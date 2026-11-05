// Verifica no navegador a proposta navegável da etapa 8 (proposta/etapa-8), com dados fictícios:
// resumo do mês, receber por atendimento com forma de pagamento e valor parcial, valor acima do que
// falta não passa, desfazer em dois toques, pacote de sessões, despesa que se repete; celular sem rolagem.
// Uso: node tests/proposta-etapa8.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const srv = await iniciar(0);
const URL_ = `http://localhost:${srv.address().port}/proposta/etapa-8/index.html#/financeiro`;
const browser = await chromium.launch();
const erros = [];
const p = await (await browser.newContext({ viewport:{ width:1366, height:1000 } })).newPage();
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const espera = () => p.waitForTimeout(50);
const clicar = async sel => { await p.click(sel); await espera(); };
const tem = async (sel, txt) => (await p.locator(sel, txt ? { hasText: txt } : {}).count()) > 0;
const txt = async sel => (await p.locator(sel).innerText()).replace(/\s+/g, ' ').trim();
const tile = k => txt(`.fin-t [data-t="${k}"] b`);

await p.goto(URL_); await p.waitForSelector('.fin-t');
ok(await tile('rec') === 'R$ 280,00' && await tile('arec') === 'R$ 520,00' && await tile('desp') === 'R$ 1.430,00' && await tile('saldo') === '-R$ 1.150,00', 'resumo do mês: recebido, a receber, despesas e saldo');
ok(await p.locator('#f-arec .fin-l').count() === 4 && await tem('#f-arec .fin-l', 'já pagou R$ 100,00'), 'a receber lista os atendimentos em aberto, com o que já foi pago');
ok(!(await tem('#f-arec .fin-l', 'Helena')), 'atendimento coberto por pacote não aparece em A receber');

// Receber parcial com forma de pagamento
const carlos = '#f-arec .fin-l:has-text("Carlos Lima")';
await clicar(`${carlos} [data-a="receber"]`);
ok((await p.locator('#rec-v').inputValue()) === '90' && await tem(`${carlos} [data-f="Pix"].on`), 'receber já sugere o valor que falta e Pix');
await clicar(`${carlos} [data-a="forma"][data-f="Dinheiro"]`);
await p.fill('#rec-v', '50'); await clicar(`${carlos} .fin-rec .btn.pri`);
ok(await tem('#toast', 'ficou faltando R$ 40,00') && await tile('rec') === 'R$ 330,00' && await tile('arec') === 'R$ 470,00', 'pagamento parcial: entra o recebido, fica o que falta');
ok(await tem('#f-recs .fin-l', 'Carlos Lima') && await tem('#f-recs .fin-l:has-text("Carlos") .pill', 'Dinheiro') && await tem('#f-recs .fin-l:has-text("Carlos")', 'parcial'), 'recebido aparece com a forma e marcado como parcial');

// Valor acima do que falta não passa
await clicar(`${carlos} [data-a="receber"]`);
await p.fill('#rec-v', '100'); await clicar(`${carlos} .fin-rec .btn.pri`);
ok(await tem('#toast', 'passa do que falta (R$ 40,00)') && await tem(`${carlos} .fin-rec`) && await tile('rec') === 'R$ 330,00', 'valor acima do que falta não é aceito');
await p.fill('#rec-v', '40'); await clicar(`${carlos} .fin-rec .btn.pri`);
ok(!(await tem(carlos)) && await tile('arec') === 'R$ 430,00', 'quitado sai de A receber');

// Desfazer em dois toques
const n = await p.locator('#f-recs .fin-l').count();
await clicar('#f-recs .fin-l >> nth=0 >> [data-a="desf"]');
ok(await tem('[data-a="desf-ok"]') && await p.locator('#f-recs .fin-l').count() === n, 'desfazer pede confirmação');
await clicar('[data-a="desf-x"]');
ok(await p.locator('#f-recs .fin-l').count() === n, 'Manter não desfaz');
await clicar('#f-recs .fin-l >> nth=0 >> [data-a="desf"]'); await clicar('[data-a="desf-ok"]');
ok(await p.locator('#f-recs .fin-l').count() === n - 1 && await tem(carlos, 'R$ 40,00') && await tem('#toast', 'voltou para A receber'), 'desfeito, o valor volta para A receber');

// Pacote
ok(await tem('[data-pac="k1"] .pac-n', '2/10'), 'pacote mostra as sessões usadas');
await clicar('[data-a="novo-pac"]');
await p.selectOption('#np-p', 'p5'); await p.fill('#np-s', '5'); await p.fill('#np-v', '700,00');
await clicar('#f-novo-pac .btn.pri');
ok(await p.locator('#f-pac .pac').count() === 2 && await tem('#f-pac .pac', 'Ana Ribeiro') && await tem('#f-pac .pac:has-text("Ana") .pac-n', '0/5'), 'novo pacote criado');
ok(await tile('rec') === 'R$ 1.030,00', 'pacote pago entra no recebido do mês');

// Despesa que se repete
await clicar('#f-nova-desp .btn.pri');
ok(await tem('#toast', 'Informe a despesa e o valor') && await p.locator('#f-desp .fin-l').count() === 2, 'despesa sem descrição e valor não entra');
await p.fill('#nd-d', 'Conta de luz'); await p.fill('#nd-v', '1.150,50'); await p.selectOption('#nd-c', 'Contas'); await p.check('#nd-r');
await clicar('#f-nova-desp .btn.pri');
ok(await tem('#f-desp .fin-l', 'Conta de luz') && await tem('#f-desp .fin-l:has-text("Conta de luz")', 'Contas · todo mês') && await tem('#f-desp .fin-l:has-text("Conta de luz") .fin-v', 'R$ 1.150,50'), 'despesa lançada com tipo e repetição');
ok(await tile('desp') === 'R$ 2.580,50' && await tile('saldo') === '-R$ 1.550,50', 'resumo acompanha a despesa');
ok(await tem('.card', 'Nota fiscal'), 'cartão da nota fiscal presente');

for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 }); await p.goto(URL_); await p.reload(); await p.waitForTimeout(80);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular ${w}px: sem rolagem horizontal`);
  await clicar('#f-arec [data-a="receber"] >> nth=0');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular ${w}px: receber aberto sem rolagem horizontal`);
  await clicar('[data-a="novo-pac"]');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular ${w}px: novo pacote sem rolagem horizontal`); }
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações da proposta da etapa 8 passaram.');
process.exit(falhas ? 1 : 0);
