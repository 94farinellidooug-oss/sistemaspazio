// @ts-nocheck
// MUSUBI · função "cobranca" do Supabase (Edge Function): pagamento do MUSUBI pela InfinitePay (Checkout Integrado).
// Como publicar: no Supabase, Edge Functions > Deploy a new function > Via Editor, nome "cobranca", cole este
// arquivo inteiro e clique em Deploy. Depois, em Details, desligue "Enforce JWT verification" (a InfinitePay
// precisa chamar o aviso de pagamento sem login; a função confere o login sozinha onde precisa).
// Segredos (Edge Functions > Secrets): INFINITEPAY_HANDLE (a InfiniteTag, sem o $) e INFINITEPAY_CHAVE
// (a chave inchk_... do Checkout Integrado). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase já fornece.
//
// Pedidos (POST, JSON):
//   { acao:'criar', clinica, plano, periodo, aceite }  com o login do administrador da clínica: cria o pedido e devolve { url }
//   { acao:'criar', clinica, plano, teste:true }  só o dono do MUSUBI: pagamento de teste de R$ 1,00 (libera 1 mês)
//   { acao:'conferir', order_nsu, transaction_nsu, slug }  com login: confere na InfinitePay e devolve { pago }
//   { acao:'link', clinica, tag, valor, descricao }  com o login de alguém da equipe: link de pagamento de um
//     atendimento na InfiniteTag da própria clínica (o dinheiro cai na conta dela); devolve { url }. Não grava nada aqui.
//   aviso da InfinitePay (webhook, ?aviso=1): confere na InfinitePay e marca como pago
// Assinatura no cartão pelo Mercado Pago (supabase/007_mercadopago.sql; segredo MERCADOPAGO_TOKEN = Access Token
// de produção; opcional MERCADOPAGO_SEGREDO = assinatura secreta dos webhooks):
//   { acao:'assinar', clinica, plano, periodo, email, aceite }  administrador: cria a assinatura e devolve { url } do Mercado Pago
//     (periodo: mensal, anual12 = anual com pagamento mensal, anual = à vista; aceite = versão do contrato aceita)
//   { acao:'cartao', clinica }  alguém da equipe: confere no Mercado Pago, registra as cobranças aprovadas, devolve a situação
//   { acao:'cancelar_cartao', clinica, confirmarMulta }  administrador: cancela as próximas cobranças (o período pago continua);
//     no anual12 antes dos 12 meses devolve antes { confirmar, multa } para o administrador confirmar
//   aviso do Mercado Pago (webhook, ?mp=1): confere no Mercado Pago e registra
//   avisos de 7 dias antes da cobrança (?avisos=1 com o cabeçalho x-avisos = AVISOS_SEGREDO, uma vez por dia): manda
//     o e-mail pelo Resend (RESEND_CHAVE e AVISO_REMETENTE, ex.: "MUSUBI <avisos@seudominio.com.br>")
// O pagamento só é marcado depois de a InfinitePay confirmar pelo payment_check (o aviso não tem assinatura).
// Escrito em JavaScript simples (sem tipos) para rodar igual no Supabase e nos testes (node).

const INFINITEPAY = 'https://api.checkout.infinitepay.io';
const MERCADOPAGO = 'https://api.mercadopago.com';
// Situação da assinatura no Mercado Pago, em português.
export const SITUACAO_MP = { pending:'pendente', authorized:'ativa', paused:'pausada', cancelled:'cancelada' };
export const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DIA = 864e5;
// Assinatura do webhook do Mercado Pago: x-signature "ts=...,v1=..." = HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
export async function assinaturaMpOk(segredo, xSig, xReq, dataId){
  const P = Object.fromEntries(String(xSig || '').split(',').map(x => x.split('=').map(y => y.trim())));
  if (!P.ts || !P.v1) return false;
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const msg = `${dataId != null && dataId !== '' ? `id:${id};` : ''}${xReq ? `request-id:${xReq};` : ''}ts:${P.ts};`;
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const h = [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))].map(b => b.toString(16).padStart(2, '0')).join('');
  return h === String(P.v1).toLowerCase();
}
// Preços em centavos: os mesmos de js/dados/planos.js. Anual = 10 meses (2 meses grátis).
export const PRECOS = { essencial:7900, profissional:14900, clinica:29900 };
export const NOMES = { essencial:'Essencial', profissional:'Profissional', clinica:'Clínica' };
// Anual com pagamento mensal (anual12): 12 meses de compromisso com 15% de desconto, só no cartão (Mercado Pago).
export const valorDe = (plano, periodo) => periodo === 'anual12' ? Math.round(PRECOS[plano] * 0.85 / 100) * 100 : PRECOS[plano] * (periodo === 'anual' ? 10 : 1);
// Contrato de assinatura (inicio/contrato.html): o aceite desta versão é exigido e registrado em aceites.
export const CONTRATO_VERSAO = '2026-11-11';
// Multa justa do anual com pagamento mensal: devolve só o desconto recebido nos meses já pagos.
// Ciclo de 12 meses em vigor no anual com pagamento mensal: ao fim de cada ciclo renova por mais 12 (cláusula 3 do contrato).
export const cicloFidelidade = (compromissoAte, agora = Date.now()) => { if (!compromissoAte) return null;
  const fim = new Date(compromissoAte); while (fim.getTime() <= agora) fim.setMonth(fim.getMonth() + 12);
  const ini = new Date(fim); ini.setMonth(ini.getMonth() - 12); return { ini:ini.toISOString(), fim:fim.toISOString() }; };
export const multaFidelidade = (plano, mesesPagos) => Math.max(0, (PRECOS[plano] - valorDe(plano, 'anual12')) * mesesPagos);
export const VALOR_TESTE = 100; // R$ 1,00, o mínimo da InfinitePay
// Número do pedido curto, só letras e números (até 25, como o identificador do Pix): alguns bancos recusam o Pix com hífen ou longo.
export const numeroPedido = (id, prefixo = 'MSB') => (prefixo + String(id).replace(/[^0-9a-z]/gi, '')).slice(0, 25);
// Cobrar por link: a InfiniteTag da clínica (sem $) e o valor em centavos (de R$ 1,00 a R$ 100.000,00).
export const TAG_OK = /^[a-z0-9][a-z0-9_.-]{1,39}$/;
export const VALOR_LINK = { min:100, max:10000000 };
// Textos sem acento nem símbolos, para o banco ler o Pix sem problema.
const semAcento = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '-');

const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const resp = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers:{ ...CORS, 'Content-Type':'application/json' } });
const erro = (status, codigo, msg) => resp(status, { erro:codigo, msg });

export function criarCobranca({ env, f = (...a) => fetch(...a), novoId = () => crypto.randomUUID() }){
  const SB = env('SUPABASE_URL'), SR = env('SUPABASE_SERVICE_ROLE_KEY');
  const HANDLE = String(env('INFINITEPAY_HANDLE') || '').replace(/^\$/, '').trim(), CHAVE = env('INFINITEPAY_CHAVE') || '';
  const SITE = (env('MUSUBI_SITE') || 'https://sistemaspazio.vercel.app').replace(/\/$/, '');
  const MP_TOKEN = env('MERCADOPAGO_TOKEN') || '', MP_SEGREDO = env('MERCADOPAGO_SEGREDO') || '';
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

  // Mercado Pago
  const mp = async (caminho, { metodo = 'GET', corpo } = {}) => {
    const r = await f(`${MERCADOPAGO}${caminho}`, { method:metodo, headers:{ Authorization:`Bearer ${MP_TOKEN}`, 'Content-Type':'application/json' }, body:corpo === undefined ? undefined : JSON.stringify(corpo) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) { const e = new Error(`mercadopago ${r.status}: ${t.slice(0, 300)}`); e.mp = j; e.status = r.status; throw e; }
    return j;
  };
  const assinaturaDe = async clinica => ((await banco(`assinaturas?select=clinica_id,plano,teste_ate,gratis_ate,pago_ate,cartao_id,cartao_situacao,cartao_plano,cartao_periodo,cartao_valor,cartao_email,cartao_proxima,cartao_inicio,cartao_compromisso_ate,cartao_multa&clinica_id=eq.${clinica}`)) || [])[0] || null;
  const mudarAssinatura = (clinica, corpo) => banco(`assinaturas?clinica_id=eq.${clinica}`, { metodo:'PATCH', corpo, cab:{ Prefer:'return=minimal' } });
  // Uma cobrança aprovada vira pagamento (uma vez só) e estende a assinatura.
  const registrarCobrancaMp = async (A, ap) => {
    if (ap?.payment?.status !== 'approved') return false;
    const order_nsu = numeroPedido(ap.id, 'MPA');
    if (((await banco(`pagamentos?select=situacao&order_nsu=eq.${order_nsu}`)) || []).some(p => p.situacao === 'pago')) return false;
    const valor = Math.round(Number(ap.transaction_amount) * 100) || A.cartao_valor || 0;
    if (!((await banco(`pagamentos?select=situacao&order_nsu=eq.${order_nsu}`)) || []).length)
      await banco('pagamentos', { metodo:'POST', corpo:{ clinica_id:A.clinica_id, plano:A.cartao_plano || A.plano, periodo:A.cartao_periodo === 'anual' ? 'anual' : 'mensal', valor:Math.max(valor, 100), order_nsu, meio:'mercadopago', forma:'credit_card' }, cab:{ Prefer:'return=minimal' } });
    return !!(await banco('rpc/registrar_pagamento', { metodo:'POST', corpo:{ p_order_nsu:order_nsu, p_forma:'credit_card', p_valor_pago:valor, p_recibo:'', p_transacao:String(ap.payment.id || '') } }));
  };
  // Confere a assinatura da clínica no Mercado Pago: situação, próxima cobrança e cobranças aprovadas.
  const sincronizarMp = async A => {
    if (!A?.cartao_id || !MP_TOKEN) return A;
    const p = await mp(`/preapproval/${encodeURIComponent(A.cartao_id)}`);
    const busca = await mp(`/authorized_payments/search?preapproval_id=${encodeURIComponent(A.cartao_id)}`).catch(() => null);
    let novos = 0;
    for (const ap of busca?.results || []) if (await registrarCobrancaMp(A, ap)) novos++;
    const mudou = { cartao_situacao:SITUACAO_MP[p?.status] || A.cartao_situacao, cartao_proxima:p?.next_payment_date || null };
    await mudarAssinatura(A.clinica_id, mudou);
    return { ...A, ...mudou, novos };
  };
  const NOME_PERIODO = { mensal:'mensal', anual12:'anual com pagamento mensal', anual:'anual à vista' };
  // Aceite do contrato: quem, quando e qual versão (supabase/008_contrato.sql).
  const registrarAceite = (clinica, u, plano, periodo, meio) => banco('aceites', { metodo:'POST', corpo:{ clinica_id:clinica, user_id:u.id, email:u.email || '', versao:CONTRATO_VERSAO, plano, periodo, meio }, cab:{ Prefer:'return=minimal' } });
  // Meses já pagos no cartão desde o início da assinatura atual (para a multa justa do anual com pagamento mensal).
  const mesesPagosCartao = async (A, desde) => ((await banco(`pagamentos?select=id&clinica_id=eq.${A.clinica_id}&meio=eq.mercadopago&situacao=eq.pago${desde ? `&pago_em=gte.${encodeURIComponent(desde)}` : ''}`)) || []).length;
  const situacaoCartao = A => ({ situacao:A?.cartao_situacao || '', plano:A?.cartao_plano || '', periodo:A?.cartao_periodo || '', valor:A?.cartao_valor || null, proxima:A?.cartao_proxima || null, compromisso:A?.cartao_periodo === 'anual12' && A?.cartao_situacao !== 'cancelada' ? cicloFidelidade(A.cartao_compromisso_ate)?.fim || null : A?.cartao_compromisso_ate || null, multa:A?.cartao_multa || 0, email:A?.cartao_email || '', novos:A?.novos || 0 });
  const perfilDe = async (clinica, u) => ((await banco(`membros?select=perfil&clinica_id=eq.${clinica}&user_id=eq.${u.id}&ativo=is.true`)) || [])[0]?.perfil || '';
  const idOk = c => /^[0-9a-f-]{36}$/i.test(String(c || ''));

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
      // Aviso do Mercado Pago: só diz o que mudou; a função confere tudo no próprio Mercado Pago.
      if (url.searchParams.has('mp')) {
        const dataId = url.searchParams.get('data.id') || corpo?.data?.id || '', tipo = corpo?.type || url.searchParams.get('type') || '';
        if (MP_SEGREDO && !(await assinaturaMpOk(MP_SEGREDO, req.headers.get('x-signature'), req.headers.get('x-request-id'), dataId))) return erro(401, 'assinatura', 'Aviso sem assinatura válida.');
        if (!MP_TOKEN || !dataId) return resp(200, { ok:true });
        let cartaoId = '';
        if (tipo === 'subscription_preapproval') cartaoId = String(dataId);
        else if (tipo === 'subscription_authorized_payment') cartaoId = String((await mp(`/authorized_payments/${encodeURIComponent(dataId)}`))?.preapproval_id || '');
        if (cartaoId) { const A = ((await banco(`assinaturas?select=clinica_id,plano,cartao_id,cartao_situacao,cartao_plano,cartao_periodo,cartao_valor,cartao_email,cartao_proxima&cartao_id=eq.${encodeURIComponent(cartaoId)}`)) || [])[0]; if (A) await sincronizarMp(A); }
        return resp(200, { ok:true });
      }
      // Aviso por e-mail 7 dias antes de cada cobrança no cartão (chamado uma vez por dia pelo agendador do Supabase).
      if (url.searchParams.has('avisos')) {
        const S = env('AVISOS_SEGREDO') || '';
        if (!S || req.headers.get('x-avisos') !== S) return erro(401, 'sem_acesso', 'Sem acesso.');
        const CH = env('RESEND_CHAVE') || '', DE = env('AVISO_REMETENTE') || '';
        if (!CH || !DE) return resp(200, { enviados:0, msg:'E-mail ainda não configurado.' });
        const agora = Date.now(), de = new Date(agora + 6 * DIA).toISOString(), ate = new Date(agora + 8 * DIA).toISOString();
        const L = (await banco(`assinaturas?select=clinica_id,cartao_email,cartao_valor,cartao_plano,cartao_periodo,cartao_proxima,cartao_aviso_para&cartao_situacao=eq.ativa&cartao_proxima=gte.${de}&cartao_proxima=lte.${ate}`)) || [];
        let enviados = 0;
        for (const A of L) {
          if (!A.cartao_email || (A.cartao_aviso_para && new Date(A.cartao_aviso_para).getTime() === new Date(A.cartao_proxima).getTime())) continue;
          const dia = new Date(A.cartao_proxima).toLocaleDateString('pt-BR', { timeZone:'America/Sao_Paulo' }), valor = ((A.cartao_valor || 0) / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
          const r = await f('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${CH}`, 'Content-Type':'application/json' }, body:JSON.stringify({
            from:DE, to:[A.cartao_email], subject:`MUSUBI: cobrança de ${valor} em ${dia}`,
            text:`Olá!\n\nEste é um aviso de que a assinatura do MUSUBI (pacote ${NOMES[A.cartao_plano] || ''}, ${NOME_PERIODO[A.cartao_periodo] || 'mensal'}) será cobrada no seu cartão em ${dia}, no valor de ${valor}, pelo Mercado Pago.\n\nNão é preciso fazer nada. Para trocar de pacote ou cancelar, entre no MUSUBI em Configurações > Sua conta: ${SITE}/sistema\n\nEquipe MUSUBI`
          }) });
          if (r.ok) { enviados++; await mudarAssinatura(A.clinica_id, { cartao_aviso_para:A.cartao_proxima }); }
        }
        return resp(200, { enviados });
      }
      const u = await usuario(req);
      if (!u) return erro(401, 'sem_login', 'Entre de novo para continuar.');
      if (corpo.acao === 'assinar') {
        const { clinica, plano, periodo } = corpo, email = String(corpo.email || u.email || '').trim().toLowerCase();
        if (!PRECOS[plano] || !['mensal', 'anual12', 'anual'].includes(periodo) || !idOk(clinica)) return erro(400, 'dados', 'Pacote ou período inválido.');
        if (corpo.aceite !== CONTRATO_VERSAO) return erro(400, 'aceite', 'Para assinar, leia e aceite o Contrato de assinatura (se a página estiver aberta há muito tempo, recarregue).');
        if (!EMAIL_OK.test(email)) return erro(400, 'email', 'Confira o e-mail da sua conta no Mercado Pago.');
        if (!MP_TOKEN) return erro(503, 'sem_cartao', 'A assinatura no cartão ainda não está ligada.');
        if (await perfilDe(clinica, u) !== 'adm') return erro(403, 'sem_acesso', 'Só o administrador da clínica faz a assinatura.');
        const A = await assinaturaDe(clinica);
        // Trocar de pacote ou de cartão: a assinatura anterior para de cobrar.
        if (A?.cartao_id && ['ativa', 'pendente', 'pausada'].includes(A.cartao_situacao)) await mp(`/preapproval/${encodeURIComponent(A.cartao_id)}`, { metodo:'PUT', corpo:{ status:'cancelled' } }).catch(() => null);
        const valor = valorDe(plano, periodo), t = d => d ? new Date(d).getTime() : 0;
        // A primeira cobrança fica para quando acabar o que já está pago, o teste ou o acesso grátis.
        const inicio = Math.max(t(A?.pago_ate), t(A?.teste_ate), t(A?.gratis_ate));
        const auto = { frequency:periodo === 'anual' ? 12 : 1, frequency_type:'months', transaction_amount:valor / 100, currency_id:'BRL' };
        if (inicio > Date.now() + 36e5) auto.start_date = new Date(inicio).toISOString();
        let p;
        try { p = await mp('/preapproval', { metodo:'POST', corpo:{ reason:`MUSUBI ${NOMES[plano]} (${NOME_PERIODO[periodo]})`, external_reference:clinica, payer_email:email, back_url:`${SITE}/sistema`, status:'pending', auto_recurring:auto } }); }
        catch (e) { console.error(e); return erro(502, 'mercadopago', `O Mercado Pago não criou a assinatura.${e.mp?.message ? ` (Motivo: ${String(e.mp.message).slice(0, 160)})` : ''}`); }
        if (!p?.init_point) return erro(502, 'mercadopago', 'O Mercado Pago não devolveu o endereço da assinatura. Tente de novo.');
        const comeca = auto.start_date || new Date().toISOString(), fim = new Date(comeca); fim.setMonth(fim.getMonth() + 12);
        await mudarAssinatura(clinica, { cartao_id:String(p.id), cartao_situacao:'pendente', cartao_plano:plano, cartao_periodo:periodo, cartao_valor:valor, cartao_email:email, cartao_proxima:p.next_payment_date || auto.start_date || null, cartao_aviso_para:null,
          cartao_inicio:comeca, cartao_compromisso_ate:periodo === 'anual12' ? fim.toISOString() : null, cartao_multa:0 });
        await registrarAceite(clinica, u, plano, periodo, 'mercadopago');
        return resp(200, { url:p.init_point, valor });
      }
      if (corpo.acao === 'cartao' || corpo.acao === 'cancelar_cartao') {
        const { clinica } = corpo; if (!idOk(clinica)) return erro(400, 'dados', 'Pedido inválido.');
        const perfil = await perfilDe(clinica, u);
        if (!perfil) return erro(403, 'sem_acesso', 'Você não faz parte desta clínica.');
        let A = await assinaturaDe(clinica);
        if (corpo.acao === 'cancelar_cartao') {
          if (perfil !== 'adm') return erro(403, 'sem_acesso', 'Só o administrador da clínica cancela a assinatura.');
          if (!A?.cartao_id) return resp(200, situacaoCartao(A));
          // Anual com pagamento mensal antes dos 12 meses: mostra a multa justa (o desconto já recebido) e pede confirmação.
          let multa = 0;
          const ciclo = A.cartao_periodo === 'anual12' && ['ativa', 'pausada'].includes(A.cartao_situacao) ? cicloFidelidade(A.cartao_compromisso_ate) : null;
          if (ciclo) {
            const meses = await mesesPagosCartao(A, ciclo.ini); multa = multaFidelidade(A.cartao_plano, meses);
            if (multa && corpo.confirmarMulta !== true) return resp(200, { ...situacaoCartao(A), confirmar:true, multa, meses, compromisso:ciclo.fim });
          }
          try { await mp(`/preapproval/${encodeURIComponent(A.cartao_id)}`, { metodo:'PUT', corpo:{ status:'cancelled' } }); }
          catch (e) { console.error(e); return erro(502, 'mercadopago', 'O Mercado Pago não respondeu. Tente de novo em instantes.'); }
          await mudarAssinatura(clinica, { cartao_situacao:'cancelada', cartao_proxima:null, cartao_multa:multa }); A = { ...A, cartao_situacao:'cancelada', cartao_proxima:null, cartao_multa:multa };
          return resp(200, situacaoCartao(A));
        }
        try { A = await sincronizarMp(A); } catch (e) { console.error(e); }
        return resp(200, situacaoCartao(A));
      }
      if (corpo.acao === 'conferir') {
        const r = await conferir({ order_nsu:corpo.order_nsu, transaction_nsu:corpo.transaction_nsu, slug:corpo.slug, recibo:corpo.receipt_url || '' });
        return resp(200, { pago:r.pago });
      }
      if (corpo.acao === 'link') {
        const { clinica } = corpo, tag = String(corpo.tag || '').trim().replace(/^\$/, '').toLowerCase(), valor = Number(corpo.valor);
        if (!/^[0-9a-f-]{36}$/i.test(String(clinica || ''))) return erro(400, 'dados', 'Pedido inválido.');
        if (!TAG_OK.test(tag)) return erro(400, 'tag', 'Confira a InfiniteTag da clínica.');
        if (!Number.isInteger(valor) || valor < VALOR_LINK.min || valor > VALOR_LINK.max) return erro(400, 'valor', 'O valor do link precisa ser de pelo menos R$ 1,00.');
        const M = (await banco(`membros?select=perfil&clinica_id=eq.${clinica}&user_id=eq.${u.id}&ativo=is.true`)) || [];
        if (!M.length) return erro(403, 'sem_acesso', 'Você não faz parte desta clínica.');
        const descricao = semAcento(String(corpo.descricao || 'Atendimento')).trim().slice(0, 60) || 'Atendimento';
        const r = await f(`${INFINITEPAY}/links`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({
          handle:tag, order_nsu:numeroPedido(novoId(), 'MSL'), items:[{ description:descricao, price:valor, quantity:1 }]
        }) });
        const j = await r.json().catch(() => null);
        const link = j && (j.url || j.payment_url || j.link || j.checkout_url);
        if (!r.ok || !link) return erro(502, 'infinitepay', 'A InfinitePay não criou o link. Confira a InfiniteTag e tente de novo.');
        return resp(200, { url:link, valor });
      }
      if (corpo.acao !== 'criar') return erro(400, 'acao', 'Pedido inválido.');
      const teste = corpo.teste === true, { clinica, plano } = corpo, periodo = teste ? 'mensal' : corpo.periodo;
      if (periodo === 'anual12') return erro(400, 'periodo', 'O anual com pagamento mensal é feito pela assinatura no cartão.');
      if (!PRECOS[plano] || !['mensal', 'anual'].includes(periodo) || !/^[0-9a-f-]{36}$/i.test(String(clinica || ''))) return erro(400, 'dados', 'Pacote ou período inválido.');
      if (!teste && corpo.aceite !== CONTRATO_VERSAO) return erro(400, 'aceite', 'Para pagar, leia e aceite o Contrato de assinatura (se a página estiver aberta há muito tempo, recarregue).');
      if (!HANDLE) return erro(503, 'sem_cobranca', 'O pagamento online ainda não está ligado.');
      const M = (await banco(`membros?select=perfil&clinica_id=eq.${clinica}&user_id=eq.${u.id}&ativo=is.true`)) || [];
      if (M[0]?.perfil !== 'adm') return erro(403, 'sem_acesso', 'Só o administrador da clínica faz o pagamento.');
      if (teste && !((await banco(`donos?select=user_id&user_id=eq.${u.id}`)) || []).length) return erro(403, 'sem_acesso', 'Só o dono do MUSUBI faz o pagamento de teste.');
      const valor = teste ? VALOR_TESTE : valorDe(plano, periodo), order_nsu = numeroPedido(novoId());
      await banco('pagamentos', { metodo:'POST', corpo:{ clinica_id:clinica, plano, periodo, valor, order_nsu, pedido_por:u.id }, cab:{ Prefer:'return=minimal' } });
      if (!teste) await registrarAceite(clinica, u, plano, periodo, 'infinitepay');
      const r = await f(`${INFINITEPAY}/links`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({
        handle:HANDLE, order_nsu,
        items:[{ description:semAcento(teste ? 'MUSUBI - teste de pagamento' : `MUSUBI ${NOMES[plano]} - ${periodo === 'anual' ? '12 meses' : '1 mes'}`), price:valor, quantity:1 }],
        redirect_url:`${SITE}/sistema`, webhook_url:`${SB}/functions/v1/cobranca?aviso=1`,
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
