// Verifica no navegador a prévia da página de apresentação do MUSUBI (proposta/etapa-10): logo colorido no
// tema claro e branco só no escuro, abas das telas, "Entrar" (validação, esqueci a senha, abre o sistema),
// formulário de contato com o mínimo de campos, menu do celular, sem rolagem horizontal e sem erros no console.
// Uso: node tests/proposta-etapa10.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const srv = await iniciar(0);
const URL_ = `http://localhost:${srv.address().port}/proposta/etapa-10/index.html`;
const browser = await chromium.launch();
const erros = [];
const abrir = async (opc) => {
  const p = await (await browser.newContext(opc)).newPage();
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await p.goto(URL_); await p.waitForSelector('#mods .mod'); return p;
};
const logoVisivel = p => p.evaluate(() => [...document.querySelectorAll('.topo .logo')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.getAttribute('src').split('/').pop()));
const carregou = p => p.evaluate(() => [...document.querySelectorAll('img')].filter(i => getComputedStyle(i).display !== 'none').every(i => i.complete && i.naturalWidth > 0));

let p = await abrir({ viewport:{ width:1366, height:900 }, colorScheme:'light' });
ok((await logoVisivel(p)).join() === 'MUSUBI_logo_colorido.svg', 'tema claro: logo colorido');
ok(await carregou(p), 'logos e telas carregam');
ok(await p.locator('#mods .mod').count() === 9 && await p.locator('#spots .spot').count() === 3 && await p.locator('#faq details').count() === 6, 'recursos, destaques e perguntas');
await p.click('[data-a="tema"]');
ok((await logoVisivel(p)).join() === 'MUSUBI_logo_branco.svg', 'tema escuro escolhido: logo branco');
await p.click('[data-a="tema"]');
ok((await logoVisivel(p)).join() === 'MUSUBI_logo_colorido.svg', 'de volta ao claro: logo colorido');

await p.click('#abas [data-k="relatorios"]');
ok((await p.getAttribute('#tela img', 'src')).endsWith('relatorios.png') && await p.getAttribute('#abas [data-k="relatorios"]', 'aria-selected') === 'true', 'abas trocam a tela mostrada');
await p.focus('#abas [data-k="relatorios"]'); await p.keyboard.press('ArrowLeft');
ok((await p.getAttribute('#tela img', 'src')).endsWith('financeiro.png'), 'abas pelo teclado');

await p.click('.hero [data-a="entrar"]'); await p.waitForTimeout(80);
ok(await p.locator('#m-entrar').isVisible() && await p.evaluate(() => document.activeElement.name) === 'email', '"Já uso, entrar" abre o acesso com o foco no e-mail');
await p.click('#e-botao');
ok(await p.locator('#e-erro', { hasText:'Confira o e-mail' }).isVisible(), 'e-mail inválido avisa');
await p.fill('#f-entrar [name=email]', 'maicon@clinica.com.br'); await p.click('#e-botao');
ok(await p.locator('#e-erro', { hasText:'senha' }).isVisible(), 'sem senha avisa');
await p.fill('#f-entrar [name=senha]', 'abc'); await p.click('[data-a="ver-senha"]');
ok(await p.getAttribute('#f-entrar [name=senha]', 'type') === 'text', 'mostrar a senha');
await p.click('[data-a="esqueci"]');
ok(!(await p.locator('#f-entrar [name=senha]').isVisible()) && await p.locator('#e-botao', { hasText:'Enviar link' }).isVisible(), 'esqueci minha senha pede só o e-mail');
await p.click('#e-botao');
ok(await p.locator('#m-entrar-t', { hasText:'Confira o seu e-mail' }).isVisible() && !(await p.locator('#e-botao').isVisible()), 'link de nova senha (simulado)');
await p.keyboard.press('Escape');
ok(await p.locator('#m-entrar').isHidden(), 'Esc fecha');
await p.click('.topo [data-a="entrar"]');
ok(await p.locator('#m-entrar-t', { hasText:'Entrar no MUSUBI' }).isVisible(), 'reabre no modo entrar');
await p.fill('#f-entrar [name=email]', 'maicon@clinica.com.br'); await p.fill('#f-entrar [name=senha]', 'abc');
await Promise.all([p.waitForURL(/localhost:\d+\/index\.html/), p.click('#e-botao')]);
ok(!p.url().includes('proposta'), 'entrar abre o sistema');

p = await abrir({ viewport:{ width:1366, height:900 }, colorScheme:'dark' });
ok((await logoVisivel(p)).join() === 'MUSUBI_logo_branco.svg', 'aparelho no escuro: logo branco');
await p.click('#f-contato button[type=submit]');
ok(await p.locator('#f-erro', { hasText:'nome' }).isVisible(), 'contato sem nome avisa');
await p.fill('#f-contato [name=nome]', 'Ana Souza'); await p.fill('#f-contato [name=whats]', '5499');
await p.click('#f-contato button[type=submit]');
ok(await p.locator('#f-erro', { hasText:'DDD' }).isVisible(), 'WhatsApp incompleto avisa');
await p.fill('#f-contato [name=whats]', '(54) 99999-1234'); await p.click('#f-contato button[type=submit]');
ok(await p.locator('.enviado-ok', { hasText:'Obrigado, Ana!' }).isVisible(), 'contato enviado (simulado)');

for (const w of [390, 360]) {
  p = await abrir({ viewport:{ width:w, height:800 }, colorScheme:'light' });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}px: sem rolagem horizontal`);
  await p.click('[data-a="menu"]');
  ok(await p.locator('#menu').isVisible() && await p.getAttribute('[data-a="menu"]', 'aria-expanded') === 'true', `${w}px: menu abre`);
  await p.click('#menu a[href="#perguntas"]');
  ok(await p.locator('#menu').isHidden(), `${w}px: menu fecha ao escolher`);
  await p.click('.hero [data-a="entrar"]');
  const c = await p.locator('.modal-c').boundingBox();
  ok(c.x >= 0 && c.x + c.width <= w, `${w}px: acesso cabe na tela`);
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA prévia da página de apresentação passou.');
process.exit(falhas ? 1 : 0);
