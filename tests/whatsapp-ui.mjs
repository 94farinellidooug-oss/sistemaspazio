// Verifica no navegador o WhatsApp (etapa 7A) no sistema modular e no arquivo único: lembretes de
// amanhã na Agenda, painel com a mensagem pronta, link wa.me com número e texto, registro de quando
// foi aberto, sem telefone não abre, retomar contato registra o contato, orientações em Documentos,
// Modelos de mensagens na Administração e celular sem rolagem horizontal.
// Uso: node tests/whatsapp-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };

async function verificar(browser, url, nome){
  const erros = [], ctx = await browser.newContext({ viewport:{ width:1366, height:1000 } }), p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await p.addInitScript(() => { window.__abertos = []; window.open = u => { window.__abertos.push(u); return null; }; });
  const espera = () => p.waitForTimeout(60), clicar = async s => { await p.click(s); await espera(); };
  const tem = async (s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
  const dados = () => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')));
  const ultimo = () => p.evaluate(() => window.__abertos.at(-1) || '');
  await p.goto(url + '#agenda'); await p.waitForSelector('#ag-l');
  const amanha = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('sv'); });

  // Agenda: lembrete de amanhã
  await p.selectOption('#na-p', 'p2'); await espera(); await p.fill('#na-d', amanha); await p.dispatchEvent('#na-d', 'change'); await espera();
  await p.fill('#na-t', '08:00'); await clicar('#f-appt .btn.pri');
  await p.selectOption('#na-p', 'p4'); await espera(); await p.fill('#na-d', amanha); await p.dispatchEvent('#na-d', 'change'); await espera();
  await p.fill('#na-t', '15:00'); await clicar('#f-appt .btn.pri');
  ok(await p.locator('#lembretes .hor').count() === 2 && await tem('#lem-falta', '2 a enviar'), `${nome}: lembretes de amanhã na Agenda`);
  await clicar('#lembretes .hor:has-text("Rafael") [data-act="wa"]');
  ok(await tem('.wa-p', 'Mensagem para Rafael') && (await p.locator('#wa-t').inputValue()).includes('acupuntura amanhã, às 08:00, na Spazio Stabilità'), `${nome}: mensagem pronta com serviço, dia e hora`);
  await p.fill('#wa-t', 'Olá, Rafael! Até amanhã às 8h.');
  await clicar('[data-act="wa-abrir"]');
  const u = await ultimo();
  ok(u.startsWith('https://wa.me/5511998201177?text=') && decodeURIComponent(u.split('text=')[1]) === 'Olá, Rafael! Até amanhã às 8h.', `${nome}: abre o WhatsApp com o número e o texto ajustado`);
  const M = (await dados()).patients.find(x => x.id === 'p2').relacionamento?.mensagens;
  ok(!(await tem('.wa-p')) && M?.[0]?.tipo === 'lembrete' && M[0].por === 'Maicon Farinelli' && M[0].ap && await tem('#lembretes .wa-ok', 'mensagem aberta') && await tem('#lem-falta', '1 a enviar'), `${nome}: fica registrado que a mensagem foi aberta`);
  await clicar('#lembretes .hor:has-text("Tiago") [data-act="wa"]');
  await clicar('.wa-p [data-act="wa-tipo"][data-k="livre"]');
  ok((await p.locator('#wa-t').inputValue()) === 'Olá, Tiago! ', `${nome}: troca para outra mensagem pronta`);
  await p.keyboard.press('Escape'); await espera();
  ok(!(await tem('.wa-p')) && (await p.evaluate(() => window.__abertos.length)) === 1, `${nome}: Esc fecha sem abrir`);

  // Sem telefone
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('musubi-v2')); d.patients.find(x => x.id === 'p4').phone = '';
    const at = d.patients.find(x => x.id === 'p1').atendimentos.at(-1); at.plano.orient = 'Compressa morna na nuca.'; localStorage.setItem('musubi-v2', JSON.stringify(d)); });
  await p.reload(); await p.waitForSelector('#ag-l');
  await clicar('#lembretes .hor:has-text("Tiago") [data-act="wa"]');
  ok(await tem('.wa-p .notice', 'Cadastre o telefone') && await p.locator('[data-act="wa-abrir"]').isDisabled(), `${nome}: sem telefone, não abre`);
  await clicar('.wa-p .btn:text-is("Cancelar")');

  // Relacionamento
  await p.evaluate(() => { location.hash = 'crm'; }); await espera();
  await clicar('[data-rel="p3"] [data-act="wa"]');
  ok((await p.locator('#wa-t').inputValue()).startsWith('Olá, Lúcia! Tudo bem?'), `${nome}: mensagem de retomar contato`);
  await clicar('[data-act="wa-abrir"]');
  ok((await ultimo()).includes('5521977330290') && await tem('[data-rel="p3"] .ctt-c', 'Maicon Farinelli') && (await dados()).patients.find(x => x.id === 'p3').relacionamento.contatos.length === 1, `${nome}: abrir registra o contato feito`);

  // Documentos: orientações
  await p.evaluate(() => { location.hash = 'documentos'; }); await espera();
  await p.selectOption('#doc-p', 'p1'); await espera(); await clicar('[data-m="orientacoes"]');
  await clicar('#doc-novo [data-act="wa"]'); await clicar('[data-act="wa-abrir"]');
  ok(decodeURIComponent((await ultimo()).split('text=')[1]).endsWith('Compressa morna na nuca.'), `${nome}: orientações pelo WhatsApp`);
  await p.selectOption('#doc-p', 'p2'); await espera();
  ok(!(await tem('#doc-novo [data-act="wa"]')), `${nome}: sem orientações escritas, sem botão`);

  // Modelos de mensagens
  await p.evaluate(() => { location.hash = 'administracao'; }); await espera();
  ok(await tem('a.adm-c[href="#mensagens"] .pill.ok', 'disponível'), `${nome}: Modelos de mensagens na Administração`);
  await clicar('a.adm-c[href="#mensagens"]');
  const f = '.f-msg[data-k="lembrete"]';
  await p.fill(`${f} textarea`, 'Oi, '); await p.locator(`${f} textarea`).press('End');
  await clicar(`${f} [data-act="msg-campo"][data-k="primeiro"]`);
  ok((await p.locator(`${f} textarea`).inputValue()) === 'Oi, {primeiro}' && await tem(`${f} .mod-raw .cp`, 'Primeiro nome'), `${nome}: botão insere o dado no texto`);
  await p.locator(`${f} textarea`).press('End'); await p.keyboard.type('! Até {quando} às {hora}.');
  await clicar(`${f} .btn.pri`);
  ok(await tem(`${f} .pill`, 'sua') && (await dados()).mensagensWa?.lembrete?.texto === 'Oi, {primeiro}! Até {quando} às {hora}.', `${nome}: mensagem pronta salva como sua`);
  await p.evaluate(() => { location.hash = 'agenda'; }); await espera();
  await clicar('#lembretes .hor:has-text("Rafael") [data-act="wa"]');
  ok((await p.locator('#wa-t').inputValue()) === 'Oi, Rafael! Até amanhã às 08:00.', `${nome}: lembrete usa a mensagem salva`);
  await clicar('.wa-p [data-act="fechar-ir"]'); await espera();
  ok(await p.evaluate(() => location.hash) === '#mensagens' && !(await tem('.wa-p')), `${nome}: atalho do painel para Modelos de mensagens`);
  await clicar(`${f} [data-act="msg-orig"]`);
  ok(await tem(`${f} .pill`, 'original') && !(await dados()).mensagensWa?.lembrete, `${nome}: voltar ao texto original`);

  for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 });
    for (const r of ['agenda', 'crm', 'mensagens']) { await p.goto(url + '#' + r); await p.waitForTimeout(120);
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome} celular ${w}px ${r}: sem rolagem horizontal`); }
    await p.goto(url + '#agenda'); await p.waitForTimeout(120); await clicar('#lembretes [data-act="wa"] >> nth=0');
    await p.waitForTimeout(300); const b = await p.locator('.wa-p').boundingBox();
    ok(b && b.x >= -1 && b.x + b.width <= w + 1 && b.y + b.height <= 801, `${nome} celular ${w}px: painel do WhatsApp cabe na tela`); }
  ok(!erros.length, `${nome}: sem erros no console` + (erros.length ? ': ' + erros.join(' | ') : ''));
  await ctx.close();
}
const srv = await iniciar(0), base = `http://localhost:${srv.address().port}/`, browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'arquivo único');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações do WhatsApp passaram.');
process.exit(falhas ? 1 : 0);
