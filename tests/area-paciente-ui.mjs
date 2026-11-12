// Área do paciente no navegador, com o Supabase falso: no prontuário, criar o link escolhendo o que liberar (documento,
// resumo da avaliação); o conteúdo vai pronto para o servidor, sem avaliação completa nem pentagrama; WhatsApp com o
// link; publica de novo sozinho quando algo muda; página do paciente com data de nascimento (errada avisa, certa
// abre), logo e profissional, baixar em PDF, celular sem rolagem; acessos aparecem na janela; desligar tira do ar.
// Uso: node tests/area-paciente-ui.mjs
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
const areaDe = () => S.areas[0];
for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  // Sem conta no servidor: explica que precisa da conta.
  { const L = await aparelho('L', url, { nuvem:false });
    await ir(L, 'pacientes'); await clicar(L, '[data-act="open"][data-pid="p1"] >> nth=0');
    await clicar(L, '[data-act="area-abrir"]');
    ok(await tem(L, '#ar-fundo', 'precisa da conta no servidor') && !(await tem(L, '#f-area')), `${rot}: sem conta no servidor, a área do paciente explica que precisa da conta`);
    await L.context().close(); }

  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } };
  S.clinicas.length = 0; S.dados = {}; S.areas = [];
  const M = await aparelho('M', url);
  await entrar(M, 'maicon@x.com', 'segredo123');
  await M.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await M.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(300);
  // Um documento guardado para liberar
  await ir(M, 'pacientes'); await clicar(M, '[data-act="open"][data-pid="p1"] >> nth=0');
  await clicar(M, '.perfil-a [data-act="doc-abrir"]'); await clicar(M, '[data-m="declaracao"]'); await clicar(M, '[data-act="doc-guardar"]');
  await ir(M, 'pacientes'); await clicar(M, '[data-act="open"][data-pid="p1"] >> nth=0');
  await clicar(M, '.perfil-a [data-act="area-abrir"]');
  ok(await tem(M, '#f-area') && await M.locator('[name=area-sec]:checked').count() === 5 && await M.locator('[name=area-doc]').count() === 1 && !(await M.isChecked('[name=area-doc]')), `${rot}: a janela abre com tudo marcado e o documento ainda não liberado`);
  ok(await tem(M, '#f-area', 'não aparecem para o paciente'), `${rot}: avisa que avaliação completa e pentagrama não aparecem`);
  await M.check('[name=area-doc]'); await M.fill('#area-resumo', 'Você chegou com dor de cabeça forte. O objetivo é diminuir as crises e melhorar o sono.');
  await clicar(M, '#f-area button.pri'); await M.waitForTimeout(400);
  const A = areaDe(), C = A?.conteudo || {};
  ok(A && A.ativo && A.paciente_id === 'p1' && A.nascimento === '1980-04-12', `${rot}: criar o link publica no servidor com a data de nascimento`);
  ok(C.paciente === 'Helena Prado' && C.clinica === 'Spazio Stabilità' && C.profissional === 'Maicon' && C.consultas?.length >= 1 && C.documentos?.length === 1 && C.resumo?.texto.startsWith('Você chegou') && C.dor?.length === 1, `${rot}: conteúdo com consultas, documento liberado, resumo, evolução e o profissional`);
  const txt = JSON.stringify(C);
  ok(!/"signs"|"status"|"anam"|"sintese"|"avaliacao"/.test(txt), `${rot}: avaliação completa, pentagrama e anotações não vão para o servidor`);
  const link = await M.inputValue('#area-link');
  ok(link.endsWith(`/paciente/?c=${A.id}`) && await tem(M, '.perfil-a', 'ligada'), `${rot}: a janela mostra o link do paciente e o prontuário marca "ligada"`);
  await clicar(M, '#f-area [data-act=area-copiar]');
  ok((await M.evaluate(() => navigator.clipboard.readText())) === link, `${rot}: copiar o link`);
  await clicar(M, '#f-area [data-act=wa][data-t=area]');
  ok((await M.inputValue('#wa-t')).includes(link) && await tem(M, '.wa-p .chip.on', 'Área do paciente') && !(await tem(M, '#f-area')), `${rot}: WhatsApp com a mensagem e o link da área`);
  await clicar(M, '.wa-p [data-act=fechar] >> nth=0');
  // Atualiza sozinho quando algo do conteúdo muda (aqui: novo documento liberado pela janela, depois um horário desmarcado)
  const pub = A.publicacoes;
  await ir(M, 'agenda'); await M.waitForTimeout(200);
  const hor = await M.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')).appts.find(a => a.pid === 'p1' && a.st !== 'desmarcado' && !a.done)?.id);
  if (hor) { await clicar(M, `#ag-l .hor[data-hor="${hor}"] [data-act=ag-desm]`); }
  await M.waitForTimeout(3200);
  ok(!hor || (A.publicacoes > pub && A.conteudo.consultas.length < C.consultas.length), `${rot}: mudar a agenda publica de novo sozinho`);
  const pub2 = A.publicacoes; await ir(M, 'pacientes'); await M.waitForTimeout(3000);
  ok(A.publicacoes === pub2, `${rot}: sem mudança no conteúdo, não publica de novo`);

  // Página do paciente
  { const P = await aparelho('P', 'paciente/?c=' + A.id, { viewport:{ width:390, height:800 }, nuvem:false }); await P.waitForTimeout(300);
    await P.evaluate(() => { window.__impresso = 0; window.print = () => { window.__impresso++; }; });
    ok(await tem(P, '#f-nasc', 'data de nascimento') && !(await tem(P, '.cartao', 'Helena')) && await P.isVisible('.topo .logo-claro'), `${rot} paciente: pede a data de nascimento antes de mostrar qualquer dado, com o logo`);
    await P.click('#nasc'); await P.keyboard.type('01011990'); await clicar(P, '#abrir'); await P.waitForTimeout(200);
    ok(await P.inputValue('#nasc').catch(() => '') !== null && await tem(P, '#msg', 'não confere') && await tem(P, '#msg', 'Restam 4'), `${rot} paciente: data errada avisa e diz quantas tentativas restam`);
    await P.fill('#nasc', ''); await P.click('#nasc'); await P.keyboard.type('12041980');
    ok(await P.inputValue('#nasc') === '12/04/1980', `${rot} paciente: a data vai ficando dd/mm/aaaa enquanto digita`);
    await clicar(P, '#abrir'); await P.waitForTimeout(300);
    ok(await tem(P, 'h1', 'Olá, Helena!') && await tem(P, '.prof', 'Profissional responsável') && await tem(P, '.prof b', 'Maicon') && await tem(P, '.prof', 'Spazio Stabilità'), `${rot} paciente: abre com o nome, a clínica e o profissional em destaque`);
    ok(await tem(P, 'h2', 'Resumo da avaliação') && await tem(P, '.cartao', 'diminuir as crises') && await tem(P, 'h2', 'Evolução das queixas') && await tem(P, '.dor svg') && await tem(P, 'h2', 'Documentos') && await tem(P, 'details.item', 'Declaração'), `${rot} paciente: resumo, evolução com gráfico e documento liberado`);
    ok(await tem(P, 'h2', 'Próximas consultas') && await tem(P, 'h2', 'Orientações para casa'), `${rot} paciente: consultas e orientações (com aviso quando vazias)`);
    ok(await semRolagem(P), `${rot} paciente: celular sem rolagem horizontal`);
    await P.evaluate(() => { window.print = () => { window.__impresso = (window.__impresso || 0) + 1; }; });
    await clicar(P, '#baixar');
    ok(await P.evaluate(() => window.__impresso) === 1, `${rot} paciente: "Baixar em PDF" abre a impressão (salvar como PDF)`);
    await P.emulateMedia({ media:'print' });
    ok(!(await P.isVisible('.acoes')) && await P.isVisible('.topo .logo-claro'), `${rot} paciente: no PDF saem os botões e fica o logo`);
    await P.emulateMedia({ media:'screen' });
    await P.reload(); await P.waitForTimeout(300);
    ok(await tem(P, 'h1', 'Olá, Helena!'), `${rot} paciente: recarregar a página não pede a data de novo (mesma sessão)`);
    await clicar(P, '#sair');
    ok(await tem(P, '#f-nasc'), `${rot} paciente: Sair volta a pedir a data`);
    // Acessos na janela do sistema
    await ir(M, 'prontuario'); await clicar(M, '.perfil-a [data-act="area-abrir"]'); await M.waitForTimeout(300);
    ok(await tem(M, '#area-ac', 'Aberta 2 vezes'), `${rot}: a janela mostra quantas vezes o paciente abriu`);
    await M.setViewportSize({ width:390, height:800 }); await M.waitForTimeout(200);
    ok(await semRolagem(M), `${rot} celular: janela da área sem rolagem horizontal`);
    await M.setViewportSize({ width:1280, height:900 });
    // Desligar
    await clicar(M, '#f-area [data-act=area-desligar]'); await M.waitForTimeout(300);
    ok(!A.ativo && JSON.stringify(A.conteudo) === '{}' && !(await tem(M, '.perfil-a', 'ligada')), `${rot}: desligar tira do ar e apaga o conteúdo publicado`);
    await P.reload(); await P.waitForTimeout(300);
    ok(await tem(P, '.cartao', 'Link desligado'), `${rot} paciente: link desligado avisa`);
    await P.goto(BASE + 'paciente/?c=abc'); await P.waitForTimeout(200);
    ok(await tem(P, '.cartao', 'Link incompleto'), `${rot} paciente: link sem código avisa`);
    await P.context().close(); }
  // Ligar de novo gera link novo
  ok(await tem(M, '#f-area button.pri', 'Criar o link'), `${rot}: depois de desligar, a janela oferece criar um link novo`);
  await clicar(M, '#f-area button.pri'); await M.waitForTimeout(400);
  ok(A.ativo && !(await M.inputValue('#area-link')).endsWith('bbbbbbbb-0000-4000-8000-000000000001'), `${rot}: criar de novo gera um link novo`);
  await M.context().close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA área do paciente (tela) passou.');
process.exit(falhas ? 1 : 0);
