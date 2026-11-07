// Testes do atendimento em andamento e da finalização (js/dados/atendimento.js), sem navegador.
// Confere que o rascunho não aparece nas sessões nem no formato do protótipo, que finalizar dá o
// mesmo resultado que registrar a sessão no v1, que a avaliação fica ligada ao atendimento e que o
// histórico registra as alterações.
// Uso: node tests/atendimento.mjs
import { seed } from '../js/dados/exemplos.js';
import { hidratar, migrarV1, paraV1, registrarSessao } from '../js/dados/migracao.js';
import { editarRegistro, versaoOriginal, PARES_VASOS, basalDe, definirVaso, ehBasal, fotoVersao, registrarCorrecao, vasoDe, versoesDe, CATEGORIAS, adicionarAchadoLivre, definirAchadoLivre, encaminhados, notaCategoria, removerAchadoLivre, alternarAchado, alternarPulso, avaliacaoEditavel, definirAchado, definirPulso, descartarRascunho, estacao, finalizarAtendimento, iniciarAtendimento, preenchimento, rascunhoDe, registrarAlteracao, registroDe } from '../js/dados/atendimento.js';
import { evaluate } from '../js/raciocinio/avaliacao.js';
import { TIPOS_MARCA, adicionarMarca, atendimentosAnteriores, editarMarca, marcasDe, removerMarca, preenchimento as preench4 } from '../js/dados/atendimento.js';
import { POS, TAM, VISTAS, ladoDe, posicoes, temPosicao } from '../js/componentes/corpo.js';
import { PT, CODIGOS, NPT } from '../js/conhecimento/pontos.js';
import { bibliotecaDe, adicionarFichaParticular, removerFichaParticular, definirNotaPonto, revisaoDe, revisarPosicao } from '../js/dados/biblioteca.js';
import { corrigirPonto, definirLado, definirMotivo, definirSituacao, definirStatus, esquecerPonto, linhaRx, todosRealizados } from '../js/dados/prescricao.js';
import { trocarNomeProfissional } from '../js/dados/migracao.js';
import { MERIDIANOS, VASOS_ATLAS, TRAJETOS, trajetoDoPonto, regiaoDoToque } from '../js/componentes/corpo.js';
import { FONTE_INDICACOES, INDICADOS_REGIAO, REGIOES_CORPO, indicadosDaRegiao, regioesDoPonto, regioesDoTexto } from '../js/conhecimento/indicacoes-regiao.js';

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

// 10. Etapa 4A: mapa corporal
d = novo(); p = d.patients[0];
const v1m = J(paraV1(d));
const mp = iniciarAtendimento(p, { id: 'r20', data: '2026-11-04' }, EM);
ok(J(mp.mapa) === J({ nota: '', marcas: [] }), 'novo atendimento começa com o mapa vazio');
ok(J(VISTAS.map(v => v[0])) === J(['anterior','posterior','lat_d','lat_e','maos','pes']), 'seis vistas');
ok(J(TIPOS_MARCA.map(t => t[0])) === J(['dor','sintoma','irradiacao','limitacao','procedimento']), 'cinco tipos de marcação, com limitação funcional');
ok(ladoDe('anterior', '', 60) === 'dir' && ladoDe('posterior', '', 60) === 'esq' && ladoDe('anterior', '', 100) === 'na', 'lado do paciente na vista anterior e posterior');
ok(ladoDe('lat_d', '', 50) === 'dir' && ladoDe('lat_e', '', 150) === 'esq', 'laterais: lado fixo');
ok(ladoDe('maos', 'palmar', 60) === 'dir' && ladoDe('maos', 'dorsal', 60) === 'esq' && ladoDe('pes', 'dorsal', 60) === 'dir' && ladoDe('pes', 'plantar', 60) === 'esq', 'mãos e pés: lado conforme a face');
const tiposCriados = TIPOS_MARCA.map(([t], i) => adicionarMarca(mp, { id: 'k' + i, tipo: t, vista: 'anterior', x: .3, y: .5, lado: 'dir' }, depois(i)));
ok(tiposCriados.every(Boolean) && marcasDe(mp).length === 5 && marcasDe(mp).every(m => m.data === '2026-11-04' && m.intensidade === null), 'cria uma marcação de cada tipo, com data do atendimento');
ok(adicionarMarca(mp, { id: 'kx', tipo: 'outro', vista: 'anterior', x: .1, y: .1 }, EM) === null, 'tipo desconhecido não é aceito');
ok(adicionarMarca(mp, { id: 'k9', tipo: 'dor', vista: 'anterior', x: .3, y: .5, lado: 'bil' }, EM) && marcasDe(mp).filter(m => m.x === .3 && m.y === .5).length === 6, 'várias marcações na mesma região');
const k0 = marcasDe(mp)[0];
ok(editarMarca(mp, 'k0', 'intensidade', 7).intensidade === 7 && editarMarca(mp, 'k0', 'intensidade', 15).intensidade === 10 && editarMarca(mp, 'k0', 'intensidade', null).intensidade === null, 'intensidade de 0 a 10, e pode ficar sem valor');
ok(editarMarca(mp, 'k4', 'intensidade', 3) === null && editarMarca(mp, 'k4', 'procedimento', 'Ventosa').procedimento === 'Ventosa', 'procedimento sem intensidade e com o campo do procedimento');
ok(editarMarca(mp, 'k0', 'lado', 'bil').lado === 'bil' && editarMarca(mp, 'k0', 'lado', 'x') === null, 'lado: direito, esquerdo, bilateral ou não se aplica');
ok(editarMarca(mp, 'k0', 'regiao', 'Lombar').regiao === 'Lombar' && editarMarca(mp, 'k0', 'nota', 'piora sentada').nota === 'piora sentada', 'região e anotação');
ok(editarMarca(mp, 'k0', 'x', .9) === null && k0.x === .3, 'a posição não é alterada por edição de campo');
ok(editarMarca(mp, 'k2', 'destino', [.4, .8]).x2 === .4 && marcasDe(mp)[2].y2 === .8 && editarMarca(mp, 'k0', 'destino', [.1, .1]) === null, 'irradiação guarda origem e destino; outros tipos não');
editarMarca(mp, 'k2', 'intensidade', 6); editarMarca(mp, 'k2', 'tipo', 'procedimento');
ok(marcasDe(mp)[2].intensidade === null && marcasDe(mp)[2].x2 === undefined, 'trocar para procedimento tira a intensidade e o trajeto');
ok(removerMarca(mp, 'k9') && !marcasDe(mp).some(m => m.id === 'k9') && !removerMarca(mp, 'k9'), 'remover marcação');
ok(adicionarMarca(mp, { id: 'kf', tipo: 'dor', vista: 'maos', face: 'palmar', x: 1.4, y: -1 }, EM).x === 1 && marcasDe(mp).at(-1).y === 0 && marcasDe(mp).at(-1).face === 'palmar', 'coordenadas guardadas como fração do desenho (0 a 1)');
ok(preench4(p, mp, 4, []) === 1, 'etapa do mapa conta como preenchida com marcações');
ok(J(paraV1(d)) === v1m, 'rascunho com marcações não muda a exportação v1');
const qtd = marcasDe(mp).length;
finalizarAtendimento(p, mp, depois(30), 'av20');
ok(marcasDe(mp).length === qtd && mp.status === 'finalizado', 'ao finalizar, as marcações ficam no atendimento do prontuário');
ok(adicionarMarca(mp, { id: 'kz', tipo: 'dor', vista: 'anterior', x: .5, y: .5 }, EM) === null && editarMarca(mp, 'k0', 'intensidade', 1) === null && !removerMarca(mp, 'k0') && k0.intensidade === null, 'depois de finalizar, as marcações não mudam');
const v1f = paraV1(d).patients[0].sessions.at(-1);
ok(!('mapa' in v1f) && !J(paraV1(d)).includes('"marcas"'), 'exportação v1 sem as marcações');
const mp2 = iniciarAtendimento(p, { id: 'r21', data: '2026-11-11' }, EM);
const antM = atendimentosAnteriores(p, mp2);
ok(antM.at(-1) === mp && marcasDe(mp2).length === 0 && antM.every(x => x.status === 'finalizado'), 'atendimento seguinte compara com os anteriores sem copiar as marcações');
ok(atendimentosAnteriores(p, mp).every(x => x.data <= mp.data && x !== mp) && atendimentosAnteriores(p, mp).length === antM.length - 1, 'anteriores de um atendimento finalizado param nele');
// Posições dos pontos: só os 28 com ficha, dentro do desenho
const comPos = Object.keys(PT).filter(temPosicao);
ok(comPos.length > 0 && Object.values(POS).every(o => Object.keys(o).every(c => PT[c])), 'só pontos com ficha têm posição');
ok(Object.keys(PT).every(c => ['anterior','posterior','lat_d','maos','pes'].every(v => posicoes(c, v, v === 'maos' ? 'palmar' : v === 'pes' ? 'dorsal' : '').every(([x, y]) => x >= 0 && y >= 0 && x <= TAM[v][0] && y <= TAM[v][1]))), 'posições dentro do desenho de cada vista');
ok(posicoes('E36', 'anterior').length === 2 && posicoes('VC12', 'anterior').length === 1 && !temPosicao('TA5'), 'pontos bilaterais espelhados, linha média única, TA5 sem posição');


console.log('\n11. Etapa 4B: Biblioteca (Particular) e Atlas');
{ const d = hidratar(migrarV1(seed(), '2026-11-04T10:00:00Z', 'exemplos')), v1 = JSON.stringify(paraV1(d));
  ok(!('biblioteca' in d) && bibliotecaDe(d).particular.length === 0, 'sem uso, os dados não ganham o campo biblioteca');
  ok(adicionarFichaParticular(d, { titulo:' ', texto:'x' }, 'em', 'f0') === null, 'ficha particular exige título e texto');
  const f = adicionarFichaParticular(d, { titulo:'Protocolo', ponto:'b23', texto:'Texto' }, '2026-11-04T10:00:00Z', 'f1');
  ok(f.ponto === 'B23' && d.biblioteca.particular.length === 1, 'ficha particular gravada, código em maiúsculas');
  definirNotaPonto(d, 'E36', 'nota'); ok(d.biblioteca.notas.E36 === 'nota', 'anotação particular no ponto');
  definirNotaPonto(d, 'E36', '   '); ok(!('E36' in d.biblioteca.notas), 'anotação vazia é apagada');
  ok(removerFichaParticular(d, 'f1') && d.biblioteca.particular.length === 0 && !removerFichaParticular(d, 'f1'), 'apagar ficha particular');
  ok(JSON.stringify(paraV1(d)) === v1, 'exportação v1 igual com a Particular em uso');
  ok(CODIGOS.length === 361 && Object.values(NPT).reduce((a, b) => a + b, 0) === 361 && Object.keys(PT).every(c => CODIGOS.includes(c)), '361 códigos, incluindo os 28 com ficha');
  ok(MERIDIANOS.length === 12 && VASOS_ATLAS.length === 8 && [...MERIDIANOS, ...VASOS_ATLAS].every(k => TRAJETOS[k] && ['ant','post','lat'].some(c => TRAJETOS[k][c])), '12 meridianos e 8 vasos com trajeto aproximado');
  ok(trajetoDoPonto('VC12') === 'Ren Mai' && trajetoDoPonto('VG20') === 'Du Mai' && trajetoDoPonto('E36') === 'E', 'VC e VG seguem Ren Mai e Du Mai'); }

console.log('\n13. Etapa 4C: revisão da posição dos pontos');
{ const d = hidratar(migrarV1(seed(), '2026-11-05T10:00:00Z', 'exemplos')), v1 = JSON.stringify(paraV1(d)), pos = JSON.stringify(POS);
  ok(revisaoDe(d, 'E36') === null && !('biblioteca' in d), 'sem revisão, os dados não mudam');
  const r = revisarPosicao(d, 'E36', true, 'Maicon Farinelli', '2026-11-05T10:30:00Z');
  ok(r.ok && r.por === 'Maicon Farinelli' && r.em === '2026-11-05T10:30:00Z' && r.hist.length === 1, 'revisão grava quem e quando');
  ok(revisarPosicao(d, 'E36', true, 'X', 'Y') === null && revisaoDe(d, 'E36').por === 'Maicon Farinelli', 'revisar de novo não duplica');
  revisarPosicao(d, 'E36', false, 'Maicon Farinelli', '2026-11-05T11:00:00Z');
  ok(!revisaoDe(d, 'E36').ok && revisaoDe(d, 'E36').hist.map(h => h.acao).join('|') === 'Revisão retirada|Posição marcada como revisada', 'retirar fica no histórico, o mais recente primeiro');
  ok(JSON.stringify(POS) === pos && JSON.stringify(paraV1(d)) === v1 && bibliotecaDe(d).particular.length === 0, 'revisão não muda posições, fichas nem a exportação v1'); }

console.log('\n12. Etapa 4A: pontos indicados por região (tabela conferida)');
{ const L = Object.values(INDICADOS_REGIAO).flat();
  ok(REGIOES_CORPO.length === 20 && REGIOES_CORPO.every(r => Array.isArray(INDICADOS_REGIAO[r])) && L.length === 1030, '20 regiões e as 1030 linhas aprovadas');
  ok(L.every(([c, pg]) => CODIGOS.includes(c) && Number.isInteger(pg) && pg > 0), 'toda linha tem código válido e página do livro');
  ok(REGIOES_CORPO.every(r => new Set(INDICADOS_REGIAO[r].map(([c]) => c)).size === INDICADOS_REGIAO[r].length), 'sem ponto repetido na mesma região');
  ok(FONTE_INDICACOES.aprovadoPor === 'Maicon' && FONTE_INDICACOES.aprovadoEm === '2026-11-04' && /Martins/.test(FONTE_INDICACOES.autora), 'fonte e aprovação registradas');
  ok(indicadosDaRegiao('Ombro').length === 47 && indicadosDaRegiao('Abdome').length === 93 && indicadosDaRegiao('xyz').length === 0, 'contagem por região igual à planilha');
  ok(regioesDoTexto('dor no ombro esquerdo').join() === 'Ombro' && regioesDoTexto('LOMBAR').join() === 'Lombar e sacro' && regioesDoTexto('pé').join() === 'Tornozelo e pé' && regioesDoTexto('Pescoço e nuca').join() === 'Pescoço e nuca', 'texto da região ligado à tabela, sem acento e sem maiúsculas');
  ok(regioesDoTexto('ombro e pescoço').length === 2 && regioesDoTexto('').length === 0 && regioesDoTexto('xyz').length === 0, 'mais de uma região no texto; texto vazio ou desconhecido não liga a nada');
  ok(regioesDoPonto('E36').every(([r, pg]) => INDICADOS_REGIAO[r].some(([c, p]) => c === 'E36' && p === pg)), 'regiões de um ponto vêm da mesma tabela');
  const t = [['anterior',100,10,'Cabeça'],['anterior',100,36,'Face e dentes'],['anterior',100,60,'Pescoço e nuca'],['anterior',66,80,'Ombro'],['anterior',40,168,'Braço e cotovelo'],['anterior',30,236,'Punho e mão'],
    ['anterior',100,118,'Tórax'],['anterior',104,163,'Abdome'],['anterior',80,230,'Quadril e nádega'],['anterior',80,270,'Coxa'],['anterior',80,315,'Joelho'],['anterior',86,350,'Perna'],['anterior',90,410,'Tornozelo e pé'],
    ['posterior',100,30,'Cabeça'],['posterior',93,58,'Pescoço e nuca'],['posterior',88,120,'Costas'],['posterior',88,180,'Lombar e sacro'],['posterior',80,230,'Quadril e nádega'],
    ['lat_d',115,30,'Face e dentes'],['lat_d',90,30,'Cabeça'],['lat_d',78,130,'Costas'],['lat_d',118,130,'Tórax'],['lat_e',82,130,'Tórax'],['maos',100,100,'Punho e mão'],['pes',100,100,'Tornozelo e pé']];
  const erradas = t.filter(([v, x, y, r]) => regiaoDoToque(v, '', x, y) !== r);
  ok(!erradas.length, 'região sugerida pelo local tocado' + (erradas.length ? ': ' + erradas.map(e => e.join(' ') + ' → ' + regiaoDoToque(e[0], '', e[1], e[2])).join('; ') : ''));
  ok(regiaoDoToque('lat_d', '', 90, 150, true) === 'Braço e cotovelo' && regiaoDoToque('lat_d', '', 95, 220, true) === 'Punho e mão', 'no perfil, tocar no braço sugere braço');
  ok(REGIOES_CORPO.includes(regiaoDoToque('anterior', '', 100, 200)), 'a sugestão é sempre uma região da tabela'); }

console.log('\n14. Etapa 5: prescrição em lista curta, evolução e correção');
{ const d = hidratar(migrarV1(seed(), '2026-11-05T10:00:00Z', 'exemplos')), p = d.patients[0], v1 = JSON.stringify(paraV1(d));
  const a = iniciarAtendimento(p, { id:'at5', data:'2026-11-05' }, '2026-11-05T10:00:00Z');
  a.plano.pontos.push('BP6', 'VG20', 'IG4');
  ok(J(linhaRx(a, 'BP6')) === J({ lado:'bil', status:'plan', motivo:'' }) && linhaRx(a, 'VG20').lado === 'med' && !('rx' in a.plano), 'padrão: bilateral (linha média para VG) e planejado, sem gravar nada');
  ok(definirLado(a, 'VG20', 'uni') === null && definirLado(a, 'BP6', 'x') === null && definirLado(a, 'E36', 'uni') === null, 'lado inválido, linha média ou ponto fora do plano não mudam');
  definirLado(a, 'BP6', 'uni'); definirStatus(a, 'IG4', 'nao'); definirMotivo(a, 'IG4', 'pediu para não aplicar');
  ok(linhaRx(a, 'BP6').lado === 'uni' && linhaRx(a, 'IG4').motivo === 'pediu para não aplicar' && definirMotivo(a, 'BP6', 'x') === null, 'lado e motivo só do não realizado');
  ok(J(todosRealizados(a)) === J(['BP6','VG20']) && linhaRx(a, 'IG4').status === 'nao', 'todos realizados só nos planejados');
  definirStatus(a, 'IG4', 'real'); ok(linhaRx(a, 'IG4').motivo === '', 'sair do não realizado limpa o motivo');
  esquecerPonto(a, 'BP6'); ok(!('BP6' in a.plano.rx), 'tirar o ponto apaga o registro');
  ok(definirSituacao(a, 'q1', 'melhora') === 'melhora' && definirSituacao(a, 'q1', 'melhora') === '' && definirSituacao(a, 'q1', 'xx') === '' && !('q1' in a.evolucao.situacoes), 'situação da queixa: escolher, desmarcar, valor inválido');
  ok(corrigirPonto(a, 'IG4', { status:'nao' }, 'motivo', 'Maicon Farinelli', 'em') === null, 'rascunho não usa correção');
  finalizarAtendimento(p, a, '2026-11-05T11:00:00Z', 'av5');
  ok(corrigirPonto(a, 'IG4', { status:'plan' }, '  ', 'Maicon Farinelli', 'em') === null && corrigirPonto(a, 'IG4', { status:'real' }, 'm', 'Maicon Farinelli', 'em') === null, 'correção exige motivo e mudança');
  const mud = corrigirPonto(a, 'IG4', { lado:'uni', status:'plan' }, 'esqueci', 'Maicon Farinelli', '2026-11-05T12:00:00Z');
  ok(J(mud) === J([['Lado','Bilateral','Unilateral'],['Situação','Realizado','Planejado']]) && a.retificacoes[0].por === 'Maicon Farinelli' && a.retificacoes[0].motivo === 'esqueci' && linhaRx(a, 'IG4').lado === 'uni', 'correção guarda antes, depois, quem, quando e motivo');
  const s1 = paraV1(d).patients[0].sessions.find(x => x.id === 'at5');
  ok(J(s1.pontos) === J(['BP6','VG20','IG4']) && !J(paraV1(d)).includes('retificacoes') && !J(paraV1(d)).includes('"rx"'), 'exportação v1 só com a lista de pontos, como antes'); }
console.log('\n15. Profissional: Maicon Farinelli nos registros salvos');
{ const d = hidratar(migrarV1(seed(), '2026-11-05T10:00:00Z', 'exemplos'));
  d.patients[0].avaliacoes[0].prof = 'Mauren Turcatti'; d.patients[1].avaliacoes.forEach(v => { v.prof = 'Outra Pessoa'; });
  d.biblioteca = { particular:[], notas:{}, revisoes:{ E36:{ ok:true, por:'Mauren Turcatti', em:'x', hist:[{ acao:'a', por:'Mauren Turcatti', em:'x' }] } } };
  ok(trocarNomeProfissional(d, 'Mauren Turcatti', 'Maicon Farinelli') === 3 && d.patients[0].avaliacoes[0].prof === 'Maicon Farinelli' && d.biblioteca.revisoes.E36.hist[0].por === 'Maicon Farinelli' && d.patients[1].avaliacoes.every(v => v.prof === 'Outra Pessoa'), 'troca só o nome exato nos registros');
  ok(trocarNomeProfissional(d, 'Mauren Turcatti', 'Maicon Farinelli') === 0, 'segunda vez não muda nada'); }

// Editar atendimento salvo (07/11): motivo obrigatório, original guardado, ponto retirado sai da prescrição.
{ const d = hidratar(migrarV1(seed(), '2026-11-07T10:00:00Z')), p = d.patients[0], a = p.atendimentos.find(x => x.status === 'finalizado');
  a.plano.rx = { [a.plano.pontos[0]]: { lado:'uni', status:'real' } };
  const orig = JSON.stringify({ n:a.evolucao.nota, i:a.evolucao.intensidades, pts:a.plano.pontos });
  ok(editarRegistro(p, a, { nota:'x' }, '  ', 'Maicon', '2026-11-07T11:00:00Z') === 'Informe o motivo da edição.' && !a.edicoes, 'editar: sem motivo não altera');
  ok(editarRegistro(p, a, {}, 'nada', 'Maicon', '2026-11-07T11:00:00Z') === 'Nada foi alterado.', 'editar: sem mudança não cria edição');
  ok(preenchimento(p, a, 0, []) >= 0, 'atendimento do protótipo (sem etapas) não quebra o preenchimento');
  const r = editarRegistro(p, a, { nota:'nova', intensidades:{ ...a.evolucao.intensidades, q1:'12' }, pontos:a.plano.pontos.slice(1).concat('e36') }, 'corrigir', 'Maicon', '2026-11-07T11:00:00Z');
  ok(typeof r === 'object' && a.evolucao.nota === 'nova' && a.evolucao.intensidades.q1 === 10 && a.plano.pontos.includes('E36') && !a.plano.rx[JSON.parse(orig).pts[0]], 'editar: aplica, limita a intensidade a 10, código em maiúsculas e tira da prescrição o ponto retirado');
  const o = versaoOriginal(a);
  ok(JSON.stringify({ n:o.nota, i:o.intensidades, pts:o.pontos }) === orig && r.motivo === 'corrigir' && r.por === 'Maicon' && r.mudou.includes('evolução') && a.historico.at(-1).acao.includes('corrigir'), 'editar: original guardado inteiro, com motivo, quem e o histórico');
  editarRegistro(p, a, { nota:'nova 2' }, 'de novo', 'Maicon', '2026-11-07T12:00:00Z');
  ok(a.edicoes.length === 2 && versaoOriginal(a).nota === JSON.parse(orig).n && a.edicoes[1].antes.nota === 'nova' && p.sessions.find(s => s.id === a.id).nota === 'nova 2', 'editar: segunda edição mantém o original e guarda a versão anterior; o prontuário lê a editada');
}

console.log(falhas ? `\n${falhas} de ${total} verificações falharam.` : `\n${total} verificações do atendimento passaram.`);
process.exit(falhas ? 1 : 0);
