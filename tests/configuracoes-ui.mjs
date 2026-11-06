// Verifica no navegador as Configurações (etapa 10): dados da clínica, serviços, horário e a conta,
// sem conta (só no aparelho) e com a conta no servidor (Supabase falso), mais celular sem rolagem lateral.
// Uso: node tests/configuracoes-ui.mjs   (requer Playwright e Chromium)
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
async function aparelho(nome, url, modo, viewport = { width:1280, height:900 }){
  const ctx = await browser.newContext({ viewport });
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    await route.fulfill({ status:r.status, contentType:'application/json', body:await r.text() });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
  if (modo) await p.addInitScript(m => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', m); sessionStorage.setItem('iniciado', '1'); } }, modo);
  await p.goto(BASE + url); await p.waitForTimeout(150); return p;
}
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(150); };
const dbDe = p => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')));
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(150); };

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  // Sem conta
  const L = await aparelho('L', url, 'local');
  await clicar(L, '[data-act=perfil]');
  ok(await tem(L, '.pf-i', 'Minha conta') && await tem(L, '.pf-i', 'Configurações da clínica'), `${rot}: menu do usuário leva à conta e às configurações`);
  await clicar(L, '.pf-i >> text=Configurações da clínica');
  ok(await L.locator('#view [role=tab]').count() === 4 && await L.inputValue('#cf-clinica [name=nome]') === 'Spazio Stabilità', `${rot}: Configurações abre com as quatro abas e os dados da clínica`);
  await L.fill('#cf-clinica [name=nome]', ''); await clicar(L, '#cf-clinica [type=submit]');
  ok(await tem(L, '#cf-cl-erro', 'Escreva o nome da clínica'), `${rot}: clínica sem nome avisa`);
  await L.fill('#cf-clinica [name=nome]', 'Clínica Sol'); await L.fill('#cf-clinica [name=cidade]', 'Porto Alegre'); await clicar(L, '#cf-clinica [type=submit]');
  ok((await dbDe(L)).config?.clinica.nome === 'Clínica Sol' && await tem(L, '#view .head p', 'Clínica Sol'), `${rot}: dados da clínica salvos`);
  await clicar(L, '[data-cf=aba][data-k=servicos]');
  const iM = await L.locator('#cf-serv [data-k=nome]').evaluateAll(E => E.findIndex(e => e.value === 'Massoterapia'));
  await L.uncheck(`#cf-serv [data-k=ativo][data-i="${iM}"]`); await L.waitForTimeout(150);
  await L.fill('#cf-serv [data-k=valor][data-i="0"]', '190,00'); await L.press('#cf-serv [data-k=valor][data-i="0"]', 'Tab'); await L.waitForTimeout(150);
  const d1 = await dbDe(L);
  ok(d1.config.servicos[iM].ativo === false && d1.config.servicos[0].valor === 190, `${rot}: serviço fora de uso e preço novo salvos`);
  await clicar(L, '[data-cf=serv-novo]');
  ok((await dbDe(L)).config.servicos.at(-1).nome === 'Novo serviço' && await L.evaluate(() => document.activeElement?.dataset.k === 'nome'), `${rot}: novo serviço já com o nome para escrever`);
  await ir(L, 'agenda'); await clicar(L, '[data-act=ag-novo] >> nth=0').catch(() => {});
  const opc = await L.locator('#na-tipo option').allTextContents().catch(() => []);
  ok(!opc.length || !opc.some(o => o.startsWith('Massoterapia')), `${rot}: serviço fora de uso some da Agenda`);
  await ir(L, 'configuracoes'); await clicar(L, '[data-cf=aba][data-k=horario]');
  await L.uncheck('#cf-hor [data-cf=dia][data-i="6"]'); await L.waitForTimeout(150);
  await L.check('#cf-hor [data-cf=pausa]'); await L.waitForTimeout(150);
  const d2 = await dbDe(L);
  ok(d2.config.horario.dias[6].aberto === false && d2.config.horario.pausa.tem && await tem(L, '#cf-hor-resumo', '6 dias abertos'), `${rot}: domingo fechado e intervalo salvos, com o resumo`);
  await clicar(L, '[data-cf=aba][data-k=conta]');
  ok(await tem(L, '#cf-conta [data-act=conta-entrar]') && await tem(L, '#cf-seg', 'Dados só neste aparelho'), `${rot}: sem conta, a aba da conta oferece entrar`);
  // Excluir o cadastro de um paciente: aviso da guarda, motivo obrigatório
  const editar = async id => { await L.evaluate(id => { document.body.insertAdjacentHTML('beforeend', `<button id="t-ed" data-act="editar-paciente" data-pid="${id}"></button>`); document.getElementById('t-ed').click(); document.getElementById('t-ed').remove(); }, id); await L.waitForTimeout(150); };
  const p0 = (await dbDe(L)).patients[0];
  await editar(p0.id); await clicar(L, '[data-act=pac-excluir]');
  ok(await tem(L, '#cad-exc .notice', 'guarda obrigatória') && await tem(L, '#cad-exc', 'não tem prontuário') && await tem(L, '[data-act=pac-excluir-sim]', 'Excluir de vez'), `${rot}: aviso da guarda; exemplo sai de vez`);
  await clicar(L, '[data-act=pac-excluir-sim]');
  ok((await dbDe(L)).patients.some(p => p.id === p0.id) && await tem(L, '#toast', 'Escolha o motivo'), `${rot}: sem motivo não exclui`);
  await L.selectOption('#exc-m', 'Paciente de exemplo'); await L.waitForTimeout(100); await clicar(L, '[data-act=pac-excluir-sim]');
  const d3 = await dbDe(L);
  ok(!d3.patients.some(p => p.id === p0.id) && !d3.appts.some(a => a.pid === p0.id) && d3.exclusoes[0].motivo === 'Paciente de exemplo' && await L.evaluate(() => location.hash) === '#pacientes', `${rot}: paciente de exemplo excluído com o motivo registrado`);
  // Paciente de verdade com prontuário: fica desativado
  const p1 = d3.patients.find(p => p.atendimentos.some(a => a.status === 'finalizado'));
  await L.evaluate(id => { const d = JSON.parse(localStorage.getItem('musubi-v2')); d.patients.find(p => p.id === id).exemplo = false; localStorage.setItem('musubi-v2', JSON.stringify(d)); }, p1.id); await L.reload(); await L.waitForTimeout(150);
  await editar(p1.id); await clicar(L, '[data-act=pac-excluir]');
  await L.selectOption('#exc-m', 'Outro motivo'); await L.waitForTimeout(100); await L.fill('#exc-o', 'Mudou de cidade');
  ok(await tem(L, '#cad-exc', 'tem prontuário') && await tem(L, '[data-act=pac-excluir-sim]', 'Desativar cadastro'), `${rot}: com prontuário, o botão é desativar`);
  await clicar(L, '[data-act=pac-excluir-sim]');
  const d4 = await dbDe(L);
  ok(!d4.patients.some(p => p.id === p1.id) && d4.desativados[0].id === p1.id && d4.desativados[0].desativado.motivo === 'Outro: Mudou de cidade' && await tem(L, '#toast', 'fica guardado até'), `${rot}: paciente com prontuário fica desativado e guardado`);
  await ir(L, 'administracao');
  ok(await tem(L, '#desativados', p1.name) && await tem(L, '#desativados', 'Outro: Mudou de cidade'), `${rot}: Administração mostra os desativados`);
  await clicar(L, '#desativados [data-act=pac-reativar]');
  ok((await dbDe(L)).patients.some(p => p.id === p1.id) && await tem(L, '#toast', 'reativado'), `${rot}: reativar volta o paciente`);
  await L.context().close();

  // Com conta no servidor
  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon Farinelli' } }; S.clinicas.length = 0; S.dados = {}; S.emailPedido = null; S.saiuOutros = false;
  const N = await aparelho('N', url, 'nuvem');
  await N.fill('#acesso [name=email]', 'maicon@x.com'); await N.fill('#acesso [name=senha]', 'segredo123'); await clicar(N, '#acesso [type=submit]');
  await N.fill('#acesso [name=clinica]', 'Clínica Lua'); await N.fill('#acesso [name=cidade]', 'Pelotas'); await clicar(N, '#acesso [type=submit]'); await N.waitForTimeout(200);
  const cid = S.clinicas[0]?.id;
  ok(S.dados[cid]?.doc.config?.clinica.nome === 'Clínica Lua', `${rot}: a clínica criada já leva o nome para os documentos`);
  ok(S.dados[cid]?.doc.patients.length > 0 && S.dados[cid].doc.patients.every(p => p.phone === '(00) 00000-0000'), `${rot}: clínica nova começa com exemplos de WhatsApp 0000`);
  ok(!(await tem(N, '[data-act=reset]')), `${rot}: com conta, "Restaurar exemplos" não aparece`);
  await clicar(N, '[data-act=perfil]');
  ok(await tem(N, '.pf-h b', 'Maicon Farinelli') && await tem(N, '.pf-h small', 'Administrador'), `${rot}: menu mostra o nome da conta e o perfil`);
  await clicar(N, '.pf-i >> text=Minha conta');
  ok(await N.inputValue('#cf-conta [name=email]') === 'maicon@x.com', `${rot}: Minha conta abre com o e-mail da conta`);
  await N.fill('#cf-conta [name=nome]', 'Maicon F.'); await clicar(N, '[data-cf=senha]'); await N.fill('#cf-conta [name=senha]', 'novasenha1');
  await N.fill('#cf-conta [name=email]', 'novo@x.com'); await clicar(N, '#cf-conta [type=submit]'); await N.waitForTimeout(200);
  ok(S.usuarios['maicon@x.com'].nome === 'Maicon F.' && S.usuarios['maicon@x.com'].senha === 'novasenha1' && S.emailPedido === 'novo@x.com', `${rot}: nome, senha e e-mail novos vão para o servidor`);
  ok(await tem(N, '.perfil-b', 'Maicon') && await tem(N, '#toast', 'mandamos um link para novo@x.com'), `${rot}: avisa que o e-mail muda pelo link`);
  await clicar(N, '[data-cf=sair-outros]'); await N.waitForTimeout(150);
  ok(S.saiuOutros, `${rot}: sair dos outros aparelhos`);
  await clicar(N, '[data-cf=aba][data-k=clinica]');
  await N.fill('#cf-clinica [name=nome]', 'Clínica Lua Nova'); await clicar(N, '#cf-clinica [type=submit]'); await N.waitForTimeout(1900);
  ok(S.clinicas[0].nome === 'Clínica Lua Nova' && S.dados[cid].doc.config.clinica.nome === 'Clínica Lua Nova', `${rot}: nome da clínica muda no cadastro e nos dados do servidor`);
  await N.context().close();
}

// Celular: sem rolagem lateral em nenhuma aba
const M = await aparelho('M', 'index.html', 'local', { width:360, height:740 });
await ir(M, 'configuracoes');
let larga = [];
for (const k of ['clinica', 'servicos', 'horario', 'conta']) { await clicar(M, `[data-cf=aba][data-k=${k}]`); if (await M.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) larga.push(k); }
ok(!larga.length, 'celular: nenhuma aba com rolagem lateral' + (larga.length ? ': ' + larga.join(', ') : ''));

// Tema claro ou escuro pelo menu do usuário: começa claro, fica salvo no aparelho e o logo vira branco no escuro
const tema = p => p.evaluate(() => document.documentElement.dataset.theme || 'light');
const filtroLogo = p => p.evaluate(() => getComputedStyle(document.querySelector('.logo-m')).filter);
ok(await tema(M) === 'light' && await filtroLogo(M) === 'none', 'tema: começa claro, com o logo colorido');
await ir(M, 'painel'); await clicar(M, '[data-act=perfil]'); await clicar(M, '[data-act=tema]');
ok(await tema(M) === 'dark' && (await filtroLogo(M)).includes('invert'), 'tema: botão do menu troca para o escuro e o logo fica branco');
await M.reload(); await M.waitForTimeout(200);
ok(await tema(M) === 'dark', 'tema: a escolha continua depois de recarregar');
await clicar(M, '[data-act=perfil]');
ok(await tem(M, '[data-act=tema]', 'Tema claro'), 'tema: no escuro o botão oferece o tema claro');
await clicar(M, '[data-act=tema]'); await M.reload(); await M.waitForTimeout(200);
ok(await tema(M) === 'light', 'tema: volta ao claro e fica salvo');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nAs Configurações passaram.');
process.exit(falhas ? 1 : 0);
