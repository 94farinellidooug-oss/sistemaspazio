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

  await p.goto(url); await p.waitForSelector('#view h1');
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
  ok(JSON.stringify((await p.locator('.ab-bar .ab').allTextContents()).map(t => t.replace(/^\d+/, '').replace(/\d+$/, '').trim())) === JSON.stringify(['Língua e pulso','Ba Gang','Zang-Fu','Qi e Xue','Jin Ye','Jing e Shen','Fatores patogênicos','Vasos extraordinários','Contexto sazonal']), `${nome}: avaliação em 9 abas na ordem aprovada`);
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
  await etapa(1);
  await p.click('[data-act="at-aba"][data-i="7"]'); await espera();
  await p.check('[data-vaso="Chong Mai"]'); await espera();
  await p.fill('[data-vnota="Chong Mai"]', 'considerar no ciclo'); await espera();
  await p.click('[data-act="at-aba"][data-i="8"]'); await espera();
  ok(await tem('.sazonal', 'hemisfério Sul'), `${nome}: contexto sazonal complementar`);
  j = await paciente();
  ok(J(j.atendimentos[0].avaliacao.signs) === J(SINAIS) && j.atendimentos[0].avaliacao.status[H[0].p.id] === 'aceito', `${nome}: sinais e hipótese aceita no rascunho`);
  ok(j.atendimentos[0].vasos['Chong Mai'].considerar && j.atendimentos[0].vasos['Chong Mai'].nota === 'considerar no ciclo', `${nome}: vasos extraordinários gravados`);

  // Pentagrama e síntese
  await etapa(2); ok(await p.locator('svg.penta').count() === 1, `${nome}: pentagrama do componente existente`);
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
  await etapa(4); ok(await tem('.mapa .ptl', 'BP6'), `${nome}: mapa corporal mostra os pontos do plano`);

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

  // Complementar depois de finalizar
  await p.click('.lt-i [data-act="abrir-atendimento"]'); await espera();
  ok(await tem('.at-m', 'Finalizado') && await tem('.notice', 'Atendimento finalizado em'), `${nome}: atendimento finalizado abre para complemento`);
  await etapa(6); await p.fill('[data-atf="nota"]', 'Respondeu bem. Retorno em 7 dias'); await espera();
  j = await paciente();
  ok(j.atendimentos[0].evolucao.nota.endsWith('7 dias') && j.atendimentos[0].historico.at(-1).acao === 'evolução (após finalizar)', `${nome}: complemento registrado no histórico como "após finalizar"`);

  // Descartar rascunho
  await p.click('[data-act="at-prontuario"]'); await espera();
  await p.click('.perfil-a [data-act="novo-atendimento"]'); await espera();
  ok(await tem('.at-id', '2º atendimento · retorno') && (await paciente()).atendimentos.length === 2, `${nome}: segundo atendimento como retorno`);
  await p.click('[data-act="at-descartar"]'); await espera();
  j = await paciente();
  ok(j.atendimentos.length === 1 && j.anam.sono === 'Acorda às 3h' && await p.evaluate(() => location.hash) === '#prontuario', `${nome}: descartar remove só o rascunho`);

  // Celular
  const cel = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pc = await cel.newPage(); pc.on('pageerror', e => erros.push(e.message));
  await pc.goto(url + '#pacientes'); await pc.waitForSelector('#view h1');
  await pc.click('#plist [data-pid="p1"]'); await pc.waitForTimeout(80); await pc.click('.perfil-a [data-act="novo-atendimento"]'); await pc.waitForTimeout(80);
  const largas = [];
  for (let i = 0; i < 8; i++) { await pc.click(`.steps [data-i="${i}"]`); await pc.waitForTimeout(60); if (await pc.evaluate(() => document.documentElement.scrollWidth > innerWidth)) largas.push(i + 1); }
  ok(largas.length === 0, `${nome} celular: nenhuma etapa com rolagem horizontal${largas.length ? ' → ' + largas.join(', ') : ''}`);
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
