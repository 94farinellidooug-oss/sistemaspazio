// Testes da migração spazio-v1 → musubi-v2 (js/dados/migracao.js), sem navegador.
// Confere que nada se perde: o v2 convertido de volta para o v1 é idêntico ao original, inclusive
// em dados incompletos ou com campos desconhecidos; que migrar de novo dá o mesmo resultado; e que
// as telas continuam vendo sessões, avaliações e queixa no mesmo formato e ordem do v1.
// Uso: node tests/migracao.mjs
import { seed } from '../js/dados/exemplos.js';
import { ehV1, ehV2, hidratar, migrarV1, novoPaciente, paraV1, registrarAvaliacao, registrarSessao } from '../js/dados/migracao.js';

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const J = x => JSON.stringify(x);
const EM = '2026-11-03T12:00:00.000Z';
const ida = v1 => hidratar(JSON.parse(J(migrarV1(v1, EM))));   // migra e simula gravar/ler do navegador

// 1. Exemplos do sistema
const ex = seed(), v2 = ida(ex);
ok(ehV2(v2) && !ehV1(v2) && ehV1(ex) && !ehV2(ex), 'formatos reconhecidos (v1 e v2)');
ok(J(paraV1(v2)) === J(ex), 'exemplos: v2 convertido de volta é idêntico ao v1, byte a byte');
ok(v2.patients.every((p, i) => J(p.sessions) === J(ex.patients[i].sessions) && J(p.assess) === J(ex.patients[i].assess) && p.queixa === ex.patients[i].queixa),
  'telas veem sessões, avaliações e queixa iguais ao v1');
ok(JSON.parse(J(v2)).patients.every(p => !('sessions' in p) && !('assess' in p) && !('queixa' in p)), 'sessões e avaliações não são gravadas em duplicidade no v2');
ok(v2.patients.reduce((n, p) => n + p.atendimentos.length, 0) === ex.patients.reduce((n, p) => n + p.sessions.length, 0), 'cada sessão vira um atendimento finalizado');
ok(v2.patients.every(p => p.atendimentos.every(a => a.status === 'finalizado' && a.historico[0].acao === 'migrado da sessão do v1')), 'atendimentos migrados com registro de origem (rastreabilidade)');
const p1 = v2.patients[0];
ok(p1.avaliacoes[0].atendimentoId === p1.atendimentos[0].id && p1.atendimentos[0].avaliacaoId === p1.avaliacoes[0].id, 'avaliação do mesmo dia ligada ao 1º atendimento (avaliação basal)');
ok(p1.queixas.length === 1 && p1.queixas[0].descricao === ex.patients[0].queixa && p1.queixas[0].id === 'q1', 'queixa em texto vira a queixa principal q1');
ok(J(v2.appts) === J(ex.appts), 'agendamentos sem alteração');
const exAntes = J(ex); migrarV1(ex, EM); ok(J(ex) === exAntes, 'migrar não altera os dados de origem');

// 2. Idempotência: migrar o resultado convertido de volta dá o mesmo v2
ok(J(migrarV1(paraV1(v2), EM)) === J(migrarV1(ex, EM)), 'migrar de novo dá exatamente o mesmo v2');

// 3. Casos extremos
const estranho = { patients: [
  { id: 'a', name: 'Sem nada', birth: '2000-01-01', phone: '', exemplo: false, queixa: 'X', anam: {}, alerts: {}, sessions: [], assess: [] },
  { id: 'b', name: 'Só avaliação', birth: '1990-01-01', phone: '1', queixa: 'Y', anam: { sono: 'ruim' }, alerts: { gestante: true }, sessions: [],
    assess: [{ id: 'av1', date: '2026-01-01', signs: ['cansaco'], status: { bp_qi: 'aceito' }, nota: 'n' }] },
  { id: 'c', name: 'Avaliação em outro dia', birth: '1990-01-01', phone: '', queixa: 'Z', anam: {}, alerts: {}, campoNovo: { qualquer: 1 },
    sessions: [{ id: 's1', date: '2026-01-02', eva: 6, pontos: ['E36'], tec: ['Acupuntura'], nota: '' }],
    assess: [{ id: 'av2', date: '2026-01-01', signs: [], status: {}, nota: '' }, { id: 'av3', date: '2026-01-02', signs: ['tpm'], status: {}, nota: '' }] },
  { id: 'd', name: 'Sessões fora de ordem', birth: '1990-01-01', phone: '', queixa: 'W', anam: {}, alerts: {}, consentimento: '2026-01-01',
    sessions: [{ id: 's3', date: '2026-03-01', eva: 3, pontos: [], tec: [], nota: '' }, { id: 's2', date: '2026-02-01', eva: 5, pontos: [], tec: [], nota: '' }], assess: [] }
], appts: [{ id: 'x', pid: 'a', date: '2026-01-01', time: '09:00', tipo: 'Acupuntura', valor: 0, done: true }] };
const e2 = ida(estranho);
ok(J(paraV1(e2)) === J(estranho), 'casos extremos: volta idêntica ao v1 (sem sessões, só avaliação, campo desconhecido, sessões fora de ordem)');
ok(e2.patients[1].avaliacoes[0].atendimentoId === null, 'avaliação sem sessão no dia fica como reavaliação avulsa');
ok(e2.patients[2].avaliacoes[0].atendimentoId === null && e2.patients[2].avaliacoes[1].atendimentoId === 's1', 'avaliação liga só ao atendimento do mesmo dia');
ok(J(e2.patients[2].v1.extras) === J({ campoNovo: { qualquer: 1 } }), 'campo desconhecido do v1 é guardado');
ok(J(e2.patients[3].sessions.map(s => s.id)) === J(['s3', 's2']), 'ordem original das sessões é mantida na migração');
const quebrado = ida({ patients: [null, { id: 'q', name: 'Q', sessions: [null, { id: 's', date: '2026-01-01', eva: '7', pontos: null }], assess: 'x' }], appts: null });
ok(quebrado.patients.length === 1 && quebrado.patients[0].sessions.length === 1 && quebrado.patients[0].sessions[0].eva === 7 && J(quebrado.appts) === '[]', 'dados corrompidos: itens inválidos ignorados, sem erro');
ok(J(ida({ patients: [], appts: [] }).patients) === '[]', 'base vazia');

// 4. Gravações novas mantêm o comportamento do v1
const v1 = seed(), novo = ida(JSON.parse(J(v1)));
const sv1 = { id: 'n1', date: '2026-01-01', eva: 2, pontos: ['F3'], tec: ['Ventosa'], nota: 'antiga' };
v1.patients[0].sessions.push({ ...sv1 }); v1.patients[0].sessions.sort((a, b) => a.date.localeCompare(b.date));
registrarSessao(novo.patients[0], { ...sv1 }, EM);
ok(J(novo.patients[0].sessions) === J(v1.patients[0].sessions), 'nova sessão entra na mesma posição (ordem por data) que no v1');
const av = { id: 'n2', date: sv1.date, signs: ['tpm'], status: {}, nota: '' };
v1.patients[0].assess.push({ ...av }); registrarAvaliacao(novo.patients[0], { ...av }, EM);
ok(J(novo.patients[0].assess) === J(v1.patients[0].assess) && novo.patients[0].avaliacoes.at(-1).atendimentoId === 'n1', 'nova avaliação igual ao v1 e ligada ao atendimento do dia');
const np = { id: 'z', name: 'Nova', birth: '2001-01-01', phone: '', queixa: 'Dor', consentimento: '2026-11-03' };
v1.patients.push({ id: np.id, name: np.name, birth: np.birth, phone: np.phone, queixa: np.queixa, exemplo: false, consentimento: np.consentimento,
  anam: { historia: '', sono: '', alimentacao: '', evacuacao: '', emocoes: '', medicamentos: '' }, alerts: { gestante: false, anticoagulante: false, marcapasso: false }, sessions: [], assess: [] });
novo.patients.push(hidratar({ patients: [novoPaciente({ ...np, em: EM })] }).patients[0]);
ok(J(paraV1(novo)) === J(v1), 'depois de novas gravações, o v2 convertido continua idêntico ao que o v1 gravaria');

console.log(falhas ? `\n${falhas} de ${total} verificações falharam.` : `\n${total} verificações da migração passaram.`);
process.exit(falhas ? 1 : 0);
