// Verifica no navegador a nota fiscal (NFS-e) com o Supabase falso: sem conta só explica; o administrador envia o
// certificado A1 (senha errada avisa) e preenche os dados fiscais em Configurações > Nota fiscal; antes disso a janela
// de emissão diz o que falta; "Emitir nota" em cada recebimento confere paciente, valor e descrição e manda o pedido
// certo (cidade do IBGE, CNPJ, regime, tributos, código do serviço); a nota aparece com o número e imprime; recusa
// da Receita fica na janela; nota sem resposta mostra "Conferir"; a recepção emite mas não configura; servidor sem
// a função avisa; celular sem rolagem horizontal.
// Uso: node tests/nfse-ui.mjs
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
async function aparelho(nome, url, { nuvem = true } = {}){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    await route.fulfill({ status:r.status, contentType:'application/json', body:await r.text() });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(`${nome}: ${m.text()}`); });
  if (nuvem) await p.addInitScript(() => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('musubi-modo', 'nuvem'); sessionStorage.setItem('iniciado', '1'); } });
  await p.addInitScript(() => { window.print = () => { window.__imprimiu = (window.__imprimiu || 0) + 1; }; });
  await p.goto(BASE + url); await p.waitForTimeout(150); return p;
}
const tem = async (p, s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const clicar = async (p, s) => { await p.click(s); await p.waitForTimeout(250); };
const entrar = async (p, email, senha) => { await p.fill('#acesso [name=email]', email); await p.fill('#acesso [name=senha]', senha); await clicar(p, '#acesso [type=submit]'); await p.waitForTimeout(150); };
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(300); };
const dados = p => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')));
const atender = async p => { await ir(p, 'agenda'); await p.waitForSelector('#ag-l');
  for (let i = 0; i < 3 && await tem(p, '#ag-l .hor [data-s="atendido"]:not(.on)'); i++) await clicar(p, '#ag-l .hor [data-s="atendido"]:not(.on) >> nth=0'); };
const receber = async p => { await clicar(p, '#f-arec [data-act=fin-receber] >> nth=0'); await clicar(p, '#f-arec .fin-rec button.pri'); };
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

for (const [rot, url] of [['sistema', 'index.html'], ['arquivo único', 'dist/spazio.html']]) {
  { const L = await aparelho('L', url, { nuvem:false }); await ir(L, 'financeiro'); await L.waitForSelector('.fin-t');
    ok(await tem(L, '#f-nota', 'Com a conta no servidor') && !(await tem(L, '[data-nf=abrir]')), `${rot}: sem conta, a nota fiscal só explica (fica o "Dados da nota")`);
    await ir(L, 'configuracoes'); await clicar(L, '[data-cf=aba][data-k=nota]');
    ok(await tem(L, '#cf-nota [data-act=conta-entrar]'), `${rot}: sem conta, Configurações > Nota fiscal pede para entrar`);
    await L.context().close(); }

  S.usuarios = { 'maicon@x.com':{ id:'u1', senha:'segredo123', nome:'Maicon' }, 'rec@x.com':{ id:'u2', senha:'segredo123', nome:'Ana' } };
  S.clinicas.length = 0; S.dados = {}; S.convites = []; S.nfse = null;
  const M = await aparelho('M', url);
  await entrar(M, 'maicon@x.com', 'segredo123');
  await M.fill('#acesso [name=clinica]', 'Spazio Stabilità'); await M.fill('#acesso [name=cidade]', 'Caxias do Sul'); await clicar(M, '#acesso [type=submit]'); await M.waitForTimeout(300);
  await ir(M, 'configuracoes'); await clicar(M, '[data-cf=aba][data-k=nota]'); await M.waitForTimeout(300);
  ok(await tem(M, '#nf-cert', 'falta publicar a função nfse'), `${rot}: servidor sem a função nfse avisa o que falta`);
  S.nfse = {};
  await M.reload(); await M.waitForTimeout(500); await ir(M, 'configuracoes'); await clicar(M, '[data-cf=aba][data-k=nota]'); await M.waitForTimeout(400);
  ok(await tem(M, '#nf-cert', 'Nenhum certificado') && await tem(M, '#nf-falta', 'certificado digital A1') && await tem(M, '#nf-homolog', 'homologação'), `${rot}: sem certificado, diz o que falta; começa em homologação`);

  // Recebimento antes de configurar: a janela diz o que falta.
  await atender(M); await ir(M, 'financeiro'); await M.waitForSelector('.fin-t'); await receber(M);
  ok(await tem(M, '#f-recs [data-nf=abrir]', 'Emitir nota') && !(await tem(M, '#f-recs [data-act=fin-nota]')), `${rot}: cada recebimento tem "Emitir nota"`);
  await clicar(M, '#f-recs [data-nf=abrir] >> nth=0'); await M.waitForTimeout(300);
  ok(await tem(M, '#f-nfse #nf-falta-j', 'certificado') && await M.locator('#f-nfse button.pri').isDisabled(), `${rot}: antes de configurar, a janela diz o que falta e não emite`);
  await M.keyboard.press('Escape'); await M.waitForTimeout(150);
  ok(!(await tem(M, '#f-nfse')), `${rot}: Esc fecha a janela`);

  // Certificado e dados fiscais
  await ir(M, 'configuracoes'); await clicar(M, '[data-cf=aba][data-k=nota]'); await M.waitForTimeout(300);
  await M.setInputFiles('#nf-arq', { name:'spazio.pfx', mimeType:'application/x-pkcs12', buffer:Buffer.from('certificado de teste') });
  await M.fill('#nf-senha', 'errada'); await clicar(M, '#nf-f-cert button.pri'); await M.waitForTimeout(200);
  ok(await tem(M, '#nf-cert-erro', 'A senha do certificado não confere') && !S.nfse.cert, `${rot}: senha errada avisa`);
  const ped = S.nfse.pedidos.at(-1);
  ok(ped.acao === 'certificado' && ped.pfx === Buffer.from('certificado de teste').toString('base64'), `${rot}: o arquivo vai em base64 para a função`);
  await M.setInputFiles('#nf-arq', { name:'spazio.pfx', mimeType:'application/x-pkcs12', buffer:Buffer.from('certificado de teste') });
  await M.fill('#nf-senha', 'certo'); await clicar(M, '#nf-f-cert button.pri'); await M.waitForTimeout(200);
  ok(await tem(M, '#nf-cert', 'SPAZIO STABILITA LTDA') && await tem(M, '#nf-cert', '11.222.333/0001-81') && await tem(M, '#nf-cert .pill', 'válido'), `${rot}: certificado enviado mostra titular, CNPJ e validade`);
  await M.selectOption('#nf-f-dados [name=regime]', '3'); await M.waitForTimeout(200);
  ok(await tem(M, '#nf-f-dados [name=pTotTribSN]') && !(await tem(M, '#nf-f-dados [name=fed]')), `${rot}: Simples pede o percentual de tributos do Simples`);
  await M.fill('#nf-f-dados [name=doc]', '11.222.333/0001-81'); await M.fill('#nf-f-dados [name=im]', '98765'); await clicar(M, '#nf-f-dados button.pri');
  ok(await tem(M, '#nf-dados-erro', 'percentual') , `${rot}: sem o percentual, não salva e diz o que falta`);
  await M.fill('#nf-f-dados [name=pTotTribSN]', '6,5'); await clicar(M, '#nf-f-dados button.pri'); await M.waitForTimeout(200);
  const D = await dados(M);
  ok(D.config.nfse.regime === '3' && D.config.nfse.pTotTribSN === '6.5' && D.config.nfse.codigo === '040501' && D.config.clinica.doc === '11222333000181', `${rot}: dados fiscais salvos (regime, tributos, acupuntura 04.05.01, CNPJ)`);
  ok(await tem(M, '#nf-pronto', 'Pronto para emitir em homologação') && await tem(M, '#nf-f-dados', 'IBGE 4305108'), `${rot}: pronto para emitir, com a cidade no código do IBGE`);
  await M.selectOption('#nf-f-dados [name=codigoSel]', 'outro'); await M.waitForTimeout(200);
  ok(await tem(M, '#nf-f-dados [name=codigo]'), `${rot}: "Outro código" abre o campo do código`);
  await M.selectOption('#nf-f-dados [name=codigoSel]', '040501'); await M.waitForTimeout(150);
  // Conferir o código na prefeitura: sem o código, avisa; com complemento, oferece usar e a nota leva o cTribMun.
  S.nfse.complemento = ''; await clicar(M, '[data-nf=conferir-codigo]'); await M.waitForTimeout(400);
  ok(await tem(M, '#nf-cod-res', 'não tem o código 04.05.01') && S.nfse.pedidos.at(-1).acao === 'conferir_codigo' && S.nfse.pedidos.at(-1).municipio === '4305108', `${rot}: consulta a prefeitura e avisa quando ela não tem o código`);
  S.nfse.complemento = '003'; await clicar(M, '[data-nf=conferir-codigo]'); await M.waitForTimeout(400);
  ok(await tem(M, '#nf-cod-res', '04.05.01.003') && await tem(M, '#nf-cod-res', 'ISS 2%'), `${rot}: mostra o código completo que a prefeitura aceita`);
  await clicar(M, '[data-nf=usar-comp]'); await M.waitForTimeout(300);
  ok(await M.inputValue('#nf-f-dados [name=codigoMun]') === '003' && !(await tem(M, '[data-nf=usar-comp]')), `${rot}: "Usar o complemento" guarda o 003`);

  // Emitir
  await ir(M, 'financeiro'); await M.waitForSelector('.fin-t');
  await clicar(M, '#f-recs [data-nf=abrir] >> nth=0'); await M.waitForTimeout(300);
  const desc = await M.inputValue('#nf-desc');
  ok(desc.includes('realizado em') && await tem(M, '#f-nfse', 'homologação') && await tem(M, '#f-nfse', 'sem identificar o paciente') && !(await M.locator('#f-nfse button.pri').isDisabled()), `${rot}: a janela confere paciente, valor e descrição; CPF inválido do exemplo sai sem identificar`);
  await M.fill('#nf-desc', 'Sessão de acupuntura em 07/11/2026'); await clicar(M, '#f-nfse button.pri'); await M.waitForTimeout(300);
  const E = S.nfse.pedidos.at(-1);
  ok(E.acao === 'emitir' && E.ambiente === 'homologacao' && E.nota.cLocEmi === '4305108' && E.nota.prestador.doc === '11222333000181' && E.nota.prestador.regime === '3' && E.nota.tributos.pTotTribSN === '6.5'
    && E.nota.servico.cTribNac === '040501' && E.nota.servico.cTribMun === '003' && E.nota.prestador.im === '98765' && E.nota.servico.descricao === 'Sessão de acupuntura em 07/11/2026' && Number.isInteger(E.nota.valor) && E.nota.valor > 0 && !E.nota.tomador && E.referencia, `${rot}: o pedido leva cidade, CNPJ, regime, tributos, serviço, descrição e valor em centavos`);
  ok(!(await tem(M, '#f-nfse')) && await tem(M, '#f-recs .nf-n', 'NFS-e 1 · teste') && await tem(M, '.toast, #toast', 'Nota 1 emitida'), `${rot}: nota emitida aparece com o número no recebimento`);
  await clicar(M, '#f-recs [data-nf=imprimir] >> nth=0');
  ok(await M.evaluate(() => window.__imprimiu) === 1 && await tem(M, '#imp', 'SEM VALOR FISCAL') && await tem(M, '#imp', S.nfse.notas[0].chave) && await tem(M, '#imp', 'Sessão de acupuntura'), `${rot}: imprimir a nota traz chave, descrição e o aviso de teste`);

  // Recusa e sem resposta
  await atender(M); await ir(M, 'financeiro'); await receber(M);
  S.nfse.modo = 'recusa';
  await clicar(M, '#f-recs [data-nf=abrir] >> nth=0'); await clicar(M, '#f-nfse button.pri'); await M.waitForTimeout(250);
  ok(await tem(M, '#f-nfse #nf-erro', 'E0312'), `${rot}: recusa da Receita aparece na janela, com o código`);
  S.nfse.modo = 'cair'; await clicar(M, '#f-nfse button.pri'); await M.waitForTimeout(250);
  ok(!(await tem(M, '#f-nfse')) && await tem(M, '#f-recs [data-nf=conferir]', 'Conferir nota'), `${rot}: sem resposta da Receita, o recebimento mostra "Conferir nota"`);
  S.nfse.modo = 'ok'; await clicar(M, '#f-recs [data-nf=conferir]'); await M.waitForTimeout(250);
  ok(!(await tem(M, '#f-recs [data-nf=conferir]')) && await M.locator('#f-recs .nf-n').count() === 2, `${rot}: "Conferir" acha a nota e mostra o número`);
  await M.waitForTimeout(2500); await M.reload(); await M.waitForTimeout(600); await ir(M, 'financeiro');
  ok(await M.locator('#f-recs .nf-n').count() === 2 && await tem(M, '#f-nota', 'emitidas neste mês'), `${rot}: as notas ficam guardadas ao recarregar`);

  // Celular
  await M.setViewportSize({ width:390, height:844 }); await M.waitForTimeout(150);
  await atender(M); await ir(M, 'financeiro'); await receber(M);
  await clicar(M, '#f-recs [data-nf=abrir] >> nth=0');
  ok(await tem(M, '#f-nfse') && await semRolagem(M), `${rot}: celular sem rolagem horizontal com a janela da nota`);
  await M.mouse.click(5, 5); await M.waitForTimeout(150);
  ok(!(await tem(M, '#f-nfse')), `${rot}: tocar fora fecha a janela`);
  await ir(M, 'configuracoes'); await clicar(M, '[data-cf=aba][data-k=nota]');
  ok(await semRolagem(M), `${rot}: celular sem rolagem horizontal em Configurações > Nota fiscal`);

  // Recepção emite, mas não configura
  S.clinicas[0].membros.push({ user:'u2', perfil:'rec', ativo:true, email:'rec@x.com', nome:'Ana' });
  const R = await aparelho('R', url);
  await entrar(R, 'rec@x.com', 'segredo123'); await R.waitForTimeout(300);
  await ir(R, 'financeiro'); await R.waitForTimeout(300);
  ok(await R.locator('#f-recs [data-nf=abrir]').count() >= 1 && !(await tem(R, '#f-nota [data-k=nota]')), `${rot}: a recepção emite a nota mas não abre a configuração`);
  await ir(R, 'configuracoes');
  ok(!(await tem(R, '[data-cf=aba][data-k=nota]')), `${rot}: Configurações da recepção não tem a aba Nota fiscal`);
  await M.context().close(); await R.context().close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA nota fiscal (tela) passou.');
process.exit(falhas ? 1 : 0);
