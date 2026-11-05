// Regras do WhatsApp (etapa 7A): número para o link, mensagem pronta preenchida, mensagens prontas
// editáveis com volta ao original, registro de quando a mensagem foi aberta e nada na exportação v1.
// Uso: node tests/whatsapp.mjs
import { seed } from '../js/dados/exemplos.js';
import { hidratar, migrarV1, paraV1 } from '../js/dados/migracao.js';
import { MENSAGENS_WA, lembreteDe, linkWa, mensagemWa, mensagensWa, numeroWa, preencherWa, registrarMensagem, salvarMensagemWa, valoresWa, voltarMensagemWa } from '../js/dados/whatsapp.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const db = hidratar(migrarV1(seed(), 'exemplos', '2026-11-05T10:00:00Z'));
const P = db.patients[0], v1Antes = JSON.stringify(paraV1(db));

ok(numeroWa('(54) 99981-1201') === '5554999811201' && numeroWa('5499981120') === '555499981120' && numeroWa('+55 54 99981-1201') === '5554999811201', 'número com DDD vira 55 + DDD + número');
ok(numeroWa('') === '' && numeroWa('9981-1201') === '' && linkWa('', 'oi') === '', 'sem DDD ou sem telefone, não há link');
ok(linkWa('(54) 99981-1201', 'Olá, Ana!\n\nAté amanhã & obrigado') === 'https://wa.me/5554999811201?text=Ol%C3%A1%2C%20Ana!%0A%0AAt%C3%A9%20amanh%C3%A3%20%26%20obrigado', 'texto vai codificado no link');
const a = { id:'x', pid:P.id, date:'2026-11-06', time:'08:00', tipo:'Acupuntura e moxabustão' };
const v = valoresWa(P, a, { hoje:'2026-11-05', amanha:'2026-11-06', clinica:'Spazio Stabilità', prof:'Maicon Farinelli' });
ok(preencherWa(mensagemWa('lembrete')[2], v) === `Olá, ${P.name.split(' ')[0]}! Passando para lembrar do seu horário de acupuntura e moxabustão amanhã, às 08:00, na Spazio Stabilità. Pode confirmar por aqui?`, 'lembrete com serviço, amanhã, hora e clínica');
ok(valoresWa(P, { ...a, date:'2026-11-05' }, { hoje:'2026-11-05', amanha:'2026-11-06' }).quando === 'hoje' && valoresWa(P, { ...a, date:'2026-11-20' }, { hoje:'2026-11-05', amanha:'2026-11-06' }).quando === 'no dia 20/11/2026', 'hoje, amanhã ou a data');
ok(preencherWa('{primeiro} {xx}', v) === `${P.name.split(' ')[0]} {xx}`, 'chave desconhecida fica como está');

ok(salvarMensagemWa(db, 'lembrete', '   ', 'e', 'p') === null && !db.mensagensWa, 'texto vazio não salva e nada é criado');
ok(salvarMensagemWa(db, 'lembrete', 'Oi, {primeiro}! Até {quando} às {hora}.', '2026-11-05T21:00:00Z', 'Maicon Farinelli') === 'lembrete' && mensagemWa('lembrete', db.mensagensWa)[3] === 'editada' && db.mensagensWa.lembrete.por === 'Maicon Farinelli', 'mensagem pronta salva como sua');
ok(preencherWa(mensagemWa('lembrete', db.mensagensWa)[2], v) === `Oi, ${P.name.split(' ')[0]}! Até amanhã às 08:00.`, 'usa a mensagem salva');
ok(salvarMensagemWa(db, 'xx', 'a', 'e', 'p') === null, 'mensagem desconhecida não salva');
salvarMensagemWa(db, 'retomar', MENSAGENS_WA[1][2], 'e', 'p');
ok(!db.mensagensWa.retomar && mensagensWa(db.mensagensWa).length === 4, 'salvar igual ao original não vira versão própria');
ok(voltarMensagemWa(db, 'lembrete') && mensagemWa('lembrete', db.mensagensWa)[3] === 'original' && !voltarMensagemWa(db, 'lembrete'), 'voltar ao texto original');

ok(registrarMensagem(P, { tipo:'xx', em:'e', por:'p' }) === null && !P.relacionamento, 'tipo desconhecido não registra e nada é criado');
const m1 = registrarMensagem(P, { tipo:'lembrete', em:'2026-11-05T21:05:00Z', por:'Maicon Farinelli', ap:'x' });
registrarMensagem(P, { tipo:'retomar', em:'2026-11-05T21:06:00Z', por:'Maicon Farinelli' });
ok(P.relacionamento.mensagens.length === 2 && P.relacionamento.mensagens[1] === m1 && !('ap' in P.relacionamento.mensagens[0]), 'registra tipo, quando e quem, mais recente primeiro');
ok(lembreteDe(P, 'x') === m1 && lembreteDe(P, 'y') === null && lembreteDe(null, 'x') === null, 'sabe se o lembrete do horário foi aberto');

const v1 = JSON.stringify(paraV1(db));
ok(v1 === v1Antes, 'mensagens e registros não mudam a exportação v1');
console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações do WhatsApp passaram.');
process.exit(falhas ? 1 : 0);
