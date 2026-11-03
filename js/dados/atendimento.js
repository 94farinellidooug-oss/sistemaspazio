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
    avaliacao: { signs: ult ? [...ult.signs] : [], status: ult ? { ...ult.status } : {}, nota: '' },
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
    p.avaliacoes.push({ id: idAvaliacao, date: a.data, signs: [...av.signs], status: { ...av.status }, nota: av.nota || '', atendimentoId: a.id,
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
