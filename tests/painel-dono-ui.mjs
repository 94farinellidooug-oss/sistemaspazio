// Verifica no navegador os pacotes e o Painel do MUSUBI (etapa 10), com o Supabase falso:
// escolher o pacote ao criar a clínica (7 dias grátis), aviso do teste no topo, teste terminado pedindo
// para continuar (sem perder dados), painel só para o dono, dar e tirar acesso grátis, trocar pacote,
// mais dias de teste, interessados e pagamento pela InfinitePay (link, volta, acesso liberado, painel).
// Uso: node tests/painel-dono-ui.mjs
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
  await ctx.route('https://checkout.infinitepay.io/**', r => r.fulfill({ status:200, contentType:'text/html', body:'<h1>InfinitePay</h1>' }));
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
  await p.addInitScript(() => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', 'nuvem'); sessionStorage.setItem('iniciado', '1'); } });
  await p.goto(BASE + url); await p.waitForTimeout(150); return p;
}
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(150); };
const entrar = async (p, email, senha) => { await p.fill('#acesso [name=email]', email); await p.fill('#acesso [name=senha]', senha); await clicar(p, '#acesso [type=submit]'); await p.waitForTimeout(150); };
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(200); };

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' }, 'ana@y.com':{ id:'u2', senha:'outrasenha', nome:'Ana' } };
  S.clinicas.length = 0; S.dados = {}; S.interessados.length = 0; S.donos = ['u1']; S.pagamentos = []; S.cobranca = false; S.mp = null; S.excluidas = []; S.encerrados = []; S.rel = {};
  // Ana cria a clínica escolhendo o Essencial
  const A = await aparelho('A', url);
  await entrar(A, 'ana@y.com', 'outrasenha');
  ok(await A.locator('#acesso [name=plano]').count() === 3 && await A.isChecked('#acesso [name=plano][value=profissional]') && await tem(A, '#acesso [type=submit]', '7 dias grátis'), `${rot}: primeiro acesso mostra os três pacotes, Profissional marcado`);
  await A.fill('#acesso [name=clinica]', 'Clínica Sol'); await A.fill('#acesso [name=cidade]', 'Pelotas');
  await A.check('#acesso [name=plano][value=essencial]'); await A.waitForTimeout(100);
  ok(await A.inputValue('#acesso [name=clinica]') === 'Clínica Sol', `${rot}: trocar o pacote não apaga o que foi digitado`);
  await clicar(A, '#acesso [type=submit]'); await A.waitForTimeout(250);
  const cA = S.clinicas.find(c => c.nome === 'Clínica Sol');
  ok(cA?.assin.plano === 'essencial' && await A.locator('#acesso').isHidden(), `${rot}: clínica criada no Essencial`);
  ok(await tem(A, '.selo-teste', 'Teste: faltam 7 dias'), `${rot}: topo mostra quantos dias de teste faltam`);
  // Essencial: sem MTC e sem relatórios (cadeado no menu e aviso no lugar da tela)
  ok(await A.locator('a[href="#relatorios"] .nav-bloq').count() > 0 && await A.locator('a[href="#biblioteca"] .nav-bloq').count() > 0 && !(await A.locator('a[href="#agenda"] .nav-bloq').count()), `${rot}: Essencial mostra cadeado em Relatórios e Biblioteca clínica`);
  await ir(A, 'relatorios');
  ok(await tem(A, '#bloq-relatorios', 'Profissional') && await tem(A, '#bloq-relatorios a[href="#configuracoes"]', 'Ver pacotes'), `${rot}: Relatórios fora do Essencial avisa e leva aos pacotes`);
  await ir(A, 'avaliacao');
  ok(await tem(A, '#bloq-mtc'), `${rot}: Avaliação energética fora do Essencial`);
  await ir(A, 'pacientes'); await clicar(A, '[data-act=open]'); await A.waitForTimeout(200);
  ok(!(await tem(A, '[data-act=ir][data-to=avaliacao]')), `${rot}: prontuário do Essencial sem botão de avaliação energética`);
  await clicar(A, '[data-act=novo-atendimento]'); await A.waitForTimeout(200);
  ok(await A.locator('.steps a.bloq').count() === 4 && !(await tem(A, '#bloq-mtc')), `${rot}: atendimento do Essencial com 4 etapas de MTC no cadeado`);
  await clicar(A, '.steps a[data-i="1"]');
  ok(await tem(A, '.et-c #bloq-mtc'), `${rot}: etapa de MTC mostra o aviso do pacote`);
  await clicar(A, '.steps a[data-i="5"]');
  ok(!(await tem(A, '.dicas')), `${rot}: plano do Essencial sem dicas de vasos e estações`);
  await clicar(A, '.at-f [data-act=at-descartar]').catch(() => {});
  await ir(A, 'configuracoes'); await clicar(A, '[data-cf=aba][data-k=conta]');
  ok(await tem(A, '#cf-pacote .cf-plano.on', 'Essencial'), `${rot}: Minha conta mostra o pacote`);
  ok(!(await tem(A, '[href="#musubi"]')), `${rot}: quem não é dono não vê o Painel do MUSUBI`);
  // Teste terminado: pede para continuar, sem perder dados
  cA.assin.teste_ate = new Date(Date.now() - 864e5).toISOString();
  await A.reload(); await A.waitForTimeout(300);
  ok(await tem(A, '#acesso h1', 'O teste grátis terminou') && await A.isChecked('#acesso [name=plano][value=essencial]') && await A.isChecked('#acesso [name=periodo][value=mensal]') && await tem(A, '#acesso [name=periodo][value=anual] ~ span', 'R$ 790/ano'), `${rot}: teste terminado pede para pagar, com o pacote escolhido, mensal ou anual`);
  // Pagamento online ainda não ligado: cai no contato pelo WhatsApp
  await clicar(A, '#acesso [type=submit]'); await A.waitForTimeout(200);
  ok(await tem(A, '#acesso .erro-a', 'Contrato de assinatura') && await tem(A, '#acesso .aceite-c a[href="inicio/contrato.html"]') && await tem(A, '#acesso h1', 'O teste grátis terminou'), `${rot}: sem marcar o aceite do contrato não segue (com o link do contrato)`);
  await A.check('#acesso [name=aceite]'); await A.waitForTimeout(100);
  await clicar(A, '#acesso [type=submit]'); await A.waitForTimeout(200);
  ok(await tem(A, '#acesso h1', 'Falar com a equipe') && await tem(A, '#acesso', 'ainda não está disponível'), `${rot}: sem pagamento online, oferece o contato da equipe`);
  await A.fill('#acesso [name=whats]', '(53) 99876-5432'); await clicar(A, '#acesso [type=submit]'); await A.waitForTimeout(150);
  ok(S.interessados.some(i => i.whats === '(53) 99876-5432' && i.nome.includes('Clínica Sol') && i.nome.includes('Essencial')) && await tem(A, '#acesso h1', 'Pedido enviado') && S.dados[cA.id], `${rot}: pedido de continuar vai para os interessados; dados guardados`);
  // Pagamento ligado: anual pelo link da InfinitePay
  S.cobranca = true; await A.reload(); await A.waitForTimeout(300);
  await A.check('#acesso [name=periodo][value=anual12]'); await A.waitForTimeout(100);
  ok(await tem(A, '#acesso [name=periodo][value=anual12] ~ span', 'R$ 67/mês por 12 meses') && !(await tem(A, '#acesso [type=submit]')) && await tem(A, '#acesso [data-ac=assinar-cartao].pri'), `${rot}: anual com pagamento mensal (R$ 67) só no cartão: o Pix some`);
  await A.check('#acesso [name=periodo][value=anual]'); await A.check('#acesso [name=aceite]'); await A.waitForTimeout(100);
  await Promise.all([A.waitForURL(/checkout\.infinitepay\.io/), clicar(A, '#acesso [type=submit]')]);
  const g = S.pagamentos[0];
  ok(g?.plano === 'essencial' && g.periodo === 'anual' && g.valor === 79000 && g.clinica_id === cA.id && S.aceites.at(-1).aceite === '2026-11-11', `${rot}: abre o link da InfinitePay com o pacote e o período`);
  await A.goto(BASE + url + `?receipt_url=https%3A%2F%2Frecibo%2F1&order_nsu=${g.order_nsu}&slug=abc&capture_method=pix&transaction_nsu=tx1`); await A.waitForTimeout(500);
  ok(await A.locator('#acesso').isHidden() && await tem(A, '#toast', 'Pagamento confirmado') && !A.url().includes('order_nsu'), `${rot}: na volta, o pagamento é conferido e o sistema abre`);
  ok(cA.assin.pago_ate && new Date(cA.assin.pago_ate) > Date.now() + 360 * 864e5 && !(await tem(A, '.selo-teste')), `${rot}: anual libera o acesso por 1 ano`);
  await ir(A, 'configuracoes'); await clicar(A, '[data-cf=aba][data-k=conta]'); await A.waitForTimeout(200);
  ok(await tem(A, '#cf-pagar h3', 'Renovar') && await tem(A, '#cf-pagar .cf-pags', 'Pago') && await tem(A, '#cf-pagar .cf-pags a', 'Recibo'), `${rot}: Minha conta mostra o pagamento, o recibo e a opção de renovar`);
  await A.selectOption('#cf-pagar [data-cf=pag-plano]', 'profissional'); await A.waitForTimeout(100);
  ok(await tem(A, '#cf-pagar [data-cf=pag-periodo] option', 'R$ 149/mês'), `${rot}: trocar o pacote mostra o preço dele`);
  await clicar(A, '[data-cf=pagar]');
  ok(await tem(A, '#cf-pag-erro:not([hidden])', 'Contrato de assinatura') && !A.url().includes('infinitepay'), `${rot}: renovar sem marcar o aceite não segue`);
  await A.check('#cf-pagar [data-cf=aceite]');
  await Promise.all([A.waitForURL(/checkout\.infinitepay\.io/), clicar(A, '[data-cf=pagar]')]);
  ok(S.pagamentos[0].plano === 'profissional' && S.pagamentos[0].periodo === 'mensal', `${rot}: renovar pela Minha conta abre o link`);
  cA.assin.pago_ate = null;
  await A.context().close();

  // Maicon: dono
  const M = await aparelho('M', url);
  await entrar(M, 'maicon@x.com', 'segredo123');
  await M.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await M.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(250);
  ok(!(await M.locator('.nav-bloq').count()), `${rot}: Profissional sem cadeado no menu`);
  await clicar(M, '[data-act=perfil]');
  ok(await tem(M, '.pf-i', 'Painel do MUSUBI'), `${rot}: o dono vê o Painel do MUSUBI no menu`);
  await clicar(M, '.pf-i >> text=Painel do MUSUBI'); await M.waitForTimeout(300);
  ok(await tem(M, '#pd-hoje'), `${rot}: o painel abre em Hoje`);
  await clicar(M, '[data-pd=aba][data-k=clinicas]');
  ok(await M.locator('#pd-cl .pd-c').count() === 2 && await tem(M, '#pd-cl .pd-c', 'Clínica Sol') && await tem(M, '#pd-cl .pd-c', 'Teste terminou') && await tem(M, '#pd-cl', 'ana@y.com'), `${rot}: painel lista as clínicas com a situação e o e-mail`);
  const linha = `#pd-cl .pd-c[data-c="${cA.id}"]`;
  await clicar(M, `${linha} [data-pd=gratis]`);
  await M.selectOption('#pd-g [name=prazo]', 'sempre'); await M.fill('#pd-g [name=motivo]', 'Testadora'); await clicar(M, '#pd-g [type=submit]'); await M.waitForTimeout(300);
  ok(cA.assin.gratis_sempre && cA.assin.gratis_motivo === 'Testadora' && await tem(M, linha, 'Grátis sem prazo'), `${rot}: dar acesso grátis sem prazo`);
  await clicar(M, `${linha} [data-pd=tirar]`); await M.waitForTimeout(300);
  ok(!cA.assin.gratis_sempre && await tem(M, linha, 'Teste terminou'), `${rot}: tirar o acesso grátis`);
  await clicar(M, `${linha} [data-pd=mais7]`); await M.waitForTimeout(300);
  ok(await tem(M, linha, 'Teste: faltam 7 dias'), `${rot}: mais 7 dias de teste`);
  await M.selectOption(`${linha} [data-pd=plano]`, 'clinica'); await M.waitForTimeout(300);
  ok(cA.assin.plano === 'clinica', `${rot}: trocar o pacote`);
  // Hoje: tarefas e dicas
  await clicar(M, '[data-pd=aba][data-k=hoje]');
  const tarefa = `#pd-hoje .pd-t[data-ref^="i:"]`;
  ok(await tem(M, tarefa, 'Chamar') && (await M.getAttribute(`${tarefa} a.wa`, 'href')).startsWith('https://wa.me/5553998765432?text=') && await M.locator('#pd-dicas li').count() >= 5, `${rot}: Hoje mostra a tarefa de chamar o interessado (WhatsApp com mensagem pronta) e as dicas`);
  // Gestão
  await clicar(M, '[data-pd=aba][data-k=gestao]');
  ok(await tem(M, '#pd-gest', 'Receita por mês') && await tem(M, '#pd-gest', 'Conversão do teste') && await tem(M, '#pd-gest', 'Recebido por mês') && await tem(M, '#pd-gest', 'Pagantes por pacote'), `${rot}: Gestão mostra receita, conversão e recebido por mês`);
  // Relacionamento: interessados, clínicas e anotações
  await clicar(M, '[data-pd=aba][data-k=relacionamento]');
  ok(await tem(M, '#pd-rel', '(53) 99876-5432') && await tem(M, '#pd-rel a.wa') && await tem(M, '#pd-rel .pd-r', 'Clínica Sol'), `${rot}: relacionamento junta interessados e clínicas, com o WhatsApp`);
  await M.selectOption('#pd-rel [data-pd=situ]', 'chamei'); await M.waitForTimeout(300);
  ok(S.interessados[0].situacao === 'chamei', `${rot}: muda a situação do interessado`);
  await clicar(M, '[data-pd=filtro][data-k=interessado]');
  ok(await M.locator('#pd-rel .pd-r').count() === 1, `${rot}: filtro mostra só os interessados`);
  await clicar(M, '#pd-rel [data-pd=anotar]');
  await M.fill('#pd-anot [name=texto]', 'Pediu para ligar sexta'); await M.fill('#pd-anot [name=retornar]', '2026-11-13'); await clicar(M, '#pd-anot [type=submit]'); await M.waitForTimeout(300);
  const r1 = Object.values(S.rel)[0];
  ok(r1?.ref.startsWith('i:') && r1.notas[0].texto === 'Pediu para ligar sexta' && r1.retornar_em === '2026-11-13' && await tem(M, '#pd-rel .pd-r', 'Pediu para ligar sexta') && await tem(M, '#pd-rel .pd-r', 'Retornar 13/11/2026'), `${rot}: anotar guarda a conversa e o dia de retornar`);
  await clicar(M, '[data-pd=filtro][data-k=todos]');
  await clicar(M, '[data-pd=aba][data-k=pagamentos]');
  ok(await M.locator('#pd-pag .pd-g-l').count() === 2 && await tem(M, '#pd-pag .pd-g-l', 'Clínica Sol') && await tem(M, '#pd-pag', 'R$ 790,00') && await tem(M, '#pd-pag .pd-g-l', 'Não concluído'), `${rot}: painel lista os pagamentos de todas as clínicas`);
  ok(await tem(M, '#pd-pag [data-pd=teste]', 'Testar pagamento (R$ 1,00)'), `${rot}: dono vê o botão de pagamento de teste`);
  const antes = S.pagamentos.length;
  await Promise.all([M.waitForURL(/checkout\.infinitepay\.io/, { timeout:5000 }).catch(() => {}), clicar(M, '#pd-pag [data-pd=teste]')]);
  ok(S.pagamentos.length === antes + 1 && S.pagamentos[0].valor === 100 && S.pagamentos[0].periodo === 'mensal' && /checkout\.infinitepay\.io/.test(M.url()), `${rot}: teste abre o pagamento de R$ 1,00 na InfinitePay`);
  // Excluir clínica que desistiu: cancela o cartão antes, pede o nome, fica só o resumo
  await M.goto(BASE + url); await M.waitForTimeout(500); await ir(M, 'musubi'); await M.waitForTimeout(300); await clicar(M, '[data-pd=aba][data-k=clinicas]');
  const propria = S.clinicas.find(c => c.nome === 'Spazio Stabilità');
  ok(await tem(M, `${linha} [data-pd=excluir]`) && !(await tem(M, `#pd-cl .pd-c[data-c="${propria.id}"] [data-pd=excluir]`)), `${rot}: cada clínica tem Excluir, menos a própria`);
  cA.assin.cartao_situacao = 'ativa'; S.mp = null; await clicar(M, '[data-pd=atualizar]'); await M.waitForTimeout(300);
  await clicar(M, `${linha} [data-pd=excluir]`);
  ok(await tem(M, '#pd-x', 'não dá para desfazer') && await tem(M, '#pd-x', 'assinatura no cartão (Mercado Pago) será cancelada') && await tem(M, '#pd-x', '30 dias'), `${rot}: excluir avisa o que apaga, os 30 dias para exportar e que o cartão será cancelado`);
  await M.fill('#pd-x [name=nome]', 'Clínica Errada'); await clicar(M, '#pd-x [type=submit]');
  ok(await tem(M, '#pd-x-erro:not([hidden])', 'não confere') && S.clinicas.includes(cA), `${rot}: nome errado não exclui`);
  await M.fill('#pd-x [name=motivo]', 'Desistiu'); await M.fill('#pd-x [name=nome]', 'clínica sol'); await clicar(M, '#pd-x [type=submit]'); await M.waitForTimeout(300);
  ok(await tem(M, '#pd-x-erro:not([hidden])', 'falta atualizar a função cobranca') && S.clinicas.includes(cA) && await M.inputValue('#pd-x [name=motivo]') === 'Desistiu', `${rot}: com cartão ativo e a função antiga, explica e não exclui`);
  S.mp = {}; await clicar(M, '#pd-x [type=submit]'); await M.waitForTimeout(500);
  ok(!S.clinicas.includes(cA) && S.encerrados.includes(cA.id) && !(await tem(M, linha)) && await tem(M, '#toast', 'As cobranças pararam'), `${rot}: excluída: o cartão foi cancelado antes e ela sai da lista`);
  await M.click('#pd-ex summary'); await M.waitForTimeout(100);
  ok(await tem(M, '#pd-ex', 'Clínicas excluídas (1)') && await tem(M, '#pd-ex', 'Clínica Sol') && await tem(M, '#pd-ex', 'Motivo: Desistiu'), `${rot}: excluídas ficam listadas com o motivo`);
  await M.context().close();
}
// Celular: painel sem rolagem lateral
S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' } }; S.donos = ['u1'];
const C = await aparelho('C', 'index.html', { width:360, height:740 });
await entrar(C, 'maicon@x.com', 'segredo123'); await C.waitForTimeout(200);
let larga = [];
for (const a of ['hoje', 'gestao', 'clinicas', 'relacionamento', 'pagamentos']) { await ir(C, 'musubi'); await C.waitForTimeout(200); await clicar(C, `[data-pd=aba][data-k=${a}]`); if (await C.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) larga.push(a); }
ok(!larga.length, 'celular: painel sem rolagem lateral' + (larga.length ? ': ' + larga.join(', ') : ''));
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nPacotes e Painel do MUSUBI passaram.');
process.exit(falhas ? 1 : 0);
