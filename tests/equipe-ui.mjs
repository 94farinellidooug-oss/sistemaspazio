// Verifica no navegador a Equipe (etapa 10), com o Supabase falso: convite pelo link (WhatsApp ou copiar), limite do
// pacote, permissões por perfil, a pessoa convidada criando a conta e entrando como Recepção (menu e telas que o
// perfil não abre), tirar o acesso e a tela no celular.
// Uso: node tests/equipe-ui.mjs
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
async function aparelho(nome, url, viewport = { width:1280, height:900 }){
  const ctx = await browser.newContext({ viewport });
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    await route.fulfill({ status:r.status, contentType:'application/json', body:await r.text() });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
  await p.addInitScript(() => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', 'nuvem'); sessionStorage.setItem('iniciado', '1'); } });
  await p.goto(BASE + url); await p.waitForTimeout(150); return p;
}
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(150); };
const entrar = async (p, email, senha) => { await p.fill('#acesso [name=email]', email); await p.fill('#acesso [name=senha]', senha); await clicar(p, '#acesso [type=submit]'); await p.waitForTimeout(150); };
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } };
  S.clinicas.length = 0; S.dados = {}; S.convites = []; S.semEquipe = false;
  const M = await aparelho('M', url);
  await entrar(M, 'maicon@x.com', 'segredo123');
  await M.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await M.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(300);
  const C = S.clinicas[0];
  await ir(M, 'administracao');
  ok(await tem(M, 'a.adm-c[href="#equipe"]', 'disponível'), `${rot}: Administração mostra a Equipe disponível`);
  await ir(M, 'equipe'); await M.waitForTimeout(300);
  ok(await tem(M, '#eq-l .eq-u', 'você') && await tem(M, '#eq-l', 'Pacote Profissional: 1 profissional'), `${rot}: a equipe mostra o administrador e o limite do pacote`);
  await clicar(M, '[data-eq=convidar]');
  const opP = await M.evaluate(() => { const s = document.querySelector('#eq-conv [name=perfil]'); return [s.querySelector('option[value=prof]').disabled, s.value]; });
  ok(opP[0] && opP[1] === 'rec', `${rot}: no Profissional não cabe outro profissional (só recepção)`);
  await clicar(M, '#eq-conv [type=submit]');
  ok(await tem(M, '#eq-erro', 'Escreva o nome'), `${rot}: convite sem nome avisa`);
  await M.fill('#eq-conv [name=nome]', 'Júlia Martins'); await M.fill('#eq-conv [name=email]', 'Julia@Z.com'); await clicar(M, '#eq-conv [type=submit]'); await M.waitForTimeout(300);
  const link = await M.inputValue('#eq-aviso input');
  ok(S.convites.length === 1 && S.convites[0].perfil === 'rec' && link.includes('?convite=julia%40z.com'), `${rot}: convite criado com o link para a pessoa`);
  ok(decodeURIComponent(await M.getAttribute('#eq-aviso a.wa', 'href')).includes('Crie a sua conta com o e-mail julia@z.com'), `${rot}: botão do WhatsApp leva o convite pronto`);
  ok(await tem(M, '#eq-l .eq-u.conv', 'convite enviado'), `${rot}: convite aparece como enviado`);
  // Permissão: Recepção também abre Documentos
  await M.click('#eq-p input[data-f=rec][data-k=documentos]', { force:true }); await M.waitForTimeout(300);
  ok(C.permissoes?.rec?.documentos === true && await tem(M, '[data-eq=padrao]'), `${rot}: administrador muda o que a recepção abre`);

  // Júlia abre o link do convite e cria a conta
  const J = await aparelho('J', url + '?convite=julia%40z.com');
  ok(await tem(M, '#eq-l') && await J.inputValue('#acesso [name=email]') === 'julia@z.com' && await tem(J, '#acesso h1', 'Criar sua conta'), `${rot}: link do convite abre "Criar sua conta" com o e-mail preenchido`);
  await J.fill('#acesso [name=nome]', 'Júlia Martins'); await J.fill('#acesso [name=senha]', 'segredo456'); await clicar(J, '#acesso [type=submit]'); await J.waitForTimeout(500);
  ok(await J.locator('#acesso').isHidden() && C.membros.some(m => m.email === 'julia@z.com' && m.perfil === 'rec'), `${rot}: ao entrar, Júlia já faz parte da clínica como Recepção`);
  ok(!(await tem(J, '.nav a[href="#relatorios"]')) && await tem(J, '.nav a[href="#agenda"]') && await tem(J, '.nav a[href="#financeiro"]') && await tem(J, '.nav a[href="#documentos"]'), `${rot}: menu da recepção sem Relatórios, com Agenda, Financeiro e Documentos`);
  await ir(J, 'relatorios');
  ok(await tem(J, '#sem-permissao', 'Recepção'), `${rot}: tela que o perfil não abre avisa`);
  await ir(J, 'financeiro');
  ok(await tem(J, '#f-arec') && !(await tem(J, '#f-desp')) && !(await tem(J, '.tile[data-t=saldo]')), `${rot}: recepção recebe pagamentos, sem despesas nem saldo`);
  await ir(J, 'pacientes'); await clicar(J, '[data-act=open]'); await J.waitForTimeout(200);
  ok(J.url().endsWith('#cadastro'), `${rot}: recepção abre o cadastro do paciente, não o prontuário`);
  await ir(J, 'equipe');
  ok(await tem(J, '#sem-permissao'), `${rot}: recepção não abre a Equipe`);

  // Maicon tira o acesso da Júlia
  await ir(M, 'painel'); await ir(M, 'equipe'); await M.waitForTimeout(300);
  const jid = C.membros.find(m => m.email === 'julia@z.com').user;
  await clicar(M, `[data-eq=tirar][data-u="${jid}"]`); await M.waitForTimeout(300);
  ok(C.membros.find(m => m.user === jid).ativo === false && await tem(M, `.eq-u[data-u="${jid}"]`, 'sem acesso'), `${rot}: tirar o acesso deixa a pessoa na lista, sem acesso`);
  await M.context().close(); await J.context().close();
}
// Servidor sem 004_equipe.sql: avisa o administrador
S.semEquipe = true; S.convites = [];
{ const M = await aparelho('M2', 'index.html'); await entrar(M, 'maicon@x.com', 'segredo123'); await M.waitForTimeout(300); await ir(M, 'equipe'); await M.waitForTimeout(300);
  ok(await tem(M, '.notice', '004_equipe.sql') && !(await tem(M, '[data-eq=convidar]')), 'servidor sem a equipe: avisa para rodar o 004 e não oferece convite');
  await M.context().close(); }
S.semEquipe = false;
// Celular: sem rolagem lateral
{ const P = await aparelho('C', 'index.html', { width:360, height:740 }); await entrar(P, 'maicon@x.com', 'segredo123'); await P.waitForTimeout(300); await ir(P, 'equipe'); await P.waitForTimeout(300);
  ok(!(await P.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'celular: Equipe sem rolagem lateral');
  await P.context().close(); }
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA Equipe passou.');
process.exit(falhas ? 1 : 0);
