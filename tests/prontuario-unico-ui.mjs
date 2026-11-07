// Verifica no navegador o prontuário único (pedido de 07/11/2026): avaliação energética, pentagrama,
// anamnese, versões e CID ficam dentro do prontuário do paciente (as antigas telas #avaliacao e #pentagrama
// abrem a aba correspondente), e a busca de CID-10 por código ou descrição sugere código e descrição,
// inclui no prontuário, mostra no cabeçalho e retira sem apagar. Celular sem rolagem horizontal.
// Uso: node tests/prontuario-unico-ui.mjs
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
  const ir = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
  const dados = () => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')) || { patients:[] });
  await p.goto(BASE + url + '#pacientes'); await p.waitForTimeout(400);
  await clicar('[data-act=open] >> nth=0');
  const abas = await p.locator('.tabs [data-act=tab]').allInnerTexts();
  ok(['Resumo', 'Atendimentos', 'Anamnese e alertas', 'Avaliação energética', 'Pentagrama', 'Versões da avaliação', 'CID', 'Registro rápido'].every(a => abas.some(x => x.trim() === a)), `${rot}: o prontuário tem as abas de tudo (${abas.length})`);
  ok(!(await tem('.perfil-a [data-to=avaliacao]')) && !(await tem('.perfil-a [data-to=pentagrama]')), `${rot}: avaliação e pentagrama não são mais telas à parte no cabeçalho`);
  const nome = (await p.locator('.perfil-h h1').innerText()).trim();

  // Avaliação dentro do prontuário
  await clicar('[data-act=tab][data-t=avaliacao]');
  ok(await p.evaluate(() => location.hash) === '#prontuario' && await tem('[data-act=save-assess]') && !(await tem('#as-patient')) && await tem('.perfil-h h1', nome), `${rot}: a avaliação energética abre como aba do prontuário do paciente`);
  await clicar('[data-act=tab][data-t=pentagrama]');
  ok(await tem('svg.penta') && !(await tem('#pt-patient')) && await p.evaluate(() => location.hash) === '#prontuario', `${rot}: o pentagrama abre como aba do prontuário`);
  await ir('avaliacao');
  ok(await p.evaluate(() => location.hash) === '#prontuario' && await tem('.tabs .on', 'Avaliação energética'), `${rot}: o endereço antigo #avaliacao abre a aba do prontuário`);
  for (const s of ['pulso_corda', 'irritabilidade']) await clicar(`[data-s="${s}"]`);
  await clicar('[data-act=save-assess]');
  const d1 = await dados();
  ok(await p.evaluate(() => location.hash) === '#prontuario' && await tem('.perfil-h h1', nome) && d1.patients.find(x => x.name === nome).avaliacoes.length >= 1, `${rot}: salvar a avaliação fica no prontuário do mesmo paciente`);

  // CID
  await clicar('[data-act=tab][data-t=cid]');
  await p.fill('#cid-q', 'f41'); await p.waitForTimeout(600);
  const ops = await p.locator('.cid-o').allInnerTexts();
  ok(ops.length > 3 && ops[0].includes('F41') && ops.some(x => x.includes('F41.1') && x.includes('Ansiedade generalizada')), `${rot}: digitar "f41" sugere os CIDs com código e descrição`);
  await p.fill('#cid-q', 'dor lomb'); await p.waitForTimeout(300);
  ok((await p.locator('.cid-o').first().innerText()).includes('M54.5'), `${rot}: digitar parte da descrição ("dor lomb") sugere M54.5 Dor lombar baixa`);
  await p.press('#cid-q', 'Enter'); await p.waitForTimeout(250);
  ok(await tem('.cid-sel .cid-i', 'M54.5') && await tem('.perfil-h .cid-pill', 'M54.5') && await p.inputValue('#cid-q') === '', `${rot}: Enter inclui o primeiro sugerido; aparece no cabeçalho do prontuário`);
  await p.fill('#cid-q', 'ansiedade gen'); await p.waitForTimeout(300); await clicar('.cid-o >> nth=0');
  await p.fill('#cid-q', 'm545'); await p.waitForTimeout(300); await clicar('.cid-o >> nth=0');
  ok(await p.locator('.cid-sel .cid-i').count() === 2 && await tem('.toast, #toast', 'já está'), `${rot}: clicar inclui; o mesmo CID não entra duas vezes`);
  await p.fill('#cid-q', 'xyzw'); await p.waitForTimeout(300);
  ok(await tem('.cid-l', 'Nenhum CID encontrado'), `${rot}: busca sem resultado avisa`);
  await p.press('#cid-q', 'Escape'); await p.waitForTimeout(100);
  await clicar('.cid-sel [data-act=cid-tirar] >> nth=0');
  const pac = (await dados()).patients.find(x => x.name === nome);
  ok(await p.locator('.cid-sel .cid-i:not(.fora)').count() === 1 && pac.diagnosticos.length === 2 && pac.diagnosticos.filter(x => x.ativo === false).length === 1 && await tem('details', 'retirado'), `${rot}: retirar não apaga; fica em "retirados"`);
  await p.reload(); await p.waitForTimeout(400);
  ok(await tem('.perfil-h .cid-pill', 'F41.1') && !(await tem('.perfil-h .cid-pill', 'M54.5')), `${rot}: o CID fica guardado ao recarregar`);

  // Celular
  await p.setViewportSize({ width:390, height:844 }); await p.waitForTimeout(200);
  await clicar('[data-act=tab][data-t=cid]'); await p.fill('#cid-q', 'cefaleia'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${rot}: celular sem rolagem horizontal (abas e CID)`);
  ok(!erros.length, `${rot}: sem erros no console` + (erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nO prontuário único passou.');
process.exit(falhas ? 1 : 0);
