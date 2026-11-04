// Atendimento em andamento (rascunho) e finalização. Funções puras, testáveis no Node.
//
// Um rascunho fica em p.atendimentos com status 'rascunho'. Ele não aparece nas sessões (p.sessions)
// nem na exportação para o protótipo: só entra no prontuário quando é finalizado. Campos além do
// formato da etapa 2B:
//   inicio, atualizadoEm, etapas (índices das etapas abertas), sintese,
//   avaliacao:{signs, status, nota} (rascunho; vira um registro em p.avaliacoes ao finalizar),
//   vasos:{[vaso]:{considerar, nota}}, mapa:{nota}, documentos:[] (estrutura para as etapas 3 a 6),
//   finalizadoEm.
// historico registra data e hora de cada alteração; alterações seguidas na mesma etapa, em menos
// de 5 minutos, ficam num único registro com a hora da última.
import { serieQueixa } from './migracao.js';

export const VASOS = ['Chong Mai','Ren Mai','Du Mai','Dai Mai','Yin Qiao Mai','Yang Qiao Mai','Yin Wei Mai','Yang Wei Mai'];
export const ETAPAS = [['anamnese','Anamnese','folha'],['avaliacao','Avaliação energética','yin'],['pentagrama','Pentagrama','estrela'],['sintese','Síntese clínica','camadas'],
  ['mapa','Mapa corporal','corpo'],['plano','Plano terapêutico','plano'],['evolucao','Evolução','evolucao'],['documentos','Documentos','doc']];
const JUNTAR_MS = 5 * 60 * 1000;

export const rascunhoDe = p => p.atendimentos.find(a => a.status === 'rascunho') || null;
export const atendimentoDe = (p, id) => p.atendimentos.find(a => a.id === id) || null;
export const finalizados = p => p.atendimentos.filter(a => a.status === 'finalizado');

// Cria o rascunho. Intensidades começam no último valor de cada queixa ativa; os sinais começam
// nos da última avaliação (o profissional desmarca o que mudou). Sem histórico, tudo começa vazio.
export function iniciarAtendimento(p, { id, data }, em){
  const ult = p.avaliacoes.at(-1);
  const intensidades = Object.fromEntries(p.queixas.filter(q => q.ativa).map(q => [q.id, serieQueixa(p, q.id).at(-1)?.valor ?? 5]));
  const a = { id, data, status: 'rascunho', origem: 'sistema', inicio: em, atualizadoEm: em, etapas: [0],
    plano: { pontos: [], tec: [] }, evolucao: { intensidades, nota: '' }, sintese: '',
    avaliacao: { signs: ult ? [...ult.signs] : [], status: ult ? { ...ult.status } : {}, nota: '', ...registroInicial(ult) },
    vasos: {}, mapa: { nota: '' }, documentos: [], avaliacaoId: null,
    historico: [{ em, acao: 'atendimento iniciado' }] };
  p.atendimentos.push(a);
  return a;
}

// Registra uma alteração no histórico (rastreabilidade).
export function registrarAlteracao(a, acao, em){
  const fim = a.status === 'finalizado' ? `${acao} (após finalizar)` : acao;
  const u = a.historico.at(-1);
  if (u && u.acao === fim && Date.parse(em) - Date.parse(u.em) < JUNTAR_MS) u.em = em;
  else a.historico.push({ em, acao: fim });
  a.atualizadoEm = em;
}

// Avaliação que o ambiente edita: a do rascunho, ou o registro ligado a um atendimento finalizado.
export function avaliacaoEditavel(p, a){
  if (a.status === 'rascunho') return a.avaliacao;
  return p.avaliacoes.find(x => x.id === a.avaliacaoId) || null;
}

// Finaliza: o atendimento entra no prontuário (mesma posição por data que uma sessão do v1) e a
// avaliação energética vira um registro próprio, ligado a ele, se a etapa foi aberta e tem sinais.
export function finalizarAtendimento(p, a, em, idAvaliacao){
  if (a.status !== 'rascunho') return a;
  const av = a.avaliacao;
  if (a.etapas.includes(1) && av.signs.length) {
    p.avaliacoes.push({ id: idAvaliacao, date: a.data, signs: [...av.signs], status: { ...av.status }, nota: av.nota || '', ...camposRegistro(av), atendimentoId: a.id,
      historico: [{ em, acao: 'avaliação registrada no atendimento' }] });
    a.avaliacaoId = idAvaliacao;
  }
  delete a.avaliacao;
  a.status = 'finalizado'; a.finalizadoEm = em; a.atualizadoEm = em;
  a.historico.push({ em, acao: 'atendimento finalizado' });
  // Mesma regra do registro de sessão: ordem por data, estável (o mais novo fica depois no mesmo dia).
  p.atendimentos.splice(p.atendimentos.indexOf(a), 1); p.atendimentos.push(a);
  p.atendimentos.sort((x, y) => x.data.localeCompare(y.data));
  return a;
}

export function descartarRascunho(p, a){
  if (a?.status !== 'rascunho') return false;
  p.atendimentos.splice(p.atendimentos.indexOf(a), 1);
  return true;
}

// Preenchimento de cada etapa (0 a 1), usado nos anéis do cabeçalho. Indica só o que foi
// registrado; não avalia o conteúdo clínico.
export function preenchimento(p, a, i, H){
  const av = avaliacaoEditavel(p, a) || { signs: [], status: {} };
  const vis = a.etapas.includes(i) ? 1 : 0;
  const anam = Object.values(p.anam).filter(Boolean).length / Math.max(1, Object.keys(p.anam).length);
  const dec = H.filter(h => av.status[h.p.id]).length;
  return [Math.min(1, vis * .4 + anam * .6),
    av.signs.length ? .5 + .5 * (H.length ? dec / H.length : 1) : 0,
    vis,
    (Object.values(av.status).includes('aceito') ? .5 : 0) + (a.sintese ? .5 : 0),
    a.plano.pontos.length || a.mapa.nota ? 1 : vis * .5,
    (a.plano.pontos.length ? .6 : 0) + (a.plano.tec.length ? .4 : 0),
    vis * .5 + (a.evolucao.nota ? .5 : 0),
    a.status === 'finalizado' ? 1 : vis * .5][i];
}

// Estação do ano pelo mês e hemisfério (contexto sazonal, só informativo).
export function estacao(mes, hemisferio = 'Sul'){
  const sul = ['Verão','Verão','Outono','Outono','Outono','Inverno','Inverno','Inverno','Primavera','Primavera','Primavera','Verão'][mes];
  return hemisferio === 'Norte' ? { Verão:'Inverno', Inverno:'Verão', Outono:'Primavera', Primavera:'Outono' }[sul] : sul;
}
export const ELEMENTO_ESTACAO = { Primavera:'madeira', Verão:'fogo', Outono:'metal', Inverno:'agua' };

/* ---------- Etapa 3A: registro da avaliação (língua e pulso) ----------
   Campos novos dentro da avaliação (rascunho ou registro em p.avaliacoes), todos opcionais:
     achados:{[sinal]:{sit:'pos'|'neg', orig:'anamnese'|'exame'|'obs'|''}}  (língua e sinais e sintomas)
     pulso:{esq:{cls[],deficiencia,orgao,obs,pos:{cun,guan,chi}}, dir:{...}, semLado:[]}
     linguaObs, bgInterp
   Camada de compatibilidade: av.signs continua sendo a única entrada do cálculo e da exportação v1.
   Entram nela os achados "Positivo" e cada classificação de pulso marcada em pelo menos um lado,
   exatamente como um sinal marcado antes. "Negativo", "Não avaliado", origem e campos escritos não
   entram no cálculo. Avaliações antigas (só signs) são lidas sem conversão: os sinais viram achados
   positivos de origem não informada e as classificações de pulso ficam "sem lado" até o profissional
   registrá-las num lado. */
export const ORIGENS_ACHADO = [['anamnese','Anamnese'],['exame','Exame'],['obs','Observação profissional']];
export const SITUACOES_ACHADO = [['pos','Positivo'],['neg','Negativo'],['na','Não avaliado']];
export const LADOS_PULSO = [['esq','Pulso esquerdo'],['dir','Pulso direito']];
export const POSICOES_PULSO = [['cun','Cun'],['guan','Guan'],['chi','Chi']];
const ehPulso = k => k.startsWith('pulso_');
const ladoVazio = () => ({ cls: [], deficiencia: '', orgao: '', obs: '', pos: { cun: '', guan: '', chi: '' } });

// Visão do registro sem alterar a avaliação (para desenhar a tela).
export function registroDe(av){
  const achados = av.achados ? av.achados : Object.fromEntries(av.signs.filter(k => !ehPulso(k)).map(k => [k, { sit: 'pos', orig: '' }]));
  const pulso = av.pulso ? av.pulso : { esq: ladoVazio(), dir: ladoVazio(), semLado: av.signs.filter(ehPulso) };
  return { achados, pulso, linguaObs: av.linguaObs || '', bgInterp: av.bgInterp || '' };
}
// Materializa o registro na avaliação antes da primeira alteração.
export function garantirRegistro(av){
  const r = registroDe(av);
  if (!av.achados) av.achados = JSON.parse(JSON.stringify(r.achados));
  if (!av.pulso) av.pulso = JSON.parse(JSON.stringify(r.pulso));
  av.pulso.semLado ||= [];
  return av;
}
// Mantém av.signs coerente, preservando a ordem em que os sinais foram marcados.
function sincronizar(av, k, presente){
  const i = av.signs.indexOf(k);
  if (presente && i < 0) av.signs.push(k);
  else if (!presente && i >= 0) av.signs.splice(i, 1);
}
const pulsoPresente = (av, k) => ['esq','dir'].some(l => av.pulso[l].cls.includes(k)) || av.pulso.semLado.includes(k);

// Toque no achado: não avaliado → positivo → negativo → não avaliado.
export function alternarAchado(av, k, origemPadrao){
  garantirRegistro(av);
  const cur = av.achados[k], prox = { na: 'pos', pos: 'neg', neg: 'na' }[cur?.sit || 'na'];
  if (prox === 'na') delete av.achados[k]; else av.achados[k] = { sit: prox, orig: cur ? cur.orig : origemPadrao };
  sincronizar(av, k, prox === 'pos');
}
export function definirAchado(av, k, campo, valor){
  garantirRegistro(av);
  if (campo === 'sit'){ if (valor === 'na') delete av.achados[k]; else (av.achados[k] ||= { sit: valor, orig: '' }).sit = valor; sincronizar(av, k, valor === 'pos'); }
  else if (av.achados[k]) av.achados[k].orig = valor;
}
// Classificação de pulso num lado (esq, dir ou semLado, este último só para retirar).
export function alternarPulso(av, lado, k){
  garantirRegistro(av);
  const L = av.pulso[lado], i = L.cls ? L.cls.indexOf(k) : L.indexOf(k), lista = L.cls || L;
  if (i < 0) lista.push(k); else lista.splice(i, 1);
  sincronizar(av, k, pulsoPresente(av, k));
}
export function definirPulso(av, caminho, valor){
  garantirRegistro(av);
  const k = caminho.split('.'), u = k.pop(); k.reduce((o, x) => o[x], av.pulso)[u] = valor;
}
// Cópia do registro de uma avaliação anterior para um novo atendimento: situação e origem dos
// achados e classificações de pulso; os campos escritos começam vazios.
export function registroInicial(ult){
  if (!ult || !ult.achados || !ult.pulso) return {};
  const lado = l => ({ ...ladoVazio(), cls: [...ult.pulso[l].cls] });
  return { achados: JSON.parse(JSON.stringify(ult.achados)), pulso: { esq: lado('esq'), dir: lado('dir'), semLado: [...(ult.pulso.semLado || [])] } };
}
const CAMPOS_REGISTRO = ['achados','pulso','linguaObs','bgInterp','categorias','interp'];
export const camposRegistro = av => Object.fromEntries(CAMPOS_REGISTRO.filter(k => av[k] !== undefined).map(k => [k, JSON.parse(JSON.stringify(av[k]))]));

/* ---------- Etapa 3B: achados livres por categoria ----------
   av.categorias:{[cat]:{nota, itens:[{id, texto, orig, sit, sintese, plano, em}]}}
   Só registro do profissional: nada entra no cálculo, nada é sugerido e nada é encaminhado sozinho.
   A Síntese e o Plano mostram só os itens marcados pelo profissional. A lista clínica de cada
   categoria será definida pela profissional; até lá, os achados são escritos livremente. */
export const CATEGORIAS = [['zangfu','Zang-Fu'],['qixue','Qi e Xue'],['jinye','Jin Ye'],['jingshen','Jing e Shen'],['fatores','Fatores patogênicos']];
const catVazia = () => ({ nota: '', itens: [] });
export const categoriaDe = (av, c) => av.categorias?.[c] || catVazia();
const garantirCat = (av, c) => ((av.categorias ||= {})[c] ||= catVazia());
export function adicionarAchadoLivre(av, c, { id, texto, orig, sit }, em){
  const it = { id, texto, orig, sit, sintese: false, plano: false, em };
  garantirCat(av, c).itens.push(it);
  return it;
}
const itemLivre = (av, c, id) => av.categorias?.[c]?.itens.find(x => x.id === id) || null;
export function definirAchadoLivre(av, c, id, campo, valor){
  const it = itemLivre(av, c, id); if (!it) return null;
  if (campo === 'sintese' || campo === 'plano') it[campo] = !!valor; else it[campo] = valor;
  return it;
}
export function removerAchadoLivre(av, c, id){
  const L = av.categorias?.[c]?.itens, i = L ? L.findIndex(x => x.id === id) : -1;
  return i < 0 ? null : L.splice(i, 1)[0];
}
export function notaCategoria(av, c, texto){ garantirCat(av, c).nota = texto; }
// Itens que o profissional levou para a Síntese ou para o Plano, por categoria.
export const encaminhados = (av, destino) => CATEGORIAS.map(([c, nome]) => [c, nome, categoriaDe(av, c).itens.filter(x => x[destino])]).filter(x => x[2].length);

/* ---------- Etapa 3C: vasos extraordinários ----------
   Decisão de 04/11: os vasos não são achado de avaliação; são opções de tratamento, mostradas no Plano
   como dicas, com os pares de abertura e acoplado conferidos pela profissional.
   a.vasos:{[vaso]:{considerar (par incluído no plano pelo profissional), nota}}. A indicação automática
   depende dos critérios clínicos da profissional; até lá nada é sugerido. */
export const PARES_VASOS = [['Du Mai','ID3','B62'],['Ren Mai','P7','R6'],['Chong Mai','BP4','CS6'],['Dai Mai','VB41','TA5'],
  ['Yin Qiao Mai','R6','P7'],['Yang Qiao Mai','B62','ID3'],['Yin Wei Mai','CS6','BP4'],['Yang Wei Mai','TA5','VB41']];
export const vasoDe = (a, v) => ({ nota: '', considerar: false, ...(a.vasos?.[v] || {}) });
export function definirVaso(a, v, campo, valor){
  const x = ((a.vasos ||= {})[v] ||= { considerar: false, nota: '' });
  x[campo] = campo === 'considerar' ? !!valor : valor;
  return x;
}

/* ---------- Etapa 3C: versões da avaliação ----------
   Cada registro em p.avaliacoes é uma versão; nenhuma é sobrescrita por uma nova avaliação.
   A basal (a primeira por data) fica bloqueada. Uma versão ligada a um atendimento finalizado pode
   ser corrigida: antes da primeira alteração, os valores anteriores ficam guardados no histórico. */
export const versoesDe = p => p.avaliacoes.map((v, i) => [v, i]).sort((x, y) => x[0].date.localeCompare(y[0].date) || x[1] - y[1]).map(x => x[0]);
export const basalDe = p => versoesDe(p)[0] || null;
export const ehBasal = (p, av) => !!av && basalDe(p) === av;
const CAMPOS_VERSAO = ['signs','status','nota','achados','pulso','linguaObs','bgInterp','categorias','interp'];
export const fotoVersao = av => JSON.parse(JSON.stringify(Object.fromEntries(CAMPOS_VERSAO.filter(k => av[k] !== undefined).map(k => [k, av[k]]))));
export function registrarCorrecao(av, anterior, em, motivo = ''){
  (av.historico ||= []).push({ em, acao: `correção registrada${motivo ? '. Motivo: ' + motivo : ''}; valores anteriores preservados`, anterior });
}
