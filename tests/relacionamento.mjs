// Regras do relacionamento (etapa 6C): lista de retomar contato (mais de 21 dias e nada agendado),
// contato feito, não retomar sem apagar, interessados e ligação com o paciente cadastrado.
// Uso: node tests/relacionamento.mjs
import { novoHorario, desmarcar, marcarHorario } from '../js/dados/agenda.js';
import { paraV1 } from '../js/dados/migracao.js';
import { naoRetomar, novoInteressado, paraRetomar, registrarContato, situacaoInteressado, virouPaciente } from '../js/dados/relacionamento.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const HOJE = '2026-11-05';
const pac = (id, ult) => ({ id, name: id.toUpperCase(), sessions: ult ? [{ date: ult }] : [], queixas: [], atendimentos: [], avaliacoes: [] });
const db = { patients: [pac('a', '2026-10-01'), pac('b', '2026-10-20'), pac('c', '2026-09-01'), pac('d', null), pac('e', '2026-10-10')], appts: [] };

ok(paraRetomar(db, HOJE).map(x => x.p.id).join() === 'c,a,e', 'mais de 21 dias sem atendimento, do mais antigo ao mais recente');
ok(paraRetomar(db, HOJE)[0].dias === 65 && paraRetomar(db, HOJE).every(x => !x.contato && !x.oculto), 'dias desde o último atendimento');
db.appts.push(novoHorario('h1', 'a', '2026-11-10', '09:00', 'Acupuntura'));
ok(!paraRetomar(db, HOJE).some(x => x.p.id === 'a'), 'com horário agendado sai da lista');
desmarcar(db.appts[0], HOJE);
ok(paraRetomar(db, HOJE).some(x => x.p.id === 'a'), 'horário desmarcado não conta como agendado');
db.appts.push(novoHorario('h2', 'e', '2026-11-05', '10:00', 'Acupuntura')); marcarHorario(db.appts[1], 'faltou');
ok(paraRetomar(db, HOJE).some(x => x.p.id === 'e'), 'falta hoje não conta como agendado');

const c = registrarContato(db.patients[2], '2026-11-05T10:00:00Z', 'Maicon Farinelli');
ok(paraRetomar(db, HOJE)[0].contato === c && c.por === 'Maicon Farinelli', 'contato feito registra quando e quem');
registrarContato(db.patients[2], '2026-11-06T10:00:00Z', 'Maicon Farinelli');
ok(db.patients[2].relacionamento.contatos.length === 2 && paraRetomar(db, HOJE)[0].contato.em.startsWith('2026-11-06'), 'mostra o contato mais recente e guarda os anteriores');
ok(naoRetomar(db.patients[0], true, 'x', 'y') && paraRetomar(db, HOJE).find(x => x.p.id === 'a').oculto, 'não retomar só esconde');
ok(!naoRetomar(db.patients[0], false) && !paraRetomar(db, HOJE).find(x => x.p.id === 'a').oculto, 'pode voltar para a lista');
ok(!('relacionamento' in db.patients[4]), 'nada é criado em quem não foi mexido');

ok(novoInteressado(db, { id: 'i0', nome: '  ', em: 'x', por: 'y' }) === null && !db.interessados, 'sem nome não inclui e nada é criado');
const i = novoInteressado(db, { id: 'i1', nome: ' Luciana ', tel: '(54) 9', origem: 'Instagram', em: '2026-11-05T11:00:00Z', por: 'Maicon Farinelli' });
const j = novoInteressado(db, { id: 'i2', nome: 'Roberto', origem: 'TV', em: 'x', por: 'y' });
ok(db.interessados[0] === j && i.nome === 'Luciana' && i.sit === 'novo' && j.origem === 'Outro', 'interessado entra como novo; origem desconhecida vira Outro');
ok(situacaoInteressado(i, 'agendou') === 'agendou' && situacaoInteressado(i, 'xx') === null && i.sit === 'agendou', 'mudar a situação');
ok(situacaoInteressado(i, 'paciente') === null && i.sit === 'agendou', 'só vira paciente quando for cadastrado');
virouPaciente(i, 'p9');
ok(i.sit === 'paciente' && i.pid === 'p9', 'cadastro liga o interessado ao paciente');

const v1 = JSON.stringify(paraV1({ patients: [], appts: [], interessados: db.interessados }));
ok(!v1.includes('Luciana') && !v1.includes('interessados'), 'nada disso vai para a exportação v1');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações do relacionamento passaram.');
process.exit(falhas ? 1 : 0);
