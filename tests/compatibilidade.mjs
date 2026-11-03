// Verifica que:
// 1. dist/spazio.html abre direto do disco (file://), sem servidor, e funciona nas 7 telas;
// 2. dados gravados pelo protótipo original na chave spazio-v1 continuam acessíveis
//    na versão modular e no arquivo único (mesma origem);
// 3. dados gravados pela versão nova continuam legíveis pelo original (permite voltar atrás).
// Uso: node tests/compatibilidade.mjs   (requer Playwright e Chromium: npx playwright install chromium)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { iniciar } from '../tools/servidor.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const arquivo = rel => pathToFileURL(join(RAIZ, rel)).href;
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };

async function abrir(ctx, url) {
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await p.goto(url); await p.waitForSelector('#view h1');
  return { p, erros };
}
const ir = async (p, h) => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(50); };

// Grava dados pelo protótipo original: novo paciente, sessão e avaliação.
async function gravarNoOriginal(p) {
  await ir(p, 'pacientes');
  await p.fill('#np-name', 'Paciente Compatibilidade'); await p.fill('#np-birth', '1985-03-02');
  await p.fill('#np-q', 'Lombalgia'); await p.check('#np-lgpd'); await p.click('#f-patient button'); await p.waitForTimeout(60);
  await p.click('[data-t="nova"]'); await p.fill('#ns-pts', 'B23, R3'); await p.fill('#ns-nota', 'Sessão gravada pelo v1');
  await p.click('#f-session button'); await p.waitForTimeout(60);
  await ir(p, 'avaliacao');
  for (const s of ['lombalgia', 'frio_extremidades', 'pulso_profundo']) await p.click(`[data-s="${s}"]`);
  await p.click('[data-act="save-assess"]'); await p.waitForTimeout(60);
  return p.evaluate(() => localStorage.getItem('spazio-v1'));
}
// Confere, na versão nova, que os dados gravados pelo original aparecem.
async function conferir(p, nome) {
  await ir(p, 'pacientes');
  ok(await p.locator('#plist', { hasText: 'Paciente Compatibilidade' }).count() === 1, `${nome}: paciente gravado pelo v1 aparece na lista`);
  await p.click('#plist [data-pid]:has-text("Paciente Compatibilidade")'); await p.waitForTimeout(60);
  await p.click('[data-t="sessoes"]');
  ok(await p.locator('#view', { hasText: 'Sessão gravada pelo v1' }).count() === 1, `${nome}: sessão gravada pelo v1 aparece no prontuário`);
  await p.click('[data-t="resumo"]');
  ok(await p.locator('#view', { hasText: 'Mapa dos cinco elementos' }).count() === 1 && await p.locator('#view svg.penta').count() === 1, `${nome}: avaliação do v1 gera o pentagrama`);
}

const browser = await chromium.launch();

// --- 1. Arquivo único aberto direto do disco, sem servidor ---
{
  const ctx = await browser.newContext();
  const { p, erros } = await abrir(ctx, arquivo('dist/spazio.html'));
  for (const r of ['painel', 'agenda', 'pacientes', 'prontuario', 'avaliacao', 'pentagrama', 'pontos', 'biblioteca', 'administracao']) {
    await ir(p, r);
    ok(await p.locator('#view h1').count() === 1, `file:// dist: tela ${r} abre`);
  }
  ok(erros.length === 0, `file:// dist: sem erros no console${erros.length ? ' → ' + erros.join(' | ') : ''}`);
  await ctx.close();
}

// --- 2. Dados do v1 lidos pela versão nova, abrindo os arquivos do disco ---
{
  const ctx = await browser.newContext();
  const v1 = await abrir(ctx, arquivo('legacy/prototipo-v1.html'));
  const antes = await gravarNoOriginal(v1.p);
  const dist = await abrir(ctx, arquivo('dist/spazio.html'));
  ok(await dist.p.evaluate(() => localStorage.getItem('spazio-v1')) === antes, 'file://: dist lê exatamente os mesmos dados de spazio-v1 gravados pelo v1');
  await conferir(dist.p, 'file:// dist');
  ok(v1.erros.length + dist.erros.length === 0, 'file://: sem erros no console');
  await ctx.close();
}

// --- 3. Mesma origem via servidor: v1 → modular → arquivo único → v1 ---
{
  const srv = await iniciar(0); const base = `http://localhost:${srv.address().port}/`;
  const ctx = await browser.newContext();
  const v1 = await abrir(ctx, base + 'legacy/prototipo-v1.html');
  const antes = await gravarNoOriginal(v1.p);
  const mod = await abrir(ctx, base + 'index.html');
  ok(await mod.p.evaluate(() => localStorage.getItem('spazio-v1')) === antes, 'modular lê exatamente os mesmos dados de spazio-v1');
  await conferir(mod.p, 'modular');
  await ir(mod.p, 'agenda'); await mod.p.fill('#na-t', '07:15'); await mod.p.click('#f-appt button'); await mod.p.waitForTimeout(60);
  const depois = await mod.p.evaluate(() => JSON.parse(localStorage.getItem('spazio-v1')));
  ok(depois.appts.some(a => a.time === '07:15'), 'modular grava novos dados na mesma chave spazio-v1');
  const dist = await abrir(ctx, base + 'dist/spazio.html');
  await conferir(dist.p, 'dist (servidor)');
  const volta = await abrir(ctx, base + 'legacy/prototipo-v1.html');
  await ir(volta.p, 'agenda');
  ok(await volta.p.locator('.appt', { hasText: '07:15' }).count() === 1, 'v1 original lê o agendamento gravado pela versão nova (é possível voltar atrás)');
  const chaves = await volta.p.evaluate(() => Object.keys(localStorage));
  ok(chaves.length === 1 && chaves[0] === 'spazio-v1', `nenhuma chave nova criada no navegador (${chaves.join(', ')})`);
  ok([v1, mod, dist, volta].every(x => x.erros.length === 0), 'sem erros no console');
  await ctx.close(); srv.close();
}

await browser.close();
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTodas as verificações de compatibilidade passaram.');
process.exit(falhas ? 1 : 0);
