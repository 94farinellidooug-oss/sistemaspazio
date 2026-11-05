// Verifica no navegador a proposta navegável da etapa 6 (proposta/etapa-6), com dados fictícios:
// agenda por dia com a semana em cima, situação de cada horário, horários livres, agendar e remarcar;
// documentos preenchidos com os dados do paciente, impressão e prontuário; relacionamento (retomar
// contato e interessados) e celular sem rolagem horizontal.
// Uso: node tests/proposta-etapa6.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const srv = await iniciar(0);
const URL_ = `http://localhost:${srv.address().port}/proposta/etapa-6/index.html`;
const browser = await chromium.launch();
const erros = [];
const p = await (await browser.newContext({ viewport:{ width:1366, height:1400 } })).newPage();
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const espera = () => p.waitForTimeout(50);
const clicar = async sel => { await p.click(sel); await espera(); };
const tem = async (sel, txt) => (await p.locator(sel, txt ? { hasText: txt } : {}).count()) > 0;
const hor = n => `#ag-l .hor:has(.hor-p b:text-is("${n}"))`;

// Agenda
await p.goto(URL_ + '#/agenda'); await p.waitForSelector('#ag-l');
ok(await p.locator('.ag-sem button').count() === 7 && await tem('.ag-sem button.on', '05'), 'semana em cima com o dia de hoje escolhido');
ok(await p.locator('#ag-l .hor').count() === 4 && await tem('#ag-dia', '4 horários'), 'quatro horários hoje');
ok(await tem(`${hor('Marina Costa')} [data-s="confirmado"].on`) && await tem('[data-cont="confirmado"]', 'Confirmados 1'), 'situação do horário ao lado, com contagem');
await clicar(`${hor('João Pereira')} [data-s="confirmado"]`);
ok(await tem('[data-cont="confirmado"]', 'Confirmados 2'), 'confirmar com um toque');
await clicar(`${hor('Pedro Alves')} [data-s="faltou"]`);
ok(await tem(`${hor('Pedro Alves')}.faltou`) && await tem('[data-cont="faltou"]', 'Faltas 1') && !(await tem(`${hor('Pedro Alves')} [data-a="ag-atender"]`)), 'marcar falta tira o botão Atender');
ok(await p.locator('#ag-livres .chip').allTextContents().then(L => L.join(' ') === '08:00 12:00 13:00 15:00 17:00 18:00'), 'horários livres de hoje para acupuntura');
await clicar('#ag-livres .chip:text-is("12:00")');
ok(await p.locator('#f-ag select[data-f="hora"]').inputValue() === '12:00', 'tocar num horário livre preenche o horário');
await clicar('#f-ag .btn.pri');
ok(await tem(hor('Helena Souza'), '12:00') && await tem('#toast', 'Helena agendado'), 'agendar com paciente, serviço e horário');
ok(!(await p.locator('#ag-livres .chip:text-is("12:00")').count()), 'horário agendado sai dos livres');
await clicar('#f-ag .btn.pri');
ok(await tem('#toast', 'Escolha um horário'), 'sem horário, não agenda');
await p.selectOption('#f-ag select[data-f="serv"]', 'Avaliação inicial'); await espera();
ok(!(await p.locator('#ag-livres .chip:text-is("08:00")').count()) && await tem('#f-ag', '90 min'), 'serviço mais longo mostra só onde cabe');
await clicar(`${hor('Ana Ribeiro')} [data-a="ag-rem"]`);
ok(await tem('#f-ag h3', 'Remarcar') && await tem('#f-ag', 'era 05/11/2026 às 16:00'), 'remarcar mostra de onde vem');
await clicar('.ag-sem button[data-d="2026-11-06"]');
ok(await p.locator('#f-ag input[data-f="data"]').inputValue() === '2026-11-05', 'trocar o dia na semana não muda o formulário de remarcar');
await p.fill('#f-ag input[data-f="data"]', '2026-11-06'); await p.dispatchEvent('#f-ag input[data-f="data"]', 'change'); await espera();
await clicar('#ag-livres .chip:text-is("10:00")'); await clicar('#f-ag .btn.pri');
ok(await tem(hor('Ana Ribeiro'), '10:00') && await tem(hor('Ana Ribeiro'), 'remarcado de 05/11/2026 16:00'), 'remarcado guarda o horário anterior');
await clicar('[data-a="hoje"]');
ok(!(await tem(hor('Ana Ribeiro'))), 'horário remarcado sai do dia antigo');
await clicar(`${hor('João Pereira')} [data-a="ag-desm"]`);
ok(!(await tem(hor('João Pereira'))) && await tem('.ag-fora summary', '1 desmarcado'), 'desmarcar guarda o horário na lista de desmarcados');
await clicar(`${hor('Marina Costa')} [data-a="ag-atender"]`);
ok(await tem(`${hor('Marina Costa')} .pill.ok`, 'Atendido') && await tem('#toast', 'atendimento de Marina'), 'Atender abre o atendimento e marca como atendido');

// Documentos
await p.goto(URL_ + '#/documentos'); await espera();
ok(await p.locator('.doc-m button').count() === 4 && await tem('#doc-pv', 'Marina Costa') && await tem('#doc-pv', 'Maicon Farinelli') && await tem('#doc-pv .dp-as'), 'termo já preenchido com paciente e profissional, com linha de assinatura');
await p.selectOption('select[data-docf="pid"]', 'p3'); await espera();
ok(await tem('#doc-pv', 'Helena Souza') && await tem('#doc-lista h3', 'Helena'), 'trocar o paciente troca o documento e a lista');
await clicar('[data-m="declaracao"]');
ok(await tem('#doc-pv', 'esteve em atendimento') && await tem('#doc-pv', 'Spazio Stabilità'), 'declaração de comparecimento');
await clicar('[data-m="registro"]');
ok(await tem('#doc-pv', 'VB20') && await tem('#doc-pv', 'Acupuntura'), 'registro do atendimento vem do atendimento');
await clicar('[data-m="termo"]');
await p.evaluate(() => { window.__imp = 0; window.print = () => { window.__imp++; }; });
await p.evaluate(() => { document.querySelector('#doc-pv .dp-t p').append(' Ajuste feito na hora.'); });
await clicar('[data-a="doc-imp"]');
ok(await p.evaluate(() => window.__imp) === 1 && await tem('#imp', 'Helena Souza') && await tem('#imp', 'Ajuste feito na hora'), 'imprime a folha com o texto ajustado');
await p.emulateMedia({ media:'print' });
ok(await p.locator('#imp').isVisible() && !(await p.locator('.app').isVisible()), 'na impressão só aparece o documento');
await p.emulateMedia({ media:'screen' });
await clicar('[data-a="doc-guardar"]');
ok(await tem('#doc-lista .doc-li', 'Termo de consentimento') && await tem('#doc-lista', 'Maicon Farinelli'), 'guardar no prontuário com data e profissional');
await clicar('#doc-lista [data-a="doc-ass"]');
ok(await tem('#doc-lista .pill.ok', 'assinado'), 'termo marcado como assinado');

// Relacionamento
await p.goto(URL_ + '#/relacionamento'); await espera();
ok(await tem('.nav a.on', 'Administração') && await tem('.migalha', 'Administração'), 'fica dentro da Administração');
ok(await tem('#rel-ret', 'Carlos Lima') && !(await tem('#rel-ret', 'Ana Ribeiro')) && !(await tem('#rel-ret', 'Marina Costa')), 'retomar contato: mais de 21 dias e nada agendado');
await clicar('[data-rel="p4"] [data-a="rel-contato"]');
ok(await tem('[data-rel="p4"] .ctt-c', 'contato em 05/11/2026 · Maicon Farinelli'), 'contato feito registra dia e quem');
await clicar('[data-rel="p4"] [data-a="rel-ocultar"]');
ok(!(await tem('[data-rel="p4"]')) && await tem('[data-a="rel-ver-oc"]', '1 que você preferiu não retomar'), 'não retomar tira da lista sem apagar');
await clicar('[data-int="i1"] [data-s="agendou"]');
ok(await tem('[data-int="i1"] .chip.on', 'Agendou'), 'situação do interessado com um toque');
await p.fill('#f-int input[data-int="nome"]', 'Fernanda Rocha'); await p.fill('#f-int input[data-int="tel"]', '(54) 99000-0000'); await clicar('#f-int .btn.pri');
ok(await tem('#rel-int .ctt', 'Fernanda Rocha') && await tem('#rel-int .ctt:has-text("Fernanda") .chip.on', 'Novo'), 'incluir interessado com nome, telefone e origem');
await clicar('[data-a="rel-ver-oc"]'); await clicar('[data-rel="p4"] [data-a="rel-volta"]');
ok(await tem('[data-rel="p4"] [data-a="rel-agendar"]'), 'quem saiu da lista pode voltar');
await clicar('[data-rel="p4"] [data-a="rel-agendar"]');
ok(await tem('#f-ag') && await p.locator('#f-ag select[data-f="pid"]').inputValue() === 'p4', 'Agendar leva à agenda com o paciente escolhido');

// Celular
for (const w of [390, 360]) {
  const c = await (await browser.newContext({ viewport:{ width:w, height:800 } })).newPage(); let sem = true;
  for (const r of ['agenda','documentos','relacionamento']) { await c.goto(URL_ + '#/' + r); await c.waitForTimeout(150); sem = sem && await c.evaluate(() => document.documentElement.scrollWidth <= innerWidth); }
  ok(sem, `celular ${w}px: três telas sem rolagem horizontal`); await c.close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações da proposta da etapa 6 passaram.');
process.exit(falhas ? 1 : 0);
