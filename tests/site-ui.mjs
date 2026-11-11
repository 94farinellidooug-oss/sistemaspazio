// Verifica no navegador a página de apresentação do MUSUBI (inicio/), primeira página do site: logo colorido no
// tema claro e branco só no escuro (tema salvo junto com o do sistema), abas das telas, pacotes com "Começar
// 7 dias grátis" (abre a criação de conta com o pacote escolhido), "Entrar" de verdade (Supabase falso),
// "Esqueci a senha", "Quero conhecer" salvando nos Interessados, quem já entrou vai direto ao sistema,
// celular sem rolagem horizontal e sem erros no console.
// Uso: node tests/site-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
import { servidor } from './lib/supabase-falso.mjs';
import { NUVEM } from '../js/dados/nuvem.js';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const srv = await iniciar(0), BASE = `http://localhost:${srv.address().port}/`, SITE = BASE + 'inicio/index.html';
const S = servidor({ chave:NUVEM.chave });
const browser = await chromium.launch();
const erros = [];
const contexto = async opc => {
  const ctx = await browser.newContext(opc);
  await ctx.route(NUVEM.url + '/**', async route => {
    const q = route.request();
    if (S.offline) return route.abort('internetdisconnected');
    const r = await S.fetch(q.url(), { method:q.method(), headers:await q.allHeaders().then(h => ({ apikey:h.apikey, Authorization:h.authorization, Prefer:h.prefer })), body:q.postData() || undefined });
    await route.fulfill({ status:r.status, contentType:'application/json', body:await r.text() });
  });
  return ctx;
};
const vigiar = p => { p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erros.push(m.text()); }); return p; };
const abrir = async (opc, url = SITE) => { const p = vigiar(await (await contexto(opc)).newPage()); await p.goto(url); await p.waitForSelector('#mods .mod'); return p; };
const logoVisivel = p => p.evaluate(() => [...document.querySelectorAll('.topo .logo')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.getAttribute('src').split('/').pop()));
const carregou = p => p.evaluate(() => [...document.querySelectorAll('img')].filter(i => getComputedStyle(i).display !== 'none').every(i => i.complete && i.naturalWidth > 0));

let p = await abrir({ viewport:{ width:1366, height:900 }, colorScheme:'light' });
ok(!(await p.locator('.faixa').count()), 'sem a faixa de prévia');
ok((await logoVisivel(p)).join() === 'MUSUBI_logo_colorido.svg', 'tema claro: logo colorido');
ok(await carregou(p), 'logos e telas carregam');
ok(await p.locator('#mods .mod').count() === 9 && await p.locator('#spots .spot').count() === 3 && await p.locator('#faq details').count() === 7, 'recursos, destaques e perguntas');
ok(await p.locator('#quem .sobre', { hasText:'Por trás do MUSUBI' }).count() === 1 && await p.locator('#quem', { hasText:'idealizado pelo Biomédico e Acupunturista Maicon Farinelli' }).count() === 1, 'seção Por trás do MUSUBI com o texto do Maicon');
ok(await p.locator('#planos-l .plano').count() === 3 && await p.locator('#planos-l', { hasText:'R$ 79' }).count() && await p.locator('#planos-l', { hasText:'R$ 149' }).count() && await p.locator('#planos-l', { hasText:'a partir de R$ 299' }).count(), 'três pacotes com os valores');
// Entrada: logo no centro por alguns segundos, só na primeira visita da sessão
ok(await p.locator('#entrada .entrada-logo').count() === 2, 'a entrada mostra o logo no centro');
await p.waitForSelector('#entrada', { state:'detached', timeout:5000 });
ok(true, 'depois de alguns segundos a entrada some e mostra a página');
await p.reload(); await p.waitForSelector('#mods .mod');
ok(!(await p.locator('#entrada').count()), 'na mesma sessão, a entrada não aparece de novo');
{ const q = vigiar(await (await contexto({ viewport:{ width:390, height:800 } })).newPage()); await q.goto(SITE); await q.waitForSelector('#entrada');
  await q.click('#entrada'); await q.waitForSelector('#entrada', { state:'detached', timeout:2000 });
  ok(await q.evaluate(() => getComputedStyle(document.querySelector('.hero h1')).clipPath === 'none' || !document.documentElement.classList.contains('com-entrada')), 'tocar na entrada pula e a página aparece'); await q.context().close(); }
// Planos: botão Mensal / Anual
ok(await p.locator('#periodo-sel [data-k=mensal][aria-checked=true]').count() === 1 && await p.locator('#anual-vant').isHidden() && !(await p.locator('#planos-l', { hasText:'plano anual' }).count()), 'planos abrem no mensal, sem o anual embaixo');
await p.click('#periodo-sel [data-k=anual]');
ok(await p.locator('#anual-vant').isVisible() && await p.locator('#planos-l', { hasText:'R$ 67' }).count() && await p.locator('#planos-l', { hasText:'R$ 127' }).count() && await p.locator('#planos-l', { hasText:'R$ 1.490 à vista' }).count() && await p.locator('#planos-l', { hasText:'Economia de R$ 264 por ano' }).count(), 'no anual: preço com desconto, à vista e as vantagens');
await p.click('#periodo-sel [data-k=mensal]');
ok(await p.locator('#anual-vant').isHidden() && await p.locator('#planos-l', { hasText:'R$ 149' }).count(), 'de volta ao mensal');
await p.click('[data-a="tema"]');
ok((await logoVisivel(p)).join() === 'MUSUBI_logo_branco.svg' && await p.evaluate(() => localStorage.getItem('musubi-tema')) === 'dark', 'tema escuro escolhido: logo branco, salvo junto com o do sistema');
await p.click('[data-a="tema"]');
ok((await logoVisivel(p)).join() === 'MUSUBI_logo_colorido.svg', 'de volta ao claro: logo colorido');

await p.click('#abas [data-k="relatorios"]');
ok((await p.getAttribute('#tela img', 'src')).endsWith('relatorios.png') && await p.getAttribute('#abas [data-k="relatorios"]', 'aria-selected') === 'true', 'abas trocam a tela mostrada');
await p.focus('#abas [data-k="relatorios"]'); await p.keyboard.press('ArrowLeft');
ok((await p.getAttribute('#tela img', 'src')).endsWith('financeiro.png'), 'abas pelo teclado');

// Entrar
await p.click('.hero [data-a="entrar"]'); await p.waitForTimeout(80);
ok(await p.locator('#m-entrar').isVisible() && await p.evaluate(() => document.activeElement.name) === 'email', '"Já uso, entrar" abre o acesso com o foco no e-mail');
await p.click('#e-botao');
ok(await p.locator('#e-erro', { hasText:'Verifique o e-mail' }).isVisible(), 'e-mail inválido avisa');
await p.fill('#f-entrar [name=email]', 'maicon@x.com'); await p.click('#e-botao');
ok(await p.locator('#e-erro', { hasText:'senha' }).isVisible(), 'sem senha avisa');
await p.fill('#f-entrar [name=senha]', 'errada1'); await p.click('#e-botao'); await p.waitForTimeout(200);
ok(await p.locator('#e-erro', { hasText:'E-mail ou senha incorretos' }).isVisible() && p.url().includes('inicio'), 'senha errada avisa e fica na página');
await p.click('[data-a="esqueci"]');
ok(!(await p.locator('#f-entrar [name=senha]').isVisible()) && await p.locator('#e-botao', { hasText:'Enviar link' }).isVisible(), 'esqueci minha senha pede só o e-mail');
await p.click('#e-botao'); await p.waitForTimeout(200);
ok(await p.locator('#m-entrar-t', { hasText:'Verifique o seu e-mail' }).isVisible() && S.chamadas.some(c => c.caminho.startsWith('/auth/v1/recover')), 'pede o link de nova senha ao servidor');
await p.keyboard.press('Escape');
ok(await p.locator('#m-entrar').isHidden(), 'Esc fecha');
await p.click('.topo [data-a="entrar"]');
ok(await p.locator('#m-entrar-t', { hasText:'Entrar no MUSUBI' }).isVisible(), 'reabre no modo entrar');
await p.fill('#f-entrar [name=email]', 'maicon@x.com'); await p.fill('#f-entrar [name=senha]', 'segredo123');
await Promise.all([p.waitForURL(/localhost:\d+\/index\.html/), p.click('#e-botao')]);
await p.waitForTimeout(400);
ok(!p.url().includes('inicio') && await p.evaluate(() => !!localStorage.getItem('musubi-sessao')), 'entrar guarda a conta e abre o sistema');
ok(await p.locator('#acesso h1', { hasText:'Conte sobre a clínica' }).isVisible(), 'o sistema continua já com a conta (primeiro acesso)');
// Quem já entrou neste aparelho vai direto para o sistema; ?ver mostra a página
await p.goto(SITE); await p.waitForURL(/\/index\.html/);
ok(!p.url().includes('inicio'), 'com conta no aparelho, a página leva direto ao sistema');
await p.goto(SITE + '?ver'); await p.waitForSelector('#mods .mod');
ok(p.url().includes('inicio'), '?ver mostra a página mesmo com conta');
await p.context().close();

// Pacote: começar 7 dias grátis
p = await abrir({ viewport:{ width:1366, height:900 }, colorScheme:'light' });
await Promise.all([p.waitForURL(/\/index\.html/), p.click('#planos-l [data-k="essencial"]')]);
await p.waitForTimeout(400);
ok(await p.locator('#acesso h1', { hasText:'Criar sua conta' }).isVisible() && !p.url().includes('#criar'), '"Começar 7 dias grátis" abre a criação de conta');
await p.fill('#f-acesso [name=nome]', 'Ana Souza'); await p.fill('#f-acesso [name=email]', 'ana@x.com'); await p.fill('#f-acesso [name=senha]', 'senha12345');
await p.click('#f-acesso [type=submit]'); await p.waitForTimeout(500);
ok(await p.locator('#acesso input[name=plano][value=essencial]').isChecked(), 'o pacote escolhido na página já vem marcado');
ok(await p.locator('#acesso a[href="inicio/index.html"]').count() === 0, 'link para a página só aparece na tela de entrar');
await p.context().close();

// Contato
p = await abrir({ viewport:{ width:1366, height:900 }, colorScheme:'dark' });
ok((await logoVisivel(p)).join() === 'MUSUBI_logo_branco.svg', 'aparelho no escuro: logo branco');
await p.click('#f-contato button[type=submit]');
ok(await p.locator('#f-erro', { hasText:'nome' }).isVisible(), 'contato sem nome avisa');
await p.fill('#f-contato [name=nome]', 'Ana <b>Souza</b>'); await p.fill('#f-contato [name=whats]', '5499');
await p.click('#f-contato button[type=submit]');
ok(await p.locator('#f-erro', { hasText:'DDD' }).isVisible(), 'WhatsApp incompleto avisa');
S.offline = true; await p.fill('#f-contato [name=whats]', '(54) 99999-1234'); await p.click('#f-contato button[type=submit]'); await p.waitForTimeout(200);
ok(await p.locator('#f-erro', { hasText:'Tente novamente' }).isVisible() && !S.interessados.length, 'sem servidor avisa e deixa tentar de novo');
S.offline = false; await p.click('#f-contato button[type=submit]'); await p.waitForTimeout(200);
ok(await p.locator('.enviado-ok', { hasText:'Obrigado, Ana' }).isVisible() && !(await p.locator('.enviado-ok b b').count()), 'contato enviado, sem HTML do nome');
ok(S.interessados.length === 1 && S.interessados[0].whats === '(54) 99999-1234', 'o pedido vai para os Interessados');
await p.context().close();

// Tela de entrar do sistema leva à página
p = vigiar(await (await contexto({ viewport:{ width:1366, height:900 } })).newPage());
await p.addInitScript(() => localStorage.setItem('musubi-modo', 'nuvem'));
await p.goto(BASE + 'index.html'); await p.waitForTimeout(300);
await Promise.all([p.waitForURL(/inicio\//), p.click('#acesso a[href="inicio/index.html"]')]);
ok(await p.locator('#mods .mod').count() === 9, 'tela de entrar do sistema tem o link "Conhecer o MUSUBI"');
await p.context().close();

for (const w of [390, 360]) {
  p = await abrir({ viewport:{ width:w, height:800 }, colorScheme:'light' });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}px: sem rolagem horizontal`);
  await p.click('[data-a="menu"]');
  ok(await p.locator('#menu').isVisible() && await p.getAttribute('[data-a="menu"]', 'aria-expanded') === 'true', `${w}px: menu abre`);
  await p.click('#menu a[href="#planos"]');
  ok(await p.locator('#menu').isHidden(), `${w}px: menu fecha ao escolher`);
  await p.click('.hero [data-a="entrar"]');
  const c = await p.locator('.modal-c').boundingBox();
  ok(c.x >= 0 && c.x + c.width <= w, `${w}px: acesso cabe na tela`);
  await p.context().close();
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA página de apresentação passou.');
process.exit(falhas ? 1 : 0);
