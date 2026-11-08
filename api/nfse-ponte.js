// Ponte da nota fiscal (Vercel, Node). A Sefin Nacional (servidor IIS) só pede o certificado da clínica numa
// renegociação do TLS 1.2, que o Deno das Edge Functions do Supabase não faz (a conexão cai: "Connection reset by
// peer"). O Node faz. Esta ponte só transporta: recebe da função nfse do Supabase o pedido já assinado e o
// certificado, envia à Sefin e devolve a resposta. Não guarda nada.
// Só aceita endereços da Sefin Nacional (e dos parâmetros municipais do ADN) e só quem está logado no MUSUBI (confere o token no Supabase).
import https from 'node:https';

export const BASES = ['https://sefin.nfse.gov.br/SefinNacional/', 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/',
  'https://adn.nfse.gov.br/parametrizacao/', 'https://adn.producaorestrita.nfse.gov.br/parametrizacao/'];
const SUPABASE = { url:'https://lmucimqjrzjewfyhcfoh.supabase.co', chave:'sb_publishable_kRmZNwp0_Xq4jPPMgTzKKA_SyLsreZS' };

// Conexão com o certificado, em TLS 1.2 (é nele que a Sefin renegocia para pedir o certificado).
export const enviarTls = (url, { metodo, corpo, cert, chave, ca }) => new Promise((ok, falha) => {
  const u = new URL(url);
  const r = https.request({ hostname:u.hostname, port:u.port || 443, path:u.pathname + u.search, method:metodo, cert, key:chave, ca, agent:false,
    minVersion:'TLSv1.2', maxVersion:'TLSv1.2', timeout:50000,
    headers:{ Accept:'application/json', ...(corpo ? { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(corpo) } : {}) } }, res => {
    const partes = []; res.on('data', p => partes.push(p)); res.on('end', () => ok({ status:res.statusCode, texto:Buffer.concat(partes).toString('utf8') }));
  });
  r.on('timeout', () => r.destroy(new Error('A Receita demorou demais para responder.')));
  r.on('error', falha);
  if (corpo) r.write(corpo);
  r.end();
});

const lerCorpo = async req => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const partes = []; for await (const p of req) partes.push(p);
  return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
};

// f = fetch (conferir o login), bases = endereços aceitos, tls = conexão. Tudo injetável para os testes.
export function criarPonte({ f = (...a) => fetch(...a), bases = BASES, tls = enviarTls, supabase = SUPABASE } = {}){
  return async (req, res) => {
    const enviar = (status, corpo) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(corpo)); };
    if (req.method !== 'POST') return enviar(405, { erro:'metodo' });
    const tk = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!tk) return enviar(401, { erro:'sem_login' });
    let P; try { P = await lerCorpo(req); } catch (e) { return enviar(400, { erro:'corpo' }); }
    const url = String(P?.url || '');
    if (!bases.some(b => url.startsWith(b)) || /[\s#]|\.\./.test(url)) return enviar(400, { erro:'endereco' });
    if (!['GET', 'POST'].includes(P.metodo) || !P.cert || !P.chave) return enviar(400, { erro:'dados' });
    const u = await f(`${supabase.url}/auth/v1/user`, { headers:{ apikey:supabase.chave, Authorization:`Bearer ${tk}` } }).catch(() => null);
    if (!u?.ok) return enviar(401, { erro:'sem_login' });
    try { return enviar(200, await tls(url, { metodo:P.metodo, corpo:P.corpo, cert:P.cert, chave:P.chave })); }
    catch (e) { console.error('ponte', e?.message || e); return enviar(502, { erro:'conexao', msg:String(e?.message || e).slice(0, 240) }); }
  };
}

export default criarPonte();
