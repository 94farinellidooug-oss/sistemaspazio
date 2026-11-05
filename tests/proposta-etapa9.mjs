// Verifica no navegador a proposta navegável da etapa 9 (proposta/etapa-9), com dados fictícios:
// período em um toque, números do período com a comparação ao anterior, atendimentos por mês com
// destaque e tabela, por serviço, recebido por forma (somando o total), evolução das queixas,
// dica ao passar o mouse; celular sem rolagem horizontal e sem erros no console.
// Uso: node tests/proposta-etapa9.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const srv = await iniciar(0);
const URL_ = `http://localhost:${srv.address().port}/proposta/etapa-9/index.html#/relatorios`;
const browser = await chromium.launch();
const erros = [];
const p = await (await browser.newContext({ viewport:{ width:1366, height:1000 } })).newPage();
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const clicar = async sel => { await p.click(sel); await p.waitForTimeout(50); };
const tem = async (sel, txt) => (await p.locator(sel, txt ? { hasText: txt } : {}).count()) > 0;
const txt = async sel => (await p.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
const num = k => txt(`.rel-t4 [data-t="${k}"] b.num`);
const reais = s => Number(s.replace(/[^\d]/g, ''));

await p.goto(URL_); await p.waitForSelector('.rel-g');
ok(await tem('[data-a="per"].on', 'Mês passado') && await num('at') === '58' && await num('rec') === 'R$ 10.010', 'abre no mês passado com atendimentos e recebido');
ok(await tem('[data-t="at"] .cmp.bom', '18% em relação a setembro') && await tem('[data-t="falt"] .cmp.ruim'), 'compara com o período anterior (mais faltas aparece como atenção)');
ok(await p.locator('#r-mes .rel-col').count() === 6 && await p.locator('#r-mes .rel-col.on').count() === 1 && await tem('#r-mes .rel-col.on small', 'out'), 'atendimentos por mês com o mês escolhido em destaque');
await clicar('#r-mes summary');
ok(await p.locator('#r-mes table tbody tr').count() === 6 && await tem('#r-mes td', 'outubro'), 'tabela com os mesmos números');
ok(await p.locator('#r-serv .rel-b').count() === 5 && await tem('#r-serv .rel-b', 'Acupuntura'), 'por serviço');
const formas = await p.locator('#r-forma .rel-v').allInnerTexts();
ok(formas.reduce((n, s) => n + reais(s.split('R$')[1].split(' ')[0]), 0) === 10010, 'recebido por forma soma o total do período');
ok(await p.locator('#r-ev .ev-i').count() === 3 && await tem('#r-ev .ev-i.ok', 'Melhorou') && await tem('#r-ev', 'não é avaliação clínica'), 'evolução das queixas com ícone e texto');
await p.hover('#r-mes .rel-col >> nth=4'); await p.waitForTimeout(50);
ok(await p.locator('#tip').isVisible() && await tem('#tip', 'outubro: 58 atendimentos'), 'dica ao passar o mouse na coluna');

await clicar('[data-a="per"][data-k="tri"]');
ok(await num('at') === '119' && await num('rec') === 'R$ 20.480' && await p.locator('#r-mes .rel-col.on').count() === 3, 'últimos 3 meses somam e destacam três meses');
ok(await tem('#r-serv small', 'últimos 3 meses'), 'cartões dizem o período');
await clicar('[data-a="per"][data-k="ano"]');
ok(await p.locator('#r-mes .rel-col').count() === 11 && await tem('[data-t="at"]', 'sem período anterior'), 'este ano: todos os meses, sem comparação');
await clicar('[data-a="per"][data-k="mes"]');
ok(await num('at') === '12' && await tem('#r-serv small', 'novembro (até hoje)'), 'este mês: até hoje');
await clicar('[data-a="fora"] >> nth=0');
ok(await tem('#toast', 'só os Relatórios'), 'outros módulos avisam que estão fora da proposta');

for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 }); await p.reload(); await p.waitForTimeout(80);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular ${w}px: sem rolagem horizontal`);
  await clicar('[data-a="per"][data-k="ano"]');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular ${w}px: ano inteiro sem rolagem horizontal`); }
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações da proposta da etapa 9 passaram.');
process.exit(falhas ? 1 : 0);
