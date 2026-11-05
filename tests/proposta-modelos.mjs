// Verifica no navegador a proposta de modelos de documento (proposta/modelos), com dados fictícios:
// o texto do modelo é editado num campo comum da página, com botões para inserir dados do sistema; a
// folha é só prévia; salvar marca como "seu"; voltar ao original; criar e apagar modelo; imprimir;
// celular sem rolagem horizontal.
// Uso: node tests/proposta-modelos.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const srv = await iniciar(0);
const URL_ = `http://localhost:${srv.address().port}/proposta/modelos/index.html`;
const browser = await chromium.launch();
const erros = [];
const p = await (await browser.newContext({ viewport:{ width:1366, height:1200 } })).newPage();
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => { window.__imp = []; window.print = () => window.__imp.push(document.getElementById('imp').innerText); });
const espera = () => p.waitForTimeout(50);
const clicar = async sel => { await p.click(sel); await espera(); };
const tem = async (sel, txt) => (await p.locator(sel, txt ? { hasText: txt } : {}).count()) > 0;

await p.goto(URL_ + '#/documentos'); await p.waitForSelector('#doc-pv');
ok(await tem('#doc-pv', 'Eu, Marina Costa') && await tem('#doc-pv', 'Maicon Farinelli') && await tem('#doc-pv .dp-as'), 'prévia já preenchida com o paciente');
ok(await p.locator('#doc-pv [contenteditable]').count() === 0 && await p.evaluate(() => !document.getElementById('doc-pv').isContentEditable), 'a folha não se edita, é só prévia');
await p.selectOption('#d-p', 'p2'); await espera();
ok(await tem('#doc-pv', 'Eu, João Pereira'), 'trocar o paciente troca a prévia');

// Editar o termo na página
await clicar('[data-a="editar"]');
ok(await tem('#f-mod textarea#m-texto') && (await p.locator('#m-texto').inputValue()).startsWith('Eu, {paciente}'), 'editar abre o texto num campo comum, com os dados entre chaves');
await p.locator('#m-texto').press('Control+End'); await p.keyboard.type('\n\nAtendido em {data}. ');
await espera();
ok(await tem('#doc-pv', 'Atendido em 05/11/2026'), 'a prévia acompanha o que se digita');
await clicar('[data-a="campo"][data-k="cpf"]');
ok((await p.locator('#m-texto').inputValue()).endsWith('{data}. {cpf}') && await tem('#doc-pv', '(sem CPF)') && await tem('.mod-raw .cp', 'CPF do paciente'), 'botão insere o dado no lugar do cursor');
await p.uncheck('#m-assina'); await espera();
ok(!(await tem('#doc-pv .dp-as')), 'pode tirar a linha de assinatura');
await clicar('#f-mod .btn.pri');
ok(await tem('#toast', 'Modelo salvo') && await tem('[data-m="termo"] .pill', 'seu') && await tem('.mod-l li', 'editado'), 'salvar marca o modelo como seu');
ok(await tem('#doc-pv', 'Atendido em 05/11/2026') && !(await tem('#doc-pv .dp-as')), 'documento usa o modelo salvo');

// Voltar ao original
await clicar('[data-a="editar"]'); await clicar('[data-a="ed-orig"]');
ok(!(await p.locator('#m-texto').inputValue()).includes('Atendido em'), 'voltar ao texto original');
await clicar('#f-mod .btn.pri');
ok(!(await tem('[data-m="termo"] .pill')) && await tem('#doc-pv .dp-as'), 'salvo o original, deixa de ser seu');
await clicar('[data-a="editar"]'); await p.fill('#m-texto', 'mudou'); await clicar('[data-a="ed-x"]');
ok(await tem('#doc-pv', 'Eu, João Pereira') && !(await tem('#f-mod')), 'cancelar não muda o modelo');

// Modelo novo
await clicar('[data-a="novo"]');
await p.fill('#m-nome', ''); await p.fill('#m-texto', 'x'); await clicar('#f-mod .btn.pri');
ok(await tem('#f-mod') && !(await tem('.mod-l li', 'criado por você')), 'sem nome, não salva');
await p.fill('#m-nome', 'Atestado de repouso'); await p.fill('#m-texto', 'Atesto que {paciente} precisa de repouso hoje, {data}.'); await espera();
await clicar('#f-mod .btn.pri');
ok(await tem('.doc-m button.on', 'Atestado de repouso') && await tem('.mod-l li', 'criado por você') && await tem('#doc-pv', 'Atesto que João Pereira'), 'modelo novo criado e escolhido');
await clicar('[data-a="imp"]');
ok((await p.evaluate(() => window.__imp.at(-1) || '')).includes('Atesto que João Pereira'), 'imprime a prévia');
await clicar('[data-a="guardar"]');
ok(await tem('#toast', 'guardado no prontuário de João'), 'guardar no prontuário');
await clicar('[data-a="editar"]'); await clicar('[data-a="ed-apagar"]');
ok(!(await tem('.doc-m button', 'Atestado')) && await tem('.doc-m button.on', 'Termo'), 'apagar modelo próprio');
ok(!(await tem('[data-a="ed-apagar"]')), 'modelos originais não se apagam');

for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 }); await p.goto(URL_ + '#/documentos'); await p.reload(); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular ${w}px: sem rolagem horizontal`);
  await clicar('[data-a="editar"]');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular ${w}px editando: sem rolagem horizontal`); }
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações da proposta de modelos passaram.');
process.exit(falhas ? 1 : 0);
