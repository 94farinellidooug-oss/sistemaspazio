// Regras dos relatórios (etapa 9): períodos, atendimentos (agenda + prontuário sem contar em dobro),
// faltas, recebido, pacientes novos, comparação, por serviço, por forma, evolução das queixas,
// dicas de gestão e nada gravado nem mudado na exportação v1.
// Uso: node tests/relatorios.mjs
import { seed } from '../js/dados/exemplos.js';
import { hidratar, migrarV1, paraV1, registrarSessao } from '../js/dados/migracao.js';
import { financeiroDe, novoPacote, receber } from '../js/dados/financeiro.js';
import { atendidosRel, periodoRel, relatorio } from '../js/dados/relatorios.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const HOJE = '2026-11-05';
const db = hidratar(migrarV1(seed(), 'exemplos', '2026-11-05T10:00:00Z'));
db.patients.forEach(p => { p.atendimentos = []; });
const ap = (id, pid, date, tipo, valor, extra = {}) => ({ id, pid, date, time: '09:00', tipo, valor, done: true, ...extra });
db.appts = [ap('a1', 'p1', '2026-10-02', 'Acupuntura', 180), ap('a2', 'p2', '2026-10-09', 'Auriculoterapia', 90), ap('a3', 'p1', '2026-10-16', 'Acupuntura', 180),
  ap('a4', 'p1', '2026-09-10', 'Acupuntura', 180), ap('a5', 'p3', '2026-10-20', 'Acupuntura', 180, { done: false, st: 'faltou' }), ap('a6', 'p2', '2026-10-21', 'Ventosaterapia', 150, { done: false, st: 'desmarcado' }),
  ap('a7', 'p4', '2026-11-03', 'Acupuntura', 180), ap('a8', 'p4', '2026-11-12', 'Acupuntura', 180, { done: false })];
// Prontuário: p1 em 02/10 (mesmo dia do horário: não conta de novo) e p3 em 25/10 sem horário.
registrarSessao(db.patients[0], { id: 's1', date: '2026-09-10', eva: 8, pontos: [], tec: [], nota: '' }, 'x');
registrarSessao(db.patients[0], { id: 's2', date: '2026-10-02', eva: 5, pontos: [], tec: [], nota: '' }, 'x');
registrarSessao(db.patients[2], { id: 's3', date: '2026-08-01', eva: 4, pontos: [], tec: [], nota: '' }, 'x');
registrarSessao(db.patients[2], { id: 's4', date: '2026-10-25', eva: 6, pontos: [], tec: [], nota: '' }, 'x');
const v1Antes = JSON.stringify(paraV1(db)), antes = JSON.stringify(db);

const P = periodoRel('passado', HOJE);
ok(P.meses.join() === '2026-10' && P.ant.join() === '2026-09' && P.em === 'em outubro' && P.antA === 'a setembro', 'mês passado: outubro comparado a setembro');
ok(periodoRel('mes', HOJE).em === 'em novembro (até hoje)' && periodoRel('tri', HOJE).meses.join() === '2026-09,2026-10,2026-11' && periodoRel('tri', HOJE).ant.join() === '2026-06,2026-07,2026-08', 'este mês e últimos 3 meses');
ok(periodoRel('ano', HOJE).meses.length === 11 && !periodoRel('ano', HOJE).ant.length && periodoRel('passado', '2026-01-10').meses.join() === '2025-12', 'este ano sem comparação; virada de ano');
ok(atendidosRel(db, HOJE).length === 7, 'atendimentos: agenda + prontuário, sem contar o mesmo dia em dobro e sem o futuro');

let R = relatorio(db, HOJE, 'passado');
ok(R.num.at === 4 && R.num.falt === 1 && R.num.pf === 20 && R.ant.at === 1, 'outubro: 4 atendimentos (3 na agenda + 1 só no prontuário), 1 falta (20%), setembro 1');
ok(R.num.novos === 1 && R.ant.novos === 1, 'paciente novo é quem teve o primeiro atendimento no período');
ok(R.servicos.map(s => `${s.s}:${s.q}`).join() === 'Acupuntura:2,Auriculoterapia:1,Registrado sem agenda:1' && R.servicos[0].v === 360, 'por serviço (o desmarcado não conta)');
ok(R.meses.length === 6 && R.meses.filter(m => m.on).map(m => m.m).join() === '2026-10' && R.meses.at(-1).at === 1, 'atendimentos por mês: últimos 6 com outubro em destaque');
ok(R.ev.total === 2 && R.ev.melhorou === 1 && R.ev.piorou === 1 && R.ev.igual === 0, 'evolução: compara a queixa principal da primeira e da última consulta');
ok(R.num.rec === 0 && !R.porForma.length && !R.dicas.some(d => d.k === 'receber'), 'sem financeiro: nada recebido e sem dica de receber');
ok(R.dicas.some(d => d.k === 'faltas') && R.dicas.some(d => d.k === 'livres'), 'faltas subiram: entra a dica; horários livres');

financeiroDe(db, '2026-10-01');
receber(db, 'a1', { id: 'r1', valor: 180, forma: 'Pix', data: '2026-10-02', por: 'M' });
receber(db, 'a3', { id: 'r2', valor: 100, forma: 'Dinheiro', data: '2026-10-16', por: 'M' });
novoPacote(db, { id: 'k1', pid: 'p4', serv: 'Acupuntura', total: 3, valor: 450, em: '2026-10-30', por: 'M' });
R = relatorio(db, HOJE, 'passado');
ok(R.num.rec === 730 && R.porForma.map(f => `${f.f}:${f.v}`).join() === 'Pix:180,Dinheiro:100,Pacotes:450', 'recebido por forma, com pacotes vendidos no mês');
ok(R.dicas.find(d => d.k === 'receber')?.t.replace(/\s/g, ' ').includes('R$ 170,00'), 'dica de receber com o que falta (o coberto pelo pacote não entra)');
db.appts.push(ap('a9', 'p4', '2026-11-04', 'Acupuntura', 180));
R = relatorio(db, HOJE, 'passado');
ok(R.dicas.find(d => d.k === 'pacotes')?.d.includes('falta 1'), 'pacote com 1 sessão restante vira dica de renovação');
ok(R.dicas.every(d => d.ic && d.b && ['crm', 'financeiro', 'agenda'].includes(d.ir)), 'cada dica leva a uma tela do sistema');
const T = relatorio(db, HOJE, 'tri');
ok(T.num.at === 7 && T.meses.filter(m => m.on).length === 3, 'últimos 3 meses');
db.appts.pop(); delete db.financeiro;
ok(JSON.stringify(db) === antes && JSON.stringify(paraV1(db)) === v1Antes, 'relatórios não gravam nada nos dados nem mudam a exportação v1');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as regras dos relatórios passaram.');
process.exit(falhas ? 1 : 0);
