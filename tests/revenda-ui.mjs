// Verifica no navegador os revendedores (supabase/015_revendedores.sql) com o Supabase falso: o dono cadastra o
// revendedor no Painel do MUSUBI e recebe o link; quem abre a página pelo link conta uma visita (uma vez por sessão)
// e, ao criar a clínica, ela fica marcada com o revendedor; o painel mostra visitas, contas, teste e comissões;
// marcar comissão como paga; mudar as regras; servidor sem o 015 avisa; celular sem rolagem lateral.
// Uso: node tests/revenda-ui.mjs
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
async function contexto(viewport = { width:1280, height:900 }){
  const ctx = await browser.newContext({ viewport, permissions:['clipboard-read', 'clipboard-write'] });
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    await route.fulfill({ status:r.status, contentType:'application/json', body:await r.text() });
  });
  return ctx;
}
const vigiar = (p, nome) => { p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); }); return p; };
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(200); };
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
async function dono(viewport){
  const p = vigiar(await (await contexto(viewport)).newPage(), 'dono');
  await p.addInitScript(() => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', 'nuvem'); sessionStorage.setItem('iniciado', '1'); } });
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(200);
  await p.fill('#acesso [name=email]', 'maicon@x.com'); await p.fill('#acesso [name=senha]', 'segredo123'); await clicar(p, '#acesso [type=submit]'); await p.waitForTimeout(300);
  if (await p.locator('#acesso [name=clinica]').count()) { await p.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await p.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(p, '#acesso [type=submit]'); await p.waitForTimeout(300); }
  await p.waitForTimeout(300); await ir(p, 'musubi'); await p.locator('[data-pd=aba][data-k=revenda]').waitFor({ timeout:8000 });
  await clicar(p, '[data-pd=aba][data-k=revenda]');
  return p;
}

S.donos = ['u1'];
S.usuarios['maicon@x.com'] = { id:'u1', senha:'segredo123', nome:'Maicon' };

// 1. Dono cadastra o revendedor e recebe o link
const M = await dono();
ok(await tem(M, '#pd-rev', 'Nenhum revendedor ainda'), 'aba Revendedores abre vazia, com explicação');
await clicar(M, '[data-pd=rev-novo]');
await M.fill('#pd-rev-f [name=nome]', 'Ana Souza'); await M.fill('#pd-rev-f [name=whats]', '(54) 99999-0000'); await M.fill('#pd-rev-f [name=pix]', 'ana@pix.com');
await clicar(M, '#pd-rev-f [type=submit]'); await M.waitForTimeout(300);
const R = S.revenda.revendedores[0];
ok(R?.codigo === 'ana-souza' && R.pix === 'ana@pix.com', 'código do link criado a partir do nome');
ok(await tem(M, '#pd-rev .pd-link', 'https://musubisistema.com.br/inicio/?r=ana-souza'), 'o link aparece no painel');
ok(await M.locator('#pd-rev .pd-rv a.wa').getAttribute('href').then(h => h.startsWith('https://wa.me/5554999990000?text=') && decodeURIComponent(h).includes('?r=ana-souza')), 'botão manda o link pelo WhatsApp do revendedor');
await clicar(M, '[data-pd=rev-copiar]');
ok(await M.evaluate(() => navigator.clipboard.readText()) === 'https://musubisistema.com.br/inicio/?r=ana-souza', 'Copiar link copia o link');
await clicar(M, '[data-pd=rev-novo]'); await M.fill('#pd-rev-f [name=nome]', 'Outro'); await M.fill('#pd-rev-f [name=codigo]', 'Ana Souza'); await clicar(M, '#pd-rev-f [type=submit]');
ok(S.revenda.revendedores.length === 1 && await tem(M, '#toast', 'já é de outro revendedor'), 'código repetido é recusado');
await clicar(M, '[data-pd=rev-fechar]');

// 2. Cliente abre a página pelo link, cria a conta e a clínica
const V = vigiar(await (await contexto()).newPage(), 'cliente');
await V.goto(BASE + 'inicio/index.html?r=ANA-SOUZA'); await V.waitForSelector('#mods .mod'); await V.waitForSelector('#entrada', { state:'detached', timeout:6000 });
await V.reload(); await V.waitForSelector('#mods .mod'); await V.waitForTimeout(200);
ok(S.revenda.visitas.reduce((t, v) => t + v.visitas, 0) === 1, 'a visita pelo link conta uma vez por sessão');
ok(await V.evaluate(() => JSON.parse(localStorage.getItem('musubi-revenda')).c) === 'ana-souza', 'o código fica guardado no aparelho');
await Promise.all([V.waitForURL(/\/index\.html/), V.click('#planos-l [data-k="profissional"]')]);
await V.locator('#acesso h1', { hasText:'Criar sua conta' }).waitFor({ state:'visible', timeout:8000 });
await V.fill('#f-acesso [name=nome]', 'Bia Lima'); await V.fill('#f-acesso [name=email]', 'bia@x.com'); await V.fill('#f-acesso [name=senha]', 'senha12345');
await clicar(V, '#f-acesso [type=submit]'); await V.waitForTimeout(300);
await V.fill('#acesso [name=clinica]', 'Clínica da Bia'); await V.fill('#acesso [name=cidade]', 'Porto Alegre');
await clicar(V, '#acesso [type=submit]'); await V.waitForTimeout(400);
const cB = S.clinicas.find(c => c.nome === 'Clínica da Bia');
ok(cB && S.revenda.clinicasRev.some(x => x.clinica_id === cB.id && x.revendedor_id === R.id), 'a clínica criada pelo link fica marcada com o revendedor');
ok(await V.evaluate(() => localStorage.getItem('musubi-revenda')) === null, 'depois de marcar, o código sai do aparelho');
await V.context().close();

// 3. Painel mostra os números do link e as comissões
const agora = Date.now(), iso = d => new Date(agora + d * 864e5).toISOString();
S.revenda.comissoes.push(
  { id:'k1', revendedor_id:R.id, clinica_id:cB.id, clinica_nome:'Clínica da Bia', plano:'profissional', forma:'mensal', valor_base:14900, comissao:2980, pago_cliente_em:iso(-10), libera_em:iso(-3), paga_em:null, paga_obs:'', cancelada_em:null, cancelada_motivo:'' },
  { id:'k2', revendedor_id:R.id, clinica_id:cB.id, clinica_nome:'Clínica da Bia', plano:'profissional', forma:'mensal', valor_base:14900, comissao:2980, pago_cliente_em:iso(-1), libera_em:iso(6), paga_em:null, paga_obs:'', cancelada_em:null, cancelada_motivo:'' });
await clicar(M, '[data-pd=atualizar]'); await M.waitForTimeout(300);
ok(await tem(M, '.pd-rv', '1 visita (1 em 30 dias)') && await tem(M, '.pd-rv', '1 conta criada') && await tem(M, '.pd-rv', '1 pagante') && await tem(M, '.pd-rv', 'conversão 100%'), 'painel mostra visitas, contas, pagantes e conversão do link');
ok(await tem(M, '#pd-rev .pd-resumo', 'R$ 29,80 para pagar') && await tem(M, '#pd-rev .pd-resumo', 'R$ 29,80 aguardando 7 dias'), 'resumo separa o que pode pagar do que aguarda os 7 dias');
await clicar(M, '[data-pd=rev-ver]');
ok(await tem(M, '.pd-com .pill', 'Pode pagar') && await tem(M, '.pd-com .pill', 'Aguardando') && await tem(M, '.pd-com', 'libera em'), 'cada comissão com a situação');
await clicar(M, '[data-pd=com-pagar]'); await M.waitForTimeout(300);
ok(!!S.revenda.comissoes[0].paga_em && await tem(M, '#pd-rev .pd-resumo', 'R$ 29,80 já pago'), 'Marcar como paga registra o pagamento ao revendedor');
// Regras
await M.click('#pd-regras summary'); await M.fill('#pd-regras-f [name=pct_mensal]', '25'); await clicar(M, '#pd-regras-f [type=submit]'); await M.waitForTimeout(300);
ok(S.revenda.regras.pct_mensal === 25 && await tem(M, '#pd-regras summary', '25% das 3 primeiras mensalidades'), 'o dono muda as regras da comissão');
// Parar o revendedor
await clicar(M, '[data-pd=rev-editar]'); await M.uncheck('#pd-rev-f [name=ativo]'); await clicar(M, '#pd-rev-f [type=submit]'); await M.waitForTimeout(300);
ok(S.revenda.revendedores[0].ativo === false && await tem(M, '.pd-rv .pill', 'Parado'), 'revendedor parado aparece marcado');
await M.context().close();

// 4. Servidor sem o 015 e celular
S.semRev = true;
const X = await dono();
ok(await tem(X, '#pd-rev', '015_revendedores.sql'), 'sem o 015 no servidor, avisa o que falta rodar');
await X.context().close(); S.semRev = false;
const C = await dono({ width:360, height:740 }); await clicar(C, '[data-pd=rev-ver]');
ok(!(await C.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'celular: aba Revendedores sem rolagem lateral');
await C.context().close();

ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nRevendedores passaram.');
process.exit(falhas ? 1 : 0);
