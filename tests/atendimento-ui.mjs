// Verifica no navegador o ambiente de atendimento (etapa 2D): 8 etapas com navegação livre, cabeçalho
// com alertas, salvamento automático (o rascunho sobrevive a recarregar a página), avaliação com o
// raciocínio clínico existente, plano com a verificação de segurança existente, finalização com
// rastreabilidade, complemento depois de finalizar e descarte do rascunho.
// Uso: node tests/atendimento-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { paraV1 } from '../js/dados/migracao.js';
import { evaluate } from '../js/raciocinio/avaliacao.js';
import { pointWarnings } from '../js/raciocinio/seguranca.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let falhas = 0;
const J = x => JSON.stringify(x);
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const NOME = 'Clara Atendimento';
const SINAIS = ['pulso_corda', 'irritabilidade', 'tpm', 'suspiros'];

async function verificar(browser, url, nome) {
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  p.on('dialog', d => d.accept());
  const espera = () => p.waitForTimeout(80);
  const ir = async h => { await p.evaluate(h => { location.hash = h; }, h); await espera(); };
  const paciente = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('musubi-v2'))).patients.find(x => x.name === NOME);
  const tem = async (sel, txt) => (await p.locator(sel, txt ? { hasText: txt } : {}).count()) > 0;
  const etapa = async i => { await p.click(`.steps [data-i="${i}"]`); await espera(); };
  const atual = () => p.$eval('.steps [aria-current="step"]', e => e.dataset.i);
  // Mapa corporal: toca no desenho em coordenadas do próprio desenho (viewBox), com qualquer ampliação.
  const tocar = async (x, y) => { await p.locator('svg.mapa4').scrollIntoViewIfNeeded();
    const [cx, cy] = await p.evaluate(([x, y]) => { const s = document.querySelector('svg.mapa4'), q = s.createSVGPoint(); q.x = x; q.y = y; const r = q.matrixTransform(s.getScreenCTM()); return [r.x, r.y]; }, [x, y]);
    await p.mouse.click(cx, cy); await espera(); };
  const vista = async (v, f) => { await p.click(`[data-act="at-mv-vista"][data-v="${v}"]`); await espera(); if (f) { await p.click(`[data-act="at-mv-face"][data-f="${f}"]`); await espera(); } };
  // O tipo escolhido fica ativo: só clica no botão quando ele ainda não está ligado.
  const ferr = async t => { if (!await p.locator(`[data-act="at-mv-ferr"][data-t="${t}"].on`).count()) { await p.click(`[data-act="at-mv-ferr"][data-t="${t}"]`); await espera(); } };
  const marcar = async (t, x, y) => { await ferr(t); await tocar(x, y); };
  const marcas = async () => (await paciente()).atendimentos.find(a => a.status === 'rascunho')?.mapa?.marcas || [];

  await p.goto(url); await p.waitForSelector('#view h1');
  // Todos os pontos com posição ficam dentro do desenho do corpo, com folga (desenho real, com as transformações)
  if (nome === 'modular') {
    const fora = await p.evaluate(async () => {
      const C = await import('/js/componentes/corpo.js'), out = [], S = 2;
      for (const [v, f] of [['anterior',''],['posterior',''],['lat_d',''],['lat_e',''],['maos','palmar'],['maos','dorsal'],['pes','dorsal'],['pes','plantar']]) {
        const [w, h] = C.TAM[v], d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff';
        d.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w * S}" height="${h * S}" style="display:block">${C.desenho(v, f)}</svg>`; document.body.append(d);
        const den = (x, y) => document.elementsFromPoint(x * S, y * S).some(e => e.closest('.corpo'));
        for (const c of C.PONTOS_NO_MAPA) for (const [x, y] of C.posicoes(c, v, f)) if (![[0,0],[2.5,0],[-2.5,0],[0,2.5],[0,-2.5]].every(([a, b]) => den(x + a, y + b))) out.push(`${v}${f ? ':' + f : ''} ${c}`);
        d.remove();
      }
      return out;
    });
    ok(!fora.length, `${nome}: todos os pontos com posição ficam dentro do corpo${fora.length ? ' (fora: ' + fora.join(', ') + ')' : ''}`);
  }
  await ir('cadastro');
  await p.fill('#np-name', NOME); await p.fill('#np-birth', '1990-02-02'); await p.fill('#np-q', 'Cefaleia');
  await p.click('label.tg:has(#np-al-gestante)'); await p.check('#np-lgpd'); await p.click('#f-patient button.pri'); await espera();

  // Abrir
  await p.click('.perfil-a [data-act="novo-atendimento"]'); await espera();
  ok(await p.evaluate(() => location.hash) === '#atendimento' && await p.locator('.steps a').count() === 8, `${nome}: "Novo atendimento" abre o ambiente com as 8 etapas`);
  ok(await tem('.at-h', NOME) && await tem('.at-al .pill.crit', 'Gestante') && await tem('.at-id', '1ª consulta · avaliação basal'), `${nome}: cabeçalho com paciente, alerta e 1ª consulta`);
  ok(await tem('#autosave', 'Rascunho iniciado'), `${nome}: selo de salvamento`);
  let j = await paciente();
  ok(j.atendimentos.length === 1 && j.atendimentos[0].status === 'rascunho', `${nome}: rascunho gravado no navegador`);
  ok(paraV1({ ...JSON.parse(await p.evaluate(() => localStorage.getItem('musubi-v2'))) }).patients.find(x => x.name === NOME).sessions.length === 0, `${nome}: rascunho não aparece no formato do protótipo`);

  // Anamnese e intensidade
  await p.click('.anam summary >> text=Sono'); await p.fill('[data-atan="sono"]', 'Acorda às 3h'); await espera();
  await p.$eval('[data-atq="q1"]', e => { e.value = '7'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await espera();
  j = await paciente();
  ok(j.anam.sono === 'Acorda às 3h' && j.atendimentos[0].evolucao.intensidades.q1 === 7, `${nome}: anamnese e intensidade salvas automaticamente`);
  ok(await tem('#autosave', 'Salvo às') && await p.textContent('#qv-q1') === '7', `${nome}: selo muda para "Salvo às"`);

  // Navegação livre e teclado
  await etapa(5); ok(await atual() === '5', `${nome}: pula direto para o Plano`);
  await p.keyboard.press('Alt+ArrowLeft'); await espera(); ok(await atual() === '4', `${nome}: Alt+← volta uma etapa`);
  await etapa(1);

  // Avaliação com o raciocínio existente
  // Etapa 3A: 9 abas; o pulso é marcado por lado, os demais sinais pelo achado
  ok(JSON.stringify((await p.locator('.ab-bar .ab').allTextContents()).map(t => t.replace(/^\d+/, '').replace(/\d+$/, '').trim())) === JSON.stringify(['Língua e pulso','Ba Gang','Zang-Fu','Qi e Xue','Jin Ye','Jing e Shen','Fatores patogênicos']), `${nome}: avaliação em 7 abas (vasos e estação ficam no Plano)`);
  ok(await p.locator('.pulso-l').count() === 2 && await p.locator('[data-act="at-pulso"][data-l="esq"]').count() === 7 && await p.locator('[data-act="at-pulso"][data-l="dir"]').count() === 7, `${nome}: pulso esquerdo e direito com as 7 classificações`);
  for (const s of SINAIS) await p.click(s.startsWith('pulso_') ? `[data-act="at-pulso"][data-l="esq"][data-k="${s}"]` : `[data-act="at-sinal"][data-s="${s}"]`);
  await espera();
  const H = evaluate(SINAIS);
  ok(await p.locator('.hp').count() === H.length && await tem('.hp', H[0].p.nome), `${nome}: hipóteses iguais às do raciocínio clínico (${H.length})`);
  await p.click(`[data-act="at-hip"][data-p="${H[0].p.id}"][data-st="aceito"]`); await espera();
  // Registro bilateral e achados: gravados no musubi-v2, sem mudar o cálculo
  await p.click('[data-act="at-pulso"][data-l="dir"][data-k="pulso_corda"]'); await espera();
  await p.click('[data-act="at-pulso"][data-l="dir"][data-k="pulso_fino"]'); await espera();
  await p.fill('[data-atp="dir.orgao"]', 'Baço'); await p.fill('[data-atp="esq.deficiencia"]', 'Yin');
  await p.click('.pulso-l[aria-label="Pulso esquerdo"] summary'); await p.fill('[data-atp="esq.pos.guan"]', 'Em corda'); await espera();
  await p.click('[data-act="at-sinal"][data-s="insonia"]'); await p.click('[data-act="at-sinal"][data-s="insonia"]'); await espera();
  await p.selectOption('[data-atorig="irritabilidade"]', 'obs'); await espera();
  await p.fill('[data-atr="linguaObs"]', 'Saburra fina'); await espera();
  j = await paciente(); let rv = j.atendimentos[0].avaliacao;
  ok(J(rv.pulso.esq.cls) === J(['pulso_corda']) && J(rv.pulso.dir.cls) === J(['pulso_corda', 'pulso_fino']) && rv.pulso.dir.orgao === 'Baço' && rv.pulso.esq.deficiencia === 'Yin' && rv.pulso.esq.pos.guan === 'Em corda', `${nome}: pulso por lado, campos e posições gravados`);
  ok(rv.achados.insonia.sit === 'neg' && rv.achados.irritabilidade.orig === 'obs' && rv.achados.tpm.orig === 'anamnese' && rv.linguaObs === 'Saburra fina', `${nome}: situação, origem e observação da língua gravadas`);
  ok(J(rv.signs) === J([...SINAIS, 'pulso_fino']), `${nome}: sinais do cálculo = positivos + classificações de qualquer lado`);
  ok(await p.locator('.hp').count() === evaluate(rv.signs).length, `${nome}: hipóteses = raciocínio existente para esses sinais`);
  await p.click('[data-act="at-pulso"][data-l="dir"][data-k="pulso_fino"]'); await p.click('[data-act="at-pulso"][data-l="dir"][data-k="pulso_corda"]'); await espera();
  j = await paciente(); rv = j.atendimentos[0].avaliacao;
  ok(J(rv.signs) === J(SINAIS), `${nome}: classificação ainda marcada no outro lado continua contando`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: aba Língua e pulso sem rolagem horizontal`);
  await p.click('[data-act="at-aba"][data-i="1"]'); await espera();
  ok(await tem('.axis') && await p.locator('[data-atr="bgInterp"]').count() === 1, `${nome}: aba Ba Gang com cálculo e interpretação`);
  // Etapa 3B: achados livres por categoria, Síntese e Plano só por escolha
  await p.click('[data-act="at-aba"][data-i="4"]'); await espera();
  ok(await p.locator('.livre').count() === 0 && await p.locator('form.livre-f[data-cat="jinye"]').count() === 1, `${nome}: Jin Ye com campo livre, sem lista inventada`);
  await p.fill('#lv-jinye', 'Edema leve em tornozelos'); await p.click('form.livre-f button'); await espera();
  ok(await p.locator('.livre', { hasText: 'Edema leve' }).count() === 1 && await p.locator('.livre [data-act="at-levar"].on').count() === 0, `${nome}: achado registrado, sem encaminhamento automático`);
  ok(await p.locator('.ab[data-i="4"] .ab-c').textContent() === '1', `${nome}: aba mostra quantos achados tem`);
  await p.fill('[data-atln="jinye"]', 'Retenção leve'); await espera();
  await p.click('.livre:has-text("Edema leve") [data-dest="sintese"]'); await espera();
  j = await paciente(); rv = j.atendimentos[0].avaliacao;
  ok(rv.categorias.jinye.itens[0].sintese === true && rv.categorias.jinye.itens[0].plano === false && rv.categorias.jinye.nota === 'Retenção leve' && J(rv.signs) === J(SINAIS), `${nome}: Jin Ye gravado; levar para a Síntese não muda o cálculo`);
  ok(j.atendimentos[0].historico.some(h => /Jin Ye: "Edema leve em tornozelos" levado para a Síntese/.test(h.acao)), `${nome}: encaminhamento registrado no histórico`);
  await p.click('[data-act="at-aba"][data-i="2"]'); await espera();
  await p.fill('#lv-zangfu', 'Fígado com sinais de excesso'); await p.selectOption('#lv-zangfu-o', 'obs'); await p.click('form.livre-f button'); await espera();
  await p.click('.livre:has-text("Fígado com sinais") [data-dest="plano"]'); await espera();
  await etapa(3);
  ok(await p.locator('.sx-cat:has(h3:text-is("Jin Ye")) .sx-i', { hasText: 'Edema leve' }).count() === 1 && await p.locator('.sx-cat', { hasText: 'Fígado com sinais' }).count() === 0, `${nome}: Síntese mostra por categoria só o que foi levado`);
  await etapa(5);
  ok(await tem('.sx-i', 'Fígado com sinais') && !(await tem('#view', 'Edema leve')), `${nome}: Plano mostra só o que foi marcado para o Plano`);
  await p.click('.sx-i:has-text("Fígado com sinais") [data-act="at-levar"]'); await espera();
  ok(!(await tem('.sx-i', 'Fígado com sinais')), `${nome}: retirar do Plano`);
  // Etapa 3C: vasos extraordinários e estação como dicas no Plano, sem indicação automática
  const pares = await p.locator('.dicas .vt-r').evaluateAll(rs => rs.map(r => r.querySelector('.vt-n b').textContent + ' ' + r.querySelector('.vt-n small').textContent));
  ok(J(pares) === J(['Du Mai ID3 + B62','Ren Mai P7 + R6','Chong Mai BP4 + CS6','Dai Mai VB41 + TA5','Yin Qiao Mai R6 + P7','Yang Qiao Mai B62 + ID3','Yin Wei Mai CS6 + BP4','Yang Wei Mai TA5 + VB41']), `${nome}: Plano mostra os 8 vasos com os pares aprovados`);
  ok(await tem('.dicas .sazonal', 'hemisfério Sul'), `${nome}: estação do ano como dica no Plano`);
  await p.click('.dica-v summary'); await espera();
  const ptsAntes = J((await paciente()).atendimentos[0].plano.pontos);
  ok(!JSON.parse(ptsAntes).some(c => ['BP4','CS6'].includes(c)), `${nome}: nenhum par entra nos pontos sozinho`);
  await p.fill('[data-vnota="Chong Mai"]', 'considerar no ciclo'); await espera();
  await p.click('[data-act="at-par"][data-v="Chong Mai"]'); await espera();
  j = await paciente();
  ok(['BP4','CS6'].every(c => j.atendimentos[0].plano.pontos.includes(c)) && j.atendimentos[0].vasos['Chong Mai'].considerar && j.atendimentos[0].vasos['Chong Mai'].nota === 'considerar no ciclo' && await tem('.dicas .vt-r.tem', 'par no plano'), `${nome}: par incluído só pelo botão do profissional`);
  for (const c of ['BP4','CS6']) await p.click(`.chip.on[data-act="at-pt"][data-c="${c}"]`);
  await espera(); ok(J((await paciente()).atendimentos[0].plano.pontos) === ptsAntes, `${nome}: pontos do par podem ser retirados`);
  await etapa(1);
  j = await paciente();
  ok(J(j.atendimentos[0].avaliacao.signs) === J(SINAIS) && j.atendimentos[0].avaliacao.status[H[0].p.id] === 'aceito', `${nome}: sinais e hipótese aceita no rascunho`);

  // Pentagrama e síntese
  await etapa(2); ok(await p.locator('svg.penta').count() === 1, `${nome}: pentagrama do componente existente`);
  // Etapa 3C: pentagrama em camadas, mesmo cálculo
  ok(await p.locator('[data-act="at-camada"]').count() === 3 && await p.locator('[data-act="at-camada"][data-k="atual"].on').count() === 1, `${nome}: pentagrama com 3 camadas, começando no cálculo de antes`);
  for (const k of ['obs','hip','conf']) ok(await p.locator(`.pe-l .ly-${k}`).count() === 5, `${nome}: camada ${k} separada em cada elemento`);
  const pentaAtual = await p.locator('svg.penta').innerHTML();
  await p.click('[data-act="at-camada"][data-k="hip"]'); await espera();
  const pentaHip = await p.locator('svg.penta').innerHTML();
  await p.click('[data-act="at-camada"][data-k="atual"]'); await espera();
  ok(await p.locator('svg.penta').innerHTML() === pentaAtual && typeof pentaHip === 'string', `${nome}: trocar de camada e voltar mostra o mesmo mapa de antes`);
  await p.fill('[data-atr="interp"]', 'Madeira em excesso'); await espera();
  j = await paciente(); ok(j.atendimentos[0].avaliacao.interp === 'Madeira em excesso' && J(j.atendimentos[0].avaliacao.signs) === J(SINAIS), `${nome}: interpretação do pentagrama gravada, sem mudar o cálculo`);
  await p.click('.node[data-e="madeira"]'); await espera(); ok(await tem('.corr-g', 'Fígado'), `${nome}: detalhe do elemento`);
  await etapa(3); ok(await tem('.sx', H[0].p.nome), `${nome}: síntese mostra o padrão validado`);
  await p.fill('[data-atf="sintese"]', 'Estagnação, priorizar fluxo'); await espera();

  // Plano com verificação de segurança
  await etapa(5);
  await p.click(`.sug [data-act="at-pt"] >> nth=0`); await p.fill('#at-pt-c', 'bp6, IG4'); await p.click('#f-at-pt button'); await espera();
  await p.click('[data-act="at-tec"][data-t="Acupuntura"]'); await espera();
  j = await paciente();
  const plano = j.atendimentos[0].plano, W = pointWarnings(plano.pontos, j, plano.tec);
  ok(plano.pontos.includes('BP6') && plano.pontos.includes('IG4') && plano.tec[0] === 'Acupuntura', `${nome}: pontos e técnicas no plano`);
  ok(W.length > 0 && await p.locator('#at-seg .notice').count() === W.length, `${nome}: avisos de segurança iguais aos da verificação existente (${W.length}, gestante)`);
  await etapa(4); ok(await p.locator('svg.mapa4 .ptp.plano[data-pt="BP6"]').count() === 2, `${nome}: mapa corporal mostra os pontos do plano (BP6 dos dois lados)`);

  // Etapa 4A: mapa corporal com seis vistas e marcações
  const VB = { anterior:'0 0 200 430', posterior:'0 0 200 430', lat_d:'0 0 200 430', lat_e:'0 0 200 430', maos:'0 0 280 256', pes:'0 0 280 276' };
  for (const [v, vb] of Object.entries(VB)) { await vista(v); ok(await p.locator('svg.mapa4').getAttribute('viewBox') === vb && await p.locator('svg.mapa4 .corpo path').count() > 0, `${nome}: vista ${v}`); }
  await vista('maos', 'dorsal'); ok(await p.locator('svg.mapa4[data-face="dorsal"]').count() === 1, `${nome}: mãos com face dorsal`);
  await vista('pes', 'plantar'); ok(await p.locator('svg.mapa4[data-face="plantar"]').count() === 1, `${nome}: pés com face plantar`);
  await vista('anterior');
  ok(J(await p.locator('svg.mapa4 .lado-t').allTextContents()) === J(['D','E']), `${nome}: D e E do paciente na vista anterior`);
  await marcar('dor', 78, 260);
  let M = await marcas();
  ok(M.length === 1 && M[0].tipo === 'dor' && M[0].lado === 'dir' && M[0].vista === 'anterior' && Math.abs(M[0].x - .39) < .01 && Math.abs(M[0].y - 260 / 430) < .01, `${nome}: marcação de dor gravada no atendimento, lado direito do paciente`);
  await marcar('sintoma', 5, 300); ok((await marcas()).length === 1, `${nome}: toque fora do corpo não marca`);
  for (const [t, y] of [['sintoma', 290], ['limitacao', 312], ['procedimento', 334]]) await marcar(t, 114, y);
  M = await marcas();
  ok(J(M.map(m => m.tipo)) === J(['dor','sintoma','limitacao','procedimento']) && M.slice(1).every(m => m.lado === 'esq'), `${nome}: marcações de cada tipo, várias na mesma região`);
  ok(await p.locator('#ed-mk [data-act="at-mk-int"]').count() === 0 && await p.locator('#mk-proc').count() === 1, `${nome}: procedimento sem intensidade, com o campo do procedimento`);
  await p.fill('#mk-proc', 'Ventosa fixa'); await espera();
  await marcar('irradiacao', 90, 240); ok(await tem('#mp-dica', 'destino'), `${nome}: irradiação pede o destino`);
  await tocar(86, 330);
  M = await marcas(); const rad = M.at(-1);
  ok(rad.tipo === 'irradiacao' && Math.abs(rad.y2 - 330 / 430) < .01 && await p.locator(`.mk[data-id="${rad.id}"] path.rad`).count() === 1, `${nome}: irradiação com trajeto da origem ao destino`);
  // Edição
  await p.click(`[data-act="at-mk-sel"][data-id="${M[0].id}"]`); await espera();
  await p.click('#ed-mk [data-act="at-mk-int"][data-n="7"]'); await espera();
  await p.selectOption('#mk-lado', 'bil'); await espera();
  await p.fill('#mk-reg', 'Lombar'); await p.fill('#mk-nota', 'Piora sentada'); await espera();
  M = await marcas();
  ok(M[0].intensidade === 7 && M[0].lado === 'bil' && M[0].regiao === 'Lombar' && M[0].nota === 'Piora sentada' && M[3].procedimento === 'Ventosa fixa', `${nome}: editar intensidade, lado, região, anotação e procedimento`);
  ok(await p.locator(`.mk[data-id="${M[0].id}"] .esp`).count() === 1 && await p.locator(`.mk[data-id="${M[0].id}"] .mk-n`).textContent() === '7', `${nome}: bilateral espelhado e intensidade no mapa`);
  // Remoção com confirmação
  await p.click(`[data-act="at-mk-sel"][data-id="${M[1].id}"]`); await espera();
  await p.click('[data-act="at-mk-rm"]'); await p.click('[data-act="at-mk-rmn"]'); await espera();
  ok((await marcas()).length === 5, `${nome}: cancelar não remove`);
  await p.click('[data-act="at-mk-rm"]'); await p.click('[data-act="at-mk-rms"]'); await espera();
  ok((await marcas()).length === 4 && !(await marcas()).some(m => m.id === M[1].id), `${nome}: remover depois de confirmar`);
  // Coordenadas independentes da ampliação
  await p.click('[data-act="at-mv-zoom"][data-d="1"]'); await p.click('[data-act="at-mv-zoom"][data-d="1"]'); await espera();
  await marcar('dor', 130, 250);
  M = await marcas();
  ok(Math.abs(M.at(-1).x - .65) < .005 && Math.abs(M.at(-1).y - 250 / 430) < .005 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: com 200% de ampliação, a mesma coordenada do desenho e sem rolagem horizontal`);
  await p.click(`[data-act="at-mk-sel"][data-id="${M.at(-1).id}"]`); await p.click('[data-act="at-mk-rm"]'); await p.click('[data-act="at-mk-rms"]'); await espera();
  await p.click('[data-act="at-mv-zoom"][data-d="-1"]'); await p.click('[data-act="at-mv-zoom"][data-d="-1"]'); await espera();
  await vista('maos', 'palmar'); await marcar('sintoma', 70, 150);
  ok((await marcas()).at(-1).lado === 'dir' && (await marcas()).at(-1).face === 'palmar', `${nome}: mão direita na palma`);
  // Com um tipo ativo, tocar em cima de uma marcação apaga
  { const n1 = (await marcas()).length, ult = (await marcas()).at(-1); await tocar(70, 150);
    ok((await marcas()).length === n1 - 1 && !(await marcas()).some(m => m.id === ult.id) && await p.locator('[data-act="at-mv-ferr"][data-t="sintoma"].on').count() === 1, `${nome}: tocar em cima de uma marcação apaga, e o tipo continua ativo`);
    await tocar(70, 150); ok((await marcas()).length === n1, `${nome}: tocar de novo no mesmo lugar marca outra vez`); }
  // Marcar continua ativo: vários toques seguidos, sem escolher o tipo de novo
  ok(await p.locator('[data-act="at-mv-ferr"][data-t="sintoma"].on').count() === 1, `${nome}: depois de marcar, o tipo continua ativo`);
  let n0 = (await marcas()).length; await tocar(90, 160); await tocar(110, 120);
  ok((await marcas()).length === n0 + 2 && (await marcas()).slice(-2).every(m => m.tipo === 'sintoma'), `${nome}: várias marcações seguidas sem escolher o tipo de novo`);
  await p.click('[data-act="at-mv-ferr"][data-t="sintoma"]'); await espera();
  ok(await p.locator('[data-act="at-mv-ferr"][data-t="sel"].on').count() === 1, `${nome}: tocar de novo no tipo para de marcar`);
  n0 = (await marcas()).length; await tocar(90, 200);
  ok((await marcas()).length === n0, `${nome}: depois de parar, tocar no corpo não marca`);
  await vista('anterior');
  // Pontos próximos da marcação: ficha resumida, incluir e tirar do plano, ficha completa
  const pontosPlano = async () => (await paciente()).atendimentos.find(a => a.status === 'rascunho').plano.pontos;
  ok(await p.locator('[data-act="at-mv-ferr"][data-t="ponto"]').count() === 0, `${nome}: sem o botão "Indicar pontos", o mapa fica mais limpo`);
  await marcar('dor', 104, 163);
  ok(await p.locator('#mk-prox .px-i').first().textContent().then(t => /VC12/.test(t) && /Zhongwan/.test(t) && /Aquecedor Médio/.test(t)), `${nome}: ao marcar, aparecem os pontos próximos com o resumo da ficha`);
  ok(await p.locator('svg.mapa4 .ptp.prox[data-pt="VC12"]').count() === 1 && await tem('#mk-prox', 'não é indicação para a queixa'), `${nome}: pontos próximos destacados no mapa e avisados como só posição`);
  ok(await p.locator('[data-act="at-mv-ferr"][data-t="dor"].on').count() === 1, `${nome}: o tipo continua ativo depois de mostrar os pontos próximos`);
  await p.click('#mk-prox [data-act="at-mv-ptx"][data-c="VC12"]'); await espera();
  ok((await pontosPlano()).includes('VC12') && await p.locator('svg.mapa4 .ptp.plano[data-pt="VC12"]').count() === 1 && await tem('#plano-mapa', 'VC12') && await tem('#mk-prox', 'Tirar do plano'), `${nome}: incluir no plano pelos pontos próximos`);
  ok(await p.locator('#mp-seg .notice').count() > 0, `${nome}: verificação de segurança do plano também no mapa`);
  await p.click('#mk-prox [data-act="at-mv-ptx"][data-c="VC12"]'); await espera();
  ok(!(await pontosPlano()).includes('VC12'), `${nome}: tirar do plano pelos pontos próximos`);
  ok((await paciente()).atendimentos[0].historico.some(h => /VC12 indicado no mapa corporal/.test(h.acao)), `${nome}: ponto indicado pelo mapa registrado no histórico`);
  await p.click('#mk-prox [data-act="at-mv-ptv"][data-c="VC12"]'); await espera();
  ok(await tem('#ficha-pt', 'Vaso Concepção') && await tem('#ficha-pt .fp-dl', 'Linha média') && await p.locator('svg.mapa4 .ptp.pt-on[data-pt="VC12"]').count() === 1, `${nome}: ficha completa do ponto (meridiano, número, localização e ações)`);
  await p.click('#ficha-pt [data-act="at-mv-ptf"]'); await espera();
  ok(await p.locator('#ficha-pt').count() === 0 && await tem('#ed-mk', 'Pontos próximos'), `${nome}: voltar da ficha para a marcação`);
  // Pontos indicados pelo livro para a região (tabela conferida por Mauren)
  const IND = await p.evaluate(async () => { const m = await import('/js/conhecimento/indicacoes-regiao.js').catch(() => null); return m ? m.INDICADOS_REGIAO : null; });
  const nInd = r => IND ? IND[r].length : (r === 'Abdome' ? 93 : r === 'Ombro' ? 47 : 29);
  ok((await marcas()).at(-1).regiao === 'Abdome' && await p.inputValue('#mk-reg') === 'Abdome', `${nome}: a região é sugerida pelo local tocado`);
  ok(await tem('#mk-ind', 'Indicados para abdome') && await p.locator('#mk-ind .ind-b').count() === nInd('Abdome') && await tem('#mk-ind', 'Ednéa Iara Souza Martins') && await tem('#mk-ind', 'conferida por Mauren'), `${nome}: aparecem os pontos indicados pelo livro para a região, com a fonte`);
  await marcar('dor', 66, 80);
  ok((await marcas()).at(-1).regiao === 'Ombro' && await p.locator('#mk-ind .ind-b').count() === nInd('Ombro'), `${nome}: dor no ombro mostra os pontos indicados para o ombro`);
  const pend = await p.$eval('#mk-ind .ind-b.pend', e => e.dataset.c);
  await p.click(`#mk-ind .ind-b[data-c="${pend}"]`); await espera();
  ok(await tem('#ficha-pt', pend) && await tem('#fp-pend', 'Ficha pendente') && await tem('#ficha-pt .fp-dl', 'Ombro · p.'), `${nome}: ponto indicado sem ficha abre a ficha pendente com a página do livro`);
  await p.click(`#ficha-pt [data-act="at-mv-ptx"][data-c="${pend}"]`); await espera();
  ok((await pontosPlano()).includes(pend), `${nome}: ponto indicado entra no plano pela ficha`);
  await p.click('#ficha-pt [data-act="at-mv-ptf"]'); await espera();
  ok(await p.locator(`#mk-ind .ind-b.on[data-c="${pend}"]`).count() === 1, `${nome}: ponto do plano fica em destaque na lista de indicados`);
  await p.click(`#mk-ind .ind-b[data-c="${pend}"]`); await espera(); await p.click(`#ficha-pt [data-act="at-mv-ptx"][data-c="${pend}"]`); await espera(); await p.click('#ficha-pt [data-act="at-mv-ptf"]'); await espera();
  ok(!(await pontosPlano()).includes(pend), `${nome}: e sai do plano do mesmo jeito`);
  await p.fill('#mk-reg', 'dor no joelho'); await espera();
  ok(await tem('#mk-ind', 'Indicados para joelho') && await p.locator('#mk-ind .ind-b').count() === nInd('Joelho'), `${nome}: mudar a região escrita muda os pontos indicados`);
  await p.fill('#mk-reg', 'xyz'); await espera();
  ok(await tem('#mk-ind', 'Não encontrei') && await p.locator('#mk-ind .ind-b').count() === 0, `${nome}: região fora da tabela não inventa pontos`);
  await p.fill('#mk-reg', 'Ombro'); await espera();
  await p.click('[data-act="at-mv-ferr"][data-t="dor"]'); await espera();
  await p.locator('svg.mapa4 .ptp.plano[data-pt="BP6"]').first().click(); await espera();
  ok(await tem('#ficha-pt', 'BP6') && await tem('#ficha-pt', 'Sanyinjiao'), `${nome}: tocar num ponto do plano abre a ficha`);
  await p.click('#ficha-pt [data-act="at-mv-ptf"]'); await espera();
  await vista('pes', 'dorsal'); await p.click('[data-act="at-mk-ok"]').catch(() => {}); await espera();
  await p.click('#plano-mapa').catch(() => {});
  await vista('anterior');
  ok(await tem('#plano-mapa', 'BP6') && await p.locator('#sem-posicao').count() === 1, `${nome}: pontos do plano no mapa e lista "sem posição no mapa"`);
  ok((await paciente()).atendimentos[0].historico.some(h => /mapa corporal: marcação de dor adicionada/.test(h.acao)), `${nome}: marcações registradas no histórico do atendimento`);
  const nMarcas = (await marcas()).length;

  // Recarregar: o rascunho continua
  await p.reload(); await p.waitForSelector('#view h1'); await ir('pacientes');
  await p.click(`#plist [data-pid]:has-text("${NOME}")`); await espera();
  ok(await tem('.rasc', 'Atendimento em andamento') && await tem('.perfil-a', 'Continuar atendimento'), `${nome}: depois de recarregar, o perfil mostra o atendimento em andamento`);
  await p.click('.rasc [data-act="novo-atendimento"]'); await espera();
  ok(await p.inputValue('[data-atq="q1"]') === '7' && (await paciente()).atendimentos.length === 1, `${nome}: continuar abre o mesmo rascunho, com os dados`);

  // Evolução e finalizar
  await etapa(6); await p.fill('[data-atf="nota"]', 'Respondeu bem'); await espera();
  await etapa(7);
  ok(await tem('.hist-alt', 'plano terapêutico') && await tem('.hist-alt', 'atendimento iniciado'), `${nome}: histórico de alterações visível`);
  await p.click('[data-act="at-finalizar"]'); await espera();
  j = await paciente();
  const at = j.atendimentos[0], av = j.avaliacoes[0];
  ok(at.status === 'finalizado' && at.finalizadoEm && at.historico.at(-1).acao === 'atendimento finalizado', `${nome}: atendimento finalizado com data e hora`);
  ok(av && av.atendimentoId === at.id && at.avaliacaoId === av.id && J(av.signs) === J(SINAIS), `${nome}: avaliação basal registrada e ligada ao atendimento`);
  const v1 = paraV1(JSON.parse(await p.evaluate(() => localStorage.getItem('musubi-v2')))).patients.find(x => x.name === NOME);
  ok(v1.sessions.length === 1 && v1.sessions[0].eva === 7 && v1.sessions[0].nota === 'Respondeu bem' && v1.assess.length === 1, `${nome}: no formato do protótipo vira sessão e avaliação`);
  ok(await tem('.tabs [data-t="sessoes"].on') && await tem('.lt-i', '1º atendimento') && await tem('.lt-i', 'Estagnação, priorizar fluxo'), `${nome}: prontuário mostra o atendimento e a síntese`);
  ok(at.mapa.marcas.length === nMarcas && await tem('.pr-mapa summary', `Mapa corporal (${nMarcas} marcações)`), `${nome}: marcações passam ao prontuário com o atendimento`);
  ok(!J(v1).includes('marcas'), `${nome}: exportação v1 sem as marcações`);

  // Complementar depois de finalizar
  await p.click('.lt-i [data-act="abrir-atendimento"]'); await espera();
  ok(await tem('.at-m', 'Finalizado') && await tem('.notice', 'Atendimento finalizado em'), `${nome}: atendimento finalizado abre para complemento`);
  await etapa(6); await p.fill('[data-atf="nota"]', 'Respondeu bem. Retorno em 7 dias'); await espera();
  j = await paciente();
  ok(j.atendimentos[0].evolucao.nota.endsWith('7 dias') && j.atendimentos[0].historico.at(-1).acao === 'evolução (após finalizar)', `${nome}: complemento registrado no histórico como "após finalizar"`);

  // Etapa 3C: a avaliação basal fica bloqueada depois de finalizada
  await etapa(1);
  ok(await tem('.trava', 'Avaliação basal bloqueada') && await p.locator('fieldset.trava-f[disabled]').count() === 1, `${nome}: basal bloqueada na avaliação`);
  const sinaisBasal = J((await paciente()).avaliacoes[0].signs);
  await p.evaluate(() => { const b = document.querySelector('[data-act="at-sinal"][data-s="lombalgia"]'); b.closest('fieldset').disabled = false; b.click(); }); await espera();
  ok(J((await paciente()).avaliacoes[0].signs) === sinaisBasal, `${nome}: mesmo forçando o clique, a basal não muda`);
  await etapa(2); ok(await p.locator('[data-atr="interp"][disabled]').count() === 1, `${nome}: interpretação da basal bloqueada`);
  await etapa(4);
  ok(await p.locator('[data-act="at-mv-ferr"][data-t="dor"][disabled]').count() === 1, `${nome}: atendimento finalizado: marcações não mudam`);
  await p.click('.mk-li >> nth=0'); await espera();
  ok(await tem('#ed-mk', 'no prontuário') && await p.locator('#mk-tipo').count() === 0, `${nome}: marcação finalizada abre só para leitura`);

  // Descartar rascunho
  await p.click('[data-act="at-prontuario"]'); await espera();
  await p.click('.perfil-a [data-act="novo-atendimento"]'); await espera();
  ok(await tem('.at-id', '2º atendimento · retorno') && (await paciente()).atendimentos.length === 2, `${nome}: segundo atendimento como retorno`);
  await etapa(4);
  ok(await p.locator('svg.mapa4 .mk.e-ant').count() > 0 && await p.locator('svg.mapa4 .mk.e-at').count() === 0 && (await marcas()).length === 0, `${nome}: atendimento seguinte mostra as anteriores em cinza, sem copiá-las`);
  ok(await tem('#mk-evolucao', 'Lombar'), `${nome}: comparação entre atendimentos`);
  await p.click('[data-act="at-mv-ant"]'); await espera();
  ok(await p.locator('svg.mapa4 .mk.e-ant').count() === 0, `${nome}: comparação pode ser ocultada`);
  await p.click('[data-act="at-mv-ant"]'); await espera(); await etapa(0);
  await p.click('[data-act="at-descartar"]'); await espera();
  j = await paciente();
  ok(j.atendimentos.length === 1 && j.anam.sono === 'Acorda às 3h' && await p.evaluate(() => location.hash) === '#prontuario', `${nome}: descartar remove só o rascunho`);

  // Etapa 3C: versões da avaliação e reavaliação avulsa com motivo
  await p.click('.tabs [data-t="versoes"]'); await espera();
  ok(await p.locator('.ver').count() === 1 && await tem('.ver.basal', 'bloqueada') && await tem('.ver.basal', 'Mauren Turcatti') && await tem('.ver.basal', 'Atendimento de'), `${nome}: versões mostram a basal, profissional e contexto`);
  await p.click('#f-reav button'); await espera();
  ok(await p.evaluate(() => location.hash) === '#prontuario', `${nome}: reavaliação sem motivo não começa`);
  await p.fill('#rv-motivo', 'Piora após viagem'); await p.click('#f-reav button'); await espera();
  ok(await p.evaluate(() => location.hash) === '#avaliacao', `${nome}: reavaliação abre a avaliação energética`);
  for (const s of ['irritabilidade', 'tpm', 'lombalgia']) await p.click(`[data-s="${s}"]`);
  await p.click('[data-act="save-assess"]'); await espera();
  j = await paciente();
  ok(j.avaliacoes.length === 2 && J(j.avaliacoes[0].signs) === J(SINAIS) && j.avaliacoes[1].motivo === 'Piora após viagem' && j.avaliacoes[1].prof === 'Mauren Turcatti', `${nome}: nova versão com motivo e profissional; a basal continua igual`);
  ok(await tem('.tabs [data-t="versoes"].on') && await p.locator('.ver').count() === 2 && await tem('.ver:not(.basal)', 'Piora após viagem') && await tem('.ver:not(.basal)', 'Reavaliação avulsa'), `${nome}: versões listam a reavaliação avulsa`);
  ok(await p.locator('.cmp svg.penta').count() === 2 && await tem('.sinais-cmp', 'Lombalgia'), `${nome}: compara duas versões`);
  ok(J(Object.keys(paraV1(JSON.parse(await p.evaluate(() => localStorage.getItem('musubi-v2')))).patients.find(x => x.name === NOME).assess[1])) === J(['id','date','signs','status','nota']), `${nome}: exportação v1 sem os campos de versão`);

  // Celular
  const cel = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pc = await cel.newPage(); pc.on('pageerror', e => erros.push(e.message));
  await pc.goto(url + '#pacientes'); await pc.waitForSelector('#view h1');
  await pc.click('#plist [data-pid="p1"]'); await pc.waitForTimeout(80); await pc.click('.perfil-a [data-act="novo-atendimento"]'); await pc.waitForTimeout(80);
  const largas = [];
  for (let i = 0; i < 8; i++) { await pc.click(`.steps [data-i="${i}"]`); await pc.waitForTimeout(60); if (await pc.evaluate(() => document.documentElement.scrollWidth > innerWidth)) largas.push(i + 1); }
  ok(largas.length === 0, `${nome} celular: nenhuma etapa com rolagem horizontal${largas.length ? ' → ' + largas.join(', ') : ''}`);
  await pc.click('.steps [data-i="4"]'); await pc.waitForTimeout(60);
  const vLargas = [];
  for (const v of ['anterior','posterior','lat_d','lat_e','maos','pes']) { await pc.click(`[data-act="at-mv-vista"][data-v="${v}"]`); await pc.waitForTimeout(50); if (await pc.evaluate(() => document.documentElement.scrollWidth > innerWidth)) vLargas.push(v); }
  ok(vLargas.length === 0, `${nome} celular: as seis vistas do mapa sem rolagem horizontal${vLargas.length ? ' → ' + vLargas.join(', ') : ''}`);
  await cel.close();

  ok(erros.length === 0, `${nome}: sem erros no console${erros.length ? ' → ' + erros.join(' | ') : ''}`);
  await ctx.close();
}
const srv = await iniciar(0); const base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'dist');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTodas as verificações do ambiente de atendimento passaram.');
process.exit(falhas ? 1 : 0);
