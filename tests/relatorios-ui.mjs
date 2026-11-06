// Verifica no navegador os Relatórios (etapa 9) no sistema modular e no arquivo único: período em um
// toque, números coerentes com os quadros, destaque dos meses, tabela, dicas no final levando à tela
// certa, folha para imprimir ou salvar em PDF e celular sem rolagem horizontal.
// Uso: node tests/relatorios-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };

async function verificar(browser, url, nome){
  const erros = [], ctx = await browser.newContext({ viewport:{ width:1366, height:1000 } }), p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await p.addInitScript(() => { window.__imp = []; window.print = () => window.__imp.push(document.getElementById('imp').innerHTML); });
  const espera = () => p.waitForTimeout(60), clicar = async s => { await p.click(s); await espera(); };
  const tem = async (s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
  const n = async s => Number((await p.locator(s).innerText()).replace(/[^\d]/g, ''));

  // Hoje: dois horários atendidos e um que faltou.
  await p.goto(url + '#agenda'); await p.waitForSelector('#ag-l');
  await clicar('#ag-l .hor [data-s="atendido"] >> nth=0'); await clicar('#ag-l .hor [data-s="atendido"]:not(.on) >> nth=0'); await clicar('#ag-l .hor [data-s="faltou"]:not(.on) >> nth=-1');
  await p.goto(url + '#relatorios'); await p.waitForSelector('.rel-g');
  ok(!(await tem('.soon-card')) && await tem('[data-act="rel-per"].on', 'Mês passado'), `${nome}: Relatórios deixou de ser "em breve" e abre no mês passado`);

  await clicar('[data-act="rel-per"][data-k="mes"]');
  const at = await n('#view [data-t="at"] b.num'), serv = (await p.locator('#r-serv .rel-v').allInnerTexts()).reduce((s, x) => s + Number(x), 0);
  ok(at >= 2 && at === serv, `${nome}: este mês, atendimentos batem com a soma por serviço`);
  ok((await p.locator('#view [data-t="falt"] b.num').innerText()).startsWith('1'), `${nome}: falta de hoje entra`);
  ok(await p.locator('#r-mes .rel-col').count() === 6 && await p.locator('#r-mes .rel-col.on').count() === 1, `${nome}: últimos 6 meses com o mês em destaque`);
  await clicar('#r-mes summary');
  ok(await p.locator('#r-mes tbody tr').count() === 6 && await tem('#r-mes td', '(até hoje)'), `${nome}: tabela com os mesmos meses`);
  await clicar('[data-act="rel-per"][data-k="tri"]');
  ok(await p.locator('#r-mes .rel-col.on').count() === 3, `${nome}: últimos 3 meses em destaque`);
  await clicar('[data-act="rel-per"][data-k="ano"]');
  const mesAtual = Number(new Date().toLocaleDateString('sv').slice(5, 7));
  ok(await p.locator('#r-mes .rel-col').count() === mesAtual && await tem('#view [data-t="at"]', 'sem período anterior'), `${nome}: este ano, sem comparação`);
  ok(await tem('#r-ev', 'não é avaliação clínica'), `${nome}: evolução das queixas descritiva`);

  // Dicas no final da página
  ok(await p.evaluate(() => document.getElementById('view').lastElementChild.id === 'r-dicas'), `${nome}: dicas no final da página`);
  ok(await p.locator('#r-dicas .dica').count() >= 1 && await tem('#r-dicas .dica[data-d="livres"]', 'horários livres'), `${nome}: dicas do que fazer agora`);

  // Imprimir ou salvar em PDF
  await clicar('[data-act="rel-imp"]');
  const folha = await p.evaluate(() => window.__imp.at(-1) || '');
  ok(folha.includes('Spazio Stabilità · Relatórios') && folha.includes('Este ano') && folha.includes('Maicon Farinelli') && folha.includes('O que dá para fazer agora') && !folha.includes('<button') && !folha.includes('<details'), `${nome}: folha com cabeçalho, período, quadros e dicas, sem botões`);
  await p.emulateMedia({ media:'print' });
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('imp')).display === 'block'), `${nome}: na impressão só a folha aparece`);
  await p.emulateMedia({ media:'screen' }); await p.evaluate(() => dispatchEvent(new Event('afterprint')));
  ok(await p.evaluate(() => document.getElementById('imp').innerHTML === ''), `${nome}: depois de imprimir a folha é limpa`);

  await clicar('#r-dicas .dica[data-d="livres"] a.btn');
  ok(await p.evaluate(() => location.hash === '#agenda'), `${nome}: a dica leva à tela certa`);
  await p.goto(url + '#relatorios'); await p.waitForSelector('.rel-g');
  ok(await tem('[data-act="rel-per"].on', 'Este ano'), `${nome}: lembra o período escolhido`);

  for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 }); await p.reload(); await p.waitForSelector('.rel-g');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: celular ${w}px sem rolagem horizontal`); }
  ok(!erros.length, `${nome}: sem erros no console` + (erros.length ? ': ' + erros.join(' | ') : ''));
  await ctx.close();
}

const srv = await iniciar(0), base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'arquivo único');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações dos relatórios passaram.');
process.exit(falhas ? 1 : 0);
