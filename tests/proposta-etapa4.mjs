// Verifica no navegador a proposta navegável da etapa 4 (proposta/etapa-4), com dados fictícios: seis vistas,
// lado anatômico do paciente, marcações de cada tipo, edição e remoção, lado e intensidade, trajeto da
// irradiação, coordenadas independentes da ampliação, comparação com atendimentos anteriores, passagem ao
// prontuário sem sobrescrever, pontos do plano no mapa, Atlas (trajetos, fichas existentes e pendentes,
// revisão de posição, Particular sem alterar a Central) e celular sem rolagem horizontal.
// Uso: node tests/proposta-etapa4.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { PT } from '../js/conhecimento/pontos.js';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const srv = await iniciar(0);
const URL_ = `http://localhost:${srv.address().port}/proposta/etapa-4/index.html`;
const browser = await chromium.launch();
const erros = [];
const p = await (await browser.newContext({ viewport:{ width:1366, height:1500 } })).newPage();
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const espera = () => p.waitForTimeout(50);
const clicar = async sel => { await p.click(sel); await espera(); };
const vista = async (v, f) => { await clicar(`[data-a="vista"][data-v="${v}"]`); if (f) await clicar(`[data-a="vista-face"][data-f="${f}"]`); };
// Toca no desenho em coordenadas do próprio desenho (viewBox), qualquer que seja a ampliação.
const tocar = async (x, y, sel = 'svg.mapa4') => {
  await p.locator(sel).scrollIntoViewIfNeeded();
  const [cx, cy] = await p.evaluate(([x, y, sel]) => { const s = document.querySelector(sel), q = s.createSVGPoint(); q.x = x; q.y = y; const r = q.matrixTransform(s.getScreenCTM()); return [r.x, r.y]; }, [x, y, sel]);
  await p.mouse.click(cx, cy); await espera();
};
const atuais = () => p.locator('svg.mapa4 .mk.e-at');
const ultimaId = async () => (await p.locator('.mk-li').last().getAttribute('data-id'));
const marcar = async (tipo, x, y) => { await clicar(`[data-a="ferr"][data-t="${tipo}"]`); await tocar(x, y); return ultimaId(); };
const attr = (id, a) => p.locator(`svg.mapa4 .mk[data-id="${id}"]`).getAttribute(a);

await p.goto(URL_ + '#/mapa'); await p.waitForSelector('svg.mapa4');

// Seis vistas
const VISTAS = { anterior:'0 0 200 430', posterior:'0 0 200 430', lat_d:'0 0 200 430', lat_e:'0 0 200 430', maos:'0 0 280 256', pes:'0 0 280 276' };
ok(await p.locator('.vbar [data-a="vista"]').count() === 6, 'seis botões de vista');
for (const [v, vb] of Object.entries(VISTAS)) {
  await vista(v);
  ok(await p.locator('svg.mapa4').getAttribute('data-vista') === v && await p.locator('svg.mapa4').getAttribute('viewBox') === vb && await p.locator('svg.mapa4 .corpo').count() > 0, `vista ${v} desenha a silhueta`);
}
await vista('maos'); ok(await p.locator('[data-a="vista-face"]').count() === 2, 'mãos: palmar e dorsal');
await vista('pes'); ok(await p.locator('[data-a="vista-face"]').count() === 2, 'pés: dorsal e plantar');
await vista('anterior');
ok(JSON.stringify(await p.locator('svg.mapa4 .lado-t').allTextContents()) === '["D","E"]', 'anterior: D à esquerda de quem olha (lado do paciente)');
await vista('posterior');
ok(JSON.stringify(await p.locator('svg.mapa4 .lado-t').allTextContents()) === '["E","D"]', 'posterior: lados invertidos');
ok((await p.locator('.legenda').first().innerText()).includes('Limitação funcional'), 'legenda com os cinco tipos');

// Lado anatômico sugerido pela posição tocada
const ladoEm = async (v, f, x, y) => { await vista(v, f); const id = await marcar('dor', x, y); return attr(id, 'data-lado'); };
ok(await ladoEm('anterior', null, 78, 260) === 'dir', 'anterior: toque à esquerda de quem olha = lado direito do paciente');
ok(await ladoEm('posterior', null, 78, 260) === 'esq', 'posterior: toque à esquerda de quem olha = lado esquerdo do paciente');
ok(await ladoEm('lat_d', null, 100, 260) === 'dir', 'lateral direita = lado direito');
ok(await ladoEm('lat_e', null, 100, 260) === 'esq', 'lateral esquerda = lado esquerdo');
ok(await ladoEm('maos', 'palmar', 70, 150) === 'dir', 'mãos palmar: mão à esquerda de quem olha é a direita');
ok(await ladoEm('maos', 'dorsal', 70, 150) === 'esq', 'mãos dorsal: mão à esquerda de quem olha é a esquerda');
ok(await ladoEm('pes', 'dorsal', 70, 150) === 'dir', 'pés dorsal: pé à esquerda de quem olha é o direito');
ok(await ladoEm('pes', 'plantar', 70, 150) === 'esq', 'pés plantar: pé à esquerda de quem olha é o esquerdo');

// Cada tipo de marcação
await vista('anterior');
const antes = await atuais().count();
await clicar('[data-a="ferr"][data-t="sintoma"]'); await tocar(5, 300);
ok(await atuais().count() === antes, 'toque fora do corpo não cria marcação');
for (const t of ['dor', 'sintoma', 'limitacao', 'procedimento']) {
  const id = await marcar(t, 120, 300);
  ok(await p.locator(`svg.mapa4 .mk.t-${t}[data-id="${id}"]`).count() === 1, `marcação "${t}" criada no corpo`);
  ok(await p.locator('#ed [data-a="int"]').count() === (t === 'procedimento' ? 0 : 11), `${t}: ${t === 'procedimento' ? 'sem intensidade' : 'intensidade de 0 a 10'}`);
  if (t === 'procedimento') { ok(await p.locator('#ed [data-mk="procedimento"]').count() === 1, 'procedimento: campo do procedimento realizado'); await p.fill('#ed [data-mk="procedimento"]', 'Ventosa'); }
}
ok(await p.locator('svg.mapa4 .mk.e-at').filter({ has:p.locator('circle, path, rect') }).count() >= 4, 'várias marcações na mesma região');
// Irradiação: origem e destino
const nRad = await atuais().count();
await clicar('[data-a="ferr"][data-t="irradiacao"]'); await tocar(90, 240);
ok((await p.locator('#dica').innerText()).includes('destino'), 'irradiação pede o destino depois da origem');
await tocar(86, 330);
const rad = await ultimaId();
ok(await atuais().count() === nRad + 1 && await attr(rad, 'data-x2') !== null && await p.locator(`.mk[data-id="${rad}"] path.rad`).count() === 1 && await p.locator(`.mk[data-id="${rad}"] path.seta`).count() === 1, 'irradiação desenha o trajeto da origem ao destino');
ok((await p.locator('#ed').innerText()).includes('Origem e destino marcados'), 'editor mostra o trajeto da irradiação');
await clicar('#ed [data-a="redesenhar"]'); await tocar(84, 380);
ok(Math.abs(Number(await attr(rad, 'data-y2')) - 380 / 430) < .003, 'destino redesenhado');

// Edição: lado, intensidade, anotação e tipo
const id = await marcar('dor', 70, 280);
await p.selectOption('#ed [data-mk="lado"]', 'bil'); await espera();
ok(await attr(id, 'data-lado') === 'bil' && await p.locator(`.mk[data-id="${id}"] .esp`).count() === 1, 'lado bilateral, com o lado espelhado no mapa');
await clicar('#ed [data-a="int"][data-n="7"]');
ok(await p.locator(`.mk[data-id="${id}"] .mk-n`).textContent() === '7' && (await p.locator('#mk-int-v').innerText()).includes('7 de 10'), 'intensidade 7 registrada');
await clicar('#ed [data-a="int"][data-n="7"]');
ok(await p.locator(`.mk[data-id="${id}"] .mk-n`).count() === 0, 'tocar de novo limpa a intensidade');
await clicar('#ed [data-a="int"][data-n="4"]');
await p.fill('#ed [data-mk="regiao"]', 'Coxa'); await p.fill('#ed [data-mk="nota"]', 'Pior ao subir escadas');
await p.selectOption('#ed [data-mk="tipo"]', 'limitacao'); await espera();
ok(await p.locator(`.mk.t-limitacao[data-id="${id}"]`).count() === 1 && await p.inputValue('#ed [data-mk="nota"]') === 'Pior ao subir escadas' && await p.inputValue('#ed [data-mk="regiao"]') === 'Coxa', 'tipo trocado mantendo região e anotação');
ok((await p.locator('#ed').innerText()).includes(`03/11/2026`) && (await p.locator('#ed').innerText()).includes('3º atendimento'), 'marcação mostra data e atendimento');
// Seleção pelo mapa
await clicar('[data-a="desmarcar"]');
await tocar(70, 280);
ok(await p.locator(`.mk[data-id="${id}"].sel`).count() === 1, 'em "Selecionar", tocar numa marcação abre a edição');
// Remoção com confirmação
const n0 = await atuais().count();
await clicar('#ed [data-a="rm"]'); await clicar('#ed [data-a="rm-nao"]');
ok(await atuais().count() === n0, 'cancelar não remove');
await clicar('#ed [data-a="rm"]'); await clicar('#ed [data-a="rm-sim"]');
ok(await atuais().count() === n0 - 1 && await p.locator(`.mk[data-id="${id}"]`).count() === 0, 'remover depois de confirmar');

// Coordenadas independentes da ampliação
const idz1 = await marcar('dor', 130, 260);
await clicar('[data-a="zoom"][data-d="1"]'); await clicar('[data-a="zoom"][data-d="1"]');
ok(await p.locator('.zoom-v').first().innerText() === '200%', 'ampliação em 200%');
const idz2 = await marcar('dor', 130, 260);
const dz = async k => Math.abs(Number(await attr(idz1, k)) - Number(await attr(idz2, k)));
ok(await dz('data-x') < .003 && await dz('data-y') < .002 && Math.abs(Number(await attr(idz2, 'data-x')) - .65) < .003, 'o mesmo ponto do corpo dá a mesma coordenada com e sem ampliação');
ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'ampliação não cria rolagem horizontal na página');
await clicar('[data-a="zoom"][data-d="-1"]'); await clicar('[data-a="zoom"][data-d="-1"]');

// Comparação
await vista('posterior');
ok(await p.locator('svg.mapa4 .mk.e-ant').count() > 0, 'marcações do atendimento anterior em cinza');
await clicar('[data-a="cmp-ant"]');
ok(await p.locator('svg.mapa4 .mk.e-ant').count() === 0, 'anterior pode ser ocultado');
await p.selectOption('[data-cmp-hist]', 'a1'); await espera();
ok(await p.locator('svg.mapa4 .mk.e-hist').count() > 0, 'atendimento mais antigo aparece como histórico');
ok(await p.locator('svg.mapa4 .mk.e-hist').first().getAttribute('data-at') === 'a1', 'histórico mostra só o atendimento escolhido');
await tocar(...(await p.evaluate(() => { const g = document.querySelector('svg.mapa4 .mk.e-hist[data-id="m4"]'); return [Number(g.dataset.x) * 200, Number(g.dataset.y) * 430]; })));
ok((await p.locator('#ed').innerText()).includes('somente leitura'), 'marcação de outro atendimento abre só para leitura');
const linha = await p.locator('#evolucao tr', { hasText:'Lombar' }).first().innerText();
ok(/8\s+6\s+3/.test(linha), 'comparação lado a lado: dor lombar 8, 6 e 3');

// Pontos do plano
ok(await p.locator('svg.mapa4 .ptp.plano[data-pt="VG4"]').count() === 1, 'ponto do plano com posição aparece no mapa');
ok((await p.locator('#sem-posicao').innerText()).includes('TA5') && !(await p.locator('#sem-posicao').innerText()).includes('VG4'), 'ponto sem posição fica na lista "sem posição no mapa"');
await clicar('[data-a="cmp-plano"]');
ok(await p.locator('svg.mapa4 .ptp.plano').count() === 0, 'camada de pontos do plano pode ser ocultada');

// Prontuário
await p.goto(URL_ + '#/prontuario'); await espera();
const c1 = await p.locator('.pr-at[data-at="a1"] .pr-m').count(), c2 = await p.locator('.pr-at[data-at="a2"] .pr-m').count();
ok(await p.locator('.pr-at[data-at="a3"]').count() === 0 && await p.locator('.pr-ras').count() === 1, 'antes de finalizar, o 3º atendimento é rascunho');
await p.goto(URL_ + '#/mapa'); await espera();
const nAtual = await p.locator('.mk-li').count();
await clicar('[data-a="finalizar"]');
ok(await p.locator('[data-a="ferr"][data-t="dor"]').isDisabled(), 'depois de finalizar, as marcações não são mais editadas');
await p.goto(URL_ + '#/prontuario'); await espera();
ok(await p.locator('.pr-at[data-at="a3"] .pr-m').count() === nAtual, 'ao finalizar, as marcações passam ao prontuário');
ok(await p.locator('.pr-at[data-at="a1"] .pr-m').count() === c1 && await p.locator('.pr-at[data-at="a2"] .pr-m').count() === c2, 'marcações dos atendimentos anteriores continuam iguais');

// Atlas
await p.goto(URL_ + '#/biblioteca/atlas'); await espera();
ok(JSON.stringify((await p.locator('.bib-t [role="tab"]').allInnerTexts()).map(s => s.trim())) === '["Central","Particular","Atlas"]', 'Biblioteca com Central, Particular e Atlas');
ok(await p.locator('[data-a="tj"]').count() === 20, '12 meridianos e 8 vasos com botão próprio');
await clicar('[data-a="tj-nenhum"][data-g="m"]');
ok(await p.locator('svg.atlas .tj').count() === 0, '"Nenhum" desliga os trajetos');
await clicar('[data-a="tj"][data-k="E"]');
ok(await p.locator('svg.atlas .tj[data-tj="E"]').count() === 1 && await p.locator('svg.atlas .tj').count() === 1, 'liga um meridiano por vez');
ok(await p.locator('svg.atlas .ptp[data-pt="E36"]').count() > 0 && await p.locator('svg.atlas .ptp[data-pt="F3"]').count() === 0, 'mostra os pontos dos trajetos ligados');
await clicar('[data-a="tj"][data-k="B"]');
ok((await p.locator('#sem-trajeto').innerText()).includes('B'), 'avisa o trajeto que não aparece nesta vista');
await clicar('[data-a="avista"][data-v="posterior"]');
ok(await p.locator('svg.atlas .tj[data-tj="B"]').count() === 1, 'trajeto da Bexiga na vista posterior');
await clicar('[data-a="tj-todos"][data-g="v"]');
ok(await p.locator('svg.atlas .tj.vaso').count() >= 2, 'vasos com trajeto tracejado');
await clicar('[data-a="avista"][data-v="anterior"]');
await p.locator('svg.atlas .tj[data-tj="Chong Mai"] .tj-h').first().dispatchEvent('click'); await espera();
const vaso = await p.locator('.fx-panel').innerText();
ok(vaso.includes('Chong Mai') && vaso.includes('BP4') && vaso.includes('CS6') && vaso.includes('Yin Wei Mai'), 'vaso mostra abertura, acoplado e par aprovados');
ok(await p.locator('svg.atlas .ptp.abre[data-pt="CS6"]').count() > 0, 'ponto de abertura ou acoplado destacado no mapa');
// Ficha existente sem sair do Atlas
await p.locator('svg.atlas .ptp[data-pt="E36"]').first().dispatchEvent('click'); await espera();
ok(p.url().includes('#/biblioteca/atlas') && await p.locator('svg.atlas').count() === 1, 'ficha abre sem sair do Atlas');
const fx = await p.locator('.ficha').innerText();
ok(fx.includes(PT.E36.loc) && fx.includes(PT.E36.acoes) && fx.includes('Ficha existente do sistema'), 'ficha existente com o conteúdo atual e a fonte');
ok(fx.includes('Obra') && fx.includes('Edição') && fx.includes('Página'), 'ficha mostra obra, edição e página');
await clicar('[data-a="revisar"][data-c="E36"]');
const rv = await p.locator('.ficha').innerText();
ok(rv.includes('revisado') && rv.includes('Mauren Turcatti') && /às \d\d:\d\d/.test(rv), 'revisão da posição registra quem e quando');
ok(await p.locator('svg.atlas .ptp.rev[data-pt="E36"]').count() > 0, 'posição revisada marcada no mapa');
await p.fill('[data-nota="E36"]', 'Nota particular de teste');
// Ficha pendente
await p.locator('svg.atlas .tj[data-tj="E"] .tj-h').first().dispatchEvent('click'); await espera();
ok((await p.locator('.fx-panel').innerText()).includes('45 pontos'), 'meridiano lista os seus pontos');
await clicar('.fx-panel [data-a="abrir-pt"][data-c="E1"]');
const pend = await p.locator('.ficha').innerText();
ok(pend.includes('ficha pendente') && pend.includes('Sem posição no mapa') && !pend.includes('Localização'), 'ponto sem conteúdo aparece como ficha pendente');
ok(await p.locator('svg.atlas').count() === 1, 'ficha pendente também abre no Atlas');

// Central e Particular
await clicar('[data-a="bib"][data-t="central"]');
ok((await p.locator('#c-total').innerText()).startsWith('361 de 361') && (await p.locator('#c-total').innerText()).includes('28 com ficha'), 'Central com 361 pontos e as 28 fichas');
await p.fill('[data-busca]', 'zusanli'); await espera();
ok(await p.locator('#c-lista .pc').count() === 1, 'busca pelo nome');
await p.fill('[data-busca]', ''); await p.selectOption('[data-fsit]', 'pend'); await espera();
ok(await p.locator('#c-lista .pc.tem').count() === 0 && await p.locator('#c-lista .pc').count() === 333, 'filtro de fichas pendentes');
await p.selectOption('[data-fsit]', ''); await espera();
await clicar('#c-lista [data-c="E36"]');
ok((await p.locator('.ficha').innerText()).includes(PT.E36.loc) && await p.inputValue('[data-nota="E36"]') === 'Nota particular de teste', 'nota particular não altera o conteúdo da Central');
await clicar('[data-a="bib"][data-t="particular"]');
ok((await p.locator('#view').innerText()).includes('Nota particular de teste'), 'nota aparece na Particular');
const nPart = await p.locator('.pa[data-id]').count();
await p.fill('#pa-t', 'Ficha de teste'); await p.fill('#pa-x', 'Texto'); await clicar('#f-part button');
ok(await p.locator('.pa[data-id]').count() === nPart + 1, 'ficha particular adicionada');

ok(erros.length === 0, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));

// Celular
const m = await (await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true })).newPage();
m.on('pageerror', e => erros.push(e.message));
for (const r of ['mapa', 'prontuario', 'biblioteca/atlas', 'biblioteca/central', 'biblioteca/particular']) {
  await m.goto(URL_ + '#/' + r); await m.waitForTimeout(80);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular sem rolagem horizontal: ${r}`);
}
await m.goto(URL_ + '#/mapa');
for (const v of Object.keys(VISTAS)) { await m.click(`[data-a="vista"][data-v="${v}"]`); await m.waitForTimeout(40); ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular, vista ${v}: sem rolagem horizontal`); }
await m.goto(URL_ + '#/biblioteca/atlas'); await m.waitForTimeout(60);
await m.locator('svg.atlas .ptp[data-pt="E36"]').first().dispatchEvent('click'); await m.waitForTimeout(60);
ok(await m.locator('.fx-panel.aberta').evaluate(e => getComputedStyle(e).position === 'fixed') && await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'celular: ficha abre por cima do Atlas, sem rolagem horizontal');

await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} falha(s)` : '\nTodos os testes da proposta da etapa 4 passaram');
process.exit(falhas ? 1 : 0);
