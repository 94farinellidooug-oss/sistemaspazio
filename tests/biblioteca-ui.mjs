// Verifica no navegador a Biblioteca clínica da etapa 4B: áreas Central, Particular e Atlas; fichas
// existentes e pendentes; anotações e fichas particulares gravadas à parte (sem alterar a Central nem o
// formato v1); Atlas com trajetos que ligam e desligam, ficha do ponto, painel do meridiano e do vaso
// com os pontos de abertura e acoplado; celular sem rolagem horizontal.
// Uso: node tests/biblioteca-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { paraV1 } from '../js/dados/migracao.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };

async function verificar(browser, url, nome) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(), erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const espera = () => p.waitForTimeout(80);
  const dados = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('musubi-v2')));
  const tem = async (sel, txt) => (await p.locator(sel, txt ? { hasText: txt } : {}).count()) > 0;
  const area = async a => { await p.click(`[data-act="bib-area"][data-a="${a}"]`); await espera(); };

  await p.goto(url); await p.waitForSelector('#view h1');
  await p.evaluate(() => { location.hash = 'biblioteca'; }); await espera();
  ok(!(await dados())?.biblioteca, `${nome}: sem uso da Particular, os dados ficam iguais`);

  if (nome === 'modular') {
    const fora = await p.evaluate(async () => {
      const C = await import('/js/componentes/corpo.js'), S = 2, out = [];
      for (const [v, ch] of [['anterior','ant'],['posterior','post'],['lat_d','lat']]) {
        const [w, h] = C.TAM[v], d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff';
        d.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w * S}" height="${h * S}" style="display:block">${C.desenho(v, '')}</svg>`; document.body.append(d);
        const den = (x, y) => document.elementsFromPoint(x * S, y * S).some(e => e.closest('.corpo'));
        for (const [k, T] of Object.entries(C.TRAJETOS)) { const P = T[ch]; if (!P) continue;
          for (let i = 0; i + 1 < P.length; i++) for (let t = 0; t <= 1; t += .1) { const x = P[i][0] + (P[i + 1][0] - P[i][0]) * t, y = P[i][1] + (P[i + 1][1] - P[i][1]) * t; if (!den(x, y)) { out.push(`${k}/${ch}`); break; } } }
        d.remove();
      }
      return [...new Set(out)];
    });
    ok(!fora.length, `${nome}: todos os trajetos ficam dentro do corpo${fora.length ? ' (fora: ' + fora.join(', ') + ')' : ''}`);
  }
  // Central
  ok(await p.locator('[data-act="bib-area"]').count() === 3 && await tem('[data-act="bib-area"].on', 'Central'), `${nome}: Biblioteca com Central, Particular e Atlas`);
  ok(await p.locator('#ptlist .pcard').count() === 28, `${nome}: as 28 fichas existentes continuam iguais`);
  ok(await tem('#c-total', '361 de 361 pontos · 28 com ficha') && await p.locator('#c-todos .pc').count() === 361 && await p.locator('#c-todos .pc.tem').count() === 28, `${nome}: todos os 361 pontos, 28 com ficha e os demais pendentes`);
  await p.click('[data-act="mer"][data-m="E"]'); await espera();
  ok(await p.locator('#ptlist .pcard').count() === 2 && await p.locator('#c-todos .pc').count() === 45 && await tem('#c-total', '45 de 361'), `${nome}: filtro por meridiano vale para as fichas e para a lista completa`);
  await p.fill('#pt-q', 'E36'); await espera();
  ok(await p.locator('#c-todos .pc').count() === 1, `${nome}: busca filtra a lista completa`);
  await p.fill('#pt-q', ''); await p.click('[data-act="mer"][data-m=""]'); await espera();
  await p.click('[data-act="bib-pt"][data-c="E36"]'); await espera();
  ok(await tem('.fx-panel .ficha', 'Zusanli') && await tem('.fx-panel .fx-dl', '3 cun abaixo do E35') && await tem('.fx-panel .fx-dl', 'Estômago (E)') && await tem('.fx-panel .fx-pos', 'Aproximada'), `${nome}: ficha existente com meridiano, número, localização, ações e posição`);
  await p.click('[data-act="bib-pt"][data-c="E37"]'); await espera();
  ok(await tem('.fx-panel .ficha', 'Nome pendente') && await tem('.fx-panel .fx-pend-t', 'ficha pendente') && await tem('.fx-panel .fx-pos', 'Sem posição no mapa'), `${nome}: ponto sem conteúdo aparece como ficha pendente`);
  ok(await tem('.fx-panel .fx-dl', 'Joelho · p. 200') && await tem('.fx-panel .ind-f', 'conferido por Mauren'), `${nome}: ficha mostra as regiões indicadas pelo livro, com página e aprovação`);
  // Anotação particular na ficha
  await p.click('[data-act="bib-pt"][data-c="E36"]'); await espera();
  await p.fill('[data-bibnota="E36"]', 'Nota da clínica para teste'); await espera();
  let d = await dados();
  ok(d.biblioteca?.notas?.E36 === 'Nota da clínica para teste', `${nome}: anotação particular gravada à parte`);
  { const { biblioteca, ...resto } = d; ok(JSON.stringify(paraV1(d)) === JSON.stringify(paraV1(resto)) && !JSON.stringify(paraV1(d)).includes('Nota da clínica'), `${nome}: exportação v1 não muda`); }
  // Etapa 4C: revisão da posição no mapa, com quem e quando
  ok(await tem('#fx-pos', 'posição não revisada') && await p.locator('#fx-pos [data-act="bib-rev"][data-ok="1"]').count() === 1, `${nome}: posição começa como não revisada`);
  await p.click('#fx-pos [data-act="bib-rev"][data-ok="1"]'); await espera();
  d = await dados();
  ok(d.biblioteca?.revisoes?.E36?.ok === true && d.biblioteca.revisoes.E36.por === 'Mauren Turcatti' && /^\d{4}-\d{2}-\d{2}T/.test(d.biblioteca.revisoes.E36.em) && await tem('#rev-ok', 'posição revisada') && await tem('#fx-pos', 'Revisada por Mauren Turcatti'), `${nome}: marcar posição como revisada grava quem e quando`);
  await p.click('#fx-pos [data-act="bib-rev"][data-ok="0"]'); await espera();
  d = await dados();
  ok(d.biblioteca.revisoes.E36.ok === false && d.biblioteca.revisoes.E36.hist.length === 2 && d.biblioteca.revisoes.E36.hist[0].acao === 'Revisão retirada' && await tem('#fx-pos', 'Histórico da revisão (2)'), `${nome}: retirar a revisão fica no histórico`);
  { const { biblioteca, ...resto } = d; ok(JSON.stringify(paraV1(d)) === JSON.stringify(paraV1(resto)), `${nome}: revisão não muda a exportação v1`); }
  await p.click('[data-act="bib-pt"][data-c="E37"]'); await espera();
  ok(await p.locator('#fx-pos [data-act="bib-rev"]').count() === 0, `${nome}: ponto sem posição não tem revisão`);
  await p.click('[data-act="bib-pt"][data-c="E36"]'); await espera();
  await p.click('#fx-pos [data-act="bib-rev"][data-ok="1"]'); await espera();
  await p.click('.fx-panel [data-act="bib-fx-x"]'); await espera();
  ok(!(await tem('.fx-panel .ficha')), `${nome}: fechar a ficha`);

  // Particular
  await area('particular');
  ok(await tem('#pa-notas', 'Nota da clínica para teste'), `${nome}: anotação aparece na Particular`);
  await p.fill('#pa-t', 'Protocolo teste'); await p.fill('#pa-p', 'b23'); await p.fill('#pa-x', 'Texto da clínica'); await p.click('#f-part button.pri'); await espera();
  d = await dados();
  ok(d.biblioteca.particular.length === 1 && d.biblioteca.particular[0].ponto === 'B23' && await tem('#pa-fichas', 'Protocolo teste'), `${nome}: ficha particular adicionada`);
  await p.click('#pa-fichas [data-act="bib-pa-pt"][data-c="B23"]'); await espera();
  ok(await tem('[data-act="bib-area"].on', 'Central') && await tem('.fx-panel .ficha', 'Shenshu'), `${nome}: ponto da ficha particular abre a ficha Central`);
  await area('particular');
  p.once('dialog', dl => dl.accept());
  await p.click('#pa-fichas [data-act="bib-pa-rm"]'); await espera();
  ok((await dados()).biblioteca.particular.length === 0, `${nome}: apagar ficha particular`);

  // Atlas
  await area('atlas');
  ok(await p.locator('svg.mapa4.atlas .tj').count() === 2 && await tem('svg.mapa4.atlas .tj[data-tj="E"]') && await tem('svg.mapa4.atlas .tj[data-tj="F"]'), `${nome}: Atlas abre com Estômago e Fígado ligados`);
  await p.click('[data-act="atl-tj"][data-k="E"]'); await espera();
  ok(!(await tem('svg.mapa4.atlas .tj[data-tj="E"]')) && await tem('[data-act="atl-tj"][data-k="E"][aria-pressed="false"]'), `${nome}: desligar trajeto`);
  await p.click('[data-act="atl-todos"][data-g="m"]'); await espera();
  ok(await p.locator('[data-act="atl-tj"].on').count() === 12, `${nome}: ligar todos os meridianos`);
  ok(await tem('#sem-trajeto', 'posterior'), `${nome}: meridianos sem trajeto nesta vista são avisados`);
  await p.click('[data-act="atl-nenhum"][data-g="m"]'); await p.click('[data-act="atl-todos"][data-g="v"]'); await espera();
  ok(await p.locator('[data-act="atl-tj"].on').count() === 8 && await p.locator('svg.mapa4.atlas .tj.vaso').count() > 0 && await p.locator('svg.mapa4.atlas .ptp.abre').count() > 0, `${nome}: vasos com trajeto e pontos de abertura e acoplado`);
  await p.click('[data-act="atl-nenhum"][data-g="v"]'); await p.click('[data-act="atl-tj"][data-k="Chong Mai"]'); await espera();
  ok(await p.locator('svg.mapa4.atlas .ptp.abre[data-pt="CS6"]').count() === 2, `${nome}: Chong Mai destaca CS6 como abertura ou acoplado`);
  await p.locator('svg.mapa4.atlas .tj[data-tj="Chong Mai"] .tj-h').first().click({ force: true }); await espera();
  ok(await tem('.fx-panel', 'Ponto de abertura') && await tem('.fx-panel [data-act="atl-pt"][data-c="BP4"]') && await tem('.fx-panel [data-act="atl-pt"][data-c="CS6"]') && await tem('.fx-panel', 'Yin Wei Mai'), `${nome}: tocar no trajeto do vaso mostra abertura, acoplado e par`);
  await p.click('.fx-panel [data-act="atl-pt"][data-c="BP4"]'); await espera();
  ok(await tem('.fx-panel .ficha', 'Nome pendente'), `${nome}: ponto de abertura sem conteúdo abre como ficha pendente`);
  await p.click('[data-act="atl-tj"][data-k="E"]'); await espera();
  await p.locator('svg.mapa4.atlas .ptp[data-pt="E36"]').first().click(); await espera();
  ok(await tem('.fx-panel .ficha', 'Zusanli') && await p.locator('svg.mapa4.atlas .ptp.pt-on[data-pt="E36"]').count() > 0, `${nome}: tocar num ponto do Atlas abre a ficha`);
  await p.locator('svg.mapa4.atlas .tj[data-tj="E"] .tj-h').first().click({ force: true }); await espera();
  ok(await tem('.fx-panel', '45 pontos') && await p.locator('.fx-panel .pc').count() === 45, `${nome}: tocar no trajeto do meridiano lista os seus pontos`);
  await p.click('[data-act="atl-vista"][data-v="maos"]'); await espera();
  ok(await tem('svg.mapa4.atlas[data-vista="maos"]') && await tem('.at-map', 'Mãos e pés mostram os pontos'), `${nome}: mãos no Atlas`);
  await p.click('[data-act="atl-vista"][data-v="anterior"]'); await p.check('[data-atltodos]'); await espera();
  ok(await p.locator('svg.mapa4.atlas .ptp').count() >= 28, `${nome}: mostrar todos os pontos com posição`);
  await p.click('[data-act="atl-zoom"][data-d="1"]'); await espera();
  ok(await tem('.zoom-v', '150%') && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: ampliação sem rolagem horizontal da página`);

  // Celular
  const cel = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const c = await cel.newPage(); c.on('pageerror', e => erros.push(e.message));
  await c.goto(url); await c.waitForSelector('#view h1'); await c.evaluate(() => { location.hash = 'biblioteca'; }); await c.waitForTimeout(100);
  const semRolagem = () => c.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  let rol = await semRolagem();
  await c.click('[data-act="bib-pt"][data-c="E36"]'); await c.waitForTimeout(80); rol = rol && await semRolagem();
  ok(await c.locator('.fx-panel.aberta').evaluate(e => getComputedStyle(e).position) === 'fixed', `${nome}: no celular a ficha abre por cima, sem sair da lista`);
  for (const a of ['particular', 'atlas']) { await c.click(`[data-act="bib-area"][data-a="${a}"]`); await c.waitForTimeout(80); rol = rol && await semRolagem(); }
  ok(rol, `${nome}: celular sem rolagem horizontal na Central, Particular e Atlas`);
  await cel.close();

  ok(erros.length === 0, `${nome}: sem erros no console${erros.length ? ' → ' + erros.join(' | ') : ''}`);
  await ctx.close();
}
const srv = await iniciar(0); const base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'dist');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTodas as verificações da Biblioteca clínica passaram.');
process.exit(falhas ? 1 : 0);
