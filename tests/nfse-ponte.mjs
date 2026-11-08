// Ponte da nota fiscal (api/nfse-ponte.js): envia à Sefin com o certificado da clínica, inclusive quando o servidor
// só pede o certificado numa renegociação do TLS 1.2 (como faz o IIS da Sefin Nacional).
import https from 'node:https';
import crypto from 'node:crypto';
import forge from 'node-forge';
import { criarPonte, enviarTls, BASES } from '../api/nfse-ponte.js';

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHA ') + m); if (!c) falhas++; };

const gerar = (cn, emissor) => {
  const k = forge.pki.rsa.generateKeyPair(2048), c = forge.pki.createCertificate();
  c.publicKey = k.publicKey; c.serialNumber = '0' + crypto.randomBytes(8).toString('hex');
  c.validity.notBefore = new Date(Date.now() - 864e5); c.validity.notAfter = new Date(Date.now() + 864e5 * 30);
  c.setSubject([{ name:'commonName', value:cn }]); c.setIssuer([{ name:'commonName', value:emissor ? emissor.cn : cn }]);
  if (!emissor) c.setExtensions([{ name:'basicConstraints', cA:true }]);
  else c.setExtensions([{ name:'subjectAltName', altNames:[{ type:2, value:'localhost' }] }]);
  c.sign(emissor ? emissor.k.privateKey : k.privateKey, forge.md.sha256.create());
  return { cn, k, pem:forge.pki.certificateToPem(c), chave:forge.pki.privateKeyToPem(k.privateKey) };
};
const ac = gerar('AC teste'), servidor = gerar('localhost', ac), clinica = gerar('CLINICA TESTE:12345678000195', ac);

// Servidor no estilo do IIS: aceita sem certificado e, só nos caminhos /SefinNacional, renegocia para pedir.
const srv = https.createServer({ key:servidor.chave, cert:servidor.pem, ca:ac.pem, requestCert:false, maxVersion:'TLSv1.2',
  secureOptions:crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION }, (req, res) => {
  const responder = () => {
    const c = req.socket.getPeerCertificate();
    let corpo = ''; req.on('data', p => corpo += p); req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ cn:c?.subject?.CN || '', metodo:req.method, caminho:req.url, corpo }));
    });
  };
  if (!req.url.startsWith('/SefinNacional')) return responder();
  req.socket.renegotiate({ requestCert:true, rejectUnauthorized:false }, e => { if (e) { res.statusCode = 500; return res.end('{}'); } responder(); });
});
await new Promise(r => srv.listen(0, r));
const base = `https://localhost:${srv.address().port}/SefinNacional/`;
const tls = (url, o) => enviarTls(url, { ...o, ca:ac.pem });

const r1 = await tls(base + 'nfse', { metodo:'POST', corpo:'{"dpsXmlGZipB64":"abc"}', cert:clinica.pem, chave:clinica.chave });
const j1 = JSON.parse(r1.texto);
ok(r1.status === 200 && j1.cn === 'CLINICA TESTE:12345678000195', 'o certificado da clínica chega à Sefin pela renegociação do TLS 1.2');
ok(j1.metodo === 'POST' && j1.caminho === '/SefinNacional/nfse' && j1.corpo === '{"dpsXmlGZipB64":"abc"}', 'o pedido chega inteiro');

// A ponte: login conferido no Supabase e só endereços da Sefin.
const resposta = () => { const R = { statusCode:0, h:{}, corpo:'' }; R.setHeader = (k, v) => { R.h[k] = v; }; R.end = t => { R.corpo = t; R.fim(); }; return R; };
const chamar = async (ponte, { metodo = 'POST', token = 'tk-bom', corpo }) => {
  const R = resposta(); const fim = new Promise(r => { R.fim = r; });
  await ponte({ method:metodo, headers:token ? { authorization:'Bearer ' + token } : {}, body:corpo }, R); await fim;
  return { status:R.statusCode, j:JSON.parse(R.corpo) };
};
const vistos = [];
const f = async (url, op) => { vistos.push(url); return { ok:op.headers.Authorization === 'Bearer tk-bom' }; };
const ponte = criarPonte({ f, bases:[base], tls });
const pedido = { url:base + 'dps/DPS123', metodo:'GET', cert:clinica.pem, chave:clinica.chave };

let r = await chamar(ponte, { corpo:pedido });
ok(r.status === 200 && r.j.status === 200 && JSON.parse(r.j.texto).caminho === '/SefinNacional/dps/DPS123', 'a ponte devolve a resposta da Sefin');
ok(vistos[0].endsWith('/auth/v1/user'), 'a ponte confere o login no Supabase');
r = await chamar(ponte, { corpo:pedido, token:'' }); ok(r.status === 401, 'sem login, recusa');
r = await chamar(ponte, { corpo:pedido, token:'tk-ruim' }); ok(r.status === 401, 'com login inválido, recusa');
r = await chamar(ponte, { corpo:{ ...pedido, url:'https://exemplo.com/SefinNacional/nfse' } }); ok(r.status === 400 && r.j.erro === 'endereco', 'só envia para a Sefin Nacional');
r = await chamar(ponte, { corpo:{ ...pedido, url:base + '../outra' } }); ok(r.status === 400, 'não aceita caminho com ..');
r = await chamar(ponte, { corpo:{ ...pedido, chave:'' } }); ok(r.status === 400, 'sem o certificado, recusa');
r = await chamar(ponte, { metodo:'GET', corpo:pedido }); ok(r.status === 405, 'só aceita POST');
ok(BASES.every(b => /^https:\/\/(sefin\.(producaorestrita\.)?nfse\.gov\.br\/SefinNacional|adn\.(producaorestrita\.)?nfse\.gov\.br\/parametrizacao)\/$/.test(b)), 'endereços reais da Sefin Nacional e do ADN');

srv.close();
if (falhas) { console.log(`\n${falhas} falha(s) na ponte da nota fiscal.`); process.exit(1); }
console.log('\nA ponte da nota fiscal passou.');
