// Teste no navegador: executa o mesmo roteiro de uso no protótipo original (legacy),
// na versão modular e no arquivo único gerado (dist), e compara o HTML de cada tela.
// Uso: node tests/navegador.mjs   (requer Playwright com Chromium instalado)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ALVOS = { 'original (legacy)': 'legacy/prototipo-v1.html', 'modular': 'index.html', 'arquivo único (dist)': 'dist/spazio.html' };
// Math.random previsível, para que os ids gerados sejam iguais nas três versões.
const SEMENTE = () => { let s = 42; Math.random = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };

async function roteiro(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(SEMENTE);
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const fotos = [];
  const foto = async nome => fotos.push([nome, await p.evaluate(() => document.getElementById('nav').innerHTML + '\n' + document.getElementById('view').innerHTML)]);
  const ir = async h => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(60); };

  await p.goto(url); await p.waitForSelector('#view .head');
  await foto('abertura');
  for (const r of ['painel', 'agenda', 'pacientes', 'prontuario', 'avaliacao', 'pentagrama', 'pontos']) { await ir(r); await foto('tela ' + r); }

  await ir('pacientes');
  await p.fill('#pq', 'lom'); await foto('busca de paciente');
  await p.fill('#np-name', 'Ana Teste'); await p.fill('#np-birth', '1990-05-10'); await p.fill('#np-phone', '(11) 90000-0000');
  await p.fill('#np-q', 'Dor no ombro'); await p.check('#np-lgpd'); await p.click('#f-patient button');
  await p.waitForTimeout(80); await foto('cadastro de paciente');
  await p.check('#al-gestante'); await p.waitForTimeout(40); await foto('alerta gestante');
  await p.fill('#an-sono', 'Acorda cansada'); await p.press('#an-sono', 'Tab'); await foto('anamnese salva');
  await p.click('[data-t="nova"]'); await p.click('[name=tec][value="Ventosa"]');
  await p.fill('#ns-pts', 'IG4, BP6, B13, XX1'); await p.waitForTimeout(40); await foto('avisos de pontos');
  await p.fill('#ns-nota', 'Primeira sessão'); await p.click('#f-session button'); await p.waitForTimeout(60); await foto('sessão registrada');

  await ir('avaliacao');
  for (const s of ['pulso_corda', 'irritabilidade', 'tpm', 'suspiros']) await p.click(`[data-s="${s}"]`);
  await p.click('[data-act="hyp"][data-p="f_estag"][data-st="aceito"]');
  await p.fill('#as-nota', 'Observação de teste'); await foto('avaliação preenchida');
  await p.click('[data-act="save-assess"]'); await p.waitForTimeout(80); await foto('avaliação salva');

  await ir('pentagrama');
  await p.click('.node[data-e="agua"]'); await foto('pentagrama Água');
  await p.evaluate(() => { const c = document.getElementById('cb-ke'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await foto('pentagrama sem Ke');

  await ir('pontos'); await p.fill('#pt-q', 'shen'); await foto('busca de ponto');
  await p.click('[data-act="mer"][data-m="R"]'); await foto('filtro meridiano R');

  await ir('agenda'); await p.click('[data-act="week"][data-d="1"]'); await foto('próxima semana');
  await p.fill('#na-t', '14:30'); await p.click('#f-appt button'); await p.waitForTimeout(60); await foto('agendamento criado');
  await p.click('[data-act="week"][data-d="0"]'); await p.click('.appt'); await foto('agendamento concluído');

  const dados = await p.evaluate(() => localStorage.getItem('spazio-v1'));
  await p.click('[data-act="reset"]'); await p.waitForTimeout(60); await foto('restaurar exemplos');
  await ctx.close();
  return { fotos, erros, dados };
}

const srv = await iniciar(0);
const base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
const res = {};
for (const [nome, cam] of Object.entries(ALVOS)) res[nome] = await roteiro(browser, base + cam);
await browser.close(); srv.close();

const ref = res['original (legacy)'];
let falhas = 0;
for (const [nome, r] of Object.entries(res)) {
  if (r.erros.length) { falhas++; console.log(`FALHA ${nome}: erros no console`, r.erros); }
  if (r === ref) continue;
  r.fotos.forEach(([etapa, html], i) => {
    const ok = html === ref.fotos[i][1];
    if (!ok) falhas++;
    if (!ok) console.log(`FALHA ${nome} · ${etapa}`);
  });
  const okDados = r.dados === ref.dados;
  if (!okDados) { falhas++; console.log(`FALHA ${nome} · dados salvos diferentes`); }
  console.log(`${nome}: ${r.fotos.filter(([, h], i) => h === ref.fotos[i][1]).length} de ${ref.fotos.length} telas idênticas ao original; dados salvos ${okDados ? 'idênticos' : 'diferentes'}.`);
}
console.log(falhas ? `\n${falhas} diferença(s) encontrada(s).` : '\nRoteiro completo sem erros e com resultado idêntico ao original.');
process.exit(falhas ? 1 : 0);
