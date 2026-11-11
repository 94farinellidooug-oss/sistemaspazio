// Testa a função cobranca (supabase/functions/cobranca) sem rede: banco, login e InfinitePay simulados.
// Uso: node tests/cobranca.mjs
import { criarCobranca, PRECOS, valorDe, numeroPedido } from '../supabase/functions/cobranca/index.ts';
import { PLANOS } from '../js/dados/planos.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const C1 = '11111111-1111-1111-1111-111111111111';

function cenario({ handle = 'spazio', resposta = { url:'https://checkout.infinitepay.io/spazio/abc' }, check = { success:true, paid:true, amount:14900, paid_amount:14900, capture_method:'pix' } } = {}){
  const S = { donos:[], pagamentos:[], chamadas:[], registros:[], membros:[{ clinica_id:C1, user_id:'u1', perfil:'adm' }, { clinica_id:C1, user_id:'u2', perfil:'rec' }], links:[], checks:[] };
  const json = (status, j) => new Response(j === undefined ? null : JSON.stringify(j), { status });
  const f = async (url, op = {}) => {
    const u = new URL(url), corpo = op.body ? JSON.parse(op.body) : undefined; S.chamadas.push(u.pathname);
    if (u.origin === 'https://sb.test') {
      if (op.headers.apikey !== 'service') ok(false, 'banco chamado sem a chave do servidor');
      if (u.pathname === '/auth/v1/user') { const t = op.headers.Authorization.replace('Bearer ', ''); return t === 'tk-u1' ? json(200, { id:'u1', email:'adm@x.com' }) : t === 'tk-u2' ? json(200, { id:'u2', email:'rec@x.com' }) : json(401, {}); }
      if (u.pathname === '/rest/v1/donos') return json(200, S.donos.includes(u.searchParams.get('user_id').slice(3)) ? [{ user_id:u.searchParams.get('user_id').slice(3) }] : []);
      if (u.pathname === '/rest/v1/membros') { const c = u.searchParams.get('clinica_id').slice(3), us = u.searchParams.get('user_id').slice(3); return json(200, S.membros.filter(m => m.clinica_id === c && m.user_id === us)); }
      if (u.pathname === '/rest/v1/pagamentos' && op.method === 'POST') { S.pagamentos.push({ ...corpo, situacao:'aberto' }); return json(201); }
      if (u.pathname === '/rest/v1/pagamentos' && op.method === 'PATCH') { const p = S.pagamentos.find(x => x.order_nsu === u.searchParams.get('order_nsu').slice(3)); Object.assign(p, corpo); return json(204); }
      if (u.pathname === '/rest/v1/pagamentos') return json(200, S.pagamentos.filter(x => x.order_nsu === u.searchParams.get('order_nsu').slice(3)));
      if (u.pathname === '/rest/v1/rpc/registrar_pagamento') { const p = S.pagamentos.find(x => x.order_nsu === corpo.p_order_nsu); S.registros.push(corpo); if (p.situacao === 'pago') return json(200, false); p.situacao = 'pago'; return json(200, true); }
    }
    if (u.origin === 'https://api.checkout.infinitepay.io') {
      if (u.pathname === '/links') { S.links.push(corpo); return resposta ? json(200, resposta) : json(500, { error:'x' }); }
      if (u.pathname === '/payment_check') { S.checks.push({ corpo, chave:op.headers['X-Api-Key'] }); return json(200, check); }
    }
    throw new Error('rede inesperada: ' + url);
  };
  const env = k => ({ SUPABASE_URL:'https://sb.test', SUPABASE_SERVICE_ROLE_KEY:'service', INFINITEPAY_HANDLE:handle, INFINITEPAY_CHAVE:'inchk_teste' })[k];
  let n = 0;
  const h = criarCobranca({ env, f, novoId:() => 'id' + (++n) });
  const pedir = (corpo, tk, q = '') => h(new Request('https://sb.test/functions/v1/cobranca' + q, { method:'POST', headers:tk ? { Authorization:'Bearer ' + tk } : {}, body:JSON.stringify(corpo) }));
  return { S, h, pedir };
}

{ const n = numeroPedido('3f2a9c1e-7b4d-4e8a-9f10-2c3d4e5f6a7b'); ok(/^[0-9A-Za-z]{1,25}$/.test(n) && n.startsWith('MSB'), 'número do pedido curto, só letras e números (aceito pelos bancos no Pix)'); }
ok(PLANOS.every(p => PRECOS[p.k] === p.preco * 100), 'preços da função iguais aos da página e do sistema');
ok(valorDe('profissional', 'anual') === 149000, 'anual = 10 meses (2 meses grátis)');

{ const { S, pedir, h } = cenario();
  const o = await h(new Request('https://sb.test/functions/v1/cobranca', { method:'OPTIONS' }));
  ok(o.status === 204 && o.headers.get('Access-Control-Allow-Origin') === '*', 'responde ao navegador (CORS)');
  let r = await pedir({ acao:'criar', clinica:C1, plano:'profissional', periodo:'mensal' });
  ok(r.status === 401, 'sem login não cria cobrança');
  r = await pedir({ acao:'criar', clinica:C1, plano:'profissional', periodo:'mensal' }, 'tk-u2');
  ok(r.status === 403 && !S.pagamentos.length, 'só o administrador da clínica cria cobrança');
  r = await pedir({ acao:'criar', clinica:C1, plano:'ouro', periodo:'mensal' }, 'tk-u1');
  ok(r.status === 400, 'pacote inexistente é recusado');
  r = await pedir({ acao:'criar', clinica:C1, plano:'profissional', periodo:'mensal', valor:1 }, 'tk-u1');
  const j = await r.json();
  ok(r.status === 200 && j.url === 'https://checkout.infinitepay.io/spazio/abc' && j.valor === 14900, 'administrador recebe o link de pagamento');
  ok(S.pagamentos.length === 1 && S.pagamentos[0].valor === 14900 && S.pagamentos[0].order_nsu === 'MSBid1' && S.pagamentos[0].link === j.url, 'pedido guardado com o valor do servidor (não o do navegador) e o link');
  const L = S.links[0];
  ok(L.handle === 'spazio' && L.items[0].price === 14900 && L.items[0].description.includes('Profissional') && /^[\x20-\x7e]+$/.test(L.items[0].description) && L.order_nsu === 'MSBid1', 'link pedido à InfinitePay com a InfiniteTag, valor e número do pedido');
  ok(L.redirect_url === 'https://sistemaspazio.vercel.app/sistema' && L.webhook_url === 'https://sb.test/functions/v1/cobranca?aviso=1' && L.customer.email === 'adm@x.com', 'volta para o sistema e avisa a função');

  // Aviso da InfinitePay
  r = await pedir({ order_nsu:'MSBid1', transaction_nsu:'tx1', invoice_slug:'abc', amount:14900, paid_amount:14900, receipt_url:'https://recibo/1' }, null, '?aviso=1');
  ok(r.status === 200 && S.checks.length === 1 && S.checks[0].chave === 'inchk_teste' && S.checks[0].corpo.slug === 'abc' && S.checks[0].corpo.handle === 'spazio', 'aviso é conferido na InfinitePay com a chave');
  ok(S.registros.length === 1 && S.registros[0].p_forma === 'pix' && S.registros[0].p_recibo === 'https://recibo/1' && S.pagamentos[0].situacao === 'pago', 'pagamento confirmado é registrado');
  r = await pedir({ order_nsu:'MSBid1', transaction_nsu:'tx1', invoice_slug:'abc' }, null, '?aviso=1');
  ok(r.status === 200 && S.checks.length === 1, 'aviso repetido não confere de novo');
  r = await pedir({ order_nsu:'nao-existe', transaction_nsu:'tx', invoice_slug:'x' }, null, '?aviso=1');
  ok(r.status === 400, 'aviso de pedido desconhecido é recusado');
  // Volta do comprador
  r = await pedir({ acao:'conferir', order_nsu:'MSBid1', transaction_nsu:'tx1', slug:'abc' }, 'tk-u1');
  ok((await r.json()).pago === true, 'na volta ao sistema, conferir mostra pago');
}
{ const { S, pedir } = cenario({ check:{ success:true, paid:true, amount:100, paid_amount:100, capture_method:'pix' } });
  S.donos = ['u1'];
  let r = await pedir({ acao:'criar', clinica:C1, plano:'profissional', periodo:'anual', teste:true }, 'tk-u1');
  const j = await r.json();
  ok(r.status === 200 && j.valor === 100 && S.pagamentos[0].valor === 100 && S.pagamentos[0].periodo === 'mensal' && S.links[0].items[0].price === 100 && S.links[0].items[0].description.includes('teste'), 'dono faz pagamento de teste de R$ 1,00 (sempre mensal)');
  await pedir({ order_nsu:'MSBid1', transaction_nsu:'tx1', invoice_slug:'abc' }, null, '?aviso=1');
  ok(S.registros.length === 1 && S.pagamentos[0].situacao === 'pago', 'pagamento de teste confirmado é registrado');
  S.donos = [];
  r = await pedir({ acao:'criar', clinica:C1, plano:'profissional', periodo:'mensal', teste:true }, 'tk-u1');
  ok(r.status === 403 && S.pagamentos.length === 1, 'quem não é dono do MUSUBI não faz pagamento de teste');
}
{ const { S, pedir } = cenario({ check:{ success:true, paid:false, amount:14900 } });
  await pedir({ acao:'criar', clinica:C1, plano:'profissional', periodo:'mensal' }, 'tk-u1');
  const r = await pedir({ order_nsu:'MSBid1', transaction_nsu:'tx1', invoice_slug:'abc', paid_amount:14900 }, null, '?aviso=1');
  ok(r.status === 200 && !S.registros.length && S.pagamentos[0].situacao === 'aberto', 'aviso falso (InfinitePay diz não pago) não libera nada');
}
{ const { S, pedir } = cenario({ check:{ success:true, paid:true, amount:100, paid_amount:100 } });
  await pedir({ acao:'criar', clinica:C1, plano:'profissional', periodo:'anual' }, 'tk-u1');
  await pedir({ order_nsu:'MSBid1', transaction_nsu:'tx1', invoice_slug:'abc' }, null, '?aviso=1');
  ok(!S.registros.length, 'pagamento de valor menor que o pedido não libera');
}
{ const { S, pedir } = cenario({ handle:'' });
  const r = await pedir({ acao:'criar', clinica:C1, plano:'essencial', periodo:'mensal' }, 'tk-u1');
  ok(r.status === 503 && (await r.json()).erro === 'sem_cobranca' && !S.pagamentos.length, 'sem InfiniteTag configurada: avisa que o pagamento online não está ligado');
}
{ const { pedir } = cenario({ resposta:null });
  const r = await pedir({ acao:'criar', clinica:C1, plano:'essencial', periodo:'mensal' }, 'tk-u1');
  ok(r.status === 502, 'InfinitePay fora do ar: avisa para tentar de novo');
}
{ const { pedir } = cenario({ resposta:{ payment_url:'https://pay/x' } });
  const r = await pedir({ acao:'criar', clinica:C1, plano:'essencial', periodo:'mensal' }, 'tk-u1');
  ok((await r.json()).url === 'https://pay/x', 'aceita o link também como payment_url');
}
// Cobrar por link: na InfiniteTag da clínica, por qualquer pessoa da equipe, sem gravar pagamento do MUSUBI.
{ const { S, pedir } = cenario({ handle:'' });
  let r = await pedir({ acao:'link', clinica:C1, tag:'$Clinica.Ana', valor:15000, descricao:'Acupuntura · 07/11' });
  ok(r.status === 401, 'cobrar por link: sem login não cria');
  r = await pedir({ acao:'link', clinica:C1, tag:'$Clinica.Ana', valor:15000, descricao:'Acupuntura · 07/11' }, 'tk-u2');
  const j = await r.json(), L = S.links[0];
  ok(r.status === 200 && j.url === 'https://checkout.infinitepay.io/spazio/abc' && j.valor === 15000, 'cobrar por link: a recepção também cria o link (mesmo sem a InfiniteTag do MUSUBI)');
  ok(L.handle === 'clinica.ana' && L.items[0].price === 15000 && /^[\x20-\x7e]+$/.test(L.items[0].description) && L.order_nsu.startsWith('MSL') && !L.webhook_url, 'cobrar por link: vai para a InfiniteTag da clínica, sem acento e sem aviso para o MUSUBI');
  ok(!S.pagamentos.length, 'cobrar por link: não vira pagamento do pacote do MUSUBI');
  r = await pedir({ acao:'link', clinica:C1, tag:'a b', valor:15000 }, 'tk-u1');
  ok(r.status === 400 && (await r.json()).erro === 'tag', 'cobrar por link: InfiniteTag inválida é recusada');
  r = await pedir({ acao:'link', clinica:C1, tag:'ana', valor:50 }, 'tk-u1');
  ok(r.status === 400 && (await r.json()).erro === 'valor', 'cobrar por link: valor abaixo de R$ 1,00 é recusado');
  r = await pedir({ acao:'link', clinica:'22222222-2222-2222-2222-222222222222', tag:'ana', valor:15000 }, 'tk-u1');
  ok(r.status === 403 && S.links.length === 1, 'cobrar por link: quem não é da clínica não cria');
}
{ const { pedir } = cenario({ resposta:null });
  const r = await pedir({ acao:'link', clinica:C1, tag:'ana', valor:15000 }, 'tk-u1');
  ok(r.status === 502, 'cobrar por link: InfinitePay recusou (tag errada) avisa para conferir');
}

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA função de cobrança passou.');
process.exit(falhas ? 1 : 0);
