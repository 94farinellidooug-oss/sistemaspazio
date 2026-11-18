// Atendimento com a conta no servidor (pedido do Maicon em 18/11): digitar na anamnese enquanto o sistema salva
// não pode tirar o cursor, fechar a seção aberta nem perder letras; "Finalizar" aparece em qualquer etapa e
// finaliza sem a avaliação energética, avisando o que ficou em branco. Alertas de segurança: lista maior e Outro.
// Uso: node tests/anamnese-digitar-ui.mjs
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { servidor } from './lib/supabase-falso.mjs';
import { NUVEM } from '../js/dados/nuvem.js';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const srv = await iniciar(0), BASE = `http://localhost:${srv.address().port}/`;
const S = servidor({ chave:NUVEM.chave });
const browser = await chromium.launch();
const erros = [];
async function aparelho(nome, url, { viewport = { width:1280, height:900 }, nuvem = true } = {}){
  const ctx = await browser.newContext({ viewport, permissions:['clipboard-read', 'clipboard-write'] });
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    if (q.method() === 'OPTIONS') return route.fulfill({ status:204, headers:{ 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*' } });
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    const corpoR = await r.text(); if (process.env.DEP && q.url().includes('teleconsulta')) console.log('RESP', r.status, corpoR, q.postData());
    await route.fulfill({ status:r.status, contentType:'application/json', headers:{ 'Access-Control-Allow-Origin':'*' }, body:corpoR });
  });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
  if (nuvem) await p.addInitScript(() => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', 'nuvem'); sessionStorage.setItem('iniciado', '1'); } });
  await p.goto(BASE + url); await p.waitForTimeout(150); return p;
}
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(250); };
const entrar = async (p, email, senha) => { await p.fill('#acesso [name=email]', email); await p.fill('#acesso [name=senha]', senha); await clicar(p, '#acesso [type=submit]'); await p.waitForTimeout(150); };
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const horarios = p => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')).appts);

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } };
  S.clinicas.length = 0; S.dados = {};
  const M = await aparelho('M', url);
  const dialogos = []; M.removeAllListeners('dialog'); M.on('dialog', d => { dialogos.push(d.message()); d.accept(); });
  await entrar(M, 'maicon@x.com', 'segredo123');
  await M.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await M.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(300);
  await ir(M, 'pacientes'); await clicar(M, '[data-act="open"][data-pid="p1"] >> nth=0');
  await clicar(M, '.perfil-a [data-act="novo-atendimento"]'); await M.waitForTimeout(300);
  ok(await tem(M, '.et-h h2', 'Anamnese') && await tem(M, '.et-h [data-act=at-finalizar-ja]'), `${rot}: o botão Finalizar aparece já na anamnese`);
  // Digitar devagar na seção Sono, enquanto o sistema salva no servidor várias vezes
  await clicar(M, '.anam details:has([data-atan="sono"]) summary');
  const salvasAntes = S.chamadas.filter(c => c.caminho.includes('salvar_dados')).length;
  await M.click('[data-atan="sono"]'); await M.keyboard.press('Control+A'); await M.keyboard.press('Delete');
  const frase = 'Acorda as 3h todas as noites, demora para pegar no sono de novo, sonhos agitados.';
  await M.keyboard.type(frase, { delay:45 }); await M.waitForTimeout(2500);
  const salvas = S.chamadas.filter(c => c.caminho.includes('salvar_dados')).length - salvasAntes;
  ok(salvas >= 1, `${rot}: o sistema salvou no servidor enquanto se digitava (${salvas}x)`);
  ok(await M.inputValue('[data-atan="sono"]') === frase, `${rot}: nenhuma letra se perde ao digitar na anamnese`);
  ok(await M.evaluate(() => document.activeElement?.dataset?.atan) === 'sono' && await M.evaluate(() => document.querySelector('.anam details:has([data-atan="sono"])').open), `${rot}: o cursor continua no campo e a seção continua aberta`);
  await M.keyboard.type(' Fim.'); 
  ok((await M.inputValue('[data-atan="sono"]')).endsWith('agitados. Fim.'), `${rot}: dá para continuar digitando no fim do texto`);
  // Finalizar sem avaliação energética
  await clicar(M, '.et-h [data-act=at-finalizar-ja]'); await M.waitForTimeout(400);
  const d = await M.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')).patients.find(p => p.id === 'p1'));
  const A = d.atendimentos.at(-1);
  ok(dialogos.at(-1)?.includes('avaliação energética') && A.status === 'finalizado' && !A.avaliacaoId && d.anam.sono.endsWith('Fim.'), `${rot}: Finalizar avisa o que ficou em branco e finaliza sem avaliação energética`);
  ok(await M.evaluate(() => location.hash) === '#prontuario', `${rot}: depois de finalizar, volta ao prontuário`);
  // Alertas de segurança: lista maior e "Outro" com texto
  await clicar(M, '.perfil-a [data-act="editar-paciente"]');
  ok(await M.locator('#f-patient [id^=np-al-]:not(#np-al-outro-t)').count() >= 15 && !(await M.isVisible('#np-al-outro-t')), `${rot}: o cadastro tem a lista maior de alertas e o Outro, com o campo escondido`);
  await clicar(M, 'label.tg:has(#np-al-diabetes)'); await clicar(M, 'label.tg:has(#np-al-outro)');
  ok(await M.isVisible('#np-al-outro-t') && await M.evaluate(() => document.activeElement.id) === 'np-al-outro-t', `${rot}: marcar Outro mostra o campo para escrever`);
  await M.keyboard.type('Cirurgia recente no joelho'); await M.fill('#np-cpf', '52998224725'); await clicar(M, '#f-patient button.pri');
  let al = await M.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')).patients.find(p => p.id === 'p1').alerts);
  ok(al.diabetes === true && al.outro === 'Cirurgia recente no joelho' && al.gestante === false && !('epilepsia' in al), `${rot}: grava só os alertas marcados e o texto do Outro`);
  ok(await tem(M, '.perfil-h .pill.crit', 'Diabetes') && await tem(M, '.perfil-h .pill.crit', 'Cirurgia recente no joelho'), `${rot}: o prontuário mostra os alertas novos e o Outro`);
  await clicar(M, '[data-t="anamnese"]');
  await M.uncheck('#al-diabetes'); await M.waitForTimeout(250);
  al = await M.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')).patients.find(p => p.id === 'p1').alerts);
  ok(!('diabetes' in al) && al.outro === 'Cirurgia recente no joelho' && await M.inputValue('#al-outro-t') === 'Cirurgia recente no joelho', `${rot}: na aba de anamnese dá para desmarcar e o Outro continua`);
  await M.fill('#al-outro-t', 'Hérnia de disco lombar'); await M.press('#al-outro-t', 'Tab'); await M.waitForTimeout(250);
  ok(await tem(M, '.perfil-h .pill.crit', 'Hérnia de disco lombar'), `${rot}: mudar o texto do Outro atualiza o alerta`);
  await M.context().close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nDigitar na anamnese e finalizar sem avaliação: passou.');
process.exit(falhas ? 1 : 0);
