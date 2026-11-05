// Verifica no navegador a proposta navegável da etapa 5 (proposta/etapa-5), com dados fictícios:
// prescrição em linhas (lado, agulhas, técnica, tempo e situação), motivo do não realizado, verificação
// de segurança por linha com a técnica dela, evolução por queixa escolhida pelo profissional, aviso de
// linhas ainda planejadas, retificação com motivo obrigatório e celular sem rolagem horizontal.
// Uso: node tests/proposta-etapa5.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const srv = await iniciar(0);
const URL_ = `http://localhost:${srv.address().port}/proposta/etapa-5/index.html`;
const browser = await chromium.launch();
const erros = [];
const p = await (await browser.newContext({ viewport:{ width:1366, height:1400 } })).newPage();
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const espera = () => p.waitForTimeout(50);
const clicar = async sel => { await p.click(sel); await espera(); };
const tem = async (sel, txt) => (await p.locator(sel, txt ? { hasText: txt } : {}).count()) > 0;
const rx = c => `.rx:has(.rx-c:text-is("${c}"))`;

await p.goto(URL_ + '#/plano'); await p.waitForSelector('#rx-l');
// Prescrição em linhas
ok(await p.locator('#rx-l .rx').count() === 5 && await p.locator('#pr-l .rx').count() === 1, 'cinco pontos e um procedimento sem ponto');
ok(await p.locator(`${rx('VB20')} select[data-k="lado"]`).inputValue() === 'bil' && await p.locator(`${rx('VG20')} select[data-k="lado"]`).inputValue() === 'med', 'lado bilateral por padrão e linha média para VG');
ok(await p.locator(`${rx('VB20')} input[data-k="agulhas"]`).inputValue() === '2' && await p.locator(`${rx('VG20')} input[data-k="agulhas"]`).inputValue() === '1', 'agulhas pelo lado');
await p.selectOption(`${rx('F3')} select[data-k="lado"]`, 'esq'); await espera();
ok(await p.locator(`${rx('F3')} input[data-k="agulhas"]`).inputValue() === '1', 'mudar o lado ajusta as agulhas');
ok(await tem(`${rx('VB20')} .rx-c`) && await tem(`${rx('VB20')}`, 'do mapa corporal') && await tem(`${rx('B23')}`, 'indicado para a região'), 'cada linha diz de onde veio o ponto');
// Segurança por linha, com a técnica da linha
ok(await tem(`${rx('B23')} .notice.crit`, 'anticoagulante') && !(await tem(`${rx('F3')} .notice.crit`)), 'aviso de anticoagulante só na linha com ventosa');
await p.selectOption(`${rx('B23')} select[data-k="tec"]`, 'Acupuntura'); await espera();
ok(!(await tem(`${rx('B23')} .notice.crit`)), 'trocar a técnica da linha tira o aviso');
await p.selectOption(`${rx('B23')} select[data-k="tec"]`, 'Ventosa'); await espera();
ok(await tem(`${rx('VB20')} .notice`, 'Fengchi') && await tem('#rx-seg .notice', 'Fengchi'), 'cautela da ficha na linha e no resumo de segurança');
// Situação de cada linha
await clicar(`${rx('VB20')} [data-a="st"][data-s="real"]`);
ok(await tem(`${rx('VB20')}.real`) && await tem('[data-cont="real"]', 'Realizado 1'), 'marcar linha como realizada');
await clicar(`${rx('C7')} [data-a="st"][data-s="nao"]`);
ok(await tem(`${rx('C7')} .rx-falta`, 'Escreva o motivo'), 'não realizado pede o motivo');
await p.fill(`${rx('C7')} input[data-k="motivo"]`, 'Paciente preferiu não aplicar hoje'); await espera();
ok(await p.locator(`${rx('C7')} .rx-falta`).isHidden(), 'com motivo, o aviso some');
await clicar('[data-a="todos-real"]');
ok(await p.locator('#rx-l .rx.real').count() === 4 && await tem(`${rx('C7')}.nao`) && await tem('#pr-l .rx.real'), 'marcar todos só muda as planejadas');
// Incluir e tirar
await p.fill('#rx-c', 'e36'); await p.selectOption('#rx-t', 'Moxabustão'); await clicar('#f-rx button');
ok(await tem(rx('E36')) && await p.locator(`${rx('E36')} select[data-k="tec"]`).inputValue() === 'Moxabustão' && await tem(`${rx('E36')}.plan`), 'incluir ponto à mão com a técnica escolhida');
await p.fill('#rx-c', 'E36'); await clicar('#f-rx button');
ok(await p.locator(rx('E36')).count() === 1, 'não repete ponto');
await clicar(`${rx('E36')} [data-a="rx-rm"]`);
ok(!(await tem(rx('E36'))), 'tirar ponto da prescrição');
await p.fill('#orient', 'Compressa morna na nuca'); await espera();

// Evolução
await p.goto(URL_ + '#/evolucao'); await espera();
ok(await tem('#ev-q', '3 sem situação') && await tem('[data-q="q4"] .chip.on', 'Nova'), 'queixas sem situação escolhida; queixa nova marcada como nova');
ok(await tem('[data-q="q1"] .qx-d.cai', '-3') && await tem('[data-q="q2"] .qx-d', '0'), 'diferença só mostra os números da Anamnese');
await clicar('[data-a="sit"][data-q="q1"][data-s="melhora"]'); await clicar('[data-a="sit"][data-q="q3"][data-s="resolvida"]');
ok(await tem('[data-q="q1"] .chip.on', 'Melhora') && await tem('[data-q="q3"] .chip.on', 'Resolvida') && await tem('#ev-q', '1 sem situação'), 'profissional escolhe a situação de cada queixa');
await clicar('[data-a="sit"][data-q="q1"][data-s="melhora"]');
ok(!(await tem('[data-q="q1"] .chip.on')), 'tocar de novo desmarca');
ok(await tem('#ev-feito', 'VB20') && await tem('#ev-feito .nao', 'Paciente preferiu não aplicar hoje') && !(await tem('#ev-plan')), 'feito hoje e não realizado vêm da prescrição');
await p.goto(URL_ + '#/plano'); await espera(); await clicar(`${rx('F3')} [data-a="st"][data-s="plan"]`);
await p.goto(URL_ + '#/evolucao'); await espera();
ok(await tem('#ev-plan', '1 linha ainda planejada'), 'avisa linhas ainda planejadas antes de finalizar');

// Prontuário e retificação
await p.goto(URL_ + '#/prontuario'); await espera();
ok(await p.locator('.pr-li').count() === 3 && await tem('#pr-ret', 'Nenhuma correção'), 'atendimento finalizado sem correções');
await clicar('.pr-li:has-text("BP6") [data-a="corr"]');
ok(await tem('#f-corr', 'antes: BP6'), 'corrigir mostra o valor anterior');
await p.selectOption('#f-corr select[data-k="status"]', 'real'); await clicar('#f-corr .btn.pri');
ok(await tem('#f-corr') && await tem('#pr-ret', 'Nenhuma correção'), 'sem motivo, a correção não é salva');
await p.fill('#f-corr input[data-k="motivo"]', 'Esqueci de marcar como realizado'); await clicar('#f-corr .btn.pri');
ok(await tem('#pr-ret li', 'Situação') && await tem('#pr-ret li s', 'Planejado') && await tem('#pr-ret li', 'Realizado') && await tem('#pr-ret li', 'Mauren Turcatti') && await tem('#pr-ret li', 'Esqueci de marcar'), 'correção registrada com antes, depois, autor e motivo');
ok(await tem('.pr-li:has-text("BP6") .pill.ok', 'Realizado'), 'linha mostra o valor corrigido');

// Celular
for (const w of [390, 360]) {
  const c = await (await browser.newContext({ viewport:{ width:w, height:800 } })).newPage(); let sem = true;
  for (const r of ['plano','evolucao','prontuario']) { await c.goto(URL_ + '#/' + r); await c.waitForTimeout(150); sem = sem && await c.evaluate(() => document.documentElement.scrollWidth <= innerWidth); }
  ok(sem, `celular ${w}px: três telas sem rolagem horizontal`); await c.close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações da proposta da etapa 5 passaram.');
process.exit(falhas ? 1 : 0);
