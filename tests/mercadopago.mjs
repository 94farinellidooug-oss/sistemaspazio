// Assinatura no cartão pelo Mercado Pago (função cobranca): criar, conferir, registrar cobranças, cancelar,
// aviso do Mercado Pago com assinatura e e-mail 7 dias antes. Sem rede: banco, login, Mercado Pago e Resend simulados.
// Uso: node tests/mercadopago.mjs
import { createHmac } from 'node:crypto';
import { criarCobranca, assinaturaMpOk } from '../supabase/functions/cobranca/index.ts';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const C1 = '11111111-1111-1111-1111-111111111111', DIA = 864e5;

function cenario({ token = 'APP_USR-x', segredo = '', resend = true, pagoAte = null } = {}){
  const S = { membros:[{ clinica_id:C1, user_id:'u1', perfil:'adm' }, { clinica_id:C1, user_id:'u2', perfil:'rec' }],
    assin:{ clinica_id:C1, plano:'profissional', teste_ate:new Date(Date.now() - DIA).toISOString(), gratis_ate:null, pago_ate:pagoAte, cartao_id:'', cartao_situacao:'', cartao_plano:'', cartao_periodo:'', cartao_valor:null, cartao_email:'', cartao_proxima:null, cartao_aviso_para:null },
    pagamentos:[], registros:[], criadas:[], puts:[], mp:{}, cobrancas:[], emails:[] };
  const json = (status, j) => new Response(j === undefined ? null : JSON.stringify(j), { status });
  const eq = (u, k) => (u.searchParams.get(k) || '').replace(/^eq\./, '');
  const f = async (url, op = {}) => {
    const u = new URL(url), corpo = op.body ? JSON.parse(op.body) : undefined;
    if (u.origin === 'https://sb.test') {
      if (u.pathname === '/auth/v1/user') { const t = op.headers.Authorization.replace('Bearer ', ''); return t === 'tk-u1' ? json(200, { id:'u1', email:'adm@x.com' }) : t === 'tk-u2' ? json(200, { id:'u2', email:'rec@x.com' }) : json(401, {}); }
      if (u.pathname === '/rest/v1/membros') return json(200, S.membros.filter(m => m.clinica_id === eq(u, 'clinica_id') && m.user_id === eq(u, 'user_id')));
      if (u.pathname === '/rest/v1/assinaturas' && op.method === 'PATCH') { Object.assign(S.assin, corpo); return json(204); }
      if (u.pathname === '/rest/v1/assinaturas') {
        if (u.searchParams.get('cartao_situacao')) { const P = u.searchParams.getAll('cartao_proxima'), de = P.find(x => x.startsWith('gte.')).slice(4), ate = P.find(x => x.startsWith('lte.')).slice(4), a = S.assin;
          return json(200, a.cartao_situacao === 'ativa' && a.cartao_proxima >= de && a.cartao_proxima <= ate ? [a] : []); }
        const c = eq(u, 'clinica_id'), id = eq(u, 'cartao_id');
        return json(200, (c && S.assin.clinica_id === c) || (id && S.assin.cartao_id === id) ? [S.assin] : []);
      }
      if (u.pathname === '/rest/v1/pagamentos' && op.method === 'POST') { S.pagamentos.push({ ...corpo, situacao:'aberto' }); return json(201); }
      if (u.pathname === '/rest/v1/pagamentos') return json(200, S.pagamentos.filter(p => p.order_nsu === eq(u, 'order_nsu')));
      if (u.pathname === '/rest/v1/rpc/registrar_pagamento') { const p = S.pagamentos.find(x => x.order_nsu === corpo.p_order_nsu); S.registros.push(corpo); if (p.situacao === 'pago') return json(200, false); p.situacao = 'pago'; return json(200, true); }
    }
    if (u.origin === 'https://api.mercadopago.com') {
      if (op.headers.Authorization !== `Bearer ${token}`) ok(false, 'Mercado Pago chamado sem o Access Token');
      if (u.pathname === '/preapproval' && op.method === 'POST') { const id = 'pre' + (S.criadas.length + 1); S.criadas.push(corpo); S.mp[id] = { id, status:'pending', next_payment_date:corpo.auto_recurring.start_date || null }; return json(201, { id, init_point:`https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${id}`, status:'pending' }); }
      let m = u.pathname.match(/^\/preapproval\/(\w+)$/);
      if (m && op.method === 'PUT') { S.puts.push({ id:m[1], ...corpo }); S.mp[m[1]].status = corpo.status; return json(200, S.mp[m[1]]); }
      if (m) return json(200, S.mp[m[1]]);
      if (u.pathname === '/authorized_payments/search') return json(200, { results:S.cobrancas.filter(c => c.preapproval_id === u.searchParams.get('preapproval_id')) });
      m = u.pathname.match(/^\/authorized_payments\/(\w+)$/);
      if (m) return json(200, S.cobrancas.find(c => String(c.id) === m[1]));
    }
    if (url === 'https://api.resend.com/emails') { S.emails.push({ corpo, chave:op.headers.Authorization }); return json(200, { id:'e1' }); }
    throw new Error('rede inesperada: ' + url);
  };
  const env = k => ({ SUPABASE_URL:'https://sb.test', SUPABASE_SERVICE_ROLE_KEY:'service', MERCADOPAGO_TOKEN:token, MERCADOPAGO_SEGREDO:segredo,
    AVISOS_SEGREDO:'agenda', RESEND_CHAVE:resend ? 're_x' : '', AVISO_REMETENTE:resend ? 'MUSUBI <avisos@musubi.test>' : '' })[k];
  const h = criarCobranca({ env, f });
  const pedir = (corpo, tk, q = '', cab = {}) => h(new Request('https://sb.test/functions/v1/cobranca' + q, { method:'POST', headers:{ ...(tk ? { Authorization:'Bearer ' + tk } : {}), ...cab }, body:JSON.stringify(corpo) }));
  return { S, pedir };
}

// Assinar
{ const { S, pedir } = cenario();
  let r = await pedir({ acao:'assinar', clinica:C1, plano:'profissional', periodo:'mensal' }, 'tk-u2');
  ok(r.status === 403 && !S.criadas.length, 'só o administrador assina no cartão');
  r = await pedir({ acao:'assinar', clinica:C1, plano:'profissional', periodo:'mensal', email:'nao-e-email' }, 'tk-u1');
  ok(r.status === 400 && (await r.json()).erro === 'email', 'e-mail do Mercado Pago inválido é recusado');
  r = await pedir({ acao:'assinar', clinica:C1, plano:'profissional', periodo:'mensal', email:'Maicon@MP.com ' }, 'tk-u1');
  const j = await r.json(), A = S.criadas[0];
  ok(r.status === 200 && j.url.includes('preapproval_id=pre1'), 'administrador recebe o endereço da assinatura no Mercado Pago');
  ok(A.status === 'pending' && A.payer_email === 'maicon@mp.com' && A.external_reference === C1 && A.auto_recurring.transaction_amount === 149 && A.auto_recurring.frequency === 1 && A.auto_recurring.frequency_type === 'months' && A.auto_recurring.currency_id === 'BRL' && A.back_url === 'https://sistemaspazio.vercel.app/sistema', 'assinatura mensal de R$ 149 pedida com o e-mail, a clínica e a volta para o sistema');
  ok(!A.auto_recurring.start_date, 'teste já acabou: a primeira cobrança é na hora');
  ok(S.assin.cartao_id === 'pre1' && S.assin.cartao_situacao === 'pendente' && S.assin.cartao_valor === 14900 && S.assin.cartao_email === 'maicon@mp.com', 'assinatura guardada como pendente');

  // Concluída no Mercado Pago, primeira cobrança aprovada: conferir registra e estende o acesso.
  S.mp.pre1.status = 'authorized'; S.mp.pre1.next_payment_date = new Date(Date.now() + 30 * DIA).toISOString();
  S.cobrancas.push({ id:7001, preapproval_id:'pre1', transaction_amount:149, status:'processed', payment:{ id:555, status:'approved' } }, { id:7002, preapproval_id:'pre1', transaction_amount:149, status:'scheduled', payment:{ id:null, status:null } });
  r = await pedir({ acao:'cartao', clinica:C1 }, 'tk-u2');
  const c = await r.json();
  ok(r.status === 200 && c.situacao === 'ativa' && c.novos === 1 && c.proxima === S.mp.pre1.next_payment_date, 'conferir: assinatura ativa, com a próxima cobrança (a recepção também vê)');
  ok(S.pagamentos.length === 1 && S.pagamentos[0].order_nsu === 'MPA7001' && S.pagamentos[0].valor === 14900 && S.pagamentos[0].meio === 'mercadopago' && S.registros[0].p_forma === 'credit_card' && S.registros[0].p_transacao === '555', 'cobrança aprovada vira pagamento e estende a assinatura; a agendada não');
  await pedir({ acao:'cartao', clinica:C1 }, 'tk-u1');
  ok(S.pagamentos.length === 1 && S.registros.length === 1, 'conferir de novo não registra a mesma cobrança duas vezes');

  // Aviso do Mercado Pago de uma nova cobrança (sem segredo configurado: confere no próprio Mercado Pago).
  S.cobrancas.push({ id:7003, preapproval_id:'pre1', transaction_amount:149, status:'processed', payment:{ id:556, status:'approved' } });
  r = await pedir({ type:'subscription_authorized_payment', data:{ id:'7003' } }, null, '?mp=1');
  ok(r.status === 200 && S.pagamentos.length === 2 && S.pagamentos[1].order_nsu === 'MPA7003', 'aviso de cobrança do Mercado Pago registra o pagamento');

  // Trocar para o anual: a assinatura anterior para de cobrar.
  r = await pedir({ acao:'assinar', clinica:C1, plano:'clinica', periodo:'anual' }, 'tk-u1');
  ok(r.status === 200 && S.puts.some(p => p.id === 'pre1' && p.status === 'cancelled') && S.criadas[1].auto_recurring.frequency === 12 && S.criadas[1].auto_recurring.transaction_amount === 2990 && S.criadas[1].payer_email === 'adm@x.com', 'trocar de pacote cancela a assinatura anterior; anual = a cada 12 meses, 10 mensalidades; e-mail padrão = o do login');

  // Cancelar
  r = await pedir({ acao:'cancelar_cartao', clinica:C1 }, 'tk-u2');
  ok(r.status === 403, 'só o administrador cancela a assinatura');
  r = await pedir({ acao:'cancelar_cartao', clinica:C1 }, 'tk-u1');
  ok(r.status === 200 && (await r.json()).situacao === 'cancelada' && S.puts.at(-1).id === 'pre2' && S.puts.at(-1).status === 'cancelled' && S.assin.cartao_proxima === null, 'administrador cancela: o Mercado Pago para de cobrar');
}
// Ainda com período pago ou teste: a primeira cobrança fica para quando ele acabar.
{ const ate = new Date(Date.now() + 20 * DIA).toISOString(), { S, pedir } = cenario({ pagoAte:ate });
  await pedir({ acao:'assinar', clinica:C1, plano:'essencial', periodo:'mensal' }, 'tk-u1');
  ok(S.criadas[0].auto_recurring.start_date === ate && S.criadas[0].auto_recurring.transaction_amount === 79, 'com 20 dias pagos, a primeira cobrança é no fim do período pago');
}
// Sem o Access Token: avisa que não está ligado.
{ const { S, pedir } = cenario({ token:'' });
  const r = await pedir({ acao:'assinar', clinica:C1, plano:'profissional', periodo:'mensal' }, 'tk-u1');
  ok(r.status === 503 && (await r.json()).erro === 'sem_cartao' && !S.criadas.length, 'sem MERCADOPAGO_TOKEN: avisa que a assinatura no cartão não está ligada');
}
// Aviso do Mercado Pago com assinatura secreta
{ const segredo = 'segredo-mp', { S, pedir } = cenario({ segredo });
  await pedir({ acao:'assinar', clinica:C1, plano:'profissional', periodo:'mensal' }, 'tk-u1');
  S.mp.pre1.status = 'authorized';
  const ts = '1704908010', xr = 'req-1', v1 = createHmac('sha256', segredo).update(`id:pre1;request-id:${xr};ts:${ts};`).digest('hex');
  ok(await assinaturaMpOk(segredo, `ts=${ts},v1=${v1}`, xr, 'pre1') && !(await assinaturaMpOk(segredo, `ts=${ts},v1=${v1}`, xr, 'pre2')), 'confere a assinatura do aviso (HMAC-SHA256)');
  let r = await pedir({ type:'subscription_preapproval', data:{ id:'pre1' } }, null, '?mp=1&data.id=pre1&type=subscription_preapproval', { 'x-signature':`ts=${ts},v1=errado`, 'x-request-id':xr });
  ok(r.status === 401 && S.assin.cartao_situacao === 'pendente', 'aviso com assinatura errada é recusado');
  r = await pedir({ type:'subscription_preapproval', data:{ id:'pre1' } }, null, '?mp=1&data.id=pre1&type=subscription_preapproval', { 'x-signature':`ts=${ts},v1=${v1}`, 'x-request-id':xr });
  ok(r.status === 200 && S.assin.cartao_situacao === 'ativa', 'aviso assinado atualiza a assinatura (ativa)');
}
// E-mail 7 dias antes da cobrança
{ const { S, pedir } = cenario();
  Object.assign(S.assin, { cartao_id:'pre9', cartao_situacao:'ativa', cartao_plano:'profissional', cartao_periodo:'mensal', cartao_valor:14900, cartao_email:'maicon@mp.com', cartao_proxima:new Date(Date.now() + 7 * DIA).toISOString() });
  let r = await pedir({}, null, '?avisos=1', { 'x-avisos':'errado' });
  ok(r.status === 401 && !S.emails.length, 'avisos: sem o segredo do agendador não manda nada');
  r = await pedir({}, null, '?avisos=1', { 'x-avisos':'agenda' });
  const e = S.emails[0]?.corpo;
  ok((await r.json()).enviados === 1 && e.to[0] === 'maicon@mp.com' && e.from === 'MUSUBI <avisos@musubi.test>' && e.subject.includes('R$') && e.text.includes('149,00') && e.text.includes('Configurações'), 'aviso por e-mail 7 dias antes, com o valor, a data e como cancelar');
  r = await pedir({}, null, '?avisos=1', { 'x-avisos':'agenda' });
  ok((await r.json()).enviados === 0 && S.emails.length === 1, 'o mesmo aviso não é mandado duas vezes');
  S.assin.cartao_proxima = new Date(Date.now() + 20 * DIA).toISOString(); S.assin.cartao_aviso_para = null;
  await pedir({}, null, '?avisos=1', { 'x-avisos':'agenda' });
  ok(S.emails.length === 1, 'cobrança daqui a 20 dias ainda não é avisada');
}
{ const { S, pedir } = cenario({ resend:false });
  Object.assign(S.assin, { cartao_situacao:'ativa', cartao_email:'a@b.com', cartao_proxima:new Date(Date.now() + 7 * DIA).toISOString() });
  const r = await pedir({}, null, '?avisos=1', { 'x-avisos':'agenda' });
  ok(r.status === 200 && (await r.json()).enviados === 0 && !S.emails.length, 'sem o Resend configurado: não quebra, só não manda e-mail');
}

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA assinatura no cartão (Mercado Pago) passou.');
process.exit(falhas ? 1 : 0);
