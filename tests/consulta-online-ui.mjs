// Consulta online no navegador, com o Supabase falso: agendar marcando "Online" cria a consulta no servidor; a agenda
// mostra Online, Vídeo e o WhatsApp com o link; o vídeo abre numa janela que fica por cima das telas (aumentar, copiar
// o link, encerrar); remarcar mantém o mesmo link; desmarcar cancela. Página do paciente: termo, aceite e vídeo em tela
// cheia; link inválido e horário desmarcado avisam. Sem conta no servidor, avisa. Celular sem rolagem horizontal.
// Uso: node tests/consulta-online-ui.mjs
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
const agendarOnline = async (p, online = true) => {
  await ir(p, 'agenda'); await p.waitForSelector('#f-appt');
  await clicar(p, '#ag-livres .chip >> nth=-1');
  if (online) await clicar(p, 'label.tg:has(#na-online)');
  await clicar(p, '#f-appt button.pri'); await p.waitForTimeout(400);
};

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  // Sem conta no servidor: agenda, mas avisa que a consulta online precisa da conta.
  { const L = await aparelho('L', url, { nuvem:false });
    await agendarOnline(L);
    const A = (await horarios(L)).find(a => a.online);
    ok(A && !A.video && await tem(L, '.toast, #toast', 'precisa da conta no servidor'), `${rot}: sem conta no servidor, o horário fica online mas avisa que precisa da conta`);
    await L.context().close(); }

  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } };
  S.clinicas.length = 0; S.dados = {}; S.teles = []; S.teleSit = '';
  const M = await aparelho('M', url);
  await entrar(M, 'maicon@x.com', 'segredo123');
  await M.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await M.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(300);
  await agendarOnline(M);
  let A = (await horarios(M)).find(a => a.online), T = S.teles[0];
  ok(S.teles.length === 1 && A?.video === T.id && T.consulta_id === A.id && T.primeiro && T.clinica_nome && T.duracao > 0 && !T.cancelada, `${rot}: agendar online cria a consulta no servidor e guarda o código no horário`);
  ok(new Date(T.inicio).getTime() === new Date(`${A.date}T${A.time}:00`).getTime(), `${rot}: o servidor recebe o dia e a hora certos`);
  const linha = `#ag-l .hor[data-hor="${A.id}"]`;
  ok(await tem(M, linha + ' .on-l', 'Online') && await tem(M, linha + ' [data-act=video]', 'Vídeo') && await tem(M, linha + ' [data-act=wa-online]'), `${rot}: a agenda marca Online, com Vídeo e WhatsApp do link`);
  await clicar(M, linha + ' [data-act=wa-online]');
  const msg = await M.inputValue('#wa-t');
  ok(msg.includes(`/consulta/?c=${T.id}`) && msg.includes('consulta online') && await tem(M, '.wa-p .chip.on', 'Consulta online'), `${rot}: o WhatsApp abre a mensagem da consulta online com o link do paciente`);
  await clicar(M, '.wa-p [data-act=fechar] >> nth=0');
  // Vídeo
  await clicar(M, linha + ' [data-act=video]'); await M.waitForTimeout(200);
  ok(await M.locator('#video-jan iframe').getAttribute('src') === `about:blank#sala-${T.id}` && T.entradas === 1, `${rot}: Vídeo abre a sala numa janela por cima do sistema`);
  await clicar(M, '#video-jan [data-v=tamanho]');
  ok(await M.locator('#video-jan.grande').count() === 1, `${rot}: dá para aumentar a janela do vídeo`);
  await clicar(M, '#video-jan [data-v=copiar]');
  ok((await M.evaluate(() => navigator.clipboard.readText())).endsWith(`/consulta/?c=${T.id}`), `${rot}: copiar o link do paciente pela janela`);
  await ir(M, 'pacientes');
  ok(await tem(M, '#video-jan iframe'), `${rot}: o vídeo continua aberto ao trocar de tela (prontuário, pacientes…)`);
  await M.setViewportSize({ width:390, height:800 }); await M.waitForTimeout(200);
  ok(await semRolagem(M), `${rot} celular: janela do vídeo sem rolagem horizontal`);
  await M.setViewportSize({ width:1280, height:900 });
  await clicar(M, '#video-jan [data-v=sair]');
  ok(!(await tem(M, '#video-jan')), `${rot}: encerrar fecha a janela`);
  // Remarcar e desmarcar
  await ir(M, 'agenda'); await clicar(M, linha + ' [data-act=ag-rem]');
  ok(await M.isChecked('#na-online'), `${rot}: remarcar já vem com Online marcado`);
  await clicar(M, '#ag-livres .chip >> nth=0'); await clicar(M, '#f-appt button.pri'); await M.waitForTimeout(400);
  A = (await horarios(M)).find(a => a.id === A.id);
  ok(S.teles.length === 1 && A.video === T.id && new Date(T.inicio).getTime() === new Date(`${A.date}T${A.time}:00`).getTime(), `${rot}: remarcar atualiza a mesma consulta (o link enviado continua valendo)`);
  await clicar(M, `#ag-l .hor[data-hor="${A.id}"] [data-act=ag-desm]`); await M.waitForTimeout(300);
  ok(T.cancelada === true, `${rot}: desmarcar cancela a consulta online`);

  // Página do paciente
  { const P = await aparelho('P', 'consulta/?c=' + T.id, { viewport:{ width:390, height:800 }, nuvem:false }); await P.waitForTimeout(300); if (process.env.DEP) console.log(await P.innerHTML('body'));
    ok(await tem(P, '.cartao', 'desmarcado') && !(await tem(P, '#entrar')), `${rot} paciente: horário desmarcado avisa e não deixa entrar`);
    T.cancelada = false; await P.reload(); await P.waitForTimeout(300);
    ok(await tem(P, '.cartao h1', `Olá, ${T.primeiro}!`) && await tem(P, '.cartao', 'Spazio Stabilità') && await tem(P, '.termo', 'não é gravada') && await P.isDisabled('#entrar'), `${rot} paciente: mostra a clínica, o horário e o termo; sem aceitar, não entra`);
    ok(await semRolagem(P), `${rot} paciente: celular sem rolagem horizontal`);
    await P.check('#aceito'); await clicar(P, '#entrar'); await P.waitForTimeout(300);
    ok(T.aceite === 1 && await P.isVisible('#video') && await P.locator('#video-f').getAttribute('src') === `about:blank#paciente-${T.id}`, `${rot} paciente: aceita o termo e o vídeo abre em tela cheia`);
    S.teleSit = 'cedo'; await P.reload(); await P.waitForTimeout(300);
    ok(await tem(P, '.cartao', 'abre 30 minutos antes'), `${rot} paciente: antes da hora, explica quando a sala abre`);
    S.teleSit = '';
    await P.goto(BASE + 'consulta/?c=aaaaaaaa-0000-4000-8000-999999999999'); await P.waitForTimeout(300);
    ok(await tem(P, '.erro', 'Consulta não encontrada'), `${rot} paciente: link errado avisa`);
    await P.goto(BASE + 'consulta/'); await P.waitForTimeout(200);
    ok(await tem(P, '.erro', 'Link incompleto'), `${rot} paciente: link sem código avisa`);
    await P.context().close(); }
  await M.context().close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA consulta online (tela) passou.');
process.exit(falhas ? 1 : 0);
