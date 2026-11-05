// Verifica no navegador o Financeiro (etapa 8) no sistema modular e no arquivo único: resumo do mês,
// receber com forma e valor parcial, valor acima do que falta não passa, desfazer em dois toques,
// dados da nota copiados, pacote descontando o atendido, despesa que repete e tirar despesa,
// dados guardados ao recarregar e celular sem rolagem horizontal.
// Uso: node tests/financeiro-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };

async function verificar(browser, url, nome){
  const erros = [], ctx = await browser.newContext({ viewport:{ width:1366, height:1000 }, permissions:['clipboard-read', 'clipboard-write'] }), p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const espera = () => p.waitForTimeout(60), clicar = async s => { await p.click(s); await espera(); };
  const tem = async (s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
  const txt = async s => (await p.locator(s).innerText()).replace(/\s+/g, ' ').trim();
  const tile = k => txt(`.fin-t [data-t="${k}"] b`);
  const dados = () => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')));

  // Os três horários de hoje dos exemplos ficam como atendidos; o atendido antigo sai da conta.
  await p.goto(url + '#agenda'); await p.waitForSelector('#ag-l');
  for (let i = 0; i < 3; i++) await clicar('#ag-l .hor [data-s="atendido"]:not(.on) >> nth=0');
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('musubi-v2')), h = new Date().toLocaleDateString('sv');
    d.appts.forEach(a => { a.done = a.date === h; }); localStorage.setItem('musubi-v2', JSON.stringify(d)); });
  await p.reload(); await p.waitForSelector('#ag-l'); await p.goto(url + '#financeiro'); await p.waitForSelector('.fin-t');
  ok(await tile('rec') === 'R$ 0,00' && await tile('arec') === 'R$ 560,00' && await tile('saldo') === 'R$ 0,00', `${nome}: resumo do mês`);
  ok(await p.locator('#f-arec .fin-l').count() === 3 && (await dados()).financeiro?.inicio?.endsWith('-01'), `${nome}: A receber com os atendidos de hoje; financeiro criado no primeiro acesso`);
  ok(!(await tem('.soon-card')) && await tem('nav .on, nav [aria-current]', 'Financeiro'), `${nome}: Financeiro deixou de ser "em breve"`);

  // Receber parcial
  const raf = '#f-arec .fin-l:has-text("Rafael Monteiro")';
  await clicar(`${raf} [data-act="fin-receber"]`);
  ok((await p.locator('#rec-v').inputValue()) === '200' && await tem(`${raf} [data-f="Pix"].on`), `${nome}: receber sugere o que falta e Pix`);
  await p.fill('#rec-v', '50'); await clicar(`${raf} [data-act="fin-forma"][data-f="Dinheiro"]`);
  ok((await p.locator('#rec-v').inputValue()) === '50', `${nome}: trocar a forma mantém o valor digitado`);
  await clicar(`${raf} .fin-rec .btn.pri`);
  ok(await tem('#toast', 'ficou faltando R$ 150,00') && await tile('rec') === 'R$ 50,00' && await tile('arec') === 'R$ 510,00', `${nome}: parcial entra e o resto fica a receber`);
  ok(await tem('#f-recs .fin-l:has-text("Rafael") .pill', 'Dinheiro') && await tem('#f-recs .fin-l:has-text("Rafael")', 'parcial') && await tem(raf, 'já pagou R$ 50,00'), `${nome}: recebido com forma e parcial`);
  await clicar(`${raf} [data-act="fin-receber"]`); await p.fill('#rec-v', '999'); await clicar(`${raf} .fin-rec .btn.pri`);
  ok(await tem('#toast', 'passa do que falta (R$ 150,00)') && await tem(`${raf} .fin-rec`), `${nome}: valor acima do que falta não passa`);
  await clicar('[data-act="fin-rec-x"]');

  // Dados da nota
  await clicar('#f-recs [data-act="fin-nota"] >> nth=0');
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(clip.includes('Paciente: Rafael Monteiro') && clip.includes('Serviço: Acupuntura e moxabustão') && clip.includes('Valor: R$') && await tem('#toast', 'Dados da nota copiados'), `${nome}: dados da nota copiados`);

  // Desfazer
  await clicar('#f-recs [data-act="fin-desf"] >> nth=0');
  ok(await tem('[data-act="fin-desf-ok"]') && await tile('rec') === 'R$ 50,00', `${nome}: desfazer pede confirmação`);
  await clicar('[data-act="fin-desf-ok"]');
  ok(await tile('rec') === 'R$ 0,00' && await tile('arec') === 'R$ 560,00' && await tem('#toast', 'voltou para A receber'), `${nome}: desfeito volta para A receber`);

  // Pacote
  await clicar('[data-act="fin-novo-pac"]');
  await p.selectOption('#np-p', 'p4'); await espera();
  ok(await tem('#np-serv', 'Acupuntura') && await tem('#f-novo-pac'), `${nome}: pacote mostra o serviço do paciente`);
  await p.fill('#np-s', '5'); await p.fill('#np-v', '800,00'); await clicar('#f-novo-pac .btn.pri');
  ok(await tem('#f-pac .pac:has-text("Tiago Sato") .pac-n', '1/5') && !(await tem('#f-arec .fin-l', 'Tiago Sato')), `${nome}: pacote desconta o atendido de hoje`);
  ok(await tile('rec') === 'R$ 800,00' && await tile('arec') === 'R$ 380,00', `${nome}: pacote entra no recebido`);

  // Despesas
  await clicar('#f-nova-desp .btn.pri');
  ok(await tem('#toast', 'Informe a despesa e o valor'), `${nome}: despesa sem dados não entra`);
  await p.fill('#nd-d', 'Aluguel da sala'); await p.fill('#nd-v', '1.200,00'); await p.check('#nd-r'); await clicar('#f-nova-desp .btn.pri');
  await p.fill('#nd-d', 'Agulhas'); await p.fill('#nd-v', '230'); await p.selectOption('#nd-c', 'Material'); await clicar('#f-nova-desp .btn.pri');
  ok(await tem('#f-desp .fin-l:has-text("Aluguel da sala")', 'Aluguel · todo mês') && await tile('desp') === 'R$ 1.430,00' && await tile('saldo') === '-R$ 630,00', `${nome}: despesas lançadas e saldo`);
  await clicar('#f-desp .fin-l:has-text("Agulhas") [data-act="fin-desp-x"]');
  ok(await tem('[data-act="fin-desp-ok"]', 'Tirar mesmo'), `${nome}: tirar despesa pede confirmação`);
  await clicar('[data-act="fin-desp-ok"]');
  ok(!(await tem('#f-desp .fin-l', 'Agulhas')) && await tile('desp') === 'R$ 1.200,00', `${nome}: despesa tirada`);

  await p.reload(); await p.waitForSelector('.fin-t');
  const d = await dados();
  ok(await tile('rec') === 'R$ 800,00' && d.financeiro.pacotes.length === 1 && d.financeiro.despesas.length === 1 && !d.appts.some(a => 'pago' in a || 'recebido' in a), `${nome}: guardado ao recarregar, sem mexer nos horários`);

  for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 }); await p.reload(); await p.waitForSelector('.fin-t');
    await clicar('#f-arec [data-act="fin-receber"] >> nth=0'); await clicar('[data-act="fin-novo-pac"]');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: celular ${w}px sem rolagem horizontal`); }
  ok(!erros.length, `${nome}: sem erros no console` + (erros.length ? ': ' + erros.join(' | ') : ''));
  await ctx.close();
}

const srv = await iniciar(0), base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'arquivo único');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações do financeiro passaram.');
process.exit(falhas ? 1 : 0);
