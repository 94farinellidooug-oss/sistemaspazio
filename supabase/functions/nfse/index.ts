// @ts-nocheck
// MUSUBI · função "nfse" do Supabase (Edge Function): nota fiscal de serviço (NFS-e) pelo Padrão Nacional, direto na
// API oficial da Receita (Sefin Nacional), com o certificado digital A1 da própria clínica. Sem intermediário pago.
//
// Como publicar: no Supabase, rode antes supabase/005_nfse.sql (SQL Editor). Depois, Edge Functions > Deploy a new
// function > Via Editor, nome "nfse", cole este arquivo inteiro e clique em Deploy. Depois, em Details, desligue
// "Enforce JWT verification" (ligado, o Supabase barra a consulta prévia do navegador e o sistema mostra "Sem conexão";
// a função confere o login sozinha).
// Segredo (Edge Functions > Secrets): NFSE_SEGREDO = uma frase longa qualquer (40 letras ou mais), inventada por
// quem administra o MUSUBI e guardada só no Supabase. Ela tranca os certificados das clínicas no banco. Se for
// trocada, cada clínica precisa enviar o certificado de novo. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase
// já fornece.
//
// Pedidos (POST, JSON, com o login de alguém da clínica):
//   { acao:'situacao', clinica }  devolve { certificado:{ titular, documento, validade } | null }
//   { acao:'certificado', clinica, pfx (base64), senha }  só o administrador: lê o .pfx, confere a validade e guarda
//     a chave e o certificado cifrados (AES-GCM). A senha não é guardada. Devolve o mesmo que 'situacao'.
//   { acao:'tirar_certificado', clinica }  só o administrador
//   { acao:'emitir', clinica, ambiente:'homologacao'|'producao', nota:{...}, referencia }  qualquer pessoa ativa da
//     equipe: monta a DPS, assina, envia e devolve { id, chave, numero, ndps, ambiente, emitidaEm, ... }.
//   { acao:'conferir', clinica, id }  nota que ficou sem resposta: pergunta à Receita se a DPS virou nota.
// A Receita recusa com códigos (E0xxx); a mensagem volta para a tela como veio.
// Escrito em JavaScript simples (sem tipos) para rodar igual no Supabase e nos testes (node). A leitura do .pfx e a
// assinatura usam a biblioteca node-forge; a conexão com a Receita usa o certificado da clínica (mTLS).

export const NS = 'http://www.sped.fazenda.gov.br/nfse';
export const VERSAO = '1.01';
export const VER_APLIC = 'MUSUBI 1.0';
export const SEFIN = { producao:'https://sefin.nfse.gov.br/SefinNacional', homologacao:'https://sefin.producaorestrita.nfse.gov.br/SefinNacional' };
export const CONSULTA_PUBLICA = 'https://www.nfse.gov.br/consultapublica';
const TP_AMB = { producao:'1', homologacao:'2' };
const DS = 'http://www.w3.org/2000/09/xmldsig#';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

// ---------- Documentos ----------
export const soDigitos = v => String(v ?? '').replace(/\D/g, '');
export function cpfValido(v){
  const c = soDigitos(v); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
export function cnpjValido(v){
  const c = soDigitos(v); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { const p = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * p[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

// ---------- XML (já na forma canônica: sem espaços entre as tags, aspas duplas, tags sempre abertas e fechadas) ----------
// Caracteres que o XML não aceita saem; quebras de linha viram espaço (a forma canônica não guarda \r).
const limpo = v => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/\r\n?|\n/g, ' ').trim();
export const escTexto = v => limpo(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const el = (n, conteudo, attrs = '') => `<${n}${attrs}>${conteudo}</${n}>`;
const tx = (n, v) => v === undefined || v === null || v === '' ? '' : el(n, escTexto(v));
const reais = centavos => (Math.round(centavos) / 100).toFixed(2);
const pct = v => Number(v).toFixed(2);

// Data e hora de Brasília (-03:00), como a DPS pede.
export function dataHoraBrasilia(d = new Date()){
  const b = new Date(d.getTime() - 3 * 3600000), z = n => String(n).padStart(2, '0');
  return `${b.getUTCFullYear()}-${z(b.getUTCMonth() + 1)}-${z(b.getUTCDate())}T${z(b.getUTCHours())}:${z(b.getUTCMinutes())}:${z(b.getUTCSeconds())}-03:00`;
}

// Id da DPS: "DPS" + município (7) + tipo de inscrição (1 CPF, 2 CNPJ) + inscrição (14) + série (5) + número (15).
export function idDps({ cLocEmi, doc, serie, nDPS }){
  const d = soDigitos(doc);
  return `DPS${cLocEmi}${d.length === 14 ? '2' : '1'}${d.padStart(14, '0')}${String(serie).padStart(5, '0')}${String(nDPS).padStart(15, '0')}`;
}

export const REGIMES = { '1':'Fora do Simples Nacional', '2':'MEI', '3':'Simples Nacional (ME ou EPP)' };

// Confere os dados e monta a DPS (leiaute 1.01). Devolve { erros } ou { id, inf (infDPS canônico), xml }.
// nota = { ambiente, dhEmi, dCompet, serie, nDPS, cLocEmi,
//   prestador:{ doc, regime:'1'|'2'|'3', regEspTrib }, tomador?:{ doc, nome, email },
//   servico:{ cTribNac, descricao, cNBS }, valor (centavos),
//   tributos:{ pTotTribSN } (Simples ME/EPP) | { fed, est, mun } (fora do Simples) | nada (MEI), aliquota? (ISS %) }
export function montarDps(n){
  const E = [], P = n.prestador || {}, S = n.servico || {}, T = n.tributos || {};
  const doc = soDigitos(P.doc), regime = String(P.regime || '');
  if (!TP_AMB[n.ambiente]) E.push('Escolha homologação ou produção.');
  if (!(doc.length === 14 ? cnpjValido(doc) : cpfValido(doc))) E.push('Confira o CNPJ (ou CPF) da clínica em Configurações.');
  if (!REGIMES[regime]) E.push('Escolha o regime tributário da clínica.');
  if (!/^\d{7}$/.test(String(n.cLocEmi || ''))) E.push('Cidade da clínica sem o código do IBGE. Confira a cidade e o estado em Configurações.');
  if (!/^(\d{1,4}|[0-8]\d{4})$/.test(String(n.serie ?? '')) || Number(n.serie) < 1) E.push('Série da nota inválida.');
  if (!/^[1-9]\d{0,14}$/.test(String(n.nDPS ?? ''))) E.push('Número da DPS inválido.');
  const cTribNac = soDigitos(S.cTribNac);
  if (cTribNac.length !== 6) E.push('Confira o código do serviço (6 números, por exemplo 04.05.01).');
  if (S.cNBS && soDigitos(S.cNBS).length !== 9) E.push('O código NBS tem 9 números.');
  const desc = limpo(S.descricao);
  if (!desc) E.push('Escreva a descrição do serviço.'); else if (desc.length > 1000) E.push('A descrição do serviço passou de 1000 letras.');
  if (!Number.isInteger(n.valor) || n.valor < 1 || n.valor > 99999999999) E.push('Valor da nota inválido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.dCompet || '')) || String(n.dCompet) > String(n.dhEmi || '').slice(0, 10)) E.push('A data do atendimento não pode ser depois de hoje.');
  if (n.tomador) {
    const t = soDigitos(n.tomador.doc);
    if (!(t.length === 11 ? cpfValido(t) : t.length === 14 && cnpjValido(t))) E.push('O CPF do paciente está incorreto. Corrija no cadastro ou emita sem CPF.');
    if (!limpo(n.tomador.nome)) E.push('Falta o nome do paciente.');
  }
  let totTrib = '';
  if (regime === '2') totTrib = el('indTotTrib', '0');
  else if (regime === '3') {
    if (!(Number(T.pTotTribSN) >= 0 && Number(T.pTotTribSN) <= 100) || T.pTotTribSN === '' || T.pTotTribSN == null) E.push('Informe o percentual aproximado de tributos do Simples (Configurações > Nota fiscal).');
    else totTrib = el('pTotTribSN', pct(T.pTotTribSN));
  } else if (regime === '1') {
    if (!['fed', 'est', 'mun'].every(k => T[k] !== '' && T[k] != null && Number(T[k]) >= 0 && Number(T[k]) <= 100)) E.push('Informe os percentuais aproximados de tributos federais, estaduais e municipais (Configurações > Nota fiscal).');
    else totTrib = el('pTotTrib', el('pTotTribFed', pct(T.fed)) + el('pTotTribEst', pct(T.est)) + el('pTotTribMun', pct(T.mun)));
  }
  const aliq = n.aliquota === '' || n.aliquota == null ? null : Number(n.aliquota);
  if (aliq !== null && !(aliq > 0 && aliq <= 5)) E.push('A alíquota do ISS fica entre 0,01% e 5%.');
  if (E.length) return { erros:E };

  const id = idDps({ cLocEmi:n.cLocEmi, doc, serie:n.serie, nDPS:n.nDPS });
  const t = n.tomador, td = t && soDigitos(t.doc);
  const corpo = [
    tx('tpAmb', TP_AMB[n.ambiente]), tx('dhEmi', n.dhEmi), tx('verAplic', VER_APLIC), tx('serie', String(Number(n.serie))), tx('nDPS', String(n.nDPS)),
    tx('dCompet', n.dCompet), tx('tpEmit', '1'), tx('cLocEmi', n.cLocEmi),
    el('prest', tx(doc.length === 14 ? 'CNPJ' : 'CPF', doc) + el('regTrib', tx('opSimpNac', regime) + tx('regEspTrib', String(P.regEspTrib ?? '0')))),
    t ? el('toma', tx(td.length === 14 ? 'CNPJ' : 'CPF', td) + tx('xNome', t.nome.slice(0, 300)) + tx('email', limpo(t.email).slice(0, 80))) : '',
    el('serv', el('locPrest', tx('cLocPrestacao', n.cLocEmi)) + el('cServ', tx('cTribNac', cTribNac) + tx('xDescServ', desc) + tx('cNBS', S.cNBS ? soDigitos(S.cNBS) : ''))),
    el('valores', el('vServPrest', tx('vServ', reais(n.valor))) + el('trib',
      el('tribMun', tx('tribISSQN', '1') + tx('tpRetISSQN', '1') + (aliq !== null && regime !== '1' ? tx('pAliq', pct(aliq)) : '')) + el('totTrib', totTrib)))
  ].join('');
  // infDPS herda o namespace da DPS: na forma canônica ele aparece no próprio infDPS (é o que se assina).
  return { id, corpo, inf:`<infDPS xmlns="${NS}" Id="${escAttr(id)}">${corpo}</infDPS>`, xml:`<DPS xmlns="${NS}" versao="${VERSAO}"><infDPS Id="${escAttr(id)}">${corpo}</infDPS></DPS>` };
}

// ---------- Assinatura (XMLDSig envelopada no infDPS, RSA-SHA256, C14N) ----------
const signedInfo = (id, digest, ns) => `<SignedInfo${ns ? ` xmlns="${DS}"` : ''}><CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod><SignatureMethod Algorithm="${RSA_SHA256}"></SignatureMethod><Reference URI="#${escAttr(id)}"><Transforms><Transform Algorithm="${ENVELOPED}"></Transform><Transform Algorithm="${C14N}"></Transform></Transforms><DigestMethod Algorithm="${SHA256}"></DigestMethod><DigestValue>${digest}</DigestValue></Reference></SignedInfo>`;
export function assinarDps(dps, cert, forge){
  const sha = s => { const md = forge.md.sha256.create(); md.update(s, 'utf8'); return md; };
  const digest = forge.util.encode64(sha(dps.inf).digest().bytes());
  const chave = forge.pki.privateKeyFromPem(cert.chavePem);
  const assinatura = forge.util.encode64(chave.sign(sha(signedInfo(dps.id, digest, true))));
  const sig = `<Signature xmlns="${DS}">${signedInfo(dps.id, digest, false)}<SignatureValue>${assinatura}</SignatureValue><KeyInfo><X509Data><X509Certificate>${cert.certB64}</X509Certificate></X509Data></KeyInfo></Signature>`;
  return `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="${NS}" versao="${VERSAO}"><infDPS Id="${escAttr(dps.id)}">${dps.corpo}</infDPS>${sig}</DPS>`;
}

// ---------- Certificado A1 (.pfx / .p12) ----------
// Lê o arquivo com a senha. Devolve { chavePem, certPem (com a cadeia), certB64, titular, documento, inicio, validade }.
export function lerPfx(pfxB64, senha, forge){
  let der;
  try { der = forge.util.decode64(String(pfxB64 || '')); forge.asn1.fromDer(der, false); } catch (e) { console.error('pfx', e.message); throw new Error('arquivo'); }
  // Abre o arquivo com a senha. Alguns emissores gravam o .pfx de um jeito (BER) em que a conferência da senha
  // pelo código do arquivo (MAC) falha mesmo com a senha certa; nesse caso abre sem o MAC e só aceita se a chave
  // decifrada combinar com o certificado (com a senha errada, a chave não decifra). Também tenta sem espaços nas pontas.
  const abrir = (s, semMac) => {
    const obj = forge.asn1.fromDer(der, false);
    if (semMac && Array.isArray(obj.value) && obj.value.length > 2) obj.value = obj.value.slice(0, 2);
    const p12 = forge.pkcs12.pkcs12FromAsn1(obj, false, s);
    const bolsas = t => (p12.getBags({ bagType:t })[t] || []);
    const chaveBag = bolsas(forge.pki.oids.pkcs8ShroudedKeyBag)[0] || bolsas(forge.pki.oids.keyBag)[0];
    const certs = bolsas(forge.pki.oids.certBag).map(b => b.cert).filter(Boolean);
    if (!chaveBag?.key || !certs.length) throw new Error(chaveBag || certs.length ? 'arquivo' : 'senha');
    // O certificado do titular é o que tem a mesma chave pública.
    const titularCert = certs.find(c => c.publicKey?.n && c.publicKey.n.equals(chaveBag.key.n));
    if (!titularCert) throw new Error(semMac ? 'senha' : 'arquivo');
    return { chave:chaveBag.key, certs, titularCert };
  };
  const senhas = [...new Set([String(senha ?? ''), String(senha ?? '').trim()])];
  let A = null, ultimo = 'senha';
  for (const s of senhas) for (const semMac of [false, true]) {
    if (A) break;
    try { A = abrir(s, semMac); } catch (e) { console.error('pfx', semMac ? 'sem MAC' : 'com MAC', e.message); ultimo = e.message === 'arquivo' ? 'arquivo' : 'senha'; }
  }
  if (!A) throw new Error(ultimo);
  const { chave, certs, titularCert } = A;
  const cadeia = [titularCert, ...certs.filter(c => c !== titularCert && !(c.subject.hash === c.issuer.hash))];
  const cn = titularCert.subject.getField('CN')?.value || '';
  let documento = (cn.match(/:(\d{14}|\d{11})\s*$/) || [])[1] || '';
  if (!documento) {   // ICP-Brasil: o CNPJ (2.16.76.1.3.3) ou o CPF (2.16.76.1.3.1) também vêm no nome alternativo
    const alt = titularCert.getExtension('subjectAltName'), bruto = alt?.value || '';
    documento = (bruto.match(/\d{14}/) || [])[0] || '';
  }
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(titularCert)).getBytes();
  return {
    chavePem:forge.pki.privateKeyToPem(chave), certPem:cadeia.map(c => forge.pki.certificateToPem(c)).join(''), certB64:forge.util.encode64(certDer),
    titular:cn.replace(/:\d{11,14}\s*$/, '').trim() || cn, documento, inicio:titularCert.validity.notBefore.toISOString(), validade:titularCert.validity.notAfter.toISOString()
  };
}

// ---------- Cofre: o certificado fica cifrado no banco (AES-GCM, chave tirada do NFSE_SEGREDO) ----------
const b64 = u8 => { let s = ''; u8.forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const chaveCofre = async segredo => crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode('musubi-nfse:' + segredo)), 'AES-GCM', false, ['encrypt', 'decrypt']);
export async function cifrar(obj, segredo){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, await chaveCofre(segredo), new TextEncoder().encode(JSON.stringify(obj)));
  return { cifrado:b64(new Uint8Array(c)), iv:b64(iv) };
}
export async function decifrar({ cifrado, iv }, segredo){
  const p = await crypto.subtle.decrypt({ name:'AES-GCM', iv:deB64(iv) }, await chaveCofre(segredo), deB64(cifrado));
  return JSON.parse(new TextDecoder().decode(p));
}

// ---------- GZip + Base64 (o formato que a Sefin recebe e devolve) ----------
const juntar = async stream => new Uint8Array(await new Response(stream).arrayBuffer());
export const gzipB64 = async texto => b64(await juntar(new Blob([new TextEncoder().encode(texto)]).stream().pipeThrough(new CompressionStream('gzip'))));
export const gunzipB64 = async s => new TextDecoder().decode(await juntar(new Blob([deB64(s)]).stream().pipeThrough(new DecompressionStream('gzip'))));

// Campos da NFS-e devolvida, para mostrar e imprimir.
const tag = (xml, n) => { const m = String(xml).match(new RegExp(`<(?:\\w+:)?${n}\\b[^>]*>([^<]*)</(?:\\w+:)?${n}>`)); return m ? m[1] : ''; };
export function lerNfse(xml){
  const id = (String(xml).match(/<infNFSe[^>]*\sId="NFS(\d{50})"/) || [])[1] || '';
  return { chave:id, numero:tag(xml, 'nNFSe'), dhProc:tag(xml, 'dhProc'), codigoVerificacao:tag(xml, 'cVerif') || tag(xml, 'codVerif'), municipio:tag(xml, 'xLocEmi'), prestadorNome:(String(xml).match(/<emit>[\s\S]*?<xNome>([^<]*)<\/xNome>/) || [])[1] || '' };
}
// Erros da Sefin, em qualquer das grafias que ela usa ({erros:[{Codigo,Descricao,Complemento}]}).
export function errosSefin(j){
  const L = j && (j.erros || j.Erros || j.erro || j.Erro); const lista = Array.isArray(L) ? L : L ? [L] : [];
  return lista.map(e => ({ codigo:String(e.Codigo ?? e.codigo ?? ''), descricao:String(e.Descricao ?? e.descricao ?? e.mensagem ?? ''), complemento:String(e.Complemento ?? e.complemento ?? '') })).filter(e => e.codigo || e.descricao);
}

const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const resp = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers:{ ...CORS, 'Content-Type':'application/json' } });
const erro = (status, codigo, msg, extra = {}) => resp(status, { erro:codigo, msg, ...extra });
const UUID = /^[0-9a-f-]{36}$/i;
const MSG_CERT = { senha:'A senha do certificado não confere.', arquivo:'Não foi possível ler o arquivo. Envie o certificado A1 (.pfx ou .p12).' };

// mtls(url, { metodo, corpo }, { certPem, chavePem }) → { status, texto }: conexão com a Receita usando o certificado.
// forge: a biblioteca node-forge. agora: relógio (testes).
export function criarNfse({ env, f = (...a) => fetch(...a), forge, mtls, agora = () => new Date(), novoId = () => crypto.randomUUID() }){
  const SB = env('SUPABASE_URL'), SR = env('SUPABASE_SERVICE_ROLE_KEY'), SEGREDO = env('NFSE_SEGREDO') || '';
  const banco = async (caminho, { metodo = 'GET', corpo, cab = {} } = {}) => {
    const r = await f(`${SB}/rest/v1/${caminho}`, { method:metodo, headers:{ apikey:SR, Authorization:`Bearer ${SR}`, 'Content-Type':'application/json', ...cab }, body:corpo === undefined ? undefined : JSON.stringify(corpo) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) { const e = new Error(`banco ${r.status}: ${t.slice(0, 200)}`); e.status = r.status; throw e; }
    return j;
  };
  const usuario = async req => {
    const tk = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tk || tk === SR) return null;
    const r = await f(`${SB}/auth/v1/user`, { headers:{ apikey:SR, Authorization:`Bearer ${tk}` } });
    if (!r.ok) return null;
    const u = await r.json(); return u?.id ? u : null;
  };
  const situacao = async clinica => {
    const C = (await banco(`nfse_certificados?select=titular,documento,validade,enviado_em&clinica_id=eq.${clinica}`)) || [];
    return C[0] ? { titular:C[0].titular, documento:C[0].documento, validade:C[0].validade, enviadoEm:C[0].enviado_em } : null;
  };
  const certificadoDe = async clinica => {
    const C = (await banco(`nfse_certificados?select=cifrado,iv,documento,validade&clinica_id=eq.${clinica}`)) || [];
    if (!C[0]) return null;
    return { ...(await decifrar(C[0], SEGREDO)), documento:C[0].documento, validade:C[0].validade };
  };
  const sefin = async (ambiente, caminho, cert, corpo) => {
    const r = await mtls(SEFIN[ambiente] + caminho, { metodo:corpo ? 'POST' : 'GET', corpo:corpo ? JSON.stringify(corpo) : undefined }, cert);
    let j = null; try { j = r.texto ? JSON.parse(r.texto) : null; } catch (e) {}
    return { status:r.status, j, texto:r.texto };
  };
  // Nota autorizada: guarda e devolve o resumo.
  const autorizada = async (linha, nfseXml, chaveResp) => {
    const N = lerNfse(nfseXml), chave = N.chave || chaveResp || '';
    const mud = { situacao:'emitida', chave, numero:N.numero, xml:nfseXml, emitida_em:N.dhProc || agora().toISOString(), erros:null };
    await banco(`nfse_notas?id=eq.${linha.id}`, { metodo:'PATCH', corpo:mud, cab:{ Prefer:'return=minimal' } });
    return { id:linha.id, situacao:'emitida', chave, numero:N.numero, ndps:linha.ndps, serie:linha.serie, ambiente:linha.ambiente, emitidaEm:mud.emitida_em, codigoVerificacao:N.codigoVerificacao,
      consulta:`${CONSULTA_PUBLICA}?tpc=1&chave=${chave}` };
  };

  return async req => {
    if (req.method === 'OPTIONS') return new Response(null, { status:204, headers:CORS });
    if (req.method !== 'POST') return erro(405, 'metodo', 'Use POST.');
    if (!SB || !SR) return erro(500, 'configuracao', 'Servidor sem configuração.');
    let corpo = {}; try { corpo = await req.json(); } catch (e) { return erro(400, 'corpo', 'Pedido inválido.'); }
    try {
      const u = await usuario(req);
      if (!u) return erro(401, 'sem_login', 'Entre de novo para continuar.');
      const { clinica, acao } = corpo;
      if (!UUID.test(String(clinica || ''))) return erro(400, 'dados', 'Pedido inválido.');
      const M = (await banco(`membros?select=perfil&clinica_id=eq.${clinica}&user_id=eq.${u.id}&ativo=is.true`)) || [];
      if (!M.length) return erro(403, 'sem_acesso', 'Você não faz parte desta clínica.');
      const adm = M[0].perfil === 'adm';
      if (SEGREDO.length < 20) return erro(503, 'sem_segredo', 'A nota fiscal ainda não foi ligada no servidor (falta o segredo NFSE_SEGREDO).');

      if (acao === 'situacao') return resp(200, { certificado:await situacao(clinica) });

      if (acao === 'certificado') {
        if (!adm) return erro(403, 'sem_acesso', 'Só o administrador da clínica envia o certificado.');
        if (!corpo.pfx || String(corpo.pfx).length > 40000) return erro(400, 'arquivo', MSG_CERT.arquivo);
        let C; try { C = lerPfx(corpo.pfx, corpo.senha, forge); } catch (e) { return erro(400, e.message === 'senha' ? 'senha' : 'arquivo', MSG_CERT[e.message] || MSG_CERT.arquivo); }
        if (new Date(C.validade) <= agora()) return erro(400, 'vencido', `Este certificado venceu em ${C.validade.slice(8, 10)}/${C.validade.slice(5, 7)}/${C.validade.slice(0, 4)}. Envie um certificado dentro da validade.`);
        if (new Date(C.inicio) > agora()) return erro(400, 'arquivo', 'Este certificado ainda não começou a valer.');
        const cofre = await cifrar({ chavePem:C.chavePem, certPem:C.certPem, certB64:C.certB64 }, SEGREDO);
        await banco('nfse_certificados?on_conflict=clinica_id', { metodo:'POST', corpo:{ clinica_id:clinica, ...cofre, titular:C.titular.slice(0, 200), documento:C.documento, validade:C.validade, enviado_em:agora().toISOString(), enviado_por:u.id },
          cab:{ Prefer:'resolution=merge-duplicates,return=minimal' } });
        return resp(200, { certificado:await situacao(clinica) });
      }

      if (acao === 'tirar_certificado') {
        if (!adm) return erro(403, 'sem_acesso', 'Só o administrador da clínica tira o certificado.');
        await banco(`nfse_certificados?clinica_id=eq.${clinica}`, { metodo:'DELETE', cab:{ Prefer:'return=minimal' } });
        return resp(200, { certificado:null });
      }

      if (acao === 'emitir') {
        const n = corpo.nota || {}, ambiente = corpo.ambiente === 'producao' ? 'producao' : 'homologacao', serie = String(Number(n.serie) || 1);
        const cert = await certificadoDe(clinica);
        if (!cert) return erro(400, 'sem_certificado', 'Envie o certificado digital A1 da clínica em Configurações > Nota fiscal.');
        if (new Date(cert.validade) <= agora()) return erro(400, 'vencido', 'O certificado digital da clínica venceu. Envie o novo em Configurações > Nota fiscal.');
        if (cert.documento && soDigitos(n.prestador?.doc) !== cert.documento) return erro(400, 'documento', `O CNPJ/CPF da clínica em Configurações é diferente do certificado (${cert.documento}).`);
        // Próximo número da DPS desta clínica, série e ambiente (nunca repete, nem depois de recusa).
        const U = (await banco(`nfse_notas?select=ndps&clinica_id=eq.${clinica}&ambiente=eq.${ambiente}&serie=eq.${serie}&order=ndps.desc&limit=1`)) || [];
        let nDPS = Math.max((U[0]?.ndps || 0) + 1, Number(n.proximo) || 1);
        const dhEmi = dataHoraBrasilia(new Date(agora().getTime() - 60000));   // 1 minuto antes: relógios fora de hora
        const base = { ...n, ambiente, serie, dhEmi, dCompet:n.dCompet || dhEmi.slice(0, 10) };
        let dps = montarDps({ ...base, nDPS });
        if (dps.erros) return erro(400, 'dados', dps.erros[0], { erros:dps.erros });
        const id = novoId();
        const linha = { id, clinica_id:clinica, ambiente, serie, ndps:nDPS, id_dps:dps.id, valor:n.valor, tomador:limpo(n.tomador?.nome || '').slice(0, 200), referencia:String(corpo.referencia || '').slice(0, 80), criado_por:u.id };
        try { await banco('nfse_notas', { metodo:'POST', corpo:linha, cab:{ Prefer:'return=minimal' } }); }
        catch (e) {   // outro aparelho pegou o mesmo número agora: usa o seguinte
          if (e.status !== 409) throw e;
          nDPS += 1; dps = montarDps({ ...base, nDPS }); Object.assign(linha, { ndps:nDPS, id_dps:dps.id });
          await banco('nfse_notas', { metodo:'POST', corpo:linha, cab:{ Prefer:'return=minimal' } });
        }
        const xml = assinarDps(dps, cert, forge);
        let r;
        try { r = await sefin(ambiente, '/nfse', cert, { dpsXmlGZipB64:await gzipB64(xml) }); }
        catch (e) { console.error(e); return erro(504, 'sem_resposta', 'A Receita não respondeu. Em instantes, toque em "Conferir" para saber se a nota saiu.', { id, situacao:'enviando' }); }
        const b = r.j?.nfseXmlGZipB64 || r.j?.NfseXmlGZipB64;
        if (r.status >= 200 && r.status < 300 && b) return resp(200, await autorizada(linha, await gunzipB64(b), r.j.chaveAcesso));
        const E = errosSefin(r.j);
        if (r.status >= 400 && r.status < 500 && E.length) {
          await banco(`nfse_notas?id=eq.${id}`, { metodo:'PATCH', corpo:{ situacao:'rejeitada', erros:E }, cab:{ Prefer:'return=minimal' } });
          return erro(422, 'rejeitada', `A Receita recusou: ${E[0].codigo} ${E[0].descricao}${E[0].complemento ? ' (' + E[0].complemento + ')' : ''}`.trim(), { id, situacao:'rejeitada', erros:E });
        }
        console.error('sefin', r.status, String(r.texto).slice(0, 300));
        return erro(502, 'sem_resposta', 'A Receita respondeu com erro. Em instantes, toque em "Conferir" para saber se a nota saiu.', { id, situacao:'enviando' });
      }

      if (acao === 'conferir') {
        if (!UUID.test(String(corpo.id || ''))) return erro(400, 'dados', 'Pedido inválido.');
        const L = (await banco(`nfse_notas?select=id,ambiente,serie,ndps,id_dps,situacao,chave,numero,emitida_em,erros&clinica_id=eq.${clinica}&id=eq.${corpo.id}`)) || [];
        const linha = L[0]; if (!linha) return erro(404, 'nao_achei', 'Nota não encontrada.');
        if (linha.situacao !== 'enviando') return resp(200, { id:linha.id, situacao:linha.situacao, chave:linha.chave, numero:linha.numero, ndps:linha.ndps, serie:linha.serie, ambiente:linha.ambiente, emitidaEm:linha.emitida_em, erros:linha.erros,
          consulta:linha.chave ? `${CONSULTA_PUBLICA}?tpc=1&chave=${linha.chave}` : '' });
        const cert = await certificadoDe(clinica); if (!cert) return erro(400, 'sem_certificado', 'Envie o certificado digital A1 da clínica em Configurações > Nota fiscal.');
        const d = await sefin(linha.ambiente, `/dps/${linha.id_dps}`, cert);
        const chave = d.j?.chaveAcesso;
        if (d.status === 404 || (d.status < 300 && !chave)) {
          await banco(`nfse_notas?id=eq.${linha.id}`, { metodo:'PATCH', corpo:{ situacao:'rejeitada', erros:[{ codigo:'', descricao:'A Receita não recebeu esta nota.', complemento:'' }] }, cab:{ Prefer:'return=minimal' } });
          return resp(200, { id:linha.id, situacao:'rejeitada', msg:'A Receita não recebeu esta nota. Pode emitir de novo.' });
        }
        if (!chave) return erro(502, 'sem_resposta', 'A Receita ainda não respondeu. Tente de novo em instantes.');
        const nf = await sefin(linha.ambiente, `/nfse/${chave}`, cert);
        const b = nf.j?.nfseXmlGZipB64 || nf.j?.NfseXmlGZipB64;
        if (!b) return erro(502, 'sem_resposta', 'A Receita ainda não respondeu. Tente de novo em instantes.');
        return resp(200, await autorizada(linha, await gunzipB64(b), chave));
      }
      return erro(400, 'acao', 'Pedido inválido.');
    } catch (e) {
      console.error(e);
      if (/decrypt|operation-specific|OperationError/i.test(String(e?.message || e?.name))) return erro(500, 'cofre', 'Não foi possível abrir o certificado guardado. Envie o certificado de novo em Configurações > Nota fiscal.');
      return erro(500, 'erro', 'Não deu certo agora. Tente de novo em instantes.');
    }
  };
}

// No Supabase (Deno): conexão com o certificado da clínica e a biblioteca node-forge. Nos testes (node) só as funções acima são usadas.
const D = globalThis.Deno;
if (D?.serve) {
  const mtls = async (url, { metodo, corpo }, cert) => {
    // A Sefin Nacional só aceita HTTP/1.1 (com HTTP/2 responde "endpoint requires HTTP/1.1").
    const client = D.createHttpClient({ cert:cert.certPem, key:cert.chavePem, certChain:cert.certPem, privateKey:cert.chavePem, http1:true, http2:false });
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000);
    try {
      const r = await fetch(url, { method:metodo, headers:{ Accept:'application/json', ...(corpo ? { 'Content-Type':'application/json' } : {}) }, body:corpo, client, signal:ctl.signal });
      return { status:r.status, texto:await r.text() };
    } finally { clearTimeout(t); client.close(); }
  };
  // A biblioteca só é carregada no primeiro pedido, e qualquer falha (de início ou inesperada) volta como resposta
  // com CORS: assim o MUSUBI mostra o motivo em vez de "Sem conexão".
  let tratar = null;
  D.serve(async req => {
    if (req.method === 'OPTIONS') return new Response(null, { status:204, headers:CORS });
    try {
      if (!tratar) { const forge = (await import('npm:node-forge@1.4.2')).default; tratar = criarNfse({ env:k => D.env.get(k), forge, mtls }); }
      return await tratar(req);
    } catch (e) {
      console.error('nfse', e);
      return resp(500, { erro:'falha_funcao', msg:'A função nfse falhou ao responder: ' + String(e?.message || e).slice(0, 300) });
    }
  });
}
