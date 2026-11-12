// Revendedores do MUSUBI (supabase/015_revendedores.sql, pedido do Maicon em 12/11/2026): link próprio de cada
// revendedor, visitas pelo link, clínicas que vieram por ele e comissões. Só cálculos (sem tela).
// Regras combinadas: mensal = 20% das 3 primeiras mensalidades pagas; anual = 50% de uma mensalidade cheia, uma vez;
// a comissão fica liberada 7 dias depois do pagamento. Quem calcula a comissão é o servidor (gatilho no banco).
import { situacaoAssinatura } from './planos.js';

export const KEY_REVENDA = 'musubi-revenda';
export const SITE_REVENDA = 'https://musubisistema.com.br/inicio/';
export const DIAS_LINK = 60;   // a indicação vale para quem cria a conta até 60 dias depois de abrir o link
export const REGRAS_PADRAO = { pct_mensal:20, meses_mensal:3, pct_anual:50, dias_liberar:7 };
const CODIGO = /^[a-z0-9][a-z0-9-]{1,29}$/;

// "Ana Souza" -> "ana-souza"; códigos já usados ganham número no fim.
export function normalizarCodigo(s){
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
}
export const codigoValido = c => CODIGO.test(String(c || ''));
export function codigoDoNome(nome, usados = []){
  const base = normalizarCodigo(String(nome || '').trim().split(/\s+/).slice(0, 2).join(' ')) || 'revenda';
  const U = new Set(usados), b = base.length < 2 ? base + '1' : base;
  if (!U.has(b)) return b;
  for (let n = 2; ; n++) { const c = `${b.slice(0, 27)}${n}`; if (!U.has(c)) return c; }
}
export const linkRevenda = codigo => `${SITE_REVENDA}?r=${encodeURIComponent(codigo)}`;

// Código do link na página de apresentação (?r=...). Devolve o código válido ou ''.
export function codigoDaUrl(search){
  const c = normalizarCodigo(new URLSearchParams(search || '').get('r') || '');
  return codigoValido(c) ? c : '';
}
// Guardado no aparelho: { c, em }. Vale por DIAS_LINK dias.
export function revendaGuardada(texto, agora = Date.now()){
  try { const r = JSON.parse(texto || 'null'); return r && codigoValido(r.c) && agora - new Date(r.em).getTime() < DIAS_LINK * 864e5 ? r.c : ''; } catch (e) { return ''; }
}

// Situação de cada comissão: 'paga', 'cancelada', 'liberada' (pode pagar) ou 'aguardando' (dentro dos dias de espera).
export function situacaoComissao(k, agora = Date.now()){
  if (k.cancelada_em) return 'cancelada';
  if (k.paga_em) return 'paga';
  return new Date(k.libera_em).getTime() <= agora ? 'liberada' : 'aguardando';
}

// Números por revendedor. clinicas = linhas do painel_dono (para saber quem está em teste ou pagando).
export function metricasRevenda({ revendedores = [], visitas = [], clinicasRev = [], comissoes = [], clinicas = [], agora = Date.now() } = {}){
  const desde30 = new Date(agora - 30 * 864e5).toISOString().slice(0, 10);
  const porId = Object.fromEntries(clinicas.map(c => [c.id, c]));
  return revendedores.map(r => {
    const V = visitas.filter(v => v.codigo === r.codigo), C = clinicasRev.filter(x => x.revendedor_id === r.id), K = comissoes.filter(k => k.revendedor_id === r.id);
    const pagaram = new Set(K.filter(k => !k.cancelada_em).map(k => k.clinica_id));
    const emTeste = C.filter(x => { const c = porId[x.clinica_id]; return c && !pagaram.has(x.clinica_id) && situacaoAssinatura(c, agora).tipo === 'teste'; }).length;
    const contas = new Set([...C.map(x => x.clinica_id), ...K.map(k => k.clinica_id)]).size;
    const soma = s => K.filter(k => situacaoComissao(k, agora) === s).reduce((t, k) => t + k.comissao, 0);
    const visitasTotal = V.reduce((t, v) => t + v.visitas, 0);
    return { ...r, link:linkRevenda(r.codigo), visitas:visitasTotal, visitas30:V.filter(v => v.dia >= desde30).reduce((t, v) => t + v.visitas, 0),
      contas, emTeste, pagantes:pagaram.size, conversao:contas ? Math.round(pagaram.size / contas * 100) : 0,
      aPagar:soma('liberada'), aguardando:soma('aguardando'), pago:soma('paga'), comissoes:K };
  }).sort((a, b) => (b.ativo - a.ativo) || (b.aPagar - a.aPagar) || (b.contas - a.contas) || a.nome.localeCompare(b.nome));
}

// Mensagem de WhatsApp para mandar o link ao revendedor.
export const mensagemRevendedor = r => `Olá, ${String(r.nome || '').split(' ')[0]}! Este é o seu link de revendedor do MUSUBI:\n${linkRevenda(r.codigo)}\n\nQuem criar a conta por ele fica registrado como indicação sua. Mande o link junto com o material de divulgação.`;
