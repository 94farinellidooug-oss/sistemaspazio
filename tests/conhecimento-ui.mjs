// Conhecimento da avaliação energética no atendimento (pedido do Maicon em 18/11): protocolo em cada hipótese,
// "como diferenciar", lista das síndromes Zang-Fu e dos objetivos das substâncias, e os pontos no Plano.
// Uso: node tests/conhecimento-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { evaluate } from '../js/raciocinio/avaliacao.js';
import { PROTOCOLOS } from '../js/conhecimento/protocolos.js';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const NOME = 'Rita Conhecimento';
const SINAIS = ['pulso_corda', 'irritabilidade', 'tpm', 'suspiros', 'cefaleia_temporal'];

async function verificar(browser, url, nome){
  const erros = [], ctx = await browser.newContext({ viewport:{ width:1280, height:900 } }), p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); p.on('dialog', d => d.accept());
  const espera = () => p.waitForTimeout(80);
  const ir = async h => { await p.evaluate(h => { location.hash = h; }, h); await espera(); };
  const rasc = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('musubi-v2'))).patients.find(x => x.name === NOME).atendimentos.find(a => a.status === 'rascunho');
  const conta = s => p.locator(s).count();
  const aba = async i => { await p.click(`.ab-bar [data-act="at-aba"][data-i="${i}"]`); await espera(); };
  const semRolagem = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

  await p.goto(url); await p.waitForSelector('#view h1');
  await ir('cadastro'); await p.fill('#np-name', NOME); await p.fill('#np-birth', '1985-06-10'); await p.fill('#np-q', 'Cefaleia');
  await p.check('#np-lgpd'); await p.click('#f-patient button.pri'); await espera();
  await p.click('.perfil-a [data-act="novo-atendimento"]'); await espera();
  await p.click('.steps [data-i="1"]'); await espera();

  // Sinais novos na tela e hipóteses com protocolo
  ok(await conta('[data-act="at-sinal"][data-s="frio_abdome"]') === 1 && await conta('[data-act="at-pulso"][data-l="esq"][data-k="pulso_tenso"]') === 1, `${nome}: sinais e pulsos novos na aba Língua e pulso`);
  for (const s of SINAIS) await p.click(s.startsWith('pulso_') ? `[data-act="at-pulso"][data-l="esq"][data-k="${s}"]` : `[data-act="at-sinal"][data-s="${s}"]`);
  await espera();
  const H = evaluate(SINAIS).map(h => h.p.id);
  ok(await conta('.hp') === H.length && H.includes('f_estag') && H.includes('f_yang'), `${nome}: hipóteses do raciocínio clínico (${H.join(', ')})`);
  ok(await conta('.hp .proto') === H.filter(i => PROTOCOLOS[i]).length, `${nome}: cada hipótese com protocolo do Maicon mostra o protocolo`);
  await p.click('.hp .proto summary >> nth=0'); await espera();
  ok(await p.locator('.hp .proto').first().evaluate(e => e.open) && (await p.locator('.hp .proto').first().textContent()).includes('Princípio'), `${nome}: protocolo abre com princípio e pontos`);
  ok(await conta('.dif') === 1 && (await p.textContent('.dif')).includes('Estagnação do Qi do Fígado') && (await p.textContent('.dif')).includes('Ascensão do Yang do Fígado'), `${nome}: "Como diferenciar" Fígado (estagnação x Yang)`);
  await p.click('[data-act="at-hip"][data-p="f_yang"][data-st="descartado"]'); await espera();
  ok(await conta('.dif') === 0, `${nome}: descartar uma das duas tira o quadro de diferenciação`);
  await p.click('[data-act="at-hip"][data-p="f_estag"][data-st="aceito"]'); await espera();

  // Zang-Fu: 11 síndromes; marcar leva para Síntese e Plano
  await aba(2);
  ok(await conta('.lista-cl .lc-i') === 11 && await conta('.lista-cl .lc-g') === 5, `${nome}: aba Zang-Fu com as 11 síndromes em 5 sistemas`);
  await p.click('[data-act="at-lista"][data-ref="zf:bp_qi"]'); await espera();
  let r = await rasc(), it = r.avaliacao.categorias.zangfu.itens[0];
  ok(it?.ref === 'zf:bp_qi' && it.texto === 'Deficiência de Qi do Baço' && it.sintese && it.plano && it.sit === 'pos', `${nome}: síndrome marcada vira achado na Síntese e no Plano`);
  ok(await conta('.lc-i .pill.ok') === 1 && await conta('[data-act="at-lista"][data-ref="zf:bp_qi"]') === 0 && await conta('.livre') === 1, `${nome}: aparece como marcado e na lista de achados`);
  ok(await conta('form.livre-f[data-cat="zangfu"]') === 1, `${nome}: registro livre continua na aba`);
  await aba(3);
  ok(await conta('.lista-cl .lc-i') === 4, `${nome}: Qi e Xue com 4 objetivos`);
  await p.click('[data-act="at-lista"][data-ref="sub:mov_qi"]'); await espera();
  await aba(4); ok(await conta('.lista-cl .lc-i') === 2, `${nome}: Jin Ye com 2 objetivos`);
  await aba(5); ok(await conta('.lista-cl .lc-i') === 2, `${nome}: Jing e Shen com 2 objetivos`);
  await aba(6); ok(await conta('.lista-cl') === 0 && await conta('form.livre-f[data-cat="fatores"]') === 1, `${nome}: Fatores continua só registro livre`);

  // Plano: pontos do item marcado e do protocolo da hipótese aceita
  await p.click('.steps [data-i="5"]'); await espera();
  const traz = p.locator('.sx-i', { hasText:'Deficiência de Qi do Baço' });
  ok(await traz.locator('[data-act="at-pt"][data-c="BP3"]').count() === 1 && (await traz.textContent()).includes('Tonificação'), `${nome}: Plano mostra pontos e técnica do item marcado`);
  ok(await p.locator('.sx-i', { hasText:'Mover o Qi estagnado' }).locator('[data-act="at-pt"][data-c="VC17"]').count() === 1, `${nome}: Plano mostra pontos do objetivo de Qi`);
  await traz.locator('[data-act="at-pt"][data-c="BP3"]').click(); await espera();
  r = await rasc(); ok(r.plano.pontos.includes('BP3'), `${nome}: tocar no ponto inclui no plano`);
  ok(await p.locator('.sug', { hasText:'Estagnação do Qi do Fígado' }).locator('[data-act="at-pt"][data-c="F3"]').count() === 1, `${nome}: sugestão da hipótese aceita usa os pontos do protocolo`);

  // Celular
  await p.setViewportSize({ width:390, height:844 }); await espera();
  ok(await semRolagem(), `${nome} celular: Plano sem rolagem horizontal`);
  await p.click('.steps [data-i="1"]'); await espera(); await aba(2);
  await p.click('.lista-cl .proto summary >> nth=0'); await espera();
  ok(await semRolagem(), `${nome} celular: Zang-Fu com protocolo aberto sem rolagem horizontal`);
  await aba(0); ok(await semRolagem(), `${nome} celular: hipóteses e diferenciação sem rolagem horizontal`);

  ok(!erros.length, `${nome}: sem erros no console${erros.length ? ' → ' + erros.join(' | ') : ''}`);
  await ctx.close();
}
const srv = await iniciar(0), base = `http://localhost:${srv.address().port}/`, browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'dist');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nConhecimento da avaliação no atendimento: tudo certo.');
process.exit(falhas ? 1 : 0);
