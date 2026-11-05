// Verifica no navegador a proposta navegável da etapa 5 (proposta/etapa-5), com dados fictícios:
// lista curta de pontos (lado bilateral ou unilateral e situação), orientações para casa com impressão,
// verificação de segurança, evolução por queixa escolhida pelo profissional, aviso de
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
// Lista curta: cada ponto só com lado (bilateral ou unilateral) e situação
ok(await p.locator('#rx-l .rx').count() === 5, 'cinco pontos na lista');
ok(await p.locator('#rx-l input[type="number"], #rx-l select').count() === 0, 'sem campos de agulhas, técnica ou tempo por ponto');
ok(await tem(`${rx('VB20')} [data-a="lado"][data-l="bil"].on`) && await tem(`${rx('C7')} [data-a="lado"][data-l="uni"].on`) && await tem(`${rx('VG20')} .rx-med`, 'linha média'), 'lado bilateral ou unilateral; VG na linha média');
await clicar(`${rx('F3')} [data-a="lado"][data-l="uni"]`);
ok(await tem(`${rx('F3')} [data-a="lado"][data-l="uni"].on`), 'mudar o lado com um toque');
ok(await tem(`${rx('VB20')} .rx-w`) && await tem('#rx-seg .notice', 'Fengchi') && await tem('#rx-seg .notice.crit', 'anticoagulante'), 'cautela no ponto e verificação de segurança com as técnicas');
await clicar('[data-a="tec"][data-t="Ventosa"]');
ok(!(await tem('#rx-seg .notice.crit')), 'tirar a ventosa tira o aviso do anticoagulante');
await clicar(`${rx('VB20')} [data-a="st"][data-s="real"]`);
ok(await tem(`${rx('VB20')}.real`) && await tem('[data-cont="real"]', 'Realizado 1'), 'marcar ponto como realizado');
await clicar(`${rx('C7')} [data-a="st"][data-s="nao"]`);
ok(await tem(`${rx('C7')}.nao`) && await p.locator(`${rx('C7')} .rx-mot`).getAttribute('placeholder') === 'Motivo (opcional)', 'não realizado com motivo opcional');
await p.fill(`${rx('C7')} .rx-mot`, 'Paciente preferiu não aplicar hoje'); await espera();
await clicar('[data-a="todos-real"]');
ok(await p.locator('#rx-l .rx.real').count() === 4 && await tem(`${rx('C7')}.nao`), 'todos realizados só muda os planejados');
await p.fill('#rx-c', 'e36'); await clicar('#f-rx button');
ok(await tem(`${rx('E36')}.plan`) && await tem(`${rx('E36')} [data-a="lado"][data-l="bil"].on`), 'ponto incluído entra bilateral e planejado');
await p.fill('#rx-c', 'E36'); await clicar('#f-rx button');
ok(await p.locator(rx('E36')).count() === 1, 'não repete ponto');
await clicar(`${rx('E36')} [data-a="rx-rm"]`);
ok(!(await tem(rx('E36'))), 'tirar ponto');
// Orientações para casa com impressão
await p.evaluate(() => { window.__imp = 0; window.print = () => { window.__imp++; }; });
await clicar('[data-a="imprimir"]');
ok(await p.evaluate(() => window.__imp) === 0, 'sem orientações, não imprime');
await p.fill('#orient', 'Compressa morna na nuca à noite'); await espera();
await clicar('[data-a="imprimir"]');
ok(await p.evaluate(() => window.__imp) === 1 && await tem('#imp', 'Compressa morna') && await tem('#imp', 'Marina Costa') && await tem('#imp', 'Mauren Turcatti') && !(await tem('#imp', 'VB20')), 'imprime folha só com as orientações, paciente, data e profissional');
await p.emulateMedia({ media:'print' });
ok(await p.locator('#imp').isVisible() && !(await p.locator('.app').isVisible()), 'na impressão só aparece a folha do paciente');
await p.emulateMedia({ media:'screen' });

// Evolução
await p.goto(URL_ + '#/evolucao'); await espera();
ok(await tem('#ev-q', '3 sem situação') && await tem('[data-q="q4"] .chip.on', 'Nova'), 'queixas sem situação escolhida; queixa nova marcada como nova');
ok(await tem('[data-q="q1"] .qx-d.cai', '-3') && await tem('[data-q="q2"] .qx-d', '0'), 'diferença só mostra os números da Anamnese');
await clicar('[data-a="sit"][data-q="q1"][data-s="melhora"]'); await clicar('[data-a="sit"][data-q="q3"][data-s="resolvida"]');
ok(await tem('[data-q="q1"] .chip.on', 'Melhora') && await tem('[data-q="q3"] .chip.on', 'Resolvida') && await tem('#ev-q', '1 sem situação'), 'profissional escolhe a situação de cada queixa');
await clicar('[data-a="sit"][data-q="q1"][data-s="melhora"]');
ok(!(await tem('[data-q="q1"] .chip.on')), 'tocar de novo desmarca');
ok(await tem('#ev-feito', 'VB20') && await tem('#ev-feito .nao', 'Paciente preferiu não aplicar hoje') && !(await tem('#ev-plan')), 'feito hoje e não realizado vêm da lista de pontos');
await p.goto(URL_ + '#/plano'); await espera(); await clicar(`${rx('F3')} [data-a="st"][data-s="plan"]`);
await p.goto(URL_ + '#/evolucao'); await espera();
ok(await tem('#ev-plan', '1 ponto ainda planejado'), 'avisa pontos ainda planejados antes de finalizar');
await clicar('[data-a="finalizar"]');
ok(!(await tem('#toast', 'motivo')), 'finalizar com pontos planejados só avisa, não bloqueia');

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
