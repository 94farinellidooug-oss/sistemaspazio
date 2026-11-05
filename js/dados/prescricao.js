// Etapa 5: prescrição e evolução (aprovada pelo Maicon em 05/11/2026, proposta/etapa-5).
//
// Os pontos continuam em a.plano.pontos (lista de códigos), que é o que o cálculo, a verificação de
// segurança e a exportação v1 leem. Para cada ponto o profissional registra só:
//   lado: 'bil' (bilateral) | 'uni' (unilateral) | 'med' (linha média, VC e VG)
//   status: 'plan' (planejado) | 'real' (realizado) | 'nao' (não realizado), com motivo opcional.
// Fica em a.plano.rx = {[código]:{lado, status, motivo}}, criado só quando algo é marcado: ponto sem
// registro é bilateral (linha média para VC e VG) e planejado. a.plano.orient guarda as orientações
// para casa. a.evolucao.situacoes = {[queixa]: 'melhora'|'estavel'|'piora'|'resolvida'|'nova'} é
// escolha do profissional: nada é calculado nem sugerido a partir das intensidades.
// Depois de finalizado, mudar o lado ou a situação de um ponto é uma correção: exige motivo e fica em
// a.retificacoes com o valor anterior, o novo, quem, quando e o motivo.

export const LADOS_RX = [['bil','Bilateral'],['uni','Unilateral'],['med','Linha média']];
export const STATUS_RX = [['plan','Planejado'],['real','Realizado'],['nao','Não realizado']];
export const SITUACOES_QUEIXA = [['melhora','Melhora'],['estavel','Estável'],['piora','Piora'],['resolvida','Resolvida'],['nova','Nova']];
export const nomeRx = (L, k) => (L.find(x => x[0] === k) || ['', '—'])[1];
export const linhaMedia = c => /^V[CG]\d+$/.test(c);

export const linhaRx = (a, c) => ({ lado: linhaMedia(c) ? 'med' : 'bil', status: 'plan', motivo: '', ...(a.plano.rx?.[c] || {}) });
export const linhasRx = a => a.plano.pontos.map(c => [c, linhaRx(a, c)]);
function gravarRx(a, c, campos){
  if (!a.plano.pontos.includes(c)) return null;
  const r = (a.plano.rx ||= {})[c] ||= {};
  Object.assign(r, campos);
  return linhaRx(a, c);
}
export function definirLado(a, c, lado){
  if (linhaMedia(c) || !['bil','uni'].includes(lado)) return null;
  return gravarRx(a, c, { lado });
}
export function definirStatus(a, c, status){
  if (!STATUS_RX.some(s => s[0] === status)) return null;
  return gravarRx(a, c, status === 'nao' ? { status } : { status, motivo: '' });
}
export function definirMotivo(a, c, motivo){
  if (linhaRx(a, c).status !== 'nao') return null;
  return gravarRx(a, c, { motivo: String(motivo || '') });
}
// Marca como realizados só os pontos ainda planejados.
export function todosRealizados(a){
  const L = a.plano.pontos.filter(c => linhaRx(a, c).status === 'plan');
  L.forEach(c => gravarRx(a, c, { status: 'real' }));
  return L;
}
// Ao tirar um ponto do plano, o registro dele sai junto.
export function esquecerPonto(a, c){
  if (a.plano.rx) delete a.plano.rx[c];
}
export const contagemRx = a => STATUS_RX.map(([k, n]) => [k, n, linhasRx(a).filter(([, l]) => l.status === k).length]);

export function definirSituacao(a, idQueixa, sit){
  const S = a.evolucao.situacoes ||= {};
  if (!sit || S[idQueixa] === sit) delete S[idQueixa];
  else if (SITUACOES_QUEIXA.some(s => s[0] === sit)) S[idQueixa] = sit;
  return S[idQueixa] || '';
}

// Correção de um ponto num atendimento finalizado. Devolve as mudanças [campo, antes, depois] ou null.
export function corrigirPonto(a, c, { lado, status }, motivo, por, em){
  const m = String(motivo || '').trim();
  if (a.status !== 'finalizado' || !m || !a.plano.pontos.includes(c)) return null;
  const antes = linhaRx(a, c), depois = { lado: linhaMedia(c) ? 'med' : lado || antes.lado, status: status || antes.status };
  if (!['bil','uni','med'].includes(depois.lado) || !STATUS_RX.some(s => s[0] === depois.status)) return null;
  const mud = [['Lado', 'lado', LADOS_RX], ['Situação', 'status', STATUS_RX]].filter(([, k]) => antes[k] !== depois[k]).map(([n, k, L]) => [n, nomeRx(L, antes[k]), nomeRx(L, depois[k])]);
  if (!mud.length) return null;
  gravarRx(a, c, depois.status === 'nao' ? depois : { ...depois, motivo: '' });
  (a.retificacoes ||= []).unshift({ em, por, ponto: c, mud, motivo: m });
  return mud;
}
