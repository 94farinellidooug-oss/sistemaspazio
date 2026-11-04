// Testes do atendimento em andamento e da finalização (js/dados/atendimento.js), sem navegador.
// Confere que o rascunho não aparece nas sessões nem no formato do protótipo, que finalizar dá o
// mesmo resultado que registrar a sessão no v1, que a avaliação fica ligada ao atendimento e que o
// histórico registra as alterações.
// Uso: node tests/atendimento.mjs
import { seed } from '../js/dados/exemplos.js';
import { hidratar, migrarV1, paraV1, registrarSessao } from '../js/dados/migracao.js';
import { PARES_VASOS, basalDe, definirVaso, ehBasal, fotoVersao, registrarCorrecao, vasoDe, versoesDe, CATEGORIAS, adicionarAchadoLivre, definirAchadoLivre, encaminhados, notaCategoria, removerAchadoLivre, alternarAchado, alternarPulso, avaliacaoEditavel, definirAchado, definirPulso, descartarRascunho, estacao, finalizarAtendimento, iniciarAtendimento, preenchimento, rascunhoDe, registrarAlteracao, registroDe } from '../js/dados/atendimento.js';
import { evaluate } from '../js/raciocinio/avaliacao.js';

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

// 7. Etapa 3A: registro da avaliação com camada de compatibilidade
d = novo(); p = d.patients[0];
const v1Antes = J(paraV1(d));
const g = iniciarAtendimento(p, { id: 'r6', data: '2026-11-03' }, EM), gv = g.avaliacao, sig0 = [...gv.signs];
const R0 = registroDe(gv);
ok(J(gv.signs) === J(sig0) && !gv.achados && !gv.pulso, 'avaliação antiga é lida sem conversão (nada é alterado ao abrir)');
ok(sig0.filter(k => !k.startsWith('pulso_')).every(k => R0.achados[k].sit === 'pos' && R0.achados[k].orig === '') && J(R0.pulso.semLado) === J(sig0.filter(k => k.startsWith('pulso_'))), 'sinais antigos aparecem como positivos de origem não informada; pulso antigo fica sem lado');
alternarPulso(gv, 'esq', 'pulso_rapido'); alternarPulso(gv, 'dir', 'pulso_rapido');
ok(gv.signs.filter(k => k === 'pulso_rapido').length === 1, 'mesma classificação nos dois lados conta uma vez');
alternarPulso(gv, 'esq', 'pulso_rapido');
ok(gv.signs.includes('pulso_rapido'), 'retirar de um lado mantém o sinal se o outro lado ainda tem');
alternarPulso(gv, 'dir', 'pulso_rapido');
ok(!gv.signs.includes('pulso_rapido'), 'retirar dos dois lados retira o sinal');
ok(J(gv.signs) === J(sig0), 'depois de marcar e desmarcar, os sinais voltam ao que eram (ordem preservada)');
definirPulso(gv, 'esq.deficiencia', 'Yin'); definirPulso(gv, 'dir.pos.chi', 'fraco');
ok(J(gv.signs) === J(sig0) && gv.pulso.esq.deficiencia === 'Yin' && gv.pulso.dir.pos.chi === 'fraco', 'campos escritos do pulso não entram no cálculo');
alternarAchado(gv, 'zumbido', 'anamnese');
ok(gv.signs.at(-1) === 'zumbido' && gv.achados.zumbido.sit === 'pos' && gv.achados.zumbido.orig === 'anamnese', 'achado positivo entra no cálculo com a origem padrão');
alternarAchado(gv, 'zumbido', 'anamnese');
ok(!gv.signs.includes('zumbido') && gv.achados.zumbido.sit === 'neg', 'negativo fica registrado e sai do cálculo');
alternarAchado(gv, 'zumbido', 'anamnese');
ok(!gv.achados.zumbido && J(gv.signs) === J(sig0), 'terceiro toque volta a não avaliado');
definirAchado(gv, sig0.find(k => !k.startsWith('pulso_')), 'orig', 'exame');
ok(J(evaluate(gv.signs)) === J(evaluate(sig0)), 'origem não muda as hipóteses');
definirAchado(gv, 'lombalgia', 'sit', 'pos'); definirAchado(gv, 'lombalgia', 'sit', 'na');
ok(J(gv.signs) === J(sig0) && !gv.achados.lombalgia, 'situação pela lista: positivo entra, não avaliado sai');
alternarPulso(gv, 'semLado', sig0.find(k => k.startsWith('pulso_')) || 'pulso_corda');
gv.linguaObs = 'saburra fina';
ok(J(paraV1(d)) === v1Antes, 'rascunho com registro novo não muda o formato do protótipo');
g.etapas.push(1); finalizarAtendimento(p, g, EM, 'av6');
const rg = p.avaliacoes.find(x => x.id === 'av6');
ok(rg.pulso.esq.deficiencia === 'Yin' && rg.linguaObs === 'saburra fina' && rg.achados && rg.signs.length === gv.signs.length, 'finalizar leva o registro para a avaliação no musubi-v2');
ok(J(Object.keys(paraV1(d).patients[0].assess.at(-1))) === J(['id','date','signs','status','nota']), 'exportação v1 continua só com sinais, status e nota');
const h = iniciarAtendimento(p, { id: 'r7', data: '2026-11-04' }, EM);
ok(J(h.avaliacao.pulso.esq.cls) === J(rg.pulso.esq.cls) && h.avaliacao.pulso.esq.deficiencia === '' && J(h.avaliacao.achados) === J(rg.achados) && !h.avaliacao.linguaObs, 'novo atendimento traz classificações e achados; campos escritos começam vazios');

// 8. Etapa 3B: achados livres por categoria
d = novo(); p = d.patients[0];
const v1b = J(paraV1(d));
const k = iniciarAtendimento(p, { id: 'r8', data: '2026-11-04' }, EM), kv = k.avaliacao, ks = J(kv.signs);
ok(J(CATEGORIAS.map(x => x[1])) === J(['Zang-Fu','Qi e Xue','Jin Ye','Jing e Shen','Fatores patogênicos']), 'as 5 categorias na ordem aprovada');
const i1 = adicionarAchadoLivre(kv, 'jinye', { id: 'l1', texto: 'Edema leve', orig: 'exame', sit: 'pos' }, EM);
adicionarAchadoLivre(kv, 'zangfu', { id: 'l2', texto: 'Fígado em excesso', orig: 'obs', sit: 'pos' }, EM);
notaCategoria(kv, 'jingshen', 'Shen agitado');
ok(!i1.sintese && !i1.plano && encaminhados(kv, 'sintese').length === 0 && encaminhados(kv, 'plano').length === 0, 'achado novo não vai sozinho para a Síntese nem para o Plano');
ok(J(kv.signs) === ks, 'achados livres não entram no cálculo');
definirAchadoLivre(kv, 'jinye', 'l1', 'sintese', true);
ok(J(encaminhados(kv, 'sintese').map(x => [x[1], x[2].map(i => i.texto)])) === J([['Jin Ye', ['Edema leve']]]) && encaminhados(kv, 'plano').length === 0, 'Síntese recebe só o marcado, na sua categoria; o Plano continua vazio');
definirAchadoLivre(kv, 'zangfu', 'l2', 'plano', true);
ok(encaminhados(kv, 'plano').map(x => x[0]).join() === 'zangfu', 'Plano recebe só o que foi marcado para o Plano');
definirAchadoLivre(kv, 'jinye', 'l1', 'sit', 'neg'); definirAchadoLivre(kv, 'jinye', 'l1', 'orig', 'anamnese');
ok(i1.sit === 'neg' && i1.orig === 'anamnese', 'situação e origem do achado livre');
ok(J(paraV1(d)) === v1b, 'achados livres não mudam o formato do protótipo');
k.etapas.push(1); finalizarAtendimento(p, k, EM, 'av8');
const rk = p.avaliacoes.find(x => x.id === 'av8');
ok(rk.categorias.jinye.itens[0].texto === 'Edema leve' && rk.categorias.jingshen.nota === 'Shen agitado' && rk.categorias !== kv.categorias, 'finalizar leva os achados livres para a avaliação (cópia)');
ok(J(Object.keys(paraV1(d).patients[0].assess.at(-1))) === J(['id','date','signs','status','nota']), 'exportação v1 continua sem os achados livres');
ok(removerAchadoLivre(rk, 'zangfu', 'l2')?.texto === 'Fígado em excesso' && rk.categorias.zangfu.itens.length === 0 && removerAchadoLivre(rk, 'zangfu', 'x') === null, 'remoção de achado livre');
const m = iniciarAtendimento(p, { id: 'r9', data: '2026-11-05' }, EM);
ok(!m.avaliacao.categorias, 'novo atendimento começa sem achados livres');

// 9. Etapa 3C: vasos, versões e correção
d = novo(); p = d.patients[0];
const q = iniciarAtendimento(p, { id: 'r10', data: '2026-11-04' }, EM);
ok(J(PARES_VASOS.map(x => x.join(' '))) === J(['Du Mai ID3 B62','Ren Mai P7 R6','Chong Mai BP4 CS6','Dai Mai VB41 TA5','Yin Qiao Mai R6 P7','Yang Qiao Mai B62 ID3','Yin Wei Mai CS6 BP4','Yang Wei Mai TA5 VB41']), 'pares dos vasos conferidos');
definirVaso(q, 'Dai Mai', 'nota', 'peso lombar');
ok(vasoDe(q, 'Dai Mai').nota === 'peso lombar' && !vasoDe(q, 'Dai Mai').considerar && q.plano.pontos.length === 0, 'anotação do vaso não inclui pontos nem marca o vaso');
ok(vasoDe({ vasos: { 'Ren Mai': { considerar: true, nota: 'x' } } }, 'Ren Mai').considerar, 'registro anterior (considerar) continua legível');
q.etapas.push(1); finalizarAtendimento(p, q, EM, 'av10');
const V = versoesDe(p);
ok(V.length === p.avaliacoes.length && V.every((v, i) => !i || V[i - 1].date <= v.date) && basalDe(p) === V[0] && ehBasal(p, V[0]) && !ehBasal(p, V.at(-1)), 'versões em ordem de data; a primeira é a basal');
const ult = V.at(-1), antes = fotoVersao(ult);
ult.signs.push('lombalgia'); registrarCorrecao(ult, antes, EM, 'erro de digitação');
ok(ult.historico.at(-1).anterior.signs.length === ult.signs.length - 1 && /erro de digitação/.test(ult.historico.at(-1).acao), 'correção guarda os valores anteriores e o motivo no histórico');
ok(J(Object.keys(paraV1(d).patients[0].assess.at(-1))) === J(['id','date','signs','status','nota']), 'exportação v1 sem histórico de correções');

console.log(falhas ? `\n${falhas} de ${total} verificações falharam.` : `\n${total} verificações do atendimento passaram.`);
process.exit(falhas ? 1 : 0);
