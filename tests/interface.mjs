// Verifica a interface do MUSUBI (etapa 2A): menu com os 8 módulos, modo recolhido com rótulos
// acessíveis, barra superior com migalhas, busca global (Ctrl K), notificações e perfil, atalhos de
// teclado, Painel com indicadores calculados dos dados, acompanhamento que leva à avaliação, atalhos
// do prontuário, telas "em breve", tema claro como padrão, menu sem textos cortados, menu em gaveta
// no celular e ausência de rolagem horizontal.
// Uso: node tests/interface.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const MENU = ['Painel', 'Agenda', 'Pacientes', 'Biblioteca clínica', 'Financeiro', 'Documentos', 'Relatórios', 'Administração'];
const ROTAS = ['painel', 'agenda', 'pacientes', 'cadastro', 'prontuario', 'avaliacao', 'pentagrama', 'pontos', 'biblioteca', 'financeiro', 'documentos', 'relatorios', 'administracao', 'crm', 'equipe', 'configuracoes'];
const EM_BREVE = ['equipe']; // Configurações saiu do "em breve" na etapa 10 (tests/configuracoes-ui.mjs)

async function verificar(browser, url, nome) {
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const ir = async h => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(60); };
  await p.goto(url); await p.waitForSelector('#view h1');

  // Menu
  ok(JSON.stringify(await p.$$eval('#nav > a', a => a.map(x => x.getAttribute('aria-label')))) === JSON.stringify(MENU), `${nome}: menu com os 8 módulos na ordem aprovada`);
  ok(await p.locator('#nav a', { hasText: 'Avaliação' }).count() === 0 && await p.locator('#nav a', { hasText: 'Pentagrama' }).count() === 0, `${nome}: Avaliação e Pentagrama fora do menu`);
  ok(await p.locator('#nav a[aria-current="page"]').getAttribute('href') === '#painel', `${nome}: item atual marcado`);
  ok(await p.evaluate(() => document.title) === 'Musubi', `${nome}: título Musubi`);

  // Recolher (botão e tecla [)
  await p.click('[data-act="menu-mini"]'); await p.waitForTimeout(250);
  const larg = (await p.locator('#nav').boundingBox()).width;
  ok(larg <= 80, `${nome}: menu recolhido com ${Math.round(larg)}px, só ícones`);
  ok(await p.locator('#nav > a span:visible').count() === 0, `${nome}: rótulos escondidos no modo recolhido`);
  ok(await p.$$eval('#nav a', as => as.every(a => a.getAttribute('aria-label'))), `${nome}: todo item mantém nome acessível (aria-label)`);
  await p.click('#nav a[href="#pacientes"]'); await p.waitForTimeout(80);
  ok(await p.locator('.app.mini').count() === 1, `${nome}: menu continua recolhido ao navegar`);
  await p.keyboard.press('['); await p.waitForTimeout(250);
  ok((await p.locator('#nav').boundingBox()).width > 200, `${nome}: tecla [ expande o menu de novo`);

  // Migalhas
  await p.click('#plist [data-pid="p2"]'); await p.waitForTimeout(80);
  ok(await p.locator('.migalha').innerText().then(t => t.replace(/\s+/g, ' ').trim()) === 'Pacientes Rafael Monteiro', `${nome}: migalhas Pacientes › paciente no prontuário`);
  ok(await p.locator('#nav a[aria-current="page"]').getAttribute('href') === '#pacientes', `${nome}: prontuário marca Pacientes no menu`);

  // Atalhos do prontuário
  await p.click('[data-act="ir"][data-to="pentagrama"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => location.hash) === '#pentagrama' && await p.$eval('#pt-patient', s => s.selectedOptions[0].textContent) === 'Rafael Monteiro', `${nome}: atalho Pentagrama no prontuário abre o paciente certo`);
  await p.click('.migalha a[data-pid="p2"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => location.hash) === '#prontuario', `${nome}: migalha volta ao prontuário do paciente`);
  await p.click('[data-act="ir"][data-to="avaliacao"]'); await p.waitForTimeout(80);
  ok(await p.$eval('#as-patient', s => s.selectedOptions[0].textContent) === 'Rafael Monteiro', `${nome}: atalho Avaliação no prontuário abre o paciente certo`);
  await ir('prontuario'); await p.click('.tabs [data-t="nova"]'); await p.waitForTimeout(80);
  ok(await p.locator('#f-session').count() === 1, `${nome}: aba Registro rápido abre o registro de sessão`);

  // Busca global
  await p.keyboard.press('Control+k'); await p.waitForTimeout(120);
  ok(await p.locator('.pal').count() === 1 && await p.evaluate(() => document.activeElement.id) === 'pal-q', `${nome}: Ctrl K abre a busca global com o cursor no campo`);
  await p.keyboard.type('lucia'); await p.waitForTimeout(80);
  ok(await p.locator('.pal-i', { hasText: 'Lúcia Andrade' }).count() === 1, `${nome}: busca encontra paciente sem acento`);
  await p.keyboard.press('Enter'); await p.waitForTimeout(120);
  ok(await p.locator('.pal').count() === 0 && await p.locator('#view h1').innerText() === 'Lúcia Andrade', `${nome}: Enter abre o prontuário do resultado`);
  await p.keyboard.press('/'); await p.waitForTimeout(80); await p.keyboard.type('BP6'); await p.waitForTimeout(80);
  await p.locator('.pal-i', { hasText: 'BP6' }).click(); await p.waitForTimeout(120);
  ok(await p.evaluate(() => location.hash) === '#biblioteca' && await p.locator('#ptlist .pcard').count() === 1, `${nome}: ponto da busca abre filtrado na Biblioteca clínica`);
  await p.keyboard.press('/'); await p.waitForTimeout(80); await p.keyboard.type('xyzw'); await p.waitForTimeout(80);
  ok(await p.locator('.pal .empty').count() === 1, `${nome}: busca sem resultado mostra estado vazio`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  ok(await p.locator('.pal').count() === 0, `${nome}: Esc fecha a busca`);
  await p.keyboard.press('?'); await p.waitForTimeout(80);
  ok(await p.locator('.pal.atl').count() === 1, `${nome}: ? mostra os atalhos de teclado`);
  await p.keyboard.press('Escape');

  // Painel e notificações
  await ir('painel');
  ok(await p.locator('#view .tile').count() === 4 && await p.locator('#view .acao').count() >= 3, `${nome}: Painel com ações rápidas e 4 indicadores`);
  ok(await p.locator('#view .dash-a .card').first().locator('h2').innerText() === 'Agenda do dia', `${nome}: agenda do dia é o primeiro quadro`);
  ok(await p.locator('#view .al-strip', { hasText: 'Rafael Monteiro' }).count() === 1, `${nome}: alerta de segurança do paciente de hoje (anticoagulante)`);
  ok(await p.locator('#view .cm-d.hoje').count() === 1, `${nome}: calendário compacto marca hoje`);
  const badge = Number(await p.locator('.tb-r .badge').innerText());
  await p.click('[data-act="notif"]'); await p.waitForTimeout(80);
  ok(await p.locator('.dd-p.notif .nt').count() === badge && badge > 0, `${nome}: central de notificações com ${badge} itens`);
  await p.click('[data-act="ler-todas"]'); await p.waitForTimeout(80);
  ok(await p.locator('.tb-r .badge').count() === 0, `${nome}: marcar como lidas zera o contador`);
  await p.click('[data-act="perfil"]'); await p.waitForTimeout(80);
  ok(await p.locator('.dd-p.pf', { hasText: 'Maicon' }).count() === 1, `${nome}: menu do perfil abre`);
  await p.mouse.click(700, 500); await p.waitForTimeout(80);
  ok(await p.locator('.dd-p').count() === 0, `${nome}: clique fora fecha o menu do perfil`);

  // Novo paciente sem avaliação aparece no acompanhamento e "Avaliar" leva à avaliação
  await ir('cadastro');
  await p.fill('#np-name', 'Paciente Interface'); await p.fill('#np-birth', '1992-01-01'); await p.fill('#np-q', 'Cefaleia');
  await p.check('#np-lgpd'); await p.click('#f-patient button'); await p.waitForTimeout(80);
  await ir('painel');
  const ac = p.locator('#acomp details', { hasText: 'Paciente Interface' });
  ok(await ac.count() === 1 && await ac.locator('.pill', { hasText: 'sem avaliação energética' }).count() === 1, `${nome}: paciente sem avaliação aparece em acompanhamento`);
  await ac.locator('summary').click(); await ac.locator('[data-to="avaliacao"]').click(); await p.waitForTimeout(80);
  ok(await p.evaluate(() => location.hash) === '#avaliacao' && await p.$eval('#as-patient', s => s.selectedOptions[0].textContent) === 'Paciente Interface', `${nome}: "Avaliar" abre a avaliação do paciente certo`);

  // Telas em breve
  for (const r of EM_BREVE) {
    await ir(r);
    ok(await p.locator('#view h1').count() === 1 && await p.locator('#view', { hasText: 'Planejado para a etapa' }).count() > 0, `${nome}: tela "em breve" de ${r}`);
  }
  await ir('administracao');
  ok(await p.locator('#view .adm-c').count() === 4, `${nome}: Administração reúne Equipe, Configurações, Relacionamento e Modelos de mensagens`);

  // Paleta
  const brand = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim());
  ok(brand === '#66864b', `${nome}: verde institucional #66864b na paleta (${brand})`);
  await ctx.close();

  // Tema claro é o padrão, mesmo com o aparelho em modo escuro
  const esc = await browser.newContext({ colorScheme: 'dark' }); const pe = await esc.newPage();
  await pe.goto(url); await pe.waitForSelector('#view h1');
  ok(await pe.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(246, 243, 236)', `${nome}: tema claro (creme) mesmo com o aparelho em modo escuro`);
  await esc.close();

  // Menu sem textos cortados
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const pm = await ctx2.newPage();
  await pm.goto(url); await pm.waitForSelector('#view h1');
  const cortados = await pm.$$eval('#nav a span:not(.nb), #nav .foot .tx', els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
  ok(cortados.length === 0, `${nome}: nenhum texto cortado no menu${cortados.length ? ' → ' + cortados.join(', ') : ''}`);
  await ctx2.close();

  // Celular
  const cel = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pc = await cel.newPage(); pc.on('pageerror', e => erros.push(e.message));
  await pc.goto(url); await pc.waitForSelector('#view h1');
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
