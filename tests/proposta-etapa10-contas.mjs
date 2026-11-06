// Verifica no navegador a proposta navegável de contas, equipe e configurações (proposta/etapa-10/sistema.html):
// primeiro acesso em 3 passos levando os dados do aparelho, equipe com convite e perfis prontos, troca de
// clínica no topo (o perfil muda o que aparece), configurações (clínica, serviços, horário, conta) e a lista
// de interessados; celular sem rolagem horizontal e sem erros no console.
// Uso: node tests/proposta-etapa10-contas.mjs   (requer Playwright e Chromium)
import { createRequire } from 'node:module';
import { iniciar } from '../tools/servidor.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const srv = await iniciar(0);
const U = `http://localhost:${srv.address().port}/proposta/etapa-10/sistema.html`;
const browser = await chromium.launch();
const erros = [];
const p = await (await browser.newContext({ viewport:{ width:1366, height:900 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const espera = () => p.waitForTimeout(60), clicar = async s => { await p.click(s); await espera(); };
const tem = async (s, t) => (await p.locator(s, t ? { hasText:t } : {}).count()) > 0;
const ir = async h => { await p.evaluate(x => { location.hash = x; }, h); await espera(); };

// Primeiro acesso
await p.goto(U + '#/primeiro-acesso'); await espera();
ok(await p.locator('#app').isHidden() && await tem('.p10-steps li.on', 'Sua conta'), 'primeiro acesso em tela cheia, passo 1');
await clicar('#pa-ok');
ok(await tem('#pa-erro', 'nome'), 'pede o nome');
await p.fill('[name=nome]', 'Maicon Farinelli'); await p.fill('[name=email]', 'maicon@clinica.com.br'); await p.fill('[name=senha]', '123'); await clicar('#pa-ok');
ok(await tem('#pa-erro', '8 caracteres'), 'senha curta avisa');
await p.fill('[name=senha]', '12345678'); await clicar('#pa-ok');
ok(await tem('.p10-steps li.on', 'Sua clínica') && await tem('.p10-steps li.feito'), 'passo 2: clínica');
await p.fill('[name=clinica]', 'Spazio Stabilità'); await p.fill('[name=cidade]', 'Caxias do Sul');
await clicar('[data-a=voltar]');
ok(await p.inputValue('[name=email]') === 'maicon@clinica.com.br', 'voltar guarda o que já foi escrito');
await p.fill('[name=senha]', '12345678'); await clicar('#pa-ok');
ok(await p.inputValue('[name=clinica]') === 'Spazio Stabilità', 'e o passo 2 também'); await clicar('#pa-ok');
ok(await tem('.p10-acha', 'Encontramos dados') && await p.isChecked('[data-a=levar][value="1"]'), 'passo 3: levar os dados do aparelho vem marcado');
await clicar('#pa-ok');
ok(p.url().endsWith('#/administracao') && await tem('#toast', 'Seus dados agora estão na sua conta'), 'entra no sistema com os dados levados');

// Administração e equipe
ok(await p.locator('.adm-c').count() === 5 && await tem('.adm-c[data-c=interessados] .pill', '2 novos'), 'administração com equipe, configurações e interessados');
await clicar('.adm-c[data-c=equipe]');
ok(await p.locator('.p10-u').count() === 3 && await p.locator('.p10-tr').count() === 9, 'equipe e tabela de permissões');
await clicar('[data-a=convidar]'); await clicar('#f-conv [type=submit]');
ok(await tem('#conv-erro', 'nome'), 'convite pede o nome');
await p.fill('#f-conv [name=nome]', 'Bruna Dias'); await p.fill('#f-conv [name=email]', 'ana.ribeiro@email.com'); await clicar('#f-conv [type=submit]');
ok(await tem('#conv-erro', 'já está na equipe'), 'não convida o mesmo e-mail duas vezes');
await p.fill('#f-conv [name=email]', 'bruna@email.com'); await p.selectOption('#f-conv [name=perfil]', 'rec'); await clicar('#f-conv [type=submit]');
ok(await p.locator('.p10-u').count() === 4 && await tem('.p10-u', 'Bruna Dias') && await tem('#toast', 'bruna@email.com'), 'convite enviado entra na lista');
await clicar('.p10-u[data-u=u2] [data-a=tirar]');
ok(await tem('.p10-u[data-u=u2] .pill', 'sem acesso') && await tem('#toast', 'registros continuam'), 'tirar acesso não apaga nada');
await p.selectOption('[data-a=perfil][data-u=u2]', 'adm'); await espera();
ok(await tem('#toast', 'agora é Administrador') && await p.isDisabled('[data-a=perfil][data-u=u1]'), 'muda o perfil; o próprio administrador não se rebaixa');

// Troca de clínica
await clicar('[data-a=conta]');
ok(await p.locator('.p10-menu [data-a=clinica]').count() === 2, 'topo mostra as clínicas da pessoa');
await clicar('.p10-menu [data-k=equilibrio]');
ok(await tem('.p10-cn small', 'Clínica Equilíbrio') && await p.locator('.adm-c').count() === 3 && await tem('.p10-n', 'Profissional'), 'como profissional, sem equipe nem interessados');
await clicar('.adm-c[data-c=configuracoes]');
ok(await p.locator('.tabs [role=tab]').count() === 1 && await tem('.tabs .on', 'Sua conta'), 'profissional só vê a própria conta');
await clicar('[data-a=conta]'); await clicar('.p10-menu [data-k=spazio]');

// Configurações
await ir('#/configuracoes');
await p.fill('#f-clinica [name=cidade]', ''); await clicar('#f-clinica [type=submit]');
ok(await tem('#cl-erro', 'cidade'), 'clínica pede a cidade');
await p.fill('#f-clinica [name=cidade]', 'Caxias do Sul'); await p.fill('#f-clinica [name=nome]', 'Spazio Stabilità Clínica'); await clicar('#f-clinica [type=submit]');
ok(await tem('#nav .brand small', 'Spazio Stabilità Clínica'), 'nome da clínica salvo aparece no menu');
await clicar('[data-a=aba][data-k=servicos]');
ok(await p.locator('#cfg-serv .p10-s:not(.p10-sh)').count() === 5, 'cinco serviços');
await p.fill('[data-a=serv-campo][data-k=valor][data-s=s0]', '195,5'); await p.press('[data-a=serv-campo][data-k=valor][data-s=s0]', 'Tab'); await espera();
ok(await p.inputValue('[data-a=serv-campo][data-k=valor][data-s=s0]') === '195,50' && await tem('#toast', 'R$'), 'valor do serviço salvo em reais');
await clicar('[data-a=serv-novo]');
ok(await p.locator('#cfg-serv .p10-s:not(.p10-sh)').count() === 6, 'novo serviço');
await clicar('[data-a=aba][data-k=horario]');
ok(await tem('#hor-resumo', '6 dias abertos'), 'horário: segunda a sábado');
await clicar('[data-a=dia][data-d="5"]');
ok(await tem('#hor-resumo', '5 dias abertos') && await tem('.p10-h[data-d="5"]', 'fechado'), 'fechar um dia');
await clicar('[data-a=aba][data-k=conta]');
ok(await tem('#seg', 'Cada clínica só enxerga os próprios dados') && await tem('#seg [data-a=baixar]'), 'conta e segurança com baixar os dados');

// Interessados
await ir('#/interessados');
ok(await p.locator('.p10-i').count() === 4, 'quatro interessados');
await clicar('[data-a=filtro][data-k=novo]');
ok(await p.locator('.p10-i').count() === 2, 'filtro de novos');
const href = await p.getAttribute('.p10-i [data-a=chamar] >> nth=0', 'href');
ok(href.startsWith('https://wa.me/55519888') && decodeURIComponent(href).includes('Carla'), 'chamar abre o WhatsApp com a mensagem pronta');
await clicar('.p10-i [data-a=chamar] >> nth=0');
ok(await p.locator('.p10-i').count() === 1, 'quem foi chamado sai de novos');

for (const w of [390, 360]) {
  const m = await (await browser.newContext({ viewport:{ width:w, height:800 } })).newPage();
  m.on('pageerror', e => erros.push(e.message));
  for (const r of ['administracao', 'equipe', 'configuracoes', 'interessados', 'primeiro-acesso']) {
    await m.goto(`${U}#/${r}`); await m.waitForTimeout(80);
    const sw = await m.evaluate(() => document.documentElement.scrollWidth);
    if (sw > w) ok(false, `${w}px ${r}: rolagem horizontal (${sw})`);
  }
  ok(true, `${w}px: telas sem rolagem horizontal`);
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close(); srv.close();
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nA proposta de contas, equipe e configurações passou.');
process.exit(falhas ? 1 : 0);
