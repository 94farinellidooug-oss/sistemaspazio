// Tira as imagens das telas usadas na página de apresentação (inicio/telas), a partir do sistema atual
// com os pacientes de exemplo. Rodar de novo quando o visual do sistema mudar.
// Uso: node tools/telas-site.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciar } from './servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const DEST = join(dirname(fileURLToPath(import.meta.url)), '..', 'inicio', 'telas');
const srv = await iniciar(0), BASE = `http://localhost:${srv.address().port}/index.html`;
const browser = await chromium.launch();
const nova = async viewport => {
  const p = await (await browser.newContext({ viewport, deviceScaleFactor:viewport.width < 500 ? 2 : 1 })).newPage();
  await p.addInitScript(() => { try { localStorage.setItem('musubi-modo', 'local'); localStorage.removeItem('musubi-tema'); } catch (e) {} });
  await p.goto(BASE); await p.waitForTimeout(400); return p;
};
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); await p.evaluate(() => scrollTo(0, 0)); };
const foto = async (p, n) => { await p.mouse.move(2, 850); await p.waitForTimeout(200); await p.screenshot({ path:join(DEST, n + '.png') }); };

const p = await nova({ width:1366, height:860 });
for (const r of ['painel', 'agenda', 'financeiro', 'relatorios', 'documentos']) { await ir(p, r); await foto(p, r); }
await ir(p, 'biblioteca'); await p.click('#view .pt-card >> nth=0').catch(() => {}); await p.waitForTimeout(300); await p.evaluate(() => scrollTo(0, 0)); await foto(p, 'biblioteca');
// Atendimento da primeira paciente de hoje: avaliação, pentagrama e mapa
await ir(p, 'agenda'); await p.click('[data-act=novo-atendimento] >> nth=0'); await p.waitForTimeout(500);
for (const [i, n] of [[1, 'avaliacao'], [2, 'pentagrama'], [4, 'mapa']]) {
  await (await p.$$('.steps button, .steps a'))[i].click(); await p.waitForTimeout(500);
  if (n === 'mapa') {
    // Algumas marcações para a imagem: dor no ombro e na lombar, irradiação no braço
    const marcar = async (tipo, pts) => { await p.click(`[data-act=at-mv-ferr][data-t=${tipo}]`); await p.waitForTimeout(200);
      for (const [x, y] of pts) { await p.locator('svg.mapa4').scrollIntoViewIfNeeded();
        const [cx, cy] = await p.evaluate(([x, y]) => { const s = document.querySelector('svg.mapa4'), q = s.createSVGPoint(); q.x = x; q.y = y; const r = q.matrixTransform(s.getScreenCTM()); return [r.x, r.y]; }, [x, y]);
        await p.mouse.click(cx, cy); await p.waitForTimeout(250); } };
    await marcar('dor', [[70, 95], [100, 185]]); await marcar('irradiacao', [[66, 108], [58, 150]]); await marcar('limitacao', [[118, 320]]);
    await p.click('[data-act=at-mv-ferr][data-t=sel]').catch(() => {}); await p.waitForTimeout(3500);
  }
  await p.evaluate(m => scrollTo(0, m ? document.querySelector('svg.mapa4').getBoundingClientRect().top + scrollY - 300 : 0), n === 'mapa'); await foto(p, n);
}
const c = await nova({ width:390, height:800 });
await ir(c, 'painel'); await foto(c, 'celular');
await browser.close(); srv.close();
console.log('Telas salvas em inicio/telas.');
