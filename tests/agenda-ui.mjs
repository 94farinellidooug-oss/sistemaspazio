// Verifica no navegador a Agenda (etapa 6A) no sistema modular e no arquivo único: semana em cima,
// situação de cada horário ao lado, horários livres, agendar, aviso de horário encostado, remarcar,
// desmarcar sem apagar, Atender abrindo o atendimento, conclusão ao finalizar e celular sem rolagem.
// Uso: node tests/agenda-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const hojeIso = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const mais = (n, b = hojeIso()) => { const d = new Date(b + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const HOJE = hojeIso();

async function verificar(browser, url, nome){
  const erros = [], ctx = await browser.newContext({ viewport:{ width:1366, height:1100 } }), p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const espera = () => p.waitForTimeout(60), clicar = async s => { await p.click(s); await espera(); };
  const tem = async (s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
  const hor = n => `#ag-l .hor:has(.hor-p .lk:text-is("${n}"))`;
  const dados = () => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')));
  await p.goto(url + '#agenda'); await p.waitForSelector('#ag-l');

  ok(await p.locator('.ag-sem button').count() === 7 && await tem(`.ag-sem button.on[data-d="${HOJE}"]`), `${nome}: semana em cima com hoje escolhido`);
  ok(await p.locator('#ag-l .hor').count() === 3 && await tem(`${hor('Helena Prado')} [data-s="agendado"].on`), `${nome}: horários de hoje com a situação ao lado`);
  await clicar(`${hor('Helena Prado')} [data-s="confirmado"]`);
  ok(await tem('[data-cont="confirmado"]', 'Confirmados 1') && (await dados()).appts.find(a => a.pid === 'p1' && a.date === HOJE).st === 'confirmado', `${nome}: confirmar com um toque e salvar`);
  await clicar(`${hor('Tiago Sato')} [data-s="faltou"]`);
  ok(await tem(`${hor('Tiago Sato')}.faltou`) && !(await tem(`${hor('Tiago Sato')} [data-act="novo-atendimento"]`)), `${nome}: falta tira o botão Atender`);
  await clicar(`${hor('Tiago Sato')} [data-s="agendado"]`);
  ok(J(await p.locator('#ag-livres .chip').allTextContents()) === J(['08:00','12:00','13:00','14:00','15:00','17:00','18:00']), `${nome}: horários livres de hoje para acupuntura`);

  // Agendar
  await p.selectOption('#na-p', 'p3'); await espera();
  await clicar('#ag-livres .chip:text-is("12:00")');
  ok(await p.locator('#na-t').inputValue() === '12:00', `${nome}: tocar num horário livre preenche o horário`);
  await clicar('#f-appt button.pri');
  const novo = (await dados()).appts.at(-1);
  ok(await tem(hor('Lúcia Andrade'), '12:00') && J(Object.keys(novo)) === J(['id','pid','date','time','tipo','valor','done']) && novo.valor === 180, `${nome}: agendado no formato do protótipo, valor pelo serviço`);
  ok(!(await tem('#ag-livres .chip:text-is("12:00")')), `${nome}: horário agendado sai dos livres`);
  await p.selectOption('#na-tipo', 'Avaliação inicial'); await espera();
  ok(await tem('#f-appt', '90 min') && !(await tem('#ag-livres .chip:text-is("08:00")')), `${nome}: serviço mais longo mostra só onde cabe`);
  await p.fill('#na-t', '11:00'); await clicar('#f-appt button.pri');
  ok(await tem('#toast', 'encosta no horário de Rafael'), `${nome}: avisa horário encostado, sem impedir`);

  // Remarcar e desmarcar
  await clicar(`${hor('Tiago Sato')} [data-act="ag-rem"]`);
  ok(await tem('#f-appt h2', 'Remarcar') && await tem('#f-appt', 'era') && await p.locator('#na-p').isDisabled(), `${nome}: remarcar mostra de onde vem`);
  const amanha = mais(1);
  await p.fill('#na-d', amanha); await p.dispatchEvent('#na-d', 'change'); await espera();
  ok(await tem(`.ag-sem button.on[data-d="${amanha}"]`), `${nome}: escolher outro dia no formulário abre esse dia`);
  await p.fill('#na-t', '13:00'); await clicar('#f-appt button.pri');
  ok(await tem(hor('Tiago Sato'), 'remarcado de') && await tem(hor('Tiago Sato'), '13:00'), `${nome}: remarcado guarda o horário anterior`);
  await clicar('[data-act="week"][data-d="0"]');
  ok(!(await tem(hor('Tiago Sato'))), `${nome}: sai do dia antigo`);
  await clicar(`${hor('Rafael Monteiro')} [data-act="ag-desm"]`);
  ok(!(await tem(hor('Rafael Monteiro'))) && await tem('.ag-fora summary', '1 desmarcado') && (await dados()).appts.some(a => a.pid === 'p2' && a.st === 'desmarcado'), `${nome}: desmarcar não apaga`);
  await p.click('.ag-fora summary'); await clicar('.ag-fora [data-act="ag-rem"]');
  ok(await tem('#f-appt h2', 'Remarcar'), `${nome}: reagendar um desmarcado`);
  await clicar('[data-act="ag-rem-x"]');

  // Atender e finalizar
  await clicar(`${hor('Helena Prado')} [data-act="novo-atendimento"]`);
  ok(await p.evaluate(() => location.hash) === '#atendimento', `${nome}: Atender abre o atendimento`);
  await p.evaluate(() => { window.confirm = () => true; });
  for (let i = 0; i < 8 && !(await p.$('[data-act="at-finalizar"]')); i++) { await p.click('[data-act="etapa"][data-i="7"]').catch(() => {}); await espera(); }
  await clicar('[data-act="at-finalizar"]');
  ok((await dados()).appts.find(a => a.pid === 'p1' && a.date === HOJE).done === true, `${nome}: ao finalizar, o horário fica como atendido`);
  await p.goto(url + '#agenda'); await p.waitForSelector('#ag-l');
  ok(await tem(`${hor('Helena Prado')} [data-s="atendido"].on`) && await tem('[data-cont="atendido"]', 'Atendidos 1'), `${nome}: agenda mostra atendido`);

  // Celular
  for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 }); await p.goto(url + '#agenda'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome} celular ${w}px: sem rolagem horizontal`); }
  ok(!erros.length, `${nome}: sem erros no console` + (erros.length ? ': ' + erros.join(' | ') : ''));
  await ctx.close();
}
const J = x => JSON.stringify(x);
const srv = await iniciar(0), base = `http://localhost:${srv.address().port}/`, browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'arquivo único');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações da agenda passaram.');
process.exit(falhas ? 1 : 0);
