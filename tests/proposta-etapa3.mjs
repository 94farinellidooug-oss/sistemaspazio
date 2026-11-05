// Verifica no navegador a proposta navegável da etapa 3 (proposta/etapa-3), com dados fictícios:
// 9 abas na ordem aprovada, pulsologia bilateral com várias classificações por lado, Cun/Guan/Chi nos
// dois lados, deficiência/órgão/observações, origem e situação dos achados, camada de compatibilidade
// (as hipóteses são as mesmas que evaluate() dá para os sinais equivalentes), encaminhamento para a
// Síntese e o Plano só por escolha, vasos com os pares aprovados, pentagrama em camadas, versões com a
// basal preservada e celular sem rolagem horizontal. Nada é gravado no navegador.
// Uso: node tests/proposta-etapa3.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { evaluate } from '../js/raciocinio/avaliacao.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const ABAS = ['Língua e pulso','Ba Gang','Zang-Fu','Qi e Xue','Jin Ye','Jing e Shen','Fatores patogênicos','Vasos extraordinários','Contexto sazonal'];
const PARES = [['Du Mai','ID3','B62'],['Ren Mai','P7','R6'],['Chong Mai','BP4','CS6'],['Dai Mai','VB41','TA5'],['Yin Qiao Mai','R6','P7'],['Yang Qiao Mai','B62','ID3'],['Yin Wei Mai','CS6','BP4'],['Yang Wei Mai','TA5','VB41']];

const srv = await iniciar(0);
const URL_ = `http://localhost:${srv.address().port}/proposta/etapa-3/index.html`;
const browser = await chromium.launch();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const espera = () => p.waitForTimeout(60);
const ir = async h => { await p.evaluate(h => { location.hash = h; }, h); await espera(); };
const aba = async i => { await p.click(`.ab-bar [data-i="${i}"]`); await espera(); };
const txt = sel => p.locator(sel).allInnerTexts();
const hipoteses = async () => (await p.locator('aside .hp b').allInnerTexts()).sort();

await p.goto(URL_); await p.waitForSelector('.ab-bar');

// Abas
const rotulos = (await txt('.ab-bar .ab')).map(t => t.replace(/^\d+\s*/, '').replace(/\s*\d+$/, '').trim());
ok(JSON.stringify(rotulos) === JSON.stringify(ABAS), 'as 9 abas aparecem na ordem aprovada');
for (let i = 0; i < 9; i++) { await aba(i); ok(await p.locator('.ab.on').getAttribute('data-i') === String(i) && await p.locator('#view .card').count() > 0, `aba ${i + 1} (${ABAS[i]}) abre com conteúdo`); }
await aba(0);
await p.click('.ab-nav .btn:has-text("Ba Gang")'); await espera();
ok(await p.locator('.ab.on').getAttribute('data-i') === '1', 'botão "próxima aba" leva à aba seguinte');
await aba(0);

// Pulsologia bilateral
ok(await p.locator('.pulso-l').count() === 2, 'pulso tem lado esquerdo e lado direito');
for (const ld of ['esq', 'dir']) ok(await p.locator(`[data-a="pcls"][data-l="${ld}"]`).count() === 7, `lado ${ld}: as 7 classificações atuais`);
await p.click('[data-a="pcls"][data-l="esq"][data-k="pulso_rapido"]'); await espera();
await p.click('[data-a="pcls"][data-l="esq"][data-k="pulso_profundo"]'); await espera();
ok(await p.locator('[data-a="pcls"][data-l="esq"].on').count() === 3, 'várias classificações marcadas ao mesmo tempo no mesmo lado');
ok(await p.locator('[data-a="pcls"][data-l="dir"][data-k="pulso_rapido"].on').count() === 0, 'marcar um lado não marca o outro');
for (const ld of ['esq', 'dir']) {
  for (const c of ['deficiencia', 'orgao', 'obs']) ok(await p.locator(`[data-p="${ld}.${c}"]`).count() === 1, `lado ${ld}: campo ${c}`);
  for (const pos of ['cun', 'guan', 'chi']) ok(await p.locator(`[data-p="${ld}.pos.${pos}"]`).count() === 1, `lado ${ld}: posição ${pos}`);
}

// Compatibilidade: as hipóteses do painel são exatamente as de evaluate() para os sinais equivalentes
const antes = await hipoteses();
await p.fill('[data-p="esq.deficiencia"]', 'Yin'); await p.fill('[data-p="esq.orgao"]', 'Rim'); await p.fill('[data-p="esq.pos.chi"]', 'Profundo, fraco');
await p.click('[data-a="aba"][data-i="1"]'); await espera(); await aba(0);
ok(JSON.stringify(await hipoteses()) === JSON.stringify(antes), 'deficiência, órgão e posições não alteram as hipóteses');
ok(await p.inputValue('[data-p="esq.orgao"]') === 'Rim' && await p.inputValue('[data-p="esq.pos.chi"]') === 'Profundo, fraco', 'registros escritos do pulso são mantidos ao trocar de aba');
const sinaisPos = async () => (await p.locator('.chip.achado.s-pos').evaluateAll(es => es.map(e => e.dataset.s)));
const pulsoCls = async () => [...new Set(await p.locator('[data-a="pcls"].on').evaluateAll(es => es.map(e => e.dataset.k)))];
const esperado = async () => evaluate([...await sinaisPos(), ...await pulsoCls()]).map(h => h.p.nome).sort();
ok(JSON.stringify(await hipoteses()) === JSON.stringify(await esperado()), 'hipóteses = evaluate() com sinais positivos + classificações de qualquer lado');
await p.click('[data-a="pcls"][data-l="dir"][data-k="pulso_corda"]'); await espera();
ok(JSON.stringify(await hipoteses()) === JSON.stringify(antes), 'a mesma classificação nos dois lados conta uma vez (como um sinal hoje)');
await p.click('[data-a="pcls"][data-l="dir"][data-k="pulso_corda"]'); await espera();

// Origem e situação
const chip = '[data-a="ach"][data-s="lingua_purpura"]';
await p.click(chip); await espera();
ok(await p.locator(`${chip}.s-pos`).count() === 1 && await p.locator('[data-sit="lingua_purpura"]').count() === 1 && await p.locator('[data-orig="lingua_purpura"]').count() === 1, 'achado positivo ganha seleção de situação e de origem');
ok(JSON.stringify(await p.locator('[data-orig="lingua_purpura"] option').allInnerTexts()) === JSON.stringify(['Anamnese','Exame','Observação profissional']), 'origens: Anamnese, Exame, Observação profissional');
ok(JSON.stringify(await p.locator('[data-sit="lingua_purpura"] option').allInnerTexts()) === JSON.stringify(['Positivo','Negativo','Não avaliado']), 'situações: Positivo, Negativo, Não avaliado');
await p.selectOption('[data-orig="lingua_purpura"]', 'obs'); await espera();
ok(await p.inputValue('[data-orig="lingua_purpura"]') === 'obs', 'origem alterada fica registrada');
ok(JSON.stringify(await hipoteses()) === JSON.stringify(await esperado()), 'origem não muda o cálculo');
await p.click(chip); await espera();
ok(await p.locator(`${chip}.s-neg`).count() === 1 && !(await sinaisPos()).includes('lingua_purpura'), 'negativo não entra no cálculo');
ok(JSON.stringify(await hipoteses()) === JSON.stringify(await esperado()), 'hipóteses continuam iguais a evaluate() depois de negativo');
await p.click(chip); await espera();
ok(await p.locator(`${chip}.s-pos, ${chip}.s-neg`).count() === 0, 'terceiro toque volta para não avaliado');

// Achados livres: nada vai para a Síntese ou o Plano sem escolha
await aba(4);
ok(await p.locator('.notice', { hasText: 'campos livres' }).count() === 1 && await p.locator('.livre').count() === 0, 'Jin Ye: só campo livre, sem lista inventada');
await p.fill('#lv-jinye', 'Edema leve em tornozelos'); await p.click('form.livre-f button'); await espera();
ok(await p.locator('.livre', { hasText: 'Edema leve' }).count() === 1, 'achado livre registrado');
ok(await p.locator('.livre [data-dest].on').count() === 0, 'achado novo não é encaminhado automaticamente');
await ir('/sintese'); ok(await p.locator('#view', { hasText: 'Edema leve' }).count() === 0, 'achado não marcado não aparece na Síntese');
await ir('/plano'); ok(await p.locator('#view', { hasText: 'Edema leve' }).count() === 0, 'achado não marcado não aparece no Plano');
await ir('/avaliacao'); await aba(4);
await p.click('.livre:has-text("Edema leve") [data-dest="sintese"]'); await espera();
await ir('/sintese'); ok(await p.locator('.card:has(h3:text-is("Jin Ye")) .sx-i', { hasText: 'Edema leve' }).count() === 1, 'marcado "Síntese": aparece na Síntese, na categoria Jin Ye');
await ir('/plano'); ok(await p.locator('#view', { hasText: 'Edema leve' }).count() === 0, 'marcado só "Síntese": continua fora do Plano');

// Vasos extraordinários
await ir('/avaliacao'); await aba(7);
const vasos = await p.locator('.vt-r').evaluateAll(rs => rs.map(r => [r.querySelector('.vt-n b').textContent, r.querySelector('.vt-n small').textContent]));
ok(vasos.length === 8 && PARES.every(([v, a, c], i) => vasos[i][0] === v && vasos[i][1] === `abertura ${a} · acoplado ${c}`), 'os 8 vasos com os pares aprovados');
ok(JSON.stringify(await p.locator('[data-vs="Dai Mai"] option').allInnerTexts()) === JSON.stringify(['Sem registro','Hipótese','Confirmado pelo profissional']), 'situação do vaso: hipótese ou confirmado pelo profissional');
await p.fill('[data-va="Dai Mai"]', 'Peso na região lombar'); await p.selectOption('[data-vs="Dai Mai"]', 'hip'); await espera();
ok(await p.locator('.vt-r:has([data-va="Dai Mai"]) [data-dest].on').count() === 0, 'vaso registrado não é encaminhado automaticamente');
await ir('/plano'); ok(await p.locator('#view', { hasText: 'Dai Mai' }).count() === 0, 'vaso não marcado não aparece no Plano');
await ir('/avaliacao'); await aba(7);
await p.click('.vt-r:has([data-va="Dai Mai"]) [data-dest="plano"]'); await espera();
await ir('/plano');
ok(await p.locator('.sx-i', { hasText: 'Dai Mai' }).count() === 1, 'marcado "Plano": vaso aparece no Plano');
const pts = async () => p.locator('.card:has(h3:text-is("Pontos do plano")) [data-a="pt"]').evaluateAll(es => es.map(e => e.dataset.c));
ok(!(await pts()).includes('VB41') && !(await pts()).includes('TA5'), 'o par do vaso não entra nos pontos sozinho');
await p.click('[data-a="par"][data-v="Dai Mai"]'); await espera();
ok((await pts()).includes('VB41') && (await pts()).includes('TA5'), 'o par entra só quando o profissional inclui');

// Pentagrama em camadas
await ir('/pentagrama');
ok(await p.locator('[data-a="camada"]').count() === 3 && await p.locator('svg .node, .node').count() >= 5, 'pentagrama com 3 camadas, mesmo componente');
for (const k of ['obs', 'hip', 'conf']) ok(await p.locator(`.pe-l .ly-${k}`).count() === 5, `camada ${k} separada em cada elemento`);
ok(await p.locator('#pt-int').count() === 1, 'campo de interpretação profissional');
await p.click('[data-a="camada"][data-k="conf"]'); await espera();
ok(await p.locator('[data-a="camada"][data-k="conf"].on').count() === 1, 'troca de camada');
await p.click('.node[data-e="madeira"]'); await espera();
ok(await p.locator('.pe').count() === 1, 'tocar num elemento filtra o detalhe');

// Versões
await ir('/versoes');
const basal = async () => p.locator('.ver.basal').innerText();
const b0 = await basal();
ok(await p.locator('.ver.basal', { hasText: 'bloqueada' }).count() === 1 && await p.locator('.ver.basal [data-a="corr"]').count() === 0, 'basal bloqueada, sem botão de correção');
ok(/22\/09\/2026 às 09:10/.test(b0) && /Maicon Farinelli/.test(b0) && /Motivo/.test(b0), 'versão mostra data, hora, profissional e motivo');
ok(await p.locator('.ver', { hasText: 'avulsa' }).count() >= 1 && await p.locator('.ver', { hasText: 'atendimento' }).count() >= 1, 'distingue reavaliação avulsa e versão de atendimento');
const nVer = await p.locator('.ver').count();
await p.click('[data-a="reav"]'); await espera();
await p.click('#f-reav button.pri'); await espera();
ok(await p.locator('.ver').count() === nVer, 'reavaliação sem motivo não é criada');
await p.fill('#rv-m', 'Teste de reavaliação'); await p.click('#f-reav button.pri'); await espera();
ok(await p.locator('.ver').count() === nVer + 1 && await p.locator('.ver', { hasText: 'Teste de reavaliação' }).count() === 1, 'nova reavaliação avulsa cria outra versão');
ok(await basal() === b0, 'a basal continua idêntica depois da nova versão');
const v2 = '.ver:has-text("Piora da cefaleia")';
const h0 = await p.locator(`${v2} .hist-alt > div`).count();
await p.click(`${v2} [data-a="corr"]`); await espera();
await p.fill(`${v2} .corr-f input`, 'Ajuste de teste'); await p.click(`${v2} .corr-f button.pri`); await espera();
ok(await p.locator(`${v2} .hist-alt > div`).count() === h0 + 1 && await p.locator(`${v2} .hist-alt`, { hasText: 'marcado por engano' }).count() === 1 && await p.locator(`${v2} .hist-alt`, { hasText: 'Ajuste de teste' }).count() === 1, 'correção é acrescentada ao histórico, sem apagar o registro anterior');
await p.selectOption('#cmp-a', 'v1'); await p.selectOption('#cmp-b', 'v2'); await espera();
ok(await p.locator('.cmp .lbl').allTextContents().then(t => t.join('|')) === 'Versão 1|Versão 2', 'compara quaisquer duas versões');
ok(await p.evaluate(() => localStorage.length) === 0, 'a proposta não grava nada no navegador');

// Celular sem rolagem horizontal
for (const w of [360, 390]) {
  const m = await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
  const q = await m.newPage(); q.on('pageerror', e => erros.push(e.message));
  await q.goto(URL_); await q.waitForSelector('.ab-bar');
  const largas = [];
  const medir = async rot => { const d = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (d > 0) largas.push(`${rot} (+${d}px)`); };
  for (let i = 0; i < 9; i++) { await q.evaluate(i => document.querySelector(`.ab-bar [data-i="${i}"]`).click(), i); await q.waitForTimeout(40); await medir(`aba ${i + 1}`); }
  for (const r of ['/pentagrama', '/sintese', '/plano', '/versoes']) { await q.evaluate(h => { location.hash = h; }, r); await q.waitForTimeout(50); await medir(r); }
  ok(!largas.length, `${w}px: sem rolagem horizontal${largas.length ? ' em ' + largas.join(', ') : ''}`);
  await m.close();
}

ok(!erros.length, `sem erros no console${erros.length ? ': ' + erros.join(' | ') : ''}`);
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} falha(s)` : '\nProposta da etapa 3: tudo ok');
process.exit(falhas ? 1 : 0);
