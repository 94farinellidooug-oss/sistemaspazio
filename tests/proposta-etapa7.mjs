// Verifica no navegador a proposta navegável da etapa 7 (proposta/etapa-7), com dados fictícios:
// WhatsApp com a mensagem pronta (lembretes de amanhã, retomar contato, orientações), link wa.me com
// o número e o texto, registro de quando foi aberto, sem telefone não abre, mensagens prontas
// editáveis; assinatura com o dedo na tela indo para a folha e o prontuário; celular sem rolagem.
// Uso: node tests/proposta-etapa7.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const srv = await iniciar(0);
const URL_ = `http://localhost:${srv.address().port}/proposta/etapa-7/index.html`;
const browser = await chromium.launch();
const erros = [];
const p = await (await browser.newContext({ viewport:{ width:1366, height:1000 } })).newPage();
p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => { window.__abertos = []; window.open = u => { window.__abertos.push(u); return null; }; window.__imp = []; window.print = () => window.__imp.push(document.getElementById('imp').innerHTML); });
const espera = () => p.waitForTimeout(50);
const clicar = async sel => { await p.click(sel); await espera(); };
const tem = async (sel, txt) => (await p.locator(sel, txt ? { hasText: txt } : {}).count()) > 0;
const ultimo = () => p.evaluate(() => window.__abertos.at(-1) || '');

// Agenda: lembretes de amanhã
await p.goto(URL_ + '#/agenda'); await p.waitForSelector('#lembretes');
ok(await p.locator('#lembretes .hor').count() === 3 && await tem('#lem-falta', '3 a enviar'), 'lembretes de amanhã com contagem');
await clicar('#lembretes [data-ap="a3"] [data-a="wa"]');
ok(await tem('.wa-p', 'Mensagem para Pedro') && (await p.locator('#wa-t').inputValue()).includes('acupuntura amanhã, às 08:00, na Spazio Stabilità'), 'mensagem pronta com serviço, dia e hora');
await p.fill('#wa-t', 'Olá, Pedro! Até amanhã às 8h.');
await clicar('[data-a="wa-abrir"]');
const u = await ultimo();
ok(u.startsWith('https://wa.me/5554993707724?text=') && decodeURIComponent(u.split('text=')[1]) === 'Olá, Pedro! Até amanhã às 8h.', 'abre o WhatsApp com o número (55 + DDD) e o texto ajustado');
ok(!(await tem('.wa-p')) && await tem('[data-ap="a3"] .wa-ok', 'mensagem aberta') && await tem('#lem-falta', '2 a enviar'), 'fica registrado que a mensagem foi aberta');
await clicar('#lembretes [data-ap="a5"] [data-a="wa"]');
ok(await tem('.wa-p .notice', 'Cadastre o telefone') && await p.locator('[data-a="wa-abrir"]').isDisabled(), 'sem telefone, não abre');
await clicar('.wa-p [data-a="wa-tipo"][data-k="livre"]');
ok((await p.locator('#wa-t').inputValue()) === 'Olá, Carlos! ', 'troca para outra mensagem pronta');
await p.keyboard.press('Escape'); await espera();
ok(!(await tem('.wa-p')), 'Esc fecha sem enviar');

// Relacionamento
await p.goto(URL_ + '#/relacionamento'); await espera();
ok(await tem('[data-rel="p3"]', 'Helena Souza') && !(await tem('[data-rel="p1"]')), 'retomar contato só com quem passou de 21 dias e não tem horário');
await clicar('[data-rel="p3"] [data-a="wa"]');
ok((await p.locator('#wa-t').inputValue()).startsWith('Olá, Helena! Tudo bem?'), 'mensagem de retomar contato');
await clicar('[data-a="wa-abrir"]');
ok(await tem('[data-rel="p3"] .ctt-c', 'contato pelo WhatsApp') && (await ultimo()).includes('5554996334410'), 'abrir registra o contato feito');

// Mensagens prontas
await clicar('.p7-abas a:text-is("Mensagens prontas")');
const f = '.f-msg[data-k="lembrete"]';
await p.fill(`${f} textarea`, 'Oi, '); await p.locator(`${f} textarea`).press('End');
await clicar(`${f} [data-a="campo"][data-k="primeiro"]`);
ok((await p.locator(`${f} textarea`).inputValue()) === 'Oi, {primeiro}', 'botão insere o dado no texto');
await p.locator(`${f} textarea`).press('End'); await p.keyboard.type('! Até {quando} às {hora}.');
await clicar(`${f} .btn.pri`);
ok(await tem(`${f} .pill`, 'sua') && await tem('#toast', 'Mensagem salva'), 'mensagem pronta salva como sua');
await p.goto(URL_ + '#/agenda'); await espera();
await clicar('#lembretes [data-ap="a4"] [data-a="wa"]');
ok((await p.locator('#wa-t').inputValue()) === 'Oi, João! Até amanhã às 17:00.', 'lembrete usa a mensagem salva');
await clicar('.wa-p .btn:text-is("Cancelar")');
await p.goto(URL_ + '#/mensagens'); await espera();
await clicar(`${f} [data-a="msg-orig"]`);
ok(await tem(`${f} .pill`, 'original') && (await p.locator(`${f} textarea`).inputValue()).startsWith('Olá, {primeiro}! Passando'), 'voltar ao texto original');

// Documentos: assinatura na tela
await p.goto(URL_ + '#/documentos'); await espera();
await clicar('[data-a="assinar"]');
ok(await tem('.ass-p canvas#ass-c') && await p.locator('[data-a="ass-ok"]').isDisabled(), 'quadro de assinatura; confirmar só depois de assinar');
const bb = await p.locator('#ass-c').boundingBox();
await p.mouse.move(bb.x + 40, bb.y + 100); await p.mouse.down();
for (let i = 0; i < 25; i++) await p.mouse.move(bb.x + 40 + i * 10, bb.y + 100 + 40 * Math.sin(i / 3));
await p.mouse.up(); await espera();
ok(!(await p.locator('[data-a="ass-ok"]').isDisabled()), 'depois de assinar, pode confirmar');
await clicar('[data-a="ass-limpar"]');
ok(await p.locator('[data-a="ass-ok"]').isDisabled(), 'limpar recomeça');
await p.mouse.move(bb.x + 40, bb.y + 100); await p.mouse.down(); await p.mouse.move(bb.x + 200, bb.y + 140); await p.mouse.move(bb.x + 300, bb.y + 90); await p.mouse.up();
await clicar('[data-a="ass-ok"]');
ok(await tem('#doc-pv .dp-as img.ass-img') && await tem('#doc-pv .dp-as', 'assinado na tela em 05/11/2026') && await p.locator('[data-a="assinar"]').isDisabled(), 'assinatura vai para a folha com data e hora');
await clicar('[data-a="imp"]');
ok((await p.evaluate(() => window.__imp.at(-1) || '')).includes('data:image/png'), 'a folha impressa leva a assinatura');
await clicar('[data-a="guardar"]');
ok(await tem('#doc-lista .pill.ok', 'assinado na tela'), 'guardado no prontuário com a assinatura');
await p.selectOption('#d-p', 'p2'); await espera();
ok(!(await tem('#doc-pv img.ass-img')) && !(await p.locator('[data-a="assinar"]').isDisabled()), 'outro paciente começa sem assinatura');
await clicar('[data-a="mod"][data-m="orientacoes"]'); await clicar('#doc-novo [data-a="wa"]');
await clicar('[data-a="wa-abrir"]');
ok(decodeURIComponent((await ultimo()).split('text=')[1]).includes('Compressa morna na nuca'), 'orientações pelo WhatsApp');

for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 });
  for (const r of ['agenda', 'relacionamento', 'documentos', 'mensagens']) { await p.goto(URL_ + '#/' + r); await p.reload(); await p.waitForTimeout(80);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `celular ${w}px ${r}: sem rolagem horizontal`); }
  await clicar('[data-a="fora"] >> nth=0').catch(() => {});
  await p.goto(URL_ + '#/agenda'); await p.reload(); await espera(); await clicar('#lembretes [data-a="wa"] >> nth=0');
  const box = await p.locator('.wa-p').boundingBox();
  ok(box.x >= 0 && box.x + box.width <= w + 1, `celular ${w}px: painel do WhatsApp cabe na tela`); }
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações da proposta da etapa 7 passaram.');
process.exit(falhas ? 1 : 0);
