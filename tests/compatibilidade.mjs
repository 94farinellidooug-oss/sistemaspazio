// Verifica que:
// 1. dist/spazio.html abre direto do disco (file://), sem servidor, e funciona nas 7 telas;
// 2. dados gravados pelo protótipo original na chave spazio-v1 são convertidos para o modelo v2
//    (musubi-v2) sem perda, e a chave spazio-v1 continua intacta;
// 3. a exportação no formato do protótipo, feita em Administração, é lida pelo original (permite voltar atrás);
// 4. a exportação completa pode ser importada em outro navegador, e dados v2 ilegíveis não são descartados.
// Uso: node tests/compatibilidade.mjs   (requer Playwright e Chromium: npx playwright install chromium)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { iniciar } from '../tools/servidor.mjs';
import { paraV1 } from '../js/dados/migracao.js';
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
  if (!await p.$('#np-name')) { await p.click('[data-act="novo-paciente"]'); await p.waitForTimeout(60); }
  await p.fill('#np-name', 'Paciente Compatibilidade'); await p.fill('#np-birth', '1985-03-02');
  await p.fill('#np-q', 'Lombalgia'); await p.check('#np-lgpd'); await p.click('#f-patient button'); await p.waitForTimeout(60);
  await p.click('[data-t="nova"]'); await p.fill('#ns-pts', 'B23, R3'); await p.fill('#ns-nota', 'Sessão gravada pelo v1');
  await p.click('#f-session button'); await p.waitForTimeout(60);
  await ir(p, 'avaliacao');
  for (const s of ['lombalgia', 'frio_extremidades', 'pulso_profundo']) await p.click(`[data-s="${s}"]`);
  await p.click('[data-act="save-assess"]'); await p.waitForTimeout(60);
  return p.evaluate(() => localStorage.getItem('spazio-v1'));
}
// Confere que a versão nova converteu os dados do v1 para o v2 sem perda e sem alterar a chave do v1.
async function convertido(p, antes, nome) {
  const { v1, v2 } = await p.evaluate(() => ({ v1: localStorage.getItem('spazio-v1'), v2: localStorage.getItem('musubi-v2') }));
  ok(v1 === antes, `${nome}: chave spazio-v1 intacta`);
  ok(!!v2 && JSON.stringify(paraV1(JSON.parse(v2))) === antes, `${nome}: musubi-v2 criado e, convertido de volta, idêntico aos dados do v1`);
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
  await conferir(dist.p, 'file:// dist');
  await convertido(dist.p, antes, 'file:// dist');
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
  await conferir(mod.p, 'modular');
  await convertido(mod.p, antes, 'modular');
  await ir(mod.p, 'agenda'); await mod.p.fill('#na-t', '07:15'); await mod.p.click('#f-appt button'); await mod.p.waitForTimeout(60);
  const depois = await mod.p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')));
  ok(depois.appts.some(a => a.time === '07:15'), 'modular grava novos dados no modelo v2 (musubi-v2)');
  ok(await mod.p.evaluate(() => localStorage.getItem('spazio-v1')) === antes, 'chave spazio-v1 continua intacta depois de gravar na versão nova');
  const dist = await abrir(ctx, base + 'dist/spazio.html');
  await conferir(dist.p, 'dist (servidor)');
  // Voltar ao protótipo: exportar no formato v1 e gravar o arquivo na chave do protótipo.
  await ir(mod.p, 'administracao');
  const [dl] = await Promise.all([mod.p.waitForEvent('download'), mod.p.click('[data-act="exportar"][data-f="v1"]')]);
  const arquivoV1 = readFileSync(await dl.path(), 'utf8');
  ok(dl.suggestedFilename().startsWith('spazio-v1-dados-') && JSON.parse(arquivoV1).patients.some(p => p.name === 'Paciente Compatibilidade'), 'exportação no formato do protótipo gera o arquivo com os pacientes');
  const [dl2] = await Promise.all([mod.p.waitForEvent('download'), mod.p.click('[data-act="exportar"][data-f="v2"]')]);
  const arquivoV2 = readFileSync(await dl2.path(), 'utf8');
  const chaves = await mod.p.evaluate(() => Object.keys(localStorage).sort());
  ok(JSON.stringify(chaves) === JSON.stringify(['musubi-v2', 'spazio-v1']), `só a chave musubi-v2 foi criada ao lado da spazio-v1 (${chaves.join(', ')})`);
  const volta = await abrir(ctx, base + 'legacy/prototipo-v1.html');
  await volta.p.evaluate(x => { localStorage.setItem('spazio-v1', x); }, arquivoV1); await volta.p.reload(); await volta.p.waitForSelector('#view .head');
  await ir(volta.p, 'agenda');
  ok(await volta.p.locator('.appt', { hasText: '07:15' }).count() === 1, 'v1 original lê o agendamento gravado pela versão nova a partir da exportação (é possível voltar atrás)');
  ok([v1, mod, dist, volta].every(x => x.erros.length === 0), 'sem erros no console');
  await ctx.close();

  // Importar a exportação completa em outro navegador (contexto vazio)
  const ctx2 = await browser.newContext(); const novo = await abrir(ctx2, base + 'index.html');
  await ir(novo.p, 'administracao');
  const tmp = join(RAIZ, 'tests', '.importar.json'); writeFileSync(tmp, arquivoV2);
  novo.p.once('dialog', d => d.accept());
  await novo.p.setInputFiles('#imp-arq', tmp); await novo.p.waitForTimeout(300); unlinkSync(tmp);
  const imp = await novo.p.evaluate(() => localStorage.getItem('musubi-v2'));
  ok(imp && JSON.stringify(JSON.parse(imp)) === JSON.stringify(JSON.parse(arquivoV2)), 'importação restaura exatamente os dados exportados');
  await ir(novo.p, 'pacientes');
  ok(await novo.p.locator('#plist', { hasText: 'Paciente Compatibilidade' }).count() === 1, 'paciente importado aparece na lista');
  ok(novo.erros.length === 0, 'importação sem erros no console');
  await ctx2.close();

  // Dados v2 ilegíveis não são descartados: ficam guardados à parte e o sistema volta aos dados do protótipo
  const ctx3 = await browser.newContext(); const q = await abrir(ctx3, base + 'legacy/prototipo-v1.html');
  const antes3 = await gravarNoOriginal(q.p);
  await q.p.evaluate(() => localStorage.setItem('musubi-v2', '{quebrado'));
  const r3 = await abrir(ctx3, base + 'index.html');
  ok(await r3.p.evaluate(() => localStorage.getItem('musubi-v2-ilegivel')) === '{quebrado', 'dados v2 ilegíveis guardados em musubi-v2-ilegivel');
  await convertido(r3.p, antes3, 'recuperação');
  ok(r3.erros.length === 0, 'recuperação sem erros no console');
  await ctx3.close(); srv.close();
}

await browser.close();
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTodas as verificações de compatibilidade passaram.');
process.exit(falhas ? 1 : 0);
