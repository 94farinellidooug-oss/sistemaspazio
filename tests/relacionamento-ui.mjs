// Verifica no navegador o Relacionamento (etapa 6C) no sistema modular e no arquivo único: fica na
// Administração, lista de retomar contato, contato feito, não retomar, Agendar levando à agenda,
// interessados e cadastro do interessado como paciente; celular sem rolagem horizontal.
// Uso: node tests/relacionamento-ui.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };

async function verificar(browser, url, nome){
  const erros = [], ctx = await browser.newContext({ viewport:{ width:1366, height:1000 } }), p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const espera = () => p.waitForTimeout(60), clicar = async s => { await p.click(s); await espera(); };
  const tem = async (s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
  const dados = () => p.evaluate(() => JSON.parse(localStorage.getItem('musubi-v2')));
  await p.goto(url + '#administracao'); await p.waitForSelector('#view h1');
  ok(await tem('a.adm-c[href="#crm"]', 'Relacionamento') && await tem('a.adm-c[href="#crm"] .pill.ok', 'disponível'), `${nome}: Relacionamento na Administração, disponível`);
  await clicar('a.adm-c[href="#crm"]');
  ok(await tem('#nav a.on', 'Administração') && await tem('.migalha', 'Administração') && !(await tem('#view', 'Planejado para a etapa')), `${nome}: tela própria dentro da Administração`);
  ok(await tem('[data-rel="p3"]', 'Lúcia Andrade') && !(await tem('[data-rel="p1"]')), `${nome}: retomar contato com quem passou de 21 dias e não tem horário`);
  await clicar('[data-rel="p3"] [data-act="rel-contato"]');
  ok(await tem('[data-rel="p3"] .ctt-c', 'Maicon Farinelli') && await p.locator('[data-rel="p3"] [data-act="rel-contato"]').isDisabled() && (await dados()).patients.find(x => x.id === 'p3').relacionamento.contatos.length === 1, `${nome}: contato feito registrado`);
  await clicar('[data-rel="p3"] [data-act="rel-ocultar"]');
  ok(!(await tem('[data-rel="p3"]')) && await tem('[data-act="rel-ver-oc"]', '1 que você preferiu não retomar'), `${nome}: não retomar esconde sem apagar`);
  await clicar('[data-act="rel-ver-oc"]'); await clicar('[data-rel="p3"] [data-act="rel-volta"]');
  ok(await tem('[data-rel="p3"] [data-act="rel-agendar"]'), `${nome}: volta para a lista`);
  await clicar('[data-rel="p3"] [data-act="rel-agendar"]');
  ok(await p.evaluate(() => location.hash) === '#agenda' && await p.locator('#na-p').inputValue() === 'p3', `${nome}: Agendar abre a agenda com o paciente`);

  // Interessados
  await p.evaluate(() => { location.hash = 'crm'; }); await espera();
  await p.fill('#int-nome', 'Fernanda Rocha'); await p.fill('#int-tel', '(54) 99000-0000'); await p.selectOption('#int-origem', 'Indicação'); await clicar('#f-int .btn.pri');
  const I = (await dados()).interessados;
  ok(I?.length === 1 && I[0].nome === 'Fernanda Rocha' && I[0].origem === 'Indicação' && I[0].sit === 'novo' && await tem('#rel-int .ctt', 'Fernanda Rocha'), `${nome}: interessado incluído com nome, telefone e origem`);
  await clicar('[data-int] [data-s="agendou"]');
  ok(await tem('[data-int] .chip.on', 'Agendou'), `${nome}: situação do interessado com um toque`);
  await clicar('[data-int] [data-s="paciente"]');
  ok(await p.evaluate(() => location.hash) === '#cadastro' && await p.locator('#np-name').inputValue() === 'Fernanda Rocha' && await p.locator('#np-phone').inputValue() === '(54) 99000-0000', `${nome}: Paciente abre o cadastro com nome e telefone`);
  await p.fill('#np-birth', '1990-01-01'); await p.fill('#np-q', 'Ansiedade'); await p.check('#np-lgpd'); await clicar('#f-patient button[type="submit"], #f-patient .btn.pri');
  const d = await dados(), np = d.patients.find(x => x.name === 'Fernanda Rocha');
  ok(np && d.interessados[0].sit === 'paciente' && d.interessados[0].pid === np.id, `${nome}: ao cadastrar, o interessado vira paciente`);
  await p.evaluate(() => { location.hash = 'crm'; }); await espera();
  ok(await tem('[data-int] .chip.on', 'Paciente'), `${nome}: lista mostra Paciente`);
  await p.click('[data-act="novo-paciente"]').catch(() => {});

  for (const w of [390, 360]) { await p.setViewportSize({ width:w, height:800 }); await p.goto(url + '#crm'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome} celular ${w}px: sem rolagem horizontal`); }
  ok(!erros.length, `${nome}: sem erros no console` + (erros.length ? ': ' + erros.join(' | ') : ''));
  await ctx.close();
}
const srv = await iniciar(0), base = `http://localhost:${srv.address().port}/`, browser = await chromium.launch();
await verificar(browser, base + 'index.html', 'modular');
await verificar(browser, base + 'dist/spazio.html', 'arquivo único');
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações do relacionamento passaram.');
process.exit(falhas ? 1 : 0);
