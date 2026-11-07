// Testa a função nfse (supabase/functions/nfse) sem rede: certificado A1 de teste gerado aqui, banco, login e
// Receita (Sefin Nacional) simulados. A DPS assinada é conferida no esquema oficial (tests/nfse-xsd, leiaute 1.01,
// com o xmllint) e a assinatura é conferida por outra biblioteca (xml-crypto), independente da que assina.
// Uso: node tests/nfse.mjs
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { assinarDps, cifrar, cnpjValido, cpfValido, criarNfse, dataHoraBrasilia, decifrar, gunzipB64, gzipB64, idDps, lerNfse, lerPfx, montarDps } from '../supabase/functions/nfse/index.ts';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const C1 = '11111111-1111-1111-1111-111111111111', CNPJ = '11222333000181', CPF_P = '52998224725';

// Certificado A1 de teste (e-CNPJ: o CNPJ vem no fim do nome, como na ICP-Brasil)
function pfxDeTeste({ cn = `SPAZIO STABILITA LTDA:${CNPJ}`, senha = 'segredo-1', inicio = -1, fim = 365 } = {}){
  const k = forge.pki.rsa.generateKeyPair(2048), c = forge.pki.createCertificate();
  c.publicKey = k.publicKey; c.serialNumber = '01' + Math.floor(Math.random() * 1e8);
  c.validity.notBefore = new Date(Date.now() + inicio * 864e5); c.validity.notAfter = new Date(Date.now() + fim * 864e5);
  const nome = [{ name:'commonName', value:cn }, { name:'countryName', value:'BR' }, { name:'organizationName', value:'ICP-Brasil' }];
  c.setSubject(nome); c.setIssuer(nome); c.sign(k.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(k.privateKey, [c], senha, { algorithm:'3des' });
  return { b64:forge.util.encode64(forge.asn1.toDer(p12).getBytes()), certPem:forge.pki.certificateToPem(c) };
}
const A = pfxDeTeste();

// Documentos
ok(cnpjValido('11.222.333/0001-81') && !cnpjValido('11222333000182') && cpfValido('529.982.247-25') && !cpfValido('11111111111'), 'CPF e CNPJ conferem os dígitos');
ok(idDps({ cLocEmi:'4305108', doc:CNPJ, serie:'1', nDPS:'27' }) === 'DPS430510821122233300018100001000000000000027' && idDps({ cLocEmi:'4305108', doc:CNPJ, serie:'1', nDPS:'27' }).length === 45, 'Id da DPS com 45 posições na regra oficial');
ok(dataHoraBrasilia(new Date('2026-11-07T23:30:05Z')) === '2026-11-07T20:30:05-03:00', 'data e hora no fuso de Brasília');

// Certificado
const C = lerPfx(A.b64, 'segredo-1', forge);
ok(C.documento === CNPJ && C.titular === 'SPAZIO STABILITA LTDA' && C.chavePem.includes('PRIVATE KEY') && C.certB64.length > 500, 'lê o .pfx: titular, CNPJ, chave e certificado');
let e1 = ''; try { lerPfx(A.b64, 'errada', forge); } catch (e) { e1 = e.message; }
let e2 = ''; try { lerPfx(btoa('nao e certificado'), 'x', forge); } catch (e) { e2 = e.message; }
ok(e1 === 'senha' && e2 === 'arquivo', 'senha errada e arquivo que não é certificado são avisados');
const cof = await cifrar({ chavePem:C.chavePem }, 'frase-longa-do-servidor-123456');
ok(!cof.cifrado.includes('PRIVATE') && (await decifrar(cof, 'frase-longa-do-servidor-123456')).chavePem === C.chavePem, 'o certificado fica cifrado e só abre com o segredo do servidor');
let e3 = false; try { await decifrar(cof, 'outra-frase-qualquer-123456789'); } catch (e) { e3 = true; }
ok(e3, 'com outro segredo o certificado não abre');
ok(await gunzipB64(await gzipB64('<a>ção</a>')) === '<a>ção</a>', 'GZip + Base64 ida e volta');

// DPS
const hoje = dataHoraBrasilia(new Date()), dia = hoje.slice(0, 10);
const NOTA = { ambiente:'homologacao', dhEmi:hoje, dCompet:dia, serie:'1', nDPS:'1', cLocEmi:'4305108',
  prestador:{ doc:CNPJ, regime:'3' }, tomador:{ doc:'529.982.247-25', nome:'Ana Souza & Filhos <teste>', email:'ana@x.com' },
  servico:{ cTribNac:'04.05.01', descricao:'Sessão de acupuntura em 07/11/2026' }, valor:15000, tributos:{ pTotTribSN:'6' } };
const dps = montarDps(NOTA);
ok(!dps.erros && dps.xml.includes('<cTribNac>040501</cTribNac>') && dps.xml.includes('<vServ>150.00</vServ>') && dps.xml.includes('<pTotTribSN>6.00</pTotTribSN>') && dps.xml.includes('Ana Souza &amp; Filhos &lt;teste&gt;'), 'monta a DPS com serviço, valor, tributos e paciente');
const xml = assinarDps(dps, C, forge);
const pasta = mkdtempSync(join(tmpdir(), 'nfse-')), arq = join(pasta, 'dps.xml'); writeFileSync(arq, xml);
// O esquema oficial escreve o padrão da série com ^ e $ (como no .NET da Receita); no XSD padrão esses sinais são
// letras comuns, e o xmllint recusaria qualquer série. A cópia usada aqui tira só esses dois sinais.
for (const x of ['DPS_v1.01.xsd', 'tiposComplexos_v1.01.xsd', 'xmldsig-core-schema.xsd']) copyFileSync(join('tests/nfse-xsd', x), join(pasta, x));
writeFileSync(join(pasta, 'tiposSimples_v1.01.xsd'), readFileSync('tests/nfse-xsd/tiposSimples_v1.01.xsd', 'utf8').replace('value="^0{0,4}\\d{1,5}$"', 'value="0{0,4}\\d{1,5}"'));
const ESQUEMA = join(pasta, 'DPS_v1.01.xsd');
let xsd = '';
try { execFileSync('xmllint', ['--noout', '--nonet', '--schema', ESQUEMA, arq], { stdio:'pipe' }); xsd = 'ok'; }
catch (e) { xsd = e.code === 'ENOENT' ? 'sem xmllint' : String(e.stderr || e.message); }
if (xsd === 'sem xmllint') { if (process.env.CI) ok(false, 'xmllint precisa estar instalado no CI'); else console.log('aviso xmllint não instalado: esquema oficial não conferido aqui'); }
else ok(xsd === 'ok', 'a DPS assinada passa no esquema oficial da Receita (DPS_v1.01.xsd)' + (xsd === 'ok' ? '' : ': ' + xsd.slice(0, 300)));
const confere = x => { const s = new SignedXml({ publicCert:A.certPem }); s.loadSignature(x.match(/<Signature[\s\S]*<\/Signature>/)[0]); return s.checkSignature(x); };
ok(confere(xml), 'a assinatura confere em outra biblioteca (xml-crypto)');
ok(!confere(xml.replace('<vServ>150.00</vServ>', '<vServ>1.00</vServ>')), 'mexer no valor depois de assinar invalida a assinatura');
for (const [rot, mud, msg] of [
  ['MEI', { prestador:{ doc:CNPJ, regime:'2' }, tributos:{} }, '<indTotTrib>0</indTotTrib>'],
  ['fora do Simples', { prestador:{ doc:CNPJ, regime:'1' }, tributos:{ fed:'4.5', est:'0', mun:'2' } }, '<pTotTribFed>4.50</pTotTribFed>'],
  ['sem paciente identificado e com CPF de prestador', { prestador:{ doc:CPF_P, regime:'2' }, tomador:undefined }, `<CPF>${CPF_P}</CPF>`]]) {
  const d = montarDps({ ...NOTA, ...mud }), x = d.erros ? '' : assinarDps(d, C, forge); writeFileSync(arq, x);
  let v = 'ok'; if (xsd !== 'sem xmllint') try { execFileSync('xmllint', ['--noout', '--nonet', '--schema', ESQUEMA, arq], { stdio:'pipe' }); } catch (e) { v = String(e.stderr).slice(0, 200); }
  ok(!d.erros && x.includes(msg) && v === 'ok' && (!('tomador' in mud) || !x.includes('<toma>')), `DPS ${rot} no esquema oficial` + (v === 'ok' ? '' : ': ' + v));
}
const ruins = montarDps({ ...NOTA, prestador:{ doc:'11222333000182', regime:'3' }, tributos:{}, tomador:{ doc:'123', nome:'X' }, dCompet:'2999-01-01', servico:{ cTribNac:'45', descricao:'' } });
ok(ruins.erros?.length >= 5 && ruins.erros.some(e => e.includes('CNPJ')) && ruins.erros.some(e => e.includes('CPF do paciente')) && ruins.erros.some(e => e.includes('percentual')), 'dados errados voltam com o que corrigir, em português');

// Função completa: banco, login e Receita simulados
function cenario({ segredo = 'frase-longa-do-servidor-123456', resposta = 'ok' } = {}){
  const S = { membros:[{ clinica_id:C1, user_id:'u1', perfil:'adm', ativo:true }, { clinica_id:C1, user_id:'u2', perfil:'rec', ativo:true }], certs:[], notas:[], envios:[], resposta };
  const json = (status, j) => new Response(j === undefined ? null : JSON.stringify(j), { status });
  const filtro = (L, u) => L.filter(x => [...u.searchParams].every(([k, v]) => ['select', 'order', 'limit', 'on_conflict'].includes(k) || String(x[k]) === v.replace(/^(eq|is)\./, '')));
  const f = async (url, op = {}) => {
    const u = new URL(url), corpo = op.body ? JSON.parse(op.body) : undefined;
    if (op.headers.apikey !== 'service') ok(false, 'banco chamado sem a chave do servidor');
    if (u.pathname === '/auth/v1/user') { const t = op.headers.Authorization.replace('Bearer ', ''); return t === 'tk-u1' ? json(200, { id:'u1' }) : t === 'tk-u2' ? json(200, { id:'u2' }) : t === 'tk-u3' ? json(200, { id:'u3' }) : json(401, {}); }
    const tab = { membros:S.membros, nfse_certificados:S.certs, nfse_notas:S.notas }[u.pathname.replace('/rest/v1/', '')];
    if (!tab) throw new Error('banco inesperado: ' + url);
    const m = op.method || 'GET';
    if (m === 'GET') { const L = filtro(tab, u); if (u.searchParams.get('order') === 'ndps.desc') L.sort((a, b) => b.ndps - a.ndps); return json(200, L.slice(0, Number(u.searchParams.get('limit')) || 99)); }
    if (m === 'POST') { const i = tab.findIndex(x => tab === S.certs ? x.clinica_id === corpo.clinica_id : x.clinica_id === corpo.clinica_id && x.ambiente === corpo.ambiente && x.serie === corpo.serie && x.ndps === corpo.ndps);
      if (i >= 0 && tab === S.notas) return json(409, { message:'duplicate' }); if (i >= 0) tab[i] = corpo; else tab.push({ situacao:'enviando', ...corpo }); return json(201); }
    if (m === 'PATCH') { filtro(tab, u).forEach(x => Object.assign(x, corpo)); return json(204); }
    if (m === 'DELETE') { filtro(tab, u).forEach(x => tab.splice(tab.indexOf(x), 1)); return json(204); }
  };
  const nfseXml = (dpsXml, chave) => `<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${chave}"><xLocEmi>Caxias do Sul</xLocEmi><nNFSe>${S.notas.filter(n => n.situacao === 'emitida').length + 1}</nNFSe><dhProc>2026-11-07T20:30:00-03:00</dhProc><emit><CNPJ>${CNPJ}</CNPJ><xNome>SPAZIO STABILITA LTDA</xNome></emit>${dpsXml.replace(/^<\?xml[^>]*>/, '')}</infNFSe></NFSe>`;
  const mtls = async (url, { metodo, corpo }, cert) => {
    const u = new URL(url); S.envios.push({ url, metodo, cert:!!cert.chavePem && cert.certPem.includes('CERTIFICATE') });
    if (S.resposta === 'cair') throw new Error('timeout');
    const chave = '4305108' + '2' + '2' + CNPJ + String(S.envios.length).padStart(13, '0') + '2611' + '123456789' + '0';
    if (metodo === 'POST' && u.pathname.endsWith('/nfse')) {
      const dpsXml = await gunzipB64(JSON.parse(corpo).dpsXmlGZipB64); S.ultimoDps = dpsXml;
      if (S.resposta === 'recusa') return { status:400, texto:JSON.stringify({ erros:[{ Codigo:'E0312', Descricao:'Código de tributação nacional não administrado pelo município', Complemento:'' }] }) };
      return { status:201, texto:JSON.stringify({ tipoAmbiente:2, idDps:dpsXml.match(/Id="(DPS\d+)"/)[1], chaveAcesso:chave, nfseXmlGZipB64:await gzipB64(nfseXml(dpsXml, chave)) }) };
    }
    if (u.pathname.includes('/dps/')) return S.resposta === 'nao_recebeu' ? { status:404, texto:'' } : { status:200, texto:JSON.stringify({ chaveAcesso:chave }) };
    if (u.pathname.includes('/nfse/')) return { status:200, texto:JSON.stringify({ chaveAcesso:chave, nfseXmlGZipB64:await gzipB64(nfseXml(S.ultimoDps || '<DPS/>', chave)) }) };
    throw new Error('Receita inesperada: ' + url);
  };
  const env = k => ({ SUPABASE_URL:'https://sb.test', SUPABASE_SERVICE_ROLE_KEY:'service', NFSE_SEGREDO:segredo })[k];
  const fn = criarNfse({ env, f, forge, mtls });
  const pedir = async (tk, corpo) => { const r = await fn(new Request('https://sb.test/functions/v1/nfse', { method:'POST', headers:tk ? { authorization:`Bearer ${tk}` } : {}, body:JSON.stringify(corpo) })); return { status:r.status, j:await r.json() }; };
  return { S, pedir };
}
const { S, pedir } = cenario();
const notaPedido = { ...NOTA, dhEmi:undefined, ambiente:undefined, nDPS:undefined };
ok((await pedir(null, { acao:'situacao', clinica:C1 })).status === 401 && (await pedir('tk-u3', { acao:'situacao', clinica:C1 })).status === 403, 'sem login, ou de fora da clínica, não entra');
ok((await pedir('tk-u1', { acao:'emitir', clinica:C1, ambiente:'homologacao', nota:notaPedido })).j.erro === 'sem_certificado', 'sem certificado, pede para enviar em Configurações');
ok((await pedir('tk-u2', { acao:'certificado', clinica:C1, pfx:A.b64, senha:'segredo-1' })).status === 403, 'a recepção não envia o certificado');
ok((await pedir('tk-u1', { acao:'certificado', clinica:C1, pfx:A.b64, senha:'errada' })).j.msg === 'A senha do certificado não confere.', 'senha errada avisa sem guardar nada');
const venc = pfxDeTeste({ inicio:-400, fim:-2 });
ok((await pedir('tk-u1', { acao:'certificado', clinica:C1, pfx:venc.b64, senha:'segredo-1' })).j.erro === 'vencido' && !S.certs.length, 'certificado vencido é recusado');
const env1 = await pedir('tk-u1', { acao:'certificado', clinica:C1, pfx:A.b64, senha:'segredo-1' });
ok(env1.status === 200 && env1.j.certificado.documento === CNPJ && env1.j.certificado.titular === 'SPAZIO STABILITA LTDA', 'o administrador envia o certificado e vê titular, CNPJ e validade');
ok(S.certs.length === 1 && !JSON.stringify(S.certs).includes('PRIVATE KEY') && !JSON.stringify(S.certs).includes('segredo-1'), 'no banco o certificado fica cifrado e a senha não é guardada');
ok((await pedir('tk-u2', { acao:'situacao', clinica:C1 })).j.certificado.documento === CNPJ, 'a equipe vê a situação do certificado (sem a chave)');

const em1 = await pedir('tk-u2', { acao:'emitir', clinica:C1, ambiente:'homologacao', nota:notaPedido, referencia:'rec-1' });
ok(em1.status === 200 && em1.j.situacao === 'emitida' && em1.j.numero === '1' && em1.j.chave.length === 50 && em1.j.ndps === 1 && em1.j.consulta.includes(em1.j.chave), 'emite a nota: número, chave de acesso e link de consulta');
ok(S.envios[0].url === 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse' && S.envios[0].cert && S.ultimoDps.includes('<tpAmb>2</tpAmb>') && confere(S.ultimoDps), 'homologação vai para a produção restrita, com o certificado da clínica e a DPS assinada');
ok(S.notas[0].situacao === 'emitida' && S.notas[0].xml.includes('<nNFSe>1</nNFSe>') && S.notas[0].referencia === 'rec-1', 'a nota fica guardada no servidor com o XML');
const em2 = await pedir('tk-u1', { acao:'emitir', clinica:C1, ambiente:'homologacao', nota:notaPedido });
ok(em2.j.ndps === 2 && S.ultimoDps.includes('<nDPS>2</nDPS>'), 'o número da DPS segue em sequência');
await pedir('tk-u1', { acao:'emitir', clinica:C1, ambiente:'producao', nota:{ ...notaPedido, proximo:40 } });
ok(S.envios.at(-1).url === 'https://sefin.nfse.gov.br/SefinNacional/nfse' && S.ultimoDps.includes('<tpAmb>1</tpAmb>') && S.ultimoDps.includes('<nDPS>40</nDPS>'), 'produção vai para a Sefin de produção e respeita o número inicial');
ok((await pedir('tk-u1', { acao:'emitir', clinica:C1, ambiente:'homologacao', nota:{ ...notaPedido, prestador:{ doc:'52998224725', regime:'3' } } })).j.erro === 'documento', 'CNPJ diferente do certificado não emite');
S.resposta = 'recusa';
const rj = await pedir('tk-u1', { acao:'emitir', clinica:C1, ambiente:'homologacao', nota:notaPedido });
ok(rj.status === 422 && rj.j.msg.includes('E0312') && S.notas.find(n => n.id === rj.j.id).situacao === 'rejeitada', 'recusa da Receita volta com o código e a descrição, e fica registrada');
const depois = await pedir('tk-u1', { acao:'emitir', clinica:C1, ambiente:'homologacao', nota:{ ...notaPedido } });
ok(S.ultimoDps.includes('<nDPS>4</nDPS>'), 'número de nota recusada não é reaproveitado');
S.resposta = 'cair';
const cai = await pedir('tk-u1', { acao:'emitir', clinica:C1, ambiente:'homologacao', nota:notaPedido });
ok(cai.status === 504 && cai.j.situacao === 'enviando' && cai.j.msg.includes('Conferir'), 'sem resposta da Receita, avisa para conferir depois');
S.resposta = 'ok';
const cf = await pedir('tk-u1', { acao:'conferir', clinica:C1, id:cai.j.id });
ok(cf.j.situacao === 'emitida' && cf.j.chave.length === 50 && S.notas.find(n => n.id === cai.j.id).situacao === 'emitida', '"Conferir" acha a nota que saiu sem resposta');
ok((await pedir('tk-u1', { acao:'conferir', clinica:C1, id:cai.j.id })).j.numero === cf.j.numero, 'conferir de novo devolve a mesma nota');
const sem = await pedir('tk-u1', { acao:'emitir', clinica:C1, ambiente:'homologacao', nota:{ ...notaPedido, tributos:{} } });
ok(sem.status === 400 && sem.j.msg.includes('percentual'), 'falta de dado fiscal avisa antes de enviar');
ok((await pedir('tk-u1', { acao:'tirar_certificado', clinica:C1 })).j.certificado === null && !S.certs.length, 'o administrador tira o certificado');
const semSeg = cenario({ segredo:'' });
ok((await semSeg.pedir('tk-u1', { acao:'situacao', clinica:C1 })).j.erro === 'sem_segredo', 'sem o segredo NFSE_SEGREDO no servidor, avisa que falta ligar');
ok(lerNfse('<NFSe><infNFSe Id="NFS' + '1'.repeat(50) + '"><nNFSe>12</nNFSe></infNFSe></NFSe>').numero === '12', 'lê número e chave da nota devolvida');
void depois;

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA nota fiscal (servidor) passou.');
process.exit(falhas ? 1 : 0);
