// Verifica no navegador o Histórico de alterações (LGPD) com o Supabase falso: sem conta só explica; com conta, o
// que a equipe muda (agenda, cadastro) aparece na Administração com quem, quando e o quê; o botão Histórico do
// prontuário abre filtrado no paciente; servidor sem o 006 avisa o que rodar; celular sem rolagem horizontal.
// Uso: node tests/historico-ui.mjs
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
async function aparelho(nome, url, { nuvem = true, largura = 1280 } = {}){
  const ctx = await browser.newContext({ viewport:{ width:largura, height:900 } });
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    await route.fulfill({ status:r.status, contentType:'application/json', body:await r.text() });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
  if (nuvem) await p.addInitScript(() => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', 'nuvem'); sessionStorage.setItem('iniciado', '1'); } });
  await p.goto(BASE + url); await p.waitForTimeout(150); return p;
}
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(250); };
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(300); };
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  { const L = await aparelho('L', url, { nuvem:false }); await ir(L, 'historico');
    ok(await tem(L, 'h1', 'Histórico de alterações') && await tem(L, '.empty, .vazio', 'só com conta'), `${rot}: sem conta, o histórico só explica`);
    await ir(L, 'administracao'); ok(!(await tem(L, '.adm-c[href="#historico"]')), `${rot}: sem conta, a Administração não mostra o histórico`);
    await L.context().close(); }

  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } };
  S.clinicas.length = 0; S.dados = {}; S.historico = []; S.semHistorico = false;
  const M = await aparelho('M', url);
  await M.fill('#acesso [name=email]', 'maicon@x.com'); await M.fill('#acesso [name=senha]', 'segredo123'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(150);
  await M.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await M.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(400);
  const c = S.clinicas[0].id; S.clinicas[0].membros[0].nome = 'Maicon Farinelli';
  // Muda a agenda e o cadastro de um paciente pelo próprio sistema.
  await ir(M, 'agenda'); await M.waitForSelector('#ag-l');
  await clicar(M, '#ag-l .hor [data-s="atendido"]:not(.on) >> nth=0');
  const pac = await M.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')).patients[0]);
  await M.evaluate(id => { location.hash = 'pacientes'; }, pac.id); await M.waitForTimeout(300);
  await clicar(M, `[data-act=open][data-pid="${pac.id}"] >> nth=0`); await M.waitForTimeout(300);
  await clicar(M, '[data-act=editar-paciente]'); await M.waitForTimeout(300);
  await M.fill('#np-phone', '(54) 99999-1234'); await M.fill('#np-cpf', '529.982.247-25'); await clicar(M, '#f-patient button.pri'); await M.waitForTimeout(2600);
  const H = S.historico.filter(h => h.clinica_id === c);
  ok(H.some(h => h.tipo === 'horario' && h.acao === 'alterou') && H.some(h => h.tipo === 'paciente' && h.acao === 'alterou' && h.campos.includes('phone') && h.campos.includes('cadastro.cpf') && h.paciente_id === pac.id), `${rot}: atender na agenda e mudar o telefone viram registros no servidor`);
  ok(H.every(h => h.email === 'maicon@x.com' && h.pessoa === 'Maicon Farinelli'), `${rot}: cada registro tem o login e o nome de quem salvou`);

  await ir(M, 'administracao');
  ok(await tem(M, '.adm-c[href="#historico"]', 'Histórico de alterações'), `${rot}: a Administração mostra o histórico para o administrador`);
  await clicar(M, '.adm-c[href="#historico"]'); await M.waitForTimeout(500);
  ok(await tem(M, '#hs-l .hs-r', `Maicon Farinelli alterou cadastro`) && await tem(M, '#hs-l .hs-r', 'telefone') && await tem(M, '#hs-l .hs-r', 'maicon@x.com'), `${rot}: o histórico mostra quem, o quê (campos em português) e o e-mail`);
  ok(await tem(M, '#hs-l .hs-r', 'alterou agenda'), `${rot}: a agenda também aparece`);
  await M.selectOption('#hs-l [name=tipo]', 'paciente'); await M.waitForTimeout(200);
  ok(!(await tem(M, '#hs-l .hs-r', 'alterou agenda')) && await tem(M, '#hs-l .hs-r', 'alterou cadastro'), `${rot}: filtra pelo tipo de registro`);

  // Pelo prontuário: abre filtrado no paciente.
  await ir(M, 'pacientes'); await clicar(M, `[data-act=open][data-pid="${pac.id}"] >> nth=0`); await M.waitForTimeout(300);
  ok(await tem(M, '.perfil-a [data-hs=paciente]'), `${rot}: o prontuário tem o botão Histórico para o administrador`);
  await clicar(M, '.perfil-a [data-hs=paciente]'); await M.waitForTimeout(500);
  ok(await M.inputValue('#hs-l [name=paciente]') === pac.id && await tem(M, '#hs-l .hs-r', pac.name), `${rot}: o botão do prontuário abre o histórico só daquele paciente`);
  await ir(M, 'administracao'); await clicar(M, '.adm-c[href="#historico"]'); await M.waitForTimeout(400);
  ok(await M.inputValue('#hs-l [name=paciente]') === '', `${rot}: pela Administração abre o histórico de todos`);

  // Celular
  await M.setViewportSize({ width:375, height:800 }); await M.waitForTimeout(200);
  ok(await semRolagem(M), `${rot}: no celular, sem rolagem horizontal`);
  await M.setViewportSize({ width:1280, height:900 });

  // Servidor sem o 006: os dados continuam salvando e a tela diz o que rodar.
  S.semHistorico = true; await M.reload(); await M.waitForTimeout(600); await ir(M, 'historico'); await M.waitForTimeout(400);
  ok(await tem(M, '#hs-falta', '006_historico.sql'), `${rot}: servidor sem o 006 avisa o arquivo que falta rodar`);
  S.semHistorico = false;
  await M.context().close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nO histórico de alterações (tela) passou.');
process.exit(falhas ? 1 : 0);
