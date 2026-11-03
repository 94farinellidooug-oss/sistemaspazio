// Verifica a interface da etapa 1B: menu em quatro grupos, modo recolhido com rótulos
// acessíveis, menu em gaveta no celular, telas "em breve", Painel misto, atalhos do
// prontuário, tema claro como padrão, menu sem textos cortados e ausência de rolagem horizontal.
// Uso: node tests/interface.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const ROTAS = ['painel','agenda','pacientes','prontuario','avaliacao','pentagrama','pontos','crm','financeiro','documentos','relatorios','equipe','configuracoes'];
const GRUPOS = ['Visão geral','Gestão clínica','Gestão administrativa','Administração'];

async function verificar(browser, url, nome) {
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const ir = async h => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(50); };
  await p.goto(url); await p.waitForSelector('#view .head');

  // Menu
  ok(JSON.stringify(await p.$$eval('#nav .grp', g => g.map(x => x.textContent))) === JSON.stringify(GRUPOS), `${nome}: menu com os 4 grupos na ordem aprovada`);
  ok(await p.locator('#nav a').count() === ROTAS.length, `${nome}: ${ROTAS.length} itens no menu`);
  ok(await p.locator('#nav a.sub').count() === 2, `${nome}: Avaliação e Pentagrama como subitens de Prontuários`);
  ok(await p.locator('#nav a[aria-current="page"]').getAttribute('href') === '#painel', `${nome}: item atual marcado`);

  // Recolher
  await p.click('[data-act="menu-mini"]'); await p.waitForTimeout(250);
  const larg = (await p.locator('#nav').boundingBox()).width;
  ok(larg <= 80, `${nome}: menu recolhido com ${Math.round(larg)}px, só ícones`);
  ok(await p.locator('#nav a span:visible').count() === 0, `${nome}: rótulos escondidos no modo recolhido`);
  ok(await p.$$eval('#nav a', as => as.every(a => a.getAttribute('aria-label'))), `${nome}: todo item mantém nome acessível (aria-label)`);
  await p.hover('#nav a[href="#agenda"]');
  ok((await p.$eval('#nav a[href="#agenda"]', a => getComputedStyle(a, '::after').content)).includes('Agenda'), `${nome}: dica com o nome aparece ao passar o mouse`);
  await p.click('#nav a[href="#pacientes"]'); await p.waitForTimeout(80);
  ok(await p.locator('.app.mini').count() === 1, `${nome}: menu continua recolhido ao navegar`);
  await p.click('[data-act="menu-mini"]'); await p.waitForTimeout(250);
  ok((await p.locator('#nav').boundingBox()).width > 200, `${nome}: menu expande de novo`);

  // Telas em breve
  for (const r of ROTAS.slice(7)) {
    await ir(r);
    ok(await p.locator('#view h1').count() === 1 && await p.locator('#view', { hasText: 'Planejado para a etapa' }).count() === 1, `${nome}: tela "em breve" de ${r}`);
  }

  // Painel misto
  await ir('painel');
  ok(await p.locator('#view .zone > .lbl').allTextContents().then(t => t.join('|') === 'Rotina clínica|Gestão administrativa'), `${nome}: Painel com Rotina clínica e Gestão administrativa`);
  ok(await p.locator('#view .kpi').count() === 4, `${nome}: 4 indicadores de gestão`);
  const prev = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('spazio-v1') || 'null'); return d; });
  ok(await p.locator('#view .todo.alertas').count() === 1 && await p.locator('#view .todo:not(.alertas)').count() === 1, `${nome}: quadros de Alertas de segurança e de Pendências`);
  ok(await p.locator('#view .zone').first().locator('.card-h h2').allTextContents().then(t => t[0].startsWith('Agenda do dia')), `${nome}: agenda do dia é o primeiro quadro da rotina clínica`);
  // Novo paciente sem avaliação aparece nas pendências e leva à avaliação
  await ir('pacientes');
  await p.fill('#np-name', 'Paciente Interface'); await p.fill('#np-birth', '1992-01-01'); await p.fill('#np-q', 'Cefaleia');
  await p.check('#np-lgpd'); await p.click('#f-patient button'); await p.waitForTimeout(80);
  await ir('painel');
  const linha = p.locator('#view .todo .row', { hasText: 'Paciente Interface ainda não tem avaliação' });
  ok(await linha.count() === 1, `${nome}: paciente sem avaliação aparece nas pendências`);
  await linha.locator('button').click(); await p.waitForTimeout(80);
  ok(await p.evaluate(() => location.hash) === '#avaliacao' && await p.$eval('#as-patient', s => s.selectedOptions[0].textContent) === 'Paciente Interface', `${nome}: "Avaliar" abre a avaliação do paciente certo`);

  // Atalhos do prontuário
  await p.evaluate(() => { location.hash = 'pacientes'; }); await p.waitForTimeout(50);
  await p.click('#plist .row:has-text("Rafael Monteiro")'); await p.waitForTimeout(80);
  await p.click('[data-act="ir"][data-to="pentagrama"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => location.hash) === '#pentagrama' && await p.$eval('#pt-patient', s => s.selectedOptions[0].textContent) === 'Rafael Monteiro', `${nome}: atalho Pentagrama no prontuário abre o paciente certo`);
  await ir('prontuario'); await p.click('[data-act="ir"][data-to="avaliacao"]'); await p.waitForTimeout(80);
  ok(await p.$eval('#as-patient', s => s.selectedOptions[0].textContent) === 'Rafael Monteiro', `${nome}: atalho Avaliação no prontuário abre o paciente certo`);

  // Paleta
  const brand = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim());
  ok(brand === '#66864b', `${nome}: verde institucional #66864b na paleta (${brand})`);
  await ctx.close();

  // Tema claro é o padrão, mesmo com o aparelho em modo escuro; o escuro só entra se for escolhido
  const esc = await browser.newContext({ colorScheme: 'dark' }); const pe = await esc.newPage();
  await pe.goto(url); await pe.waitForSelector('#view .head');
  ok(await pe.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(246, 243, 236)', `${nome}: tema claro (creme) mesmo com o aparelho em modo escuro`);
  await pe.evaluate(() => document.documentElement.dataset.theme = 'dark');
  ok(await pe.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(20, 23, 18)', `${nome}: tema escuro disponível quando escolhido`);
  await esc.close();

  // Menu sem textos cortados
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const pm = await ctx2.newPage();
  await pm.goto(url); await pm.waitForSelector('#view .head');
  const cortados = await pm.$$eval('#nav a span:not(.soon), #nav .grp', els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
  ok(cortados.length === 0, `${nome}: nenhum texto cortado no menu${cortados.length ? ' → ' + cortados.join(', ') : ''}`);
  await ctx2.close();

  // Celular
  const cel = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pc = await cel.newPage(); pc.on('pageerror', e => erros.push(e.message));
  await pc.goto(url); await pc.waitForSelector('#view .head');
  ok(await pc.locator('.topbar').isVisible(), `${nome} celular: barra superior visível`);
  ok((await pc.locator('#nav').boundingBox()).x < 0, `${nome} celular: menu fechado fora da tela`);
  await pc.click('[data-act="menu-abrir"]'); await pc.waitForTimeout(300);
  ok((await pc.locator('#nav').boundingBox()).x >= 0, `${nome} celular: menu abre como gaveta`);
  await pc.click('#nav a[href="#agenda"]'); await pc.waitForTimeout(300);
  ok(await pc.evaluate(() => location.hash) === '#agenda' && (await pc.locator('#nav').boundingBox()).x < 0, `${nome} celular: escolher um item navega e fecha o menu`);
  await pc.click('[data-act="menu-abrir"]'); await pc.waitForTimeout(250); await pc.click('.backdrop', { position: { x: 370, y: 400 } }); await pc.waitForTimeout(300);
  ok((await pc.locator('#nav').boundingBox()).x < 0, `${nome} celular: tocar fora fecha o menu`);
  const largas = [];
  for (const r of ROTAS) { await pc.evaluate(h => { location.hash = h; }, r); await pc.waitForTimeout(60); if (await pc.evaluate(() => document.documentElement.scrollWidth > innerWidth)) largas.push(r); }
  ok(largas.length === 0, `${nome} celular: nenhuma tela com rolagem horizontal${largas.length ? ' → ' + largas.join(', ') : ''}`);
  await cel.close();

  ok(erros.length === 0, `${nome}: sem erros no console${erros.length ? ' → ' + erros.join(' | ') : ''}`);
}

const srv = await iniciar(0); const base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'dist');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTodas as verificações de interface passaram.');
process.exit(falhas ? 1 : 0);
