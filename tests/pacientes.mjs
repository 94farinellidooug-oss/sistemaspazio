// Verifica a etapa 2C: lista de pacientes com busca e estados vazios, cadastro completo (novo e
// edição, com validação de CPF), várias queixas com a evolução de cada uma, prontuário em linha do
// tempo e comparação entre a avaliação basal e a atual. Confere também que o que é gravado continua
// compatível com o protótipo: convertido para o v1, só a queixa principal aparece nas sessões.
// Uso: node tests/pacientes.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { paraV1 } from '../js/dados/migracao.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const NOME = 'Joana Cadastro';

async function verificar(browser, url, nome) {
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const ir = async h => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(60); };
  const espera = () => p.waitForTimeout(80);
  const dados = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('musubi-v2')));
  const paciente = async () => (await dados())?.patients.find(x => x.name === NOME);
  const tem = async (sel, txt) => (await p.locator(sel, txt ? { hasText: txt } : {}).count()) > 0;
  const faixa = async (sel, v) => p.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
  await p.goto(url); await p.waitForSelector('#view h1');

  // Lista e busca
  await ir('pacientes');
  ok(await p.locator('#plist .pc').count() === 4, `${nome}: lista mostra os 4 pacientes de exemplo`);
  await p.fill('#pq', 'zzz'); await espera();
  ok(await tem('#plist .empty', 'Nenhum paciente encontrado') && await tem('#plist [data-act="novo-paciente"]'), `${nome}: busca sem resultado mostra estado vazio com "Novo paciente"`);
  await p.fill('#pq', 'lombalgia'); await espera();
  ok(await p.locator('#plist .pc').count() >= 1, `${nome}: busca pela queixa encontra paciente`);
  await p.fill('#pq', '');

  // Cadastro completo
  await p.click('.head [data-act="novo-paciente"]'); await espera();
  ok(await p.evaluate(() => location.hash) === '#cadastro' && await p.textContent('#view h1') === 'Novo paciente', `${nome}: "Novo paciente" abre a tela de cadastro`);
  ok(await p.locator('#nav a[aria-current="page"]').getAttribute('href') === '#pacientes', `${nome}: cadastro marca Pacientes no menu`);
  await p.fill('#np-name', NOME); await espera();
  ok(await p.textContent('#pv-n') === NOME && await p.textContent('#pv-av') === 'JC', `${nome}: pré-visualização acompanha o nome`);
  // Máscaras: data digitada (sem calendário), telefone e CPF formatados enquanto se digita
  await p.click('#np-birth'); await p.keyboard.type('31021990');
  await p.click('#np-phone'); await p.keyboard.type('11988887777');
  await p.click('#np-cpf'); await p.keyboard.type('11111111111');
  ok(await p.inputValue('#np-birth') === '31/02/1990' && await p.getAttribute('#np-birth', 'type') === 'text', `${nome}: data de nascimento é digitada e vira dd/mm/aaaa`);
  ok(await p.inputValue('#np-phone') === '(11) 98888-7777', `${nome}: telefone vira (00) 00000-0000 enquanto digita`);
  ok(await p.inputValue('#np-cpf') === '111.111.111-11', `${nome}: CPF vira 000.000.000-00 enquanto digita`);
  await p.fill('#np-phone', '5433334444');
  ok(await p.inputValue('#np-phone') === '(54) 3333-4444', `${nome}: telefone fixo com 10 números vira (00) 0000-0000`);
  await p.fill('#np-phone', ''); await p.click('#np-phone'); await p.keyboard.type('11988887777');
  await p.fill('#np-email', 'joana@exemplo.com');
  await p.fill('#np-end', 'Rua das Flores, 10'); await p.fill('#np-cid', 'Curitiba'); await p.fill('#np-emerg', 'Pedro · (11) 97777-6666');
  await p.fill('#np-q', 'Enxaqueca'); await p.click('label.tg:has(#np-al-gestante)'); await p.check('#np-lgpd');
  await p.click('#f-patient button.pri'); await espera();
  ok(await p.evaluate(() => location.hash) === '#cadastro' && !(await paciente()), `${nome}: CPF inválido impede o cadastro`);
  await p.fill('#np-cpf', '52998224725');
  ok(await p.inputValue('#np-cpf') === '529.982.247-25', `${nome}: CPF colado sem pontos também é formatado`);
  await p.click('#f-patient button.pri'); await espera();
  ok(await p.evaluate(() => location.hash) === '#cadastro' && !(await paciente()) && await p.evaluate(() => document.getElementById('np-birth').validationMessage.includes('Data inválida')), `${nome}: data impossível (31/02) impede o cadastro`);
  await p.fill('#np-birth', ''); await p.click('#np-birth'); await p.keyboard.type('12/04/1988');
  ok(await p.inputValue('#np-birth') === '12/04/1988', `${nome}: data digitada com barras continua dd/mm/aaaa`);
  await p.fill('#np-cpf', '52998224725'); await p.click('#f-patient button.pri'); await espera();
  let j = await paciente();
  ok(!!j && await p.evaluate(() => location.hash) === '#prontuario' && await tem('.tabs [data-t="anamnese"].on'), `${nome}: CPF válido cadastra e abre o perfil na anamnese`);
  ok(j && j.birth === '1988-04-12' && j.phone === '(11) 98888-7777', `${nome}: data gravada como aaaa-mm-dd e telefone formatado`);
  ok(j && j.cadastro.cpf === '529.982.247-25' && j.cadastro.cidade === 'Curitiba' && j.cadastro.email === 'joana@exemplo.com' && j.cadastro.endereco === 'Rua das Flores, 10' && j.cadastro.contatoEmergencia.startsWith('Pedro') && j.cadastro.hemisferio === 'Sul', `${nome}: dados cadastrais completos gravados (CPF formatado)`);
  ok(j && j.alerts.gestante === true && j.alerts.marcapasso === false && j.consentimento, `${nome}: alertas e consentimento LGPD gravados`);
  ok(await tem('.perfil-h .pill.crit', 'Gestante') && await tem('.perfil-h', 'Curitiba'), `${nome}: perfil mostra o alerta e a cidade`);

  // Edição do cadastro
  await p.click('[data-t="resumo"]'); await espera();
  ok(await tem('.corr-g', '529.982.247-25') && await tem('.corr-g', 'Pedro'), `${nome}: resumo mostra os dados cadastrais`);
  await p.click('.perfil-a [data-act="editar-paciente"]'); await espera();
  ok(await p.inputValue('#np-birth') === '12/04/1988' && await p.inputValue('#np-phone') === '(11) 98888-7777', `${nome}: edição mostra a data como dd/mm/aaaa`);
  ok(await p.textContent('#view h1') === 'Editar cadastro' && await p.inputValue('#np-cid') === 'Curitiba' && await p.inputValue('#np-q') === 'Enxaqueca', `${nome}: edição abre com os dados preenchidos`);
  ok(await tem('#view', 'Consentimento LGPD registrado'), `${nome}: edição mostra o consentimento já registrado`);
  await p.fill('#np-cid', 'Porto Alegre'); await p.selectOption('#np-hem', 'Sul'); await p.click('#f-patient button.pri'); await espera();
  j = await paciente();
  ok(j.cadastro.cidade === 'Porto Alegre' && j.cadastro.atualizadoEm && await tem('.corr-g', 'Porto Alegre'), `${nome}: edição salva e volta ao perfil`);

  // CEP: busca no ViaCEP (simulado) e preenche rua, bairro, cidade e estado
  await p.route('https://viacep.com.br/**', r => r.fulfill({ headers:{ 'Access-Control-Allow-Origin':'*' }, contentType:'application/json',
    body:JSON.stringify(r.request().url().includes('99999999') ? { erro:'true' } : { logradouro:'Rua Sinimbu', bairro:'Centro', localidade:'Caxias do Sul', uf:'RS' }) }));
  await p.click('.perfil-a [data-act="editar-paciente"]'); await espera();
  await p.fill('#np-cep', '99999999'); await p.waitForTimeout(250);
  ok(await tem('#np-cep-s', 'CEP não encontrado') && await p.inputValue('#np-cid') === 'Porto Alegre', `${nome}: CEP inexistente avisa e não apaga o endereço`);
  await p.fill('#np-cep', '95020002'); await p.waitForTimeout(250);
  ok(await p.inputValue('#np-cep') === '95020-002' && await p.inputValue('#np-end') === 'Rua Sinimbu' && await p.inputValue('#np-bai') === 'Centro' && await p.inputValue('#np-cid') === 'Caxias do Sul' && await p.inputValue('#np-uf') === 'RS', `${nome}: CEP preenche rua, bairro, cidade e estado`);
  ok(await p.evaluate(() => document.activeElement?.id) === 'np-num' && await tem('#np-cep-s', 'Falta o número'), `${nome}: depois do CEP o cursor vai para o número`);
  await p.fill('#np-num', '1500'); await p.fill('#np-comp', 'sala 2'); await p.click('#f-patient button.pri'); await espera();
  j = await paciente();
  ok(j.cadastro.cep === '95020002' && j.cadastro.numero === '1500' && j.cadastro.complemento === 'sala 2' && j.cadastro.uf === 'RS' && j.cadastro.endereco === 'Rua Sinimbu', `${nome}: CEP, número, complemento e estado gravados`);
  ok(await tem('.corr-g', 'Rua Sinimbu, 1500, sala 2 · Centro · CEP 95020-002') && await tem('.corr-g', 'Caxias do Sul - RS'), `${nome}: perfil mostra o endereço completo`);

  // Várias queixas
  await p.fill('#nq-desc', 'Insônia'); await p.click('#f-queixa button'); await espera();
  j = await paciente();
  const qi = j.queixas.find(q => q.descricao === 'Insônia');
  ok(j.queixas.length === 2 && qi && qi.ativa, `${nome}: segunda queixa adicionada`);
  ok(await tem('.qgrid .qc', 'Insônia') && await tem('.qgrid .qc', 'medida no próximo atendimento'), `${nome}: queixa nova aparece aguardando a primeira medida`);
  for (const [q1, q2, nota] of [[6, 7, 'Primeiro atendimento'], [3, 4, 'Segundo atendimento']]) {
    await p.click('.tabs [data-t="nova"]'); await espera();
    await faixa('#ns-eva', q1); await faixa(`#ns-q-${qi.id}`, q2); await p.fill('#ns-nota', nota);
    await p.click('#f-session button.pri'); await espera();
  }
  j = await paciente();
  ok(JSON.stringify(j.atendimentos.map(a => a.evolucao.intensidades)) === JSON.stringify([{ q1: 6, [qi.id]: 7 }, { q1: 3, [qi.id]: 4 }]), `${nome}: cada atendimento grava a intensidade de cada queixa`);
  const v1 = paraV1(await dados())?.patients.find(x => x.name === NOME);
  ok(JSON.stringify(v1.sessions.map(s => s.eva)) === '[6,3]' && v1.queixa === 'Enxaqueca' && !('cadastro' in v1) && Object.keys(v1.sessions[0]).join() === 'id,date,eva,pontos,tec,nota', `${nome}: convertido para o protótipo, só a queixa principal entra nas sessões`);

  // Prontuário em linha do tempo
  ok(await tem('.tabs [data-t="sessoes"].on', 'Atendimentos'), `${nome}: depois de salvar, abre a aba Atendimentos do prontuário`);
  ok(await p.locator('#view .card .chart g.se').count() === 2 && await p.locator('#view .leg-b').count() === 2, `${nome}: gráfico de evolução com uma linha por queixa`);
  ok(await tem('.qsum', '7 → 4') && await tem('.qsum', '6 → 3'), `${nome}: resumo da evolução de cada queixa`);
  ok(await p.locator('.lt .lt-i').count() === 2 && await tem('.lt .lt-i', '2º atendimento') && await tem('.lt .lt-i', 'Insônia: 4/10'), `${nome}: linha do tempo com os atendimentos e as intensidades`);
  const ordem = await p.$$eval('.lt .lt-i .lt-h b', b => b.map(x => x.textContent));
  ok(ordem[0] === '2º atendimento', `${nome}: linha do tempo do mais recente para o mais antigo`);
  await p.click('.leg-b[data-s="1"]');
  ok(await p.locator('.chart g.se.oculta').count() === 1, `${nome}: legenda oculta e mostra cada queixa`);
  await p.click('[data-t="resumo"]'); await espera();
  ok(await tem('.qc', '43% de melhora') && await tem('.qc', '50% de melhora'), `${nome}: melhora de cada queixa calculada da primeira para a última medida`);

  ok(JSON.stringify(await p.$$eval('.hist .hi-n', e => e.map(x => x.textContent))) === '["2","1"]', `${nome}: atendimentos recentes numerados na ordem certa`);

  // Resolver e reativar queixa
  await p.click(`[data-act="queixa-ativa"][data-q="${qi.id}"]`); await espera();
  ok((await paciente()).queixas.find(q => q.id === qi.id).ativa === false && await tem('details.mais summary', '1 queixa resolvida'), `${nome}: queixa marcada como resolvida`);
  await p.click('.tabs [data-t="nova"]'); await espera();
  ok(await p.locator(`#ns-q-${qi.id}`).count() === 0, `${nome}: queixa resolvida não é medida no próximo atendimento`);
  await p.click('[data-t="resumo"]'); await espera();
  await p.click('details.mais summary >> text=queixa resolvida'); await p.click(`[data-act="queixa-ativa"][data-q="${qi.id}"]`); await espera();
  ok((await paciente()).queixas.find(q => q.id === qi.id).ativa === true, `${nome}: queixa reativada`);

  // Avaliação basal × atual
  for (const sinais of [['pulso_corda', 'irritabilidade'], ['irritabilidade', 'tpm']]) {
    await p.click('.tabs [data-t="avaliacao"]'); await espera();
    for (const s of sinais) await p.click(`[data-s="${s}"]`);
    await p.click('[data-act="save-assess"]'); await espera();
  }
  await p.click('[data-t="sessoes"]'); await espera();
  ok(await tem('#view .card h2', 'Avaliação basal × atual') && await p.locator('.cmp svg.penta').count() === 2, `${nome}: comparação basal × atual com os dois pentagramas`);
  ok(await tem('.sinais-cmp', '1 sinal que não aparece mais') && await tem('.sinais-cmp', '1 sinal novo'), `${nome}: sinais que saíram e sinais novos desde o basal`);
  ok(await tem('.lt', 'avaliação basal') && await tem('.lt', 'reavaliação'), `${nome}: linha do tempo marca a avaliação basal e a reavaliação`);

  // Paciente sem atendimentos
  await p.goto(url + '#pacientes'); await p.waitForSelector('#view h1');
  await p.click('#plist [data-pid]:has-text("Tiago")'); await espera();
  await p.click('[data-t="sessoes"]'); await espera();
  ok(await tem('#view .lt-i') && await tem('#view', 'Só existe a avaliação basal'), `${nome}: paciente com uma avaliação mostra só o basal, sem comparação`);

  // Celular: cadastro e prontuário sem rolagem horizontal
  const cel = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pc = await cel.newPage(); pc.on('pageerror', e => erros.push(e.message));
  await pc.goto(url + '#cadastro'); await pc.waitForSelector('#view h1');
  ok(!(await pc.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${nome} celular: cadastro sem rolagem horizontal`);
  await cel.close();

  ok(erros.length === 0, `${nome}: sem erros no console${erros.length ? ' → ' + erros.join(' | ') : ''}`);
  await ctx.close();
}

const srv = await iniciar(0); const base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'dist');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTodas as verificações de pacientes e prontuário passaram.');
process.exit(falhas ? 1 : 0);
