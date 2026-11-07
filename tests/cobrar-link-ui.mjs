// Verifica no navegador o "Cobrar por link" do Financeiro (etapa 10), com o Supabase falso: sem a conta no servidor só
// explica; o administrador informa a InfiniteTag; o botão Link cria o link do valor que falta, mostra WhatsApp do
// paciente e Copiar; o link fica guardado ("link enviado"); a recepção usa mas não troca a InfiniteTag; servidor com
// a função antiga avisa; e o celular fica sem rolagem horizontal.
// Uso: node tests/cobrar-link-ui.mjs
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
async function aparelho(nome, url, { viewport = { width:1280, height:900 }, nuvem = true } = {}){
  const ctx = await browser.newContext({ viewport, permissions:['clipboard-read', 'clipboard-write'] });
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    await route.fulfill({ status:r.status, contentType:'application/json', body:await r.text() });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
  if (nuvem) await p.addInitScript(() => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', 'nuvem'); sessionStorage.setItem('iniciado', '1'); } });
  await p.goto(BASE + url); await p.waitForTimeout(150); return p;
}
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(200); };
const entrar = async (p, email, senha) => { await p.fill('#acesso [name=email]', email); await p.fill('#acesso [name=senha]', senha); await clicar(p, '#acesso [type=submit]'); await p.waitForTimeout(150); };
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
// Marca como atendidos os horários de hoje dos exemplos, para aparecerem em A receber.
const atender = async p => { await ir(p, 'agenda'); await p.waitForSelector('#ag-l');
  for (let i = 0; i < 3 && await tem(p, '#ag-l .hor [data-s="atendido"]:not(.on)'); i++) await clicar(p, '#ag-l .hor [data-s="atendido"]:not(.on) >> nth=0'); };

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  // Sem conta no servidor: só a explicação, sem botão Link.
  { const L = await aparelho('L', url, { nuvem:false }); await atender(L); await ir(L, 'financeiro'); await L.waitForSelector('.fin-t');
    ok(await tem(L, '#f-cob', 'Com a conta no servidor') && !(await tem(L, '[data-act=fin-link]')), `${rot}: sem conta no servidor, Cobrar por link só explica`);
    await L.context().close(); }

  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' }, 'rec@x.com':{ id:'u2', senha:'segredo123', nome:'Ana' } };
  S.clinicas.length = 0; S.dados = {}; S.convites = []; S.links = []; S.semLink = false;
  const M = await aparelho('M', url);
  await entrar(M, 'maicon@x.com', 'segredo123');
  await M.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await M.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(300);
  await atender(M); await ir(M, 'financeiro'); await M.waitForSelector('.fin-t');
  ok(await tem(M, '#f-cob-ip', 'somente para quem tem conta na InfinitePay'), `${rot}: avisa que o link é só para quem tem conta na InfinitePay`);
  ok(await tem(M, '#f-tag #ft-tag') && !(await tem(M, '[data-act=fin-link]')), `${rot}: administrador vê o campo da InfiniteTag e ainda sem botão Link`);
  await M.fill('#ft-tag', 'a b'); await clicar(M, '#f-tag button.pri');
  ok(await tem(M, '#f-tag') && await tem(M, '.toast, #toast', 'Confira a InfiniteTag'), `${rot}: InfiniteTag inválida não é salva`);
  await M.fill('#ft-tag', '$Spazio.Clinica'); await clicar(M, '#f-tag button.pri');
  ok(await tem(M, '#f-cob', '$spazio.clinica') && await M.locator('#f-arec [data-act=fin-link]').count() >= 1, `${rot}: InfiniteTag salva; botão Link em A receber`);

  const ap = await M.locator('#f-arec .fin-l >> nth=0').getAttribute('data-ap');
  const falta = (await M.locator(`#f-arec .fin-l[data-ap="${ap}"] .fin-v`).innerText()).trim();
  await clicar(M, `#f-arec .fin-l[data-ap="${ap}"] [data-act=fin-link]`); await M.waitForTimeout(300);
  const pedido = S.links.at(-1);
  ok(S.links.length === 1 && pedido.tag === 'spazio.clinica' && 'R$ ' + (pedido.valor / 100).toFixed(2).replace('.', ',') === falta.replace(/ /g, ' ') && pedido.descricao.includes(' - '), `${rot}: o link é pedido na InfiniteTag da clínica com o valor que falta`);
  const href = await M.locator('#fin-link a.wa').getAttribute('href');
  ok(await M.inputValue('#fin-link-u') === 'https://checkout.infinitepay.io/spazio.clinica/l1' && /^https:\/\/wa\.me\/\d*\?text=/.test(href) && decodeURIComponent(href).includes('l1') && decodeURIComponent(href).includes('Pix'), `${rot}: mostra o link com Enviar pelo WhatsApp (mensagem com o link) e Copiar`);
  await clicar(M, '[data-act=fin-link-copiar]');
  ok(await M.evaluate(() => navigator.clipboard.readText()) === 'https://checkout.infinitepay.io/spazio.clinica/l1', `${rot}: Copiar link copia o endereço`);
  await clicar(M, '[data-act=fin-link-x]');
  ok(!(await tem(M, '#fin-link')) && await tem(M, `#f-arec .fin-l[data-ap="${ap}"]`, 'link enviado'), `${rot}: fechado, a linha mostra "link enviado"`);
  await clicar(M, `#f-arec .fin-l[data-ap="${ap}"] [data-act=fin-link]`);
  ok(S.links.length === 1 && await tem(M, '#fin-link'), `${rot}: abrir de novo reaproveita o mesmo link (não cria outro)`);
  await M.reload(); await M.waitForTimeout(400); await ir(M, 'financeiro');
  ok(await tem(M, `#f-arec .fin-l[data-ap="${ap}"]`, 'link enviado'), `${rot}: o link fica guardado ao recarregar`);
  // Servidor com a função antiga
  S.semLink = true;
  const ap2 = await M.locator('#f-arec .fin-l >> nth=1').getAttribute('data-ap');
  await clicar(M, `#f-arec .fin-l[data-ap="${ap2}"] [data-act=fin-link]`); await M.waitForTimeout(300);
  ok(await tem(M, '.toast, #toast', 'falta atualizar a função cobranca') && !(await tem(M, '#fin-link')), `${rot}: servidor sem a função nova avisa o que falta`);
  S.semLink = false;
  // Celular
  await M.setViewportSize({ width:390, height:844 }); await M.waitForTimeout(150);
  await clicar(M, `#f-arec .fin-l[data-ap="${ap}"] [data-act=fin-link]`);
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${rot}: celular sem rolagem horizontal com o link aberto`);

  // A recepção usa o Link, mas não troca a InfiniteTag.
  const C = S.clinicas[0]; C.membros.push({ user:'u2', perfil:'rec', ativo:true, email:'rec@x.com', nome:'Ana' });
  const R = await aparelho('R', url);
  await entrar(R, 'rec@x.com', 'segredo123'); await R.waitForTimeout(300);
  await ir(R, 'financeiro'); await R.waitForTimeout(300);
  ok(await tem(R, '#f-cob', '$spazio.clinica') && !(await tem(R, '[data-act=fin-tag]')) && await R.locator('#f-arec [data-act=fin-link]').count() >= 1, `${rot}: recepção usa o Link mas não troca a InfiniteTag`);
  await M.context().close(); await R.context().close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nO Cobrar por link passou.');
process.exit(falhas ? 1 : 0);
