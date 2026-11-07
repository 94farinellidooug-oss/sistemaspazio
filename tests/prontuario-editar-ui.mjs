// Verifica no navegador a edição de um atendimento salvo no prontuário (pedido de 07/11/2026): o botão
// "Editar registro" abre uma janela por cima do prontuário (antes "Abrir no ambiente" travava a tela nos
// atendimentos vindos do registro rápido ou do protótipo); salvar exige o motivo; a versão original fica
// guardada e aparece junto das edições; Esc e Cancelar fecham; o menu continua funcionando; celular sem
// rolagem horizontal.
// Uso: node tests/prontuario-editar-ui.mjs
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const srv = await iniciar(0), BASE = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  const erros = [], ctx = await browser.newContext({ viewport:{ width:1280, height:900 } }), p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const tem = async (s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
  const clicar = async s => { await p.click(s); await p.waitForTimeout(150); };
  const dados = () => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')) || { patients:[] });
  const atend = async id => (await dados()).patients.flatMap(x => x.atendimentos).find(a => a.id === id);
  await p.goto(BASE + url + '#pacientes'); await p.waitForTimeout(400);
  await clicar('[data-act=open] >> nth=0'); await clicar('[data-act=tab][data-t=sessoes]');
  ok(await p.locator('[data-act=pr-editar]').count() === await p.locator('.lt-i:not(.av)').count() && !(await tem('.lt-i', 'Abrir no ambiente')), `${rot}: cada atendimento do prontuário tem "Editar registro"`);
  ok(!(await tem('[data-act=abrir-atendimento]')), `${rot}: atendimentos do registro rápido ou do protótipo não abrem o ambiente das 8 etapas (era o que travava)`);

  const id = await p.locator('[data-act=pr-editar] >> nth=0').getAttribute('data-id');
  const textoItem = await p.locator('.lt-i', { has:p.locator(`[data-act=pr-editar][data-id="${id}"]`) }).innerText();
  await clicar('[data-act=pr-editar] >> nth=0');
  ok(await tem('#f-edreg[role=dialog]') && await p.evaluate(() => location.hash) === '#prontuario', `${rot}: a janela de edição abre por cima do prontuário`);
  const antes = { nota:await p.inputValue('#ed-nota'), pts:await p.inputValue('#ed-pts'), q1:await p.inputValue('[data-edq=q1]') };
  ok(antes.nota && textoItem.includes(antes.nota) && antes.pts.split(', ').every(c => textoItem.includes(c)), `${rot}: a janela traz o que foi registrado`);
  await p.fill('#ed-nota', 'Evolução corrigida no teste'); await p.fill('[data-edq=q1]', '3');
  await clicar('#f-edreg button.pri');
  ok(await tem('#f-edreg') && !(await atend(id))?.edicoes, `${rot}: sem o motivo a edição não é salva`);
  await p.fill('#ed-motivo', 'Corrigir anotação do dia'); await clicar('#f-edreg button.pri');
  const depois = await atend(id);
  ok(!(await tem('#f-edreg')) && depois.evolucao.nota === 'Evolução corrigida no teste' && depois.evolucao.intensidades.q1 === 3, `${rot}: com o motivo, a edição é salva`);
  ok(depois.edicoes.length === 1 && depois.edicoes[0].motivo === 'Corrigir anotação do dia' && depois.edicoes[0].antes.nota === antes.nota && String(depois.edicoes[0].antes.intensidades.q1) === antes.q1, `${rot}: a versão original fica guardada inteira`);
  const item = p.locator('.lt-i', { has:p.locator(`[data-act=pr-editar][data-id="${id}"]`) });
  ok(await item.locator('.pill', { hasText:'editado' }).count() === 1 && (await item.innerText()).includes('Evolução corrigida no teste'), `${rot}: o prontuário mostra a versão editada com o selo "editado"`);
  await item.locator('.pr-ed summary').click(); await p.waitForTimeout(100);
  const txt = await item.locator('.pr-ed').innerText();
  ok(txt.includes('Corrigir anotação do dia') && txt.includes('Versão original') && txt.includes(antes.nota), `${rot}: "Versão original e edições" mostra o motivo e o original`);

  // Fechar sem salvar: Esc e Cancelar; o menu continua funcionando.
  await clicar(`[data-act=pr-editar][data-id="${id}"]`); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(!(await tem('#f-edreg')), `${rot}: Esc fecha a janela`);
  await clicar(`[data-act=pr-editar][data-id="${id}"]`); await p.fill('#ed-nota', 'não salvar'); await clicar('#f-edreg [data-act=pr-editar-x].ghost:not([aria-label])');
  ok(!(await tem('#f-edreg')) && (await atend(id)).edicoes.length === 1, `${rot}: Cancelar fecha sem salvar`);
  await clicar(`[data-act=pr-editar][data-id="${id}"]`); await clicar('#f-edreg .chips label >> nth=0');
  ok(await tem('#f-edreg'), `${rot}: clicar dentro da janela não fecha`);
  await p.mouse.click(5, 5); await p.waitForTimeout(150);
  ok(!(await tem('#f-edreg')), `${rot}: clicar fora fecha`);
  await clicar('nav a[href="#agenda"]');
  ok(await p.evaluate(() => location.hash) === '#agenda' && await tem('#view h1', 'Agenda'), `${rot}: depois de editar, o menu continua levando às outras telas`);

  // Celular
  await p.setViewportSize({ width:390, height:844 }); await p.evaluate(() => { location.hash = '#prontuario'; }); await p.waitForTimeout(300);
  await clicar('[data-act=tab][data-t=sessoes]'); await clicar(`[data-act=pr-editar][data-id="${id}"]`);
  ok(await tem('#f-edreg') && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.querySelector('#f-edreg').getBoundingClientRect().right <= innerWidth + 1), `${rot}: celular sem rolagem horizontal com a janela aberta`);
  ok(!erros.length, `${rot}: sem erros no console` + (erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA edição no prontuário passou.');
process.exit(falhas ? 1 : 0);
