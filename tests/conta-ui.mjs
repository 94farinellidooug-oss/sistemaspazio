// Verifica no navegador a conta no servidor (etapa 10) com um Supabase falso no lugar do real:
// tela de acesso, erros em português, criar conta, primeiro acesso levando os dados do aparelho,
// selo "Salvo" no topo, mudança indo para o servidor, outro aparelho abrindo os mesmos dados, sair
// apagando os dados do aparelho, "usar sem conta" e o modo de desenvolvimento sem tela de acesso.
// Uso: node tests/conta-ui.mjs   (requer Playwright e Chromium)
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
async function aparelho(nome, url = 'index.html', modo = 'nuvem'){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    await route.fulfill({ status:r.status, contentType:'application/json', body:await r.text() });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
  if (modo) await p.addInitScript(m => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', m); sessionStorage.setItem('iniciado', '1'); } }, modo);
  await p.goto(BASE + url); await p.waitForTimeout(150); return p;
}
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(120); };

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } }; S.clinicas.length = 0; S.dados = {};
  // Aparelho 1: tem os exemplos e um paciente cadastrado sem conta
  const A = await aparelho('A', url);
  // um paciente de verdade, cadastrado antes no protótipo (o sistema converte ao abrir), além dos exemplos
  await A.evaluate(() => { localStorage.setItem('spazio-v1', JSON.stringify({ patients:[{ id:'r1', name:'Paciente Real', birth:'1990-01-01', phone:'', queixa:'dor', anam:{}, alerts:{}, sessions:[], assess:[] }], appts:[{ id:'h1', pid:'r1', date:new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10), time:'09:00', tipo:'Acupuntura', valor:180, done:false }] })); localStorage.removeItem('musubi-v2'); }); await A.reload(); await A.waitForTimeout(150);
  ok(await p_visivel(A, '#acesso') && await tem(A, '#acesso h1', 'Entrar no MUSUBI'), `${rot}: abre na tela de entrar`);
  await A.fill('#acesso [name=email]', 'maicon@x.com'); await A.fill('#acesso [name=senha]', 'errada'); await clicar(A, '#acesso [type=submit]');
  ok(await tem(A, '.erro-a', 'E-mail ou senha incorretos'), `${rot}: senha errada em português`);
  await clicar(A, '[data-ac=criar]');
  await A.fill('#acesso [name=nome]', 'Ana'); await A.fill('#acesso [name=email]', 'maicon@x.com'); await A.fill('#acesso [name=senha]', 'outrasenha'); await clicar(A, '#acesso [type=submit]');
  ok(await tem(A, '.erro-a', 'Já existe uma conta'), `${rot}: conta repetida avisa`);
  await clicar(A, '[data-ac=entrar]');
  await A.fill('#acesso [name=email]', 'maicon@x.com'); await A.fill('#acesso [name=senha]', 'segredo123'); await clicar(A, '#acesso [type=submit]');
  ok(await tem(A, '#acesso h1', 'Conte sobre a clínica') && await tem(A, '.acesso-opc', 'Encontramos dados neste aparelho'), `${rot}: sem clínica: primeiro acesso com os dados do aparelho`);
  await A.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await A.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(A, '#acesso [type=submit]'); await A.waitForTimeout(200);
  const cid = S.clinicas[0]?.id;
  ok(await A.locator('#acesso').isHidden() && S.dados[cid]?.doc.patients.length > 0, `${rot}: clínica criada levando os dados; sistema aberto`);
  ok(await tem(A, '.selo-nuvem', 'Salvo'), `${rot}: selo "Salvo" no topo`);
  ok(S.acessos?.some(x => x.user === 'u1' && x.evento === 'entrou'), `${rot}: a entrada fica registrada no servidor (Marco Civil)`);
  // Uma mudança vai para o servidor
  const antes = S.dados[cid].versao;
  await A.evaluate(() => { location.hash = 'agenda'; }); await A.waitForTimeout(150);
  await clicar(A, '#ag-l .hor [data-s="faltou"] >> nth=0'); await A.waitForTimeout(1900);
  ok(S.dados[cid].versao === antes + 1, `${rot}: mudança enviada ao servidor`);
  // Aparelho 2 abre os mesmos dados
  const B = await aparelho('B', url);
  await B.fill('#acesso [name=email]', 'maicon@x.com'); await B.fill('#acesso [name=senha]', 'segredo123'); await clicar(B, '#acesso [type=submit]'); await B.waitForTimeout(200);
  const nA = await A.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')).appts.filter(a => a.st === 'faltou').length);
  const nB = await B.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')).appts.filter(a => a.st === 'faltou').length);
  ok(await B.locator('#acesso').isHidden() && nA === nB && nB > 0, `${rot}: outro aparelho entra direto na clínica com os mesmos dados`);
  const nAc = S.acessos.length; await B.reload(); await B.waitForTimeout(250);
  ok(S.acessos.length === nAc + 1 && S.acessos.at(-1).evento === 'voltou', `${rot}: reabrir com o login guardado também registra o acesso`);
  // Sair
  await clicar(B, '[data-act=perfil]');
  ok(await tem(B, '.pf-conta', 'maicon@x.com') && await tem(B, '.pf-conta', 'Spazio Stabilità'), `${rot}: menu mostra a conta e a clínica`);
  await Promise.all([B.waitForEvent('load'), B.click('[data-act=sair]')]); await B.waitForTimeout(150);
  const restou = await B.evaluate(() => ({ pac:JSON.parse(localStorage.getItem('musubi-v2')).patients.length, sessao:localStorage.getItem('musubi-sessao') }));
  ok(await tem(B, '#acesso h1', 'Entrar') && restou.pac === 0 && !restou.sessao, `${rot}: sair volta para entrar e não deixa os dados no aparelho`);
  // Usar sem conta
  await clicar(B, '[data-ac=local]');
  ok(await B.locator('#acesso').isHidden() && !(await tem(B, '.selo-nuvem')), `${rot}: dá para usar sem conta`);
  await A.context().close(); await B.context().close();
}
// Desenvolvimento (localhost) sem escolher modo: segue sem tela de acesso, como sempre
const D = await aparelho('D', 'index.html', null);
ok(await D.locator('#acesso').isHidden() && await tem(D, '#view h1'), 'no computador de desenvolvimento o sistema abre sem conta');
await clicar(D, '[data-act=perfil]');
ok(await tem(D, '[data-act=conta-entrar]', 'Entrar na sua conta'), 'sem conta, o menu oferece entrar');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA conta no servidor passou.');
process.exit(falhas ? 1 : 0);
async function p_visivel(p, s){ return p.locator(s).isVisible(); }
