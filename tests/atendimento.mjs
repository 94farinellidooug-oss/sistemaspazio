// Testes do atendimento em andamento e da finalização (js/dados/atendimento.js), sem navegador.
// Confere que o rascunho não aparece nas sessões nem no formato do protótipo, que finalizar dá o
// mesmo resultado que registrar a sessão no v1, que a avaliação fica ligada ao atendimento e que o
// histórico registra as alterações.
// Uso: node tests/atendimento.mjs
import { seed } from '../js/dados/exemplos.js';
import { hidratar, migrarV1, paraV1, registrarSessao } from '../js/dados/migracao.js';
import { avaliacaoEditavel, descartarRascunho, estacao, finalizarAtendimento, iniciarAtendimento, preenchimento, rascunhoDe, registrarAlteracao } from '../js/dados/atendimento.js';

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; console.log(`${cond ? 'ok   ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };
const J = x => JSON.stringify(x);
const EM = '2026-11-03T12:00:00.000Z', depois = m => new Date(Date.parse(EM) + m * 60000).toISOString();
const BASE = J(migrarV1(seed(), EM));   // um só seed: os ids dos exemplos são aleatórios
const novo = () => hidratar(JSON.parse(BASE));

// 1. Rascunho
let d = novo(), p = d.patients[0];
const antesV1 = J(paraV1(d)), nSess = p.sessions.length;
const a = iniciarAtendimento(p, { id: 'r1', data: '2026-11-03' }, EM);
ok(rascunhoDe(p) === a && a.status === 'rascunho', 'rascunho criado e encontrado');
ok(p.sessions.length === nSess && J(paraV1(d)) === antesV1, 'rascunho não aparece nas sessões nem no formato do protótipo');
ok(a.evolucao.intensidades.q1 === p.sessions.at(-1).eva, 'intensidade começa no último valor medido');
ok(J(a.avaliacao.signs) === J(p.avaliacoes.at(-1).signs) && a.avaliacao.signs !== p.avaliacoes.at(-1).signs, 'sinais começam como cópia da última avaliação');
const vazio = iniciarAtendimento(hidratar({ patients: [{ ...JSON.parse(J(d.patients[3])), atendimentos: [], avaliacoes: [] }] }).patients[0], { id: 'r0', data: '2026-11-03' }, EM);
ok(vazio.avaliacao.signs.length === 0 && vazio.evolucao.intensidades.q1 === 5, 'primeira consulta começa sem sinais e com intensidade 5');

// 2. Histórico
registrarAlteracao(a, 'plano terapêutico: pontos', depois(1));
registrarAlteracao(a, 'plano terapêutico: pontos', depois(3));
registrarAlteracao(a, 'evolução', depois(4));
registrarAlteracao(a, 'plano terapêutico: pontos', depois(20));
ok(J(a.historico.map(h => h.acao)) === J(['atendimento iniciado', 'plano terapêutico: pontos', 'evolução', 'plano terapêutico: pontos']) && a.historico[1].em === depois(3), 'histórico junta alterações seguidas na mesma etapa e guarda a hora da última');
ok(a.atualizadoEm === depois(20), 'hora da última alteração atualizada');

// 3. Finalizar = registrar sessão do v1
a.plano.pontos.push('F3', 'IG4'); a.plano.tec.push('Acupuntura'); a.evolucao.intensidades.q1 = 3; a.evolucao.nota = 'Boa resposta'; a.etapas.push(1);
a.avaliacao.status = { f_estag: 'aceito' };
const ref = novo(); registrarSessao(ref.patients[0], { id: 'r1', date: '2026-11-03', eva: 3, pontos: ['F3', 'IG4'], tec: ['Acupuntura'], nota: 'Boa resposta' }, EM);
finalizarAtendimento(p, a, depois(30), 'av-r1');
ok(J(p.sessions) === J(ref.patients[0].sessions), 'finalizado, aparece nas sessões igual a uma sessão registrada no v1');
ok(a.status === 'finalizado' && a.finalizadoEm === depois(30) && a.historico.at(-1).acao === 'atendimento finalizado' && !('avaliacao' in a), 'status, data de finalização e registro no histórico');
const av = p.avaliacoes.at(-1);
ok(av.id === 'av-r1' && av.atendimentoId === 'r1' && a.avaliacaoId === 'av-r1' && av.status.f_estag === 'aceito' && av.date === '2026-11-03', 'avaliação do atendimento vira registro próprio ligado a ele');
ok(avaliacaoEditavel(p, a) === av, 'depois de finalizar, o ambiente edita o registro da avaliação');
ok(finalizarAtendimento(p, a, depois(40), 'x') === a && p.avaliacoes.length === 2, 'finalizar de novo não duplica nada');
registrarAlteracao(a, 'evolução', depois(50));
ok(a.historico.at(-1).acao === 'evolução (após finalizar)', 'alteração depois de finalizar fica marcada no histórico');

// 4. Avaliação só entra se a etapa foi aberta
d = novo(); p = d.patients[1];
const b = iniciarAtendimento(p, { id: 'r2', data: '2026-11-03' }, EM), nAv = p.avaliacoes.length;
finalizarAtendimento(p, b, EM, 'av-r2');
ok(p.avaliacoes.length === nAv && b.avaliacaoId === null, 'sem abrir a etapa de avaliação, não cria reavaliação automática');

// 5. Ordem por data e descarte
d = novo(); p = d.patients[0];
const c = iniciarAtendimento(p, { id: 'r3', data: '2026-10-01' }, EM); finalizarAtendimento(p, c, EM, 'av3');
ok(J(p.sessions.map(s => s.date)) === J([...p.sessions.map(s => s.date)].sort()), 'atendimento com data anterior entra na posição certa');
const e = iniciarAtendimento(p, { id: 'r4', data: '2026-11-03' }, EM), n = p.atendimentos.length;
ok(descartarRascunho(p, e) && p.atendimentos.length === n - 1 && !rascunhoDe(p), 'rascunho descartado');
ok(!descartarRascunho(p, c), 'atendimento finalizado não pode ser descartado');

// 6. Preenchimento e estação
const f = iniciarAtendimento(p, { id: 'r5', data: '2026-11-03' }, EM);
ok(preenchimento(p, f, 5, []) === 0 && (f.plano.pontos.push('F3'), f.plano.tec.push('Ventosa'), preenchimento(p, f, 5, [])) === 1, 'preenchimento do plano: pontos e técnicas');
ok(estacao(10, 'Sul') === 'Primavera' && estacao(10, 'Norte') === 'Outono' && estacao(0, 'Sul') === 'Verão' && estacao(6, 'Norte') === 'Verão', 'estação pelo mês e hemisfério');

console.log(falhas ? `\n${falhas} de ${total} verificações falharam.` : `\n${total} verificações do atendimento passaram.`);
process.exit(falhas ? 1 : 0);
