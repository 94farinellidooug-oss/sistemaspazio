// Conhecimento da avaliação energética enviado pelo Maicon em 18/11 (js/conhecimento/protocolos.js):
// hipóteses novas só com sinal próprio (o v1 continua igual: tests/comparar.mjs), protocolos com pontos válidos,
// "como diferenciar" e itens das listas clínicas, que já vão para a Síntese e o Plano.
// Uso: node tests/protocolos.mjs
import { CODIGOS } from '../js/conhecimento/pontos.js';
import { PATTERNS } from '../js/conhecimento/padroes.js';
import { SIGN, SIGNS } from '../js/conhecimento/sinais.js';
import { DIFERENCIAIS, PADROES_MAIS, PROTOCOLOS, SISTEMAS_ZF, SIGNS_TELA, SUBSTANCIAS, diferenciaisDe, pontosDaRef, pontosPadrao } from '../js/conhecimento/protocolos.js';
import { evaluate } from '../js/raciocinio/avaliacao.js';
import { adicionarAchadoLivre, encaminhados } from '../js/dados/atendimento.js';

let falhas = 0;
const ok = (c, m) => { console.log(`${c ? 'ok   ' : 'FALHA'} ${m}`); if (!c) falhas++; };
const ids = s => evaluate(s).map(h => h.p.id);
const EXTRAS = ['Taiyang', 'Yintang'];
const valido = c => CODIGOS.includes(c) || EXTRAS.includes(c);

ok(Object.keys(PROTOCOLOS).length === 11, '11 síndromes Zang-Fu com protocolo');
ok(Object.values(PROTOCOLOS).every(P => SISTEMAS_ZF.includes(P.sistema) && P.fisio && P.principio && P.tecnica && P.pontos.length >= 4), 'cada protocolo tem sistema, fisiopatologia, princípio, técnica e pontos');
const ruins = [...Object.values(PROTOCOLOS).flatMap(P => P.pontos.map(x => x[0])), ...SUBSTANCIAS.flatMap(s => s[2])].filter(c => !valido(c));
ok(!ruins.length, `todos os pontos existem na lista de 361 (ou são extras)${ruins.length ? ': ' + ruins.join(', ') : ''}`);
ok(Object.keys(PROTOCOLOS).every(id => [...PATTERNS, ...PADROES_MAIS].some(p => p.id === id)), 'cada protocolo corresponde a uma hipótese');
ok(SUBSTANCIAS.length === 8 && ['qixue', 'jinye', 'jingshen'].every(a => SUBSTANCIAS.some(s => s[4] === a)), '8 objetivos das substâncias nas abas Qi e Xue, Jin Ye e Jing e Shen');
ok(PADROES_MAIS.every(p => p.sinais.every(s => SIGN[s])), 'sinais das hipóteses novas têm nome');
ok(Object.values(SIGNS).flat().every(([k]) => Object.values(SIGNS_TELA).flat().some(x => x[0] === k)), 'a tela mostra todos os sinais do v1');

// Hipóteses novas só com o sinal próprio
ok(!ids(['saburra_branca', 'lingua_inchada', 'pulso_escorregadio', 'peso_corpo', 'fezes_amolecidas']).includes('bp_umid_frio'), 'sem "frio no abdome", Umidade-Frio não aparece');
ok(ids(['frio_abdome', 'saburra_branca', 'lingua_inchada', 'pulso_escorregadio']).includes('bp_umid_frio'), 'com frio no abdome, Umidade-Frio no Baço aparece');
ok(ids(['sede_fria', 'gengivas', 'saburra_amarela', 'lingua_vermelha']).includes('e_fogo'), 'Fogo no Estômago aparece com sede de água gelada e gengivas');
ok(ids(['aversao_frio', 'espirros_coriza', 'pulso_superficial']).includes('p_vento_frio'), 'Vento-Frio no Pulmão aparece com os sinais externos');

// Pontos: do protocolo quando há; senão os do v1
const um = PATTERNS.find(p => p.id === 'umid_calor');
ok(pontosPadrao(PATTERNS.find(p => p.id === 'bp_qi'))[0][0] === PROTOCOLOS.bp_qi.pontos[0][0] && pontosPadrao(um) === um.pontos, 'pontos sugeridos: protocolo do Maicon, ou os do v1 sem protocolo');
ok(pontosDaRef('zf:r_yang').moxa === 'essencial' && pontosDaRef('sub:dren_umid').pontos.map(x => x[0]).join() === 'BP9,E40,VC9' && pontosDaRef('zf:nada') === null && pontosDaRef(undefined) === null, 'pontos de um item marcado na lista');

// Como diferenciar
ok(DIFERENCIAIS.length === 4 && diferenciaisDe(['bp_qi', 'r_yang']).length === 1 && !diferenciaisDe(['bp_qi']).length, 'quadro de diferenciação só com duas síndromes do mesmo par');
ok(DIFERENCIAIS.every(d => d.ids.every(i => d.criterio[i])), 'cada síndrome do quadro tem o critério');

// Item da lista: vai para Síntese e Plano; o livre continua só com o profissional
const av = {};
adicionarAchadoLivre(av, 'zangfu', { id:'a', texto:'Deficiência de Qi do Baço', orig:'exame', sit:'pos', ref:'zf:bp_qi' }, 'x');
adicionarAchadoLivre(av, 'zangfu', { id:'b', texto:'Livre', orig:'exame', sit:'pos' }, 'x');
ok(av.categorias.zangfu.itens[0].ref === 'zf:bp_qi' && av.categorias.zangfu.itens[0].plano && !('ref' in av.categorias.zangfu.itens[1]) && !av.categorias.zangfu.itens[1].plano, 'item da lista já vai para Síntese e Plano; achado livre não');
ok(encaminhados(av, 'plano')[0][2].length === 1, 'só o item da lista aparece no Plano');

console.log(falhas ? `\n${falhas} falha(s)` : '\nConhecimento da avaliação: tudo certo');
process.exit(falhas ? 1 : 0);
