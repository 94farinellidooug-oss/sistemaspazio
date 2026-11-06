// Excluir o cadastro de um paciente (etapa 10): sempre com motivo; sem prontuário sai de vez, com prontuário
// fica desativado até o prazo de guarda (e dá para reativar). Exemplos da clínica nova sem WhatsApp de verdade.
// Uso: node tests/excluir.mjs
import { excluirPaciente, guardarAte, reativarPaciente, temProntuario } from '../js/dados/excluir.js';
import { linkWa, numeroWa } from '../js/dados/whatsapp.js';
import { dadosNovaClinica } from '../js/dados/repositorio.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const base = () => ({
  patients:[{ id:'p1', name:'Ana Lima', atendimentos:[], avaliacoes:[] }, { id:'p2', name:'Bruno', atendimentos:[{ data:'2026-03-10', status:'finalizado' }], avaliacoes:[{ date:'2026-05-02' }] }],
  appts:[{ id:'a1', pid:'p1', tipo:'Acupuntura', date:'2026-11-01', done:true }, { id:'a2', pid:'p2', tipo:'Ventosaterapia', date:'2026-05-02', done:true }, { id:'a3', pid:'p1', tipo:'Auriculoterapia', date:'2026-11-20', done:false }, { id:'a4', pid:'p2', tipo:'Acupuntura', date:'2026-12-01', done:false }],
  financeiro:{ recebimentos:[{ id:'r1', ap:'a1', valor:180 }, { id:'r2', ap:'a2', valor:150 }], pacotes:[{ id:'k1', pid:'p1', serv:'Acupuntura' }] },
  interessados:[{ id:'i1', sit:'paciente', pid:'p1' }]
});
const op = { motivo:'Cadastro duplicado', em:'2026-11-06T10:00:00Z', por:'Maicon', hoje:'2026-11-06' };
let db = base();
ok(excluirPaciente(db, 'p1', { ...op, motivo:' ' }) === null && db.patients.length === 2, 'sem motivo não exclui');
ok(!temProntuario(db.patients[0]) && temProntuario(db.patients[1]) && !temProntuario({ ...db.patients[1], exemplo:true }), 'prontuário = atendimento finalizado, avaliação ou documento; exemplo nunca conta');
let r = excluirPaciente(db, 'p1', op);
ok(r && r.nome === 'Ana Lima' && !r.desativado && !db.patients.some(p => p.id === 'p1') && !db.appts.some(a => a.pid === 'p1') && !db.desativados, 'sem prontuário: sai de vez com os horários');
ok(db.exclusoes[0].nome === 'Ana Lima' && db.exclusoes[0].motivo === 'Cadastro duplicado' && db.exclusoes[0].por === 'Maicon', 'a exclusão fica registrada com o motivo e quem fez');
ok(db.financeiro.recebimentos[0].nome === 'Ana Lima' && db.financeiro.recebimentos[0].tipo === 'Acupuntura' && !db.financeiro.recebimentos[1].nome && db.financeiro.pacotes[0].nome === 'Ana Lima' && !db.interessados[0].pid, 'o recebido e o pacote continuam no financeiro, com o nome');
ok(guardarAte(db.patients[0], '2026-11-06') === '2046-05-02', 'guarda: 20 anos depois do último registro');
r = excluirPaciente(db, 'p2', { ...op, motivo:'Pedido do paciente' });
const D = db.desativados?.[0];
ok(r.desativado && r.guardarAte === '2046-05-02' && !db.patients.some(p => p.id === 'p2') && D?.name === 'Bruno' && D.atendimentos.length === 1 && D.desativado.motivo === 'Pedido do paciente', 'com prontuário: desativado, fora das listas, prontuário guardado');
ok(D.horarios.map(a => a.id).join() === 'a2' && !db.appts.some(a => a.pid === 'p2'), 'histórico da agenda guardado; horário futuro sai');
const p = reativarPaciente(db, 'p2');
ok(p && db.patients.some(x => x.id === 'p2') && !('desativado' in p) && !('horarios' in p) && db.appts.some(a => a.id === 'a2') && !db.desativados.length, 'reativar volta o paciente com o histórico');
ok(excluirPaciente(db, 'nada', op) === null && reativarPaciente(db, 'nada') === null, 'paciente que não existe: nada acontece');

ok(numeroWa('(00) 00000-0000') === '' && numeroWa('111.111.111-11') === '' && linkWa('(00) 00000-0000', 'oi') === '' && numeroWa('(54) 99123-4567') === '5554991234567', 'número repetido não abre o WhatsApp; número de verdade abre');
const N = dadosNovaClinica();
ok(N.patients.length > 0 && N.patients.every(p => p.exemplo && p.phone === '(00) 00000-0000' && p.cadastro.cpf === '000.000.000-00'), 'clínica nova: exemplos com WhatsApp e CPF 0000');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nExcluir paciente e exemplos da clínica nova passaram.');
process.exit(falhas ? 1 : 0);
