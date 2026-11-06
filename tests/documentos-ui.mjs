// Verifica no navegador a tela Documentos (etapa 6B) no sistema modular e no arquivo único: modelo +
// paciente já preenchido, folha só prévia, modelos editados na página (campo comum, botões de dados,
// salvar como seu, voltar ao original, criar e apagar), impressão, guardar no prontuário, termo
// assinado, imprimir de novo, atalhos do prontuário e do atendimento, e celular sem rolagem horizontal.
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
  p.on('dialog', d => d.accept());
  await p.goto(url + '#documentos'); await p.waitForSelector('#doc-pv');

  ok(await p.locator('.doc-m [data-act="doc-mod"]').count() === 4 && await p.evaluate(() => !document.getElementById('doc-pv').querySelector('[contenteditable]')) && await tem('#doc-t', 'Helena Prado') && await tem('#doc-t', 'Maicon Farinelli') && await tem('#doc-pv .dp-as'), `${nome}: termo já preenchido, com linha de assinatura; a folha é só prévia`);
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
  ok(await tem('#toast', 'sem texto') && (await p.evaluate(() => window.__imp.length)) === 0, `${nome}: sem texto, não imprime`);

  // Editar o modelo na página, imprimir e guardar
  await clicar('[data-m="termo"]'); await clicar('[data-act="doc-editar"]');
  ok(await tem('#f-mod') && (await p.locator('#m-texto').inputValue()).startsWith('Eu, {paciente}') && await tem('#mod-raw .cp', 'Paciente'), `${nome}: editar abre o texto do modelo num campo comum`);
  await p.locator('#m-texto').press('Control+End'); await p.keyboard.type(' Ajuste feito na hora em {data}.'); await espera();
  ok(await tem('#doc-t', 'Ajuste feito na hora em ' + await p.evaluate(() => new Date().toLocaleDateString('pt-BR'))) && await p.evaluate(() => document.activeElement.id) === 'm-texto', `${nome}: a prévia acompanha o que se digita, sem perder o cursor`);
  await clicar('[data-act="doc-campo"][data-k="profissional"]');
  ok((await p.locator('#m-texto').inputValue()).endsWith('{data}.{profissional}') && await tem('#mod-raw .cp', 'Profissional'), `${nome}: botão insere o dado no cursor`);
  await clicar('#f-mod .btn.pri');
  const M = (await dados()).modelosDoc;
  ok(M?.termo?.texto.includes('Ajuste feito na hora') && M.termo.por === 'Maicon Farinelli' && await tem('[data-m="termo"] .pill', 'seu') && await tem('#doc-modelos li', 'editado'), `${nome}: modelo salvo como seu`);
  await clicar('[data-act="doc-imp"]');
  const folha = await p.evaluate(() => window.__imp.at(-1) || '');
  ok(folha.includes('Termo de consentimento') && folha.includes('Rafael Monteiro') && folha.includes('Ajuste feito na hora') && folha.includes('Maicon Farinelli'), `${nome}: imprime a folha com o modelo editado`);
  await p.emulateMedia({ media:'print' });
  ok(await p.locator('#imp').isVisible() && !(await p.locator('.app').isVisible()), `${nome}: na impressão só aparece o documento`);
  await p.emulateMedia({ media:'screen' });
  await clicar('[data-act="doc-guardar"]');
  const d = (await dados()).patients.find(x => x.id === 'p2').documentos;
  ok(d?.length === 1 && d[0].modelo === 'termo' && d[0].nome === 'Termo de consentimento' && d[0].texto.includes('Ajuste feito na hora') && d[0].por === 'Maicon Farinelli', `${nome}: guardado no prontuário com o texto, quem e quando`);
  ok(await tem('#doc-lista .doc-li', 'Termo de consentimento') && await tem('#doc-lista [data-act="doc-ass"]'), `${nome}: aparece na lista do paciente`);
  await clicar('#doc-lista [data-act="doc-ass"]');
  ok(await tem('#doc-lista .pill.ok', 'assinado') && (await dados()).patients.find(x => x.id === 'p2').documentos[0].assinado === true, `${nome}: termo marcado como assinado`);
  await clicar('[data-act="doc-editar"]'); await clicar('[data-act="doc-ed-orig"]');
  ok(!(await dados()).modelosDoc.termo && !(await tem('#doc-t', 'Ajuste feito')) && !(await tem('[data-m="termo"] .pill')), `${nome}: voltar ao texto original`);
  await clicar('[data-act="doc-editar"]'); await p.fill('#m-texto', 'mudou'); await clicar('[data-act="doc-ed-x"]');
  ok(!(await tem('#doc-t', 'mudou')) && !(await tem('#f-mod')), `${nome}: cancelar não muda o modelo`);

  // Modelo próprio
  await clicar('[data-act="doc-novo-mod"]');
  await p.fill('#m-nome', 'Atestado de repouso'); await p.fill('#m-texto', 'Atesto que {paciente} precisa de repouso hoje, {data}.'); await p.uncheck('#m-assina'); await espera();
  await clicar('#f-mod .btn.pri');
  ok(await tem('.doc-m button.on', 'Atestado de repouso') && await tem('#doc-modelos li', 'criado por você') && await tem('#doc-t', 'Atesto que Rafael Monteiro') && !(await tem('#doc-pv .dp-as')), `${nome}: modelo novo criado e escolhido`);
  await clicar('[data-act="doc-guardar"]');
  await clicar('[data-act="doc-editar"]'); await clicar('[data-act="doc-ed-apagar"]');
  ok(!(await tem('.doc-m button', 'Atestado')) && await tem('#doc-lista .doc-li', 'Atestado de repouso') && !(await tem('[data-act="doc-ed-apagar"]')), `${nome}: apagar o modelo mantém o documento guardado`);
  await clicar('[data-act="doc-editar"]');
  ok(!(await tem('[data-act="doc-ed-apagar"]')) && !(await tem('[data-act="doc-ed-orig"]')), `${nome}: modelo original sem alteração não se apaga nem volta`);
  await clicar('[data-act="doc-ed-x"]');
  await clicar('[data-m="declaracao"]'); await clicar('#doc-lista .doc-li:has-text("Termo") [data-act="doc-reimp"]');
  ok((await p.evaluate(() => window.__imp.at(-1))).includes('Ajuste feito na hora'), `${nome}: imprimir de novo usa o texto guardado`);

  // Assinatura na tela (etapa 7B)
  await p.selectOption('#doc-p', 'p3'); await espera(); await clicar('[data-m="termo"]');
  await clicar('[data-act="doc-assinar"]');
  ok(await tem('.ass-p canvas#ass-c') && await p.locator('[data-act="ass-ok"]').isDisabled(), `${nome}: quadro de assinatura; confirmar só depois de assinar`);
  const bb = await p.locator('#ass-c').boundingBox();
  const assinar = async () => { await p.mouse.move(bb.x + 40, bb.y + 100); await p.mouse.down(); for (let i = 0; i < 20; i++) await p.mouse.move(bb.x + 40 + i * 12, bb.y + 100 + 35 * Math.sin(i / 3)); await p.mouse.up(); await espera(); };
  await assinar();
  ok(!(await p.locator('[data-act="ass-ok"]').isDisabled()), `${nome}: depois de assinar, pode confirmar`);
  await clicar('[data-act="ass-limpar"]');
  ok(await p.locator('[data-act="ass-ok"]').isDisabled(), `${nome}: limpar recomeça`);
  await assinar(); await clicar('[data-act="ass-ok"]');
  ok(await tem('#doc-pv .dp-as img.ass-img') && await tem('#doc-pv .dp-as', 'assinado na tela em') && await p.locator('[data-act="doc-assinar"]').isDisabled(), `${nome}: assinatura vai para a prévia com data e hora`);
  await clicar('[data-act="doc-imp"]');
  ok(await p.evaluate(() => !!document.querySelector('#imp img.ass-img')), `${nome}: a folha impressa leva a assinatura`);
  await clicar('[data-act="doc-guardar"]');
  const dA = (await dados()).patients.find(x => x.id === 'p3').documentos[0];
  ok(dA.assinado && dA.naTela && dA.assinatura.startsWith('data:image/png;base64,') && dA.assinadoPor === 'Maicon Farinelli' && await tem('#doc-lista .pill.ok', 'assinado na tela'), `${nome}: guardado no prontuário com a assinatura, quando e quem`);
  ok(!(await tem('#doc-pv img.ass-img')) && !(await p.locator('[data-act="doc-assinar"]').isDisabled()), `${nome}: o próximo documento começa sem assinatura`);
  await clicar('#doc-lista .doc-li:has-text("Termo") [data-act="doc-reimp"]');
  ok(await p.evaluate(() => !!document.querySelector('#imp img.ass-img')), `${nome}: imprimir de novo leva a assinatura guardada`);
  await clicar('[data-m="declaracao"]');
  ok(!(await tem('[data-act="doc-assinar"]')), `${nome}: declaração não tem assinatura`);

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
