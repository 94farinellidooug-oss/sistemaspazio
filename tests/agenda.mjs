// Regras de dados da agenda (etapa 6A): situação de cada horário, desmarcar sem apagar, remarcar com
// histórico, horários livres pela duração do serviço, aviso de horário encostado, conclusão ao
// finalizar o atendimento e exportação no formato do protótipo.
// Uso: node tests/agenda.mjs
import { SERVICOS, ativo, concluirHorario, conflito, desmarcar, fimHorario, horariosDoDia, horariosLivres, inicioSemana, marcarHorario, novoHorario, remarcar, servicoDe, situacaoHorario } from '../js/dados/agenda.js';
import { paraV1 } from '../js/dados/migracao.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const J = x => JSON.stringify(x);
const D = '2026-11-05';
const L = [novoHorario('a1', 'p1', D, '09:00', 'Acupuntura'), novoHorario('a2', 'p2', D, '10:30', 'Acupuntura e moxabustão'), novoHorario('a3', 'p3', D, '16:00', 'Ventosaterapia')];

ok(J(Object.keys(L[0])) === J(['id', 'pid', 'date', 'time', 'tipo', 'valor', 'done']) && L[0].valor === 180 && L[0].done === false, 'novo horário com os campos e a ordem do protótipo; valor vem do serviço');
ok(J(servicoDe('Ventosaterapia')) === J(['Ventosaterapia', 45, 150]) && J(servicoDe('Massagem antiga')) === J(['Massagem antiga', 60, 0]), 'duração e valor do serviço; serviço antigo vale 60 min');
ok(fimHorario(L[2]) === '16:45' && inicioSemana(D) === '2026-11-02' && inicioSemana('2026-11-08') === '2026-11-02', 'fim do horário e início da semana (segunda)');
ok(situacaoHorario(L[0]) === 'agendado', 'sem situação marcada é agendado');
ok(marcarHorario(L[0], 'confirmado') === 'confirmado' && L[0].st === 'confirmado' && !L[0].done, 'confirmar');
ok(marcarHorario(L[0], 'atendido') === 'atendido' && L[0].done === true && !('st' in L[0]), 'atendido usa done e não guarda st');
ok(marcarHorario(L[0], 'agendado') === 'agendado' && L[0].done === false && !('st' in L[0]), 'voltar a agendado limpa tudo');
ok(marcarHorario(L[0], 'xx') === null && situacaoHorario(L[0]) === 'agendado', 'situação desconhecida é ignorada');
ok(J(horariosLivres(L, D, 'Acupuntura')) === J(['08:00', '12:00', '13:00', '14:00', '15:00', '17:00', '18:00']), 'horários livres de hora em hora, sem encostar nos marcados');
ok(J(horariosLivres(L, D, 'Avaliação inicial')) === J(['12:00', '13:00', '14:00', '17:00']), 'serviço mais longo só onde cabe (até 19h)');
ok(horariosLivres(L, D, 'Acupuntura', 'a1').includes('09:00'), 'ao remarcar, o próprio horário conta como livre');
ok(conflito(L, D, '11:00', 'Acupuntura')?.id === 'a2' && conflito(L, D, '11:30', 'Acupuntura') === null && conflito(L, D, '10:00', 'Acupuntura', 'a2') === null, 'aviso de horário encostado');

desmarcar(L[2], D);
ok(L[2].st === 'desmarcado' && !ativo(L[2]) && L[2].hist[0] === 'desmarcado em 05/11/2026' && L.length === 3, 'desmarcar não apaga e guarda quando');
ok(horariosDoDia(L, D).length === 2 && horariosLivres(L, D, 'Acupuntura').includes('16:00'), 'desmarcado sai do dia e libera o horário');
ok(remarcar(L[2], '2026-11-06', '10:00', 'Ventosaterapia') && L[2].date === '2026-11-06' && !('st' in L[2]) && L[2].hist[0] === 'remarcado de 05/11/2026 16:00' && L[2].hist.length === 2, 'reagendar um desmarcado volta a agendado com histórico');
ok(!remarcar(L[2], '2026-11-06', '10:00', 'Ventosaterapia') && L[2].hist.length === 2, 'remarcar para o mesmo horário não muda nada');
ok(remarcar(L[1], D, '14:00', 'Acupuntura') && L[1].tipo === 'Acupuntura' && L[1].valor === 180, 'remarcar trocando o serviço atualiza o valor');

marcarHorario(L[0], 'faltou');
ok(concluirHorario(L, 'p1', D) === null && L[0].st === 'faltou', 'finalizar não muda quem faltou');
marcarHorario(L[0], 'confirmado');
ok(concluirHorario(L, 'p1', D)?.id === 'a1' && L[0].done === true && !('st' in L[0]), 'finalizar o atendimento conclui o horário do paciente no dia');
ok(concluirHorario(L, 'p9', D) === null, 'sem horário no dia, nada muda');

const ex = [novoHorario('b1', 'p1', D, '09:00', 'Acupuntura'), novoHorario('b2', 'p1', D, '10:00', 'Acupuntura')];
desmarcar(ex[1], D);
const v1 = paraV1({ patients: [], appts: ex });
ok(v1.appts.length === 1 && v1.appts[0].id === 'b1', 'exportação para o protótipo deixa de fora os desmarcados');
ok(SERVICOS.every(s => s.length === 3 && s[1] > 0 && s[2] > 0), 'serviços com duração e valor');

console.log(falhas ? `\n${falhas} verificações falharam.` : '\nTodas as verificações da agenda passaram.');
process.exit(falhas ? 1 : 0);
