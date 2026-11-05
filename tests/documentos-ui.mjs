// Verifica no navegador a tela Documentos (etapa 6B) no sistema modular e no arquivo único: modelo +
// paciente já preenchido, ajuste do texto, impressão, guardar no prontuário, termo assinado, imprimir
// de novo, atalhos do prontuário e do atendimento, e celular sem rolagem horizontal.
// Uso: node tests/documentos-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };

async function verificar(browser, url, nome){
  const erros = [], ctx = await browser.newContext({ viewport:{ width:1366, height:1100 } }), p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const espera = () => p.waitForTimeout(60), clicar = async s => { await p.click(s); await espera(); };
  const tem = async (s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
  const dados = () => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')));
  await p.addInitScript(() => { window.__imp = []; window.print = () => window.__imp.push(document.getElementById('imp').innerText); });
  await p.goto(url + '#documentos'); await p.waitForSelector('#doc-pv');

  ok(await p.locator('.doc-m button').count() === 4 && await tem('#doc-t', 'Helena Prado') && await tem('#doc-t', 'Maicon Farinelli') && await tem('#doc-pv .dp-as'), `${nome}: termo já preenchido, com linha de assinatura`);
  ok(!(await tem('#view', 'Planejado para a etapa')), `${nome}: Documentos deixou de ser "em breve"`);
  await p.selectOption('#doc-p', 'p2'); await espera();
  ok(await tem('#doc-t', 'Rafael Monteiro') && await tem('#doc-lista h2', 'Rafael'), `${nome}: trocar o paciente troca o texto e a lista`);
  await clicar('[data-m="declaracao"]');
  ok(await tem('#doc-t', 'esteve em atendimento') && await tem('#doc-t', 'das 10:30 às 11:30') && !(await tem('#doc-pv .dp-as')), `${nome}: declaração com o horário de hoje, sem linha de assinatura`);
  await clicar('[data-m="registro"]');
  ok(await tem('#doc-t', 'Pontos registrados'), `${nome}: registro do último atendimento`);
  await clicar('[data-m="orientacoes"]');
  ok(await tem('#doc-novo .notice', 'Nenhum atendimento com orientações'), `${nome}: orientações vazias explicam o motivo`);
  await clicar('[data-act="doc-imp"]');
  ok(await tem('#toast', 'Escreva o texto') && (await p.evaluate(() => window.__imp.length)) === 0, `${nome}: sem texto, não imprime`);

  // Ajustar, imprimir e guardar
  await clicar('[data-m="termo"]');
  await p.click('#doc-t p >> nth=1'); await p.keyboard.press('End'); await p.keyboard.type(' Ajuste feito na hora.'); await espera();
  ok(await tem('[data-act="doc-refazer"]'), `${nome}: texto ajustado pode voltar ao modelo`);
  await clicar('[data-act="doc-imp"]');
  const folha = await p.evaluate(() => window.__imp.at(-1) || '');
  ok(folha.includes('Termo de consentimento') && folha.includes('Rafael Monteiro') && folha.includes('Ajuste feito na hora') && folha.includes('Maicon Farinelli'), `${nome}: imprime a folha com o texto ajustado`);
  await p.emulateMedia({ media:'print' });
  ok(await p.locator('#imp').isVisible() && !(await p.locator('.app').isVisible()), `${nome}: na impressão só aparece o documento`);
  await p.emulateMedia({ media:'screen' });
  await clicar('[data-act="doc-guardar"]');
  const d = (await dados()).patients.find(x => x.id === 'p2').documentos;
  ok(d?.length === 1 && d[0].modelo === 'termo' && d[0].texto.includes('Ajuste feito na hora') && d[0].por === 'Maicon Farinelli', `${nome}: guardado no prontuário com o texto, quem e quando`);
  ok(await tem('#doc-lista .doc-li', 'Termo de consentimento') && await tem('#doc-lista [data-act="doc-ass"]'), `${nome}: aparece na lista do paciente`);
  await clicar('#doc-lista [data-act="doc-ass"]');
  ok(await tem('#doc-lista .pill.ok', 'assinado') && (await dados()).patients.find(x => x.id === 'p2').documentos[0].assinado === true, `${nome}: termo marcado como assinado`);
  await clicar('[data-m="declaracao"]'); await clicar('#doc-lista [data-act="doc-reimp"]');
  ok((await p.evaluate(() => window.__imp.at(-1))).includes('Ajuste feito na hora'), `${nome}: imprimir de novo usa o texto guardado`);

  // Atalhos
  await p.evaluate(() => { location.hash = 'pacientes'; }); await espera();
  await clicar('[data-act="open"][data-pid="p3"]');
  await clicar('[data-act="doc-abrir"][data-pid="p3"]');
  ok(await p.evaluate(() => location.hash) === '#documentos' && await tem('#doc-t', 'Lúcia Andrade'), `${nome}: botão Documentos do prontuário abre com o paciente`);
  await p.evaluate(() => { location.hash = 'prontuario'; }); await espera();
  await clicar('[data-act="novo-atendimento"]');
  await clicar('[data-act="etapa"][data-i="7"]');
  await clicar('[data-act="at-doc"][data-d="doc-termo"]');
  ok(await tem('[data-m="termo"].on') && await tem('#doc-t', 'Lúcia Andrade'), `${nome}: atendimento abre o termo do paciente`);

  for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 }); await p.goto(url + '#documentos'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome} celular ${w}px: sem rolagem horizontal`); }
  ok(!erros.length, `${nome}: sem erros no console` + (erros.length ? ': ' + erros.join(' | ') : ''));
  await ctx.close();
}
const srv = await iniciar(0), base = `http://localhost:${srv.address().port}/`, browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'arquivo único');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações dos documentos passaram.');
process.exit(falhas ? 1 : 0);
