// Verifica no navegador a assinatura no cartão (Mercado Pago) em Configurações > Sua conta, com o Supabase falso:
// assinar abre o Mercado Pago com o e-mail informado; ativa mostra a próxima cobrança, o aviso 7 dias antes e o
// cancelar com confirmação; a volta do Mercado Pago avisa; servidor sem a função nova explica; celular sem rolagem.
// Uso: node tests/mercadopago-ui.mjs
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { servidor } from './lib/supabase-falso.mjs';
import { NUVEM } from '../js/dados/nuvem.js';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const srv = await iniciar(0), BASE = `http://localhost:${srv.address().port}/`;
const S = servidor({ chave:NUVEM.chave });
const browser = await chromium.launch();
const erros = [];
async function aparelho(nome, url, largura = 1280){
  const ctx = await browser.newContext({ viewport:{ width:largura, height:900 } });
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    await route.fulfill({ status:r.status, contentType:'application/json', body:await r.text() });
  });
  await ctx.route('https://www.mercadopago.com.br/**', route => route.fulfill({ status:200, contentType:'text/html', body:'<h1>Mercado Pago</h1>' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
  await p.addInitScript(() => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', 'nuvem'); sessionStorage.setItem('iniciado', '1'); } });
  await p.goto(BASE + url); await p.waitForTimeout(150); return p;
}
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(250); };
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(300); };
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const abrirConta = async p => { await ir(p, 'configuracoes'); await clicar(p, '[data-cf=aba][data-k=conta]'); };

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } };
  S.clinicas.length = 0; S.dados = {}; S.mp = null;
  let M = await aparelho('M', url);
  await M.fill('#acesso [name=email]', 'maicon@x.com'); await M.fill('#acesso [name=senha]', 'segredo123'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(150);
  await M.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await M.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(400);
  await abrirConta(M);
  ok(await tem(M, '#cf-pagar [data-cf=pagar]', 'Pagar uma vez') && await tem(M, '#cf-cartao [data-cf=cartao-assinar]', 'Assinar no cartão') && await M.inputValue('#cf-cartao [data-cf=cartao-email]') === 'maicon@x.com', `${rot}: Sua conta oferece pagar uma vez (InfinitePay) e assinar no cartão (Mercado Pago), com o e-mail do login`);
  // Servidor ainda com a função antiga
  await clicar(M, '[data-cf=cartao-assinar]');
  ok(await tem(M, '#cf-pag-erro:not([hidden])', 'falta atualizar a função cobranca'), `${rot}: função antiga no servidor: explica o que falta`);
  // Assinar
  S.mp = {};
  await M.fill('#cf-cartao [data-cf=cartao-email]', 'x'); await clicar(M, '[data-cf=cartao-assinar]');
  ok(await tem(M, '#cf-pag-erro:not([hidden])', 'e-mail da sua conta no Mercado Pago') && !S.mp.assinados, `${rot}: e-mail inválido não segue`);
  await M.selectOption('[data-cf=pag-periodo]', 'anual'); await M.waitForTimeout(150);
  await M.fill('#cf-cartao [data-cf=cartao-email]', 'maicon@mp.com'); await clicar(M, '[data-cf=cartao-assinar]'); await M.waitForTimeout(500);
  ok(M.url().startsWith('https://www.mercadopago.com.br/subscriptions/checkout') && S.mp.assinados[0].email === 'maicon@mp.com' && S.mp.assinados[0].periodo === 'anual' && S.mp.assinados[0].plano === 'profissional', `${rot}: assinar abre o Mercado Pago com o pacote, o período e o e-mail`);
  // Volta do Mercado Pago, assinatura ativa com cobrança em 5 dias
  S.mp.estado = { situacao:'ativa', plano:'profissional', periodo:'mensal', valor:14900, email:'maicon@mp.com', proxima:new Date(Date.now() + 5 * 864e5).toISOString() };
  await M.goto(BASE + url + '?preapproval_id=pre1'); await M.waitForTimeout(900);
  ok(await tem(M, '#toast', 'Assinatura no cartão ativada') && !M.url().includes('preapproval_id'), `${rot}: na volta do Mercado Pago, avisa que a assinatura está ativa`);
  await abrirConta(M);
  const dia = new Date(S.mp.estado.proxima).toLocaleDateString('pt-BR');
  ok(await tem(M, '#cf-cartao.on', 'Assinatura no cartão ativa') && await tem(M, '#cf-cartao', `próxima cobrança em ${dia}`) && await tem(M, '#cf-cartao .cf-aviso', 'será cobrada no cartão'), `${rot}: ativa mostra a próxima cobrança e o aviso de 7 dias antes`);
  await clicar(M, '[data-cf=cartao-cancelar]');
  ok(await tem(M, '#cf-cartao', 'O período pago continua'), `${rot}: cancelar pede confirmação`);
  await clicar(M, '[data-cf=cartao-cancelar-sim]'); await M.waitForTimeout(300);
  ok(S.mp.estado.situacao === 'cancelada' && await tem(M, '#cf-cartao [data-cf=cartao-assinar]'), `${rot}: cancelada, volta a oferecer assinar`);
  // Ao entrar com a cobrança perto, o aviso aparece
  S.mp.estado = { ...S.mp.estado, situacao:'ativa', proxima:new Date(Date.now() + 6 * 864e5).toISOString() };
  await M.goto(BASE + url); await M.waitForTimeout(900);
  ok(await tem(M, '#toast', 'será cobrada no cartão'), `${rot}: ao entrar, 7 dias antes, avisa a cobrança`);
  // Teste grátis terminou: a tela de pagamento também oferece o cartão.
  Object.assign(S.clinicas[0].assin, { teste_ate:new Date(Date.now() - 864e5).toISOString(), pago_ate:null, gratis_ate:null, gratis_sempre:false });
  S.mp.estado = { situacao:'' }; const antes = S.mp.assinados.length;
  await M.goto(BASE + url); await M.waitForTimeout(900);
  ok(await tem(M, '#acesso [data-ac=assinar-cartao]', 'Assinar no cartão'), `${rot}: teste terminado: a tela de pagamento oferece a assinatura no cartão`);
  await clicar(M, '#acesso [data-ac=assinar-cartao]'); await M.waitForTimeout(500);
  ok(M.url().startsWith('https://www.mercadopago.com.br/') && S.mp.assinados.length === antes + 1 && S.mp.assinados.at(-1).email === 'maicon@x.com', `${rot}: assinar na tela de pagamento abre o Mercado Pago com o e-mail do login`);
  Object.assign(S.clinicas[0].assin, { pago_ate:new Date(Date.now() + 30 * 864e5).toISOString() });
  await M.goto(BASE + url); await M.waitForTimeout(900);
  await M.setViewportSize({ width:375, height:800 }); await abrirConta(M);
  ok(await semRolagem(M), `${rot}: celular sem rolagem horizontal`);
  await M.context().close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA assinatura no cartão (tela) passou.');
process.exit(falhas ? 1 : 0);
