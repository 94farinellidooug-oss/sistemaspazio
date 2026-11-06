// @ts-nocheck
// MUSUBI · função "cobranca" do Supabase (Edge Function): pagamento do MUSUBI pela InfinitePay (Checkout Integrado).
// Como publicar: no Supabase, Edge Functions > Deploy a new function > Via Editor, nome "cobranca", cole este
// arquivo inteiro e clique em Deploy. Depois, em Details, desligue "Enforce JWT verification" (a InfinitePay
// precisa chamar o aviso de pagamento sem login; a função confere o login sozinha onde precisa).
// Segredos (Edge Functions > Secrets): INFINITEPAY_HANDLE (a InfiniteTag, sem o $) e INFINITEPAY_CHAVE
// (a chave inchk_... do Checkout Integrado). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase já fornece.
//
// Pedidos (POST, JSON):
//   { acao:'criar', clinica, plano, periodo }  com o login do administrador da clínica: cria o pedido e devolve { url }
//   { acao:'conferir', order_nsu, transaction_nsu, slug }  com login: confere na InfinitePay e devolve { pago }
//   aviso da InfinitePay (webhook, ?aviso=1): confere na InfinitePay e marca como pago
// O pagamento só é marcado depois de a InfinitePay confirmar pelo payment_check (o aviso não tem assinatura).
// Escrito em JavaScript simples (sem tipos) para rodar igual no Supabase e nos testes (node).

const INFINITEPAY = 'https://api.checkout.infinitepay.io';
// Preços em centavos: os mesmos de js/dados/planos.js. Anual = 10 meses (2 meses grátis).
export const PRECOS = { essencial:7900, profissional:14900, clinica:29900 };
export const NOMES = { essencial:'Essencial', profissional:'Profissional', clinica:'Clínica' };
export const valorDe = (plano, periodo) => PRECOS[plano] * (periodo === 'anual' ? 10 : 1);

const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const resp = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers:{ ...CORS, 'Content-Type':'application/json' } });
const erro = (status, codigo, msg) => resp(status, { erro:codigo, msg });

export function criarCobranca({ env, f = (...a) => fetch(...a), novoId = () => crypto.randomUUID() }){
  const SB = env('SUPABASE_URL'), SR = env('SUPABASE_SERVICE_ROLE_KEY');
  const HANDLE = String(env('INFINITEPAY_HANDLE') || '').replace(/^\$/, '').trim(), CHAVE = env('INFINITEPAY_CHAVE') || '';
  const SITE = (env('MUSUBI_SITE') || 'https://sistemaspazio.vercel.app').replace(/\/$/, '');
  const banco = async (caminho, { metodo = 'GET', corpo, cab = {} } = {}) => {
    const r = await f(`${SB}/rest/v1/${caminho}`, { method:metodo, headers:{ apikey:SR, Authorization:`Bearer ${SR}`, 'Content-Type':'application/json', ...cab }, body:corpo === undefined ? undefined : JSON.stringify(corpo) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) throw new Error(`banco ${r.status}: ${t.slice(0, 200)}`);
    return j;
  };
  const usuario = async req => {
    const tk = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tk || tk === SR) return null;
    const r = await f(`${SB}/auth/v1/user`, { headers:{ apikey:SR, Authorization:`Bearer ${tk}` } });
    if (!r.ok) return null;
    const u = await r.json(); return u?.id ? u : null;
  };
  // Confere na InfinitePay e, se pago, marca no banco. Devolve { pago, novo }.
  const conferir = async ({ order_nsu, transaction_nsu, slug, recibo = '' }) => {
    if (!order_nsu || !transaction_nsu || !slug) return { pago:false };
    const P = (await banco(`pagamentos?select=valor,situacao&order_nsu=eq.${encodeURIComponent(order_nsu)}`)) || [];
    if (!P.length) return { pago:false, desconhecido:true };
    if (P[0].situacao === 'pago') return { pago:true, novo:false };
    const r = await f(`${INFINITEPAY}/payment_check`, { method:'POST', headers:{ 'Content-Type':'application/json', 'X-Api-Key':CHAVE }, body:JSON.stringify({ handle:HANDLE, order_nsu, transaction_nsu, slug }) });
    const c = r.ok ? await r.json().catch(() => null) : null;
    if (!c?.success || !c?.paid || Number(c.amount) < P[0].valor) return { pago:false };
    const novo = await banco('rpc/registrar_pagamento', { metodo:'POST', corpo:{ p_order_nsu:order_nsu, p_forma:c.capture_method || '', p_valor_pago:Number(c.paid_amount) || Number(c.amount), p_recibo:recibo, p_transacao:transaction_nsu } });
    return { pago:true, novo:!!novo };
  };

  return async req => {
    if (req.method === 'OPTIONS') return new Response(null, { status:204, headers:CORS });
    if (req.method !== 'POST') return erro(405, 'metodo', 'Use POST.');
    if (!SB || !SR) return erro(500, 'configuracao', 'Servidor sem configuração.');
    let corpo = {}; try { corpo = await req.json(); } catch (e) { return erro(400, 'corpo', 'Pedido inválido.'); }
    const url = new URL(req.url);
    try {
      // Aviso da InfinitePay
      if (url.searchParams.has('aviso')) {
        const r = await conferir({ order_nsu:corpo.order_nsu, transaction_nsu:corpo.transaction_nsu, slug:corpo.invoice_slug || corpo.slug, recibo:corpo.receipt_url || '' });
        return r.desconhecido ? erro(400, 'desconhecido', 'Pedido desconhecido.') : resp(200, { ok:true, pago:r.pago });
      }
      const u = await usuario(req);
      if (!u) return erro(401, 'sem_login', 'Entre de novo para continuar.');
      if (corpo.acao === 'conferir') {
        const r = await conferir({ order_nsu:corpo.order_nsu, transaction_nsu:corpo.transaction_nsu, slug:corpo.slug, recibo:corpo.receipt_url || '' });
        return resp(200, { pago:r.pago });
      }
      if (corpo.acao !== 'criar') return erro(400, 'acao', 'Pedido inválido.');
      const { clinica, plano, periodo } = corpo;
      if (!PRECOS[plano] || !['mensal', 'anual'].includes(periodo) || !/^[0-9a-f-]{36}$/i.test(String(clinica || ''))) return erro(400, 'dados', 'Pacote ou período inválido.');
      if (!HANDLE) return erro(503, 'sem_cobranca', 'O pagamento online ainda não está ligado.');
      const M = (await banco(`membros?select=perfil&clinica_id=eq.${clinica}&user_id=eq.${u.id}&ativo=is.true`)) || [];
      if (M[0]?.perfil !== 'adm') return erro(403, 'sem_acesso', 'Só o administrador da clínica faz o pagamento.');
      const valor = valorDe(plano, periodo), order_nsu = 'musubi-' + novoId();
      await banco('pagamentos', { metodo:'POST', corpo:{ clinica_id:clinica, plano, periodo, valor, order_nsu, pedido_por:u.id }, cab:{ Prefer:'return=minimal' } });
      const r = await f(`${INFINITEPAY}/links`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({
        handle:HANDLE, order_nsu,
        items:[{ description:`MUSUBI ${NOMES[plano]} · ${periodo === 'anual' ? '12 meses' : '1 mês'}`, price:valor, quantity:1 }],
        redirect_url:`${SITE}/spazio.html`, webhook_url:`${SB}/functions/v1/cobranca?aviso=1`,
        customer:u.email ? { email:u.email } : undefined
      }) });
      const j = await r.json().catch(() => null);
      const link = j && (j.url || j.payment_url || j.link || j.checkout_url);
      if (!r.ok || !link) return erro(502, 'infinitepay', 'A InfinitePay não respondeu. Tente de novo em instantes.');
      await banco(`pagamentos?order_nsu=eq.${encodeURIComponent(order_nsu)}`, { metodo:'PATCH', corpo:{ link }, cab:{ Prefer:'return=minimal' } });
      return resp(200, { url:link, order_nsu, valor });
    } catch (e) {
      console.error(e);
      return erro(500, 'erro', 'Não deu certo agora. Tente de novo em instantes.');
    }
  };
}

// No Supabase (Deno): atende os pedidos. Nos testes (node) só as funções acima são usadas.
const D = globalThis.Deno;
if (D?.serve) D.serve(criarCobranca({ env:k => D.env.get(k) }));
