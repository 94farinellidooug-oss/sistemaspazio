// Etapa 8: financeiro sem serviço externo (aprovado pelo Maicon em 05/11/2026, proposta/etapa-8).
//
// O valor combinado continua no horário da agenda (a.valor); o que entrou de fato fica à parte, em
// db.financeiro, para o horário e a exportação v1 não mudarem:
//   db.financeiro = {
//     inicio: 'aaaa-mm-dd'   (primeiro dia do mês em que o financeiro foi aberto; atendimentos antes disso
//                              não entram em A receber, para não cobrar o histórico antigo)
//     recebimentos: [{id, ap, valor, forma, data, por}]   (ap = horário da agenda; parcial é permitido)
//     pacotes: [{id, pid, serv, total, valor, em, por}]   (pago na compra; cada atendido do serviço desconta uma)
//     despesas: [{id, desc, cat, valor, data, repete, ate?, por}]   (repete = entra todo mês; ate = último mês)
//   }
// A nota fiscal (NFS-e) automática fica para a etapa 10; aqui só os dados prontos para a nota.
import { ativo } from './agenda.js';
import { brl, fmt } from '../util.js';

export const FORMAS = ['Pix', 'Dinheiro', 'Débito', 'Crédito'];
export const CATEGORIAS_DESP = ['Aluguel', 'Material', 'Contas', 'Outros'];
const mesDe = d => String(d).slice(0, 7);
const somaFin = (L, f = x => x.valor) => L.reduce((n, x) => n + f(x), 0);
const centavos = v => Math.round(v * 100) / 100;

// Lê um valor digitado ("1.150,50", "90", "R$ 40,00") como número.
export const lerValor = s => { const t = String(s ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return t ? Number(t) : NaN; };

// Estrutura do financeiro, criada na primeira vez (devolve se acabou de criar, para gravar).
export function financeiroDe(db, hoje){
  if (db.financeiro) return [db.financeiro, false];
  db.financeiro = { inicio: mesDe(hoje) + '-01', recebimentos: [], pacotes: [], despesas: [] };
  return [db.financeiro, true];
}
const F = db => db.financeiro || { inicio: '9999-12-31', recebimentos: [], pacotes: [], despesas: [] };

export const recebidoDe = (db, apId) => somaFin(F(db).recebimentos.filter(r => r.ap === apId));
// Horários atendidos cobertos por pacote: Map(horário → pacote). Cada pacote cobre, em ordem, os
// atendidos do mesmo paciente e serviço a partir da compra, sem recebimento avulso, até o total.
export function coberturaPacotes(db){
  const M = new Map(), uso = {};
  const at = db.appts.filter(a => a.done && ativo(a) && !F(db).recebimentos.some(r => r.ap === a.id)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const P = F(db).pacotes.slice().sort((a, b) => a.em.localeCompare(b.em));
  for (const a of at) { const k = P.find(k => k.pid === a.pid && k.serv === a.tipo && k.em <= a.date && (uso[k.id] || 0) < k.total);
    if (k) { M.set(a.id, k); uso[k.id] = (uso[k.id] || 0) + 1; } }
  return M;
}
export const usosPacote = (db, k, cob = coberturaPacotes(db)) => [...cob.values()].filter(x => x.id === k.id).length;
export const faltaDe = (db, a, cob = coberturaPacotes(db)) => cob.has(a.id) ? 0 : Math.max(0, centavos((a.valor || 0) - recebidoDe(db, a.id)));

// Atendimentos feitos (até hoje, desde o início do financeiro) com algo ainda a receber.
export function aReceber(db, hoje){
  const cob = coberturaPacotes(db), ini = F(db).inicio;
  return db.appts.filter(a => a.done && ativo(a) && a.date >= ini && a.date <= hoje && faltaDe(db, a, cob) > 0)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// Recebe um valor (até o que falta). Devolve o recebimento, ou um texto com o motivo de não aceitar.
export function receber(db, apId, { id, valor, forma, data, por }){
  const a = db.appts.find(x => x.id === apId), f = a ? faltaDe(db, a) : 0, v = centavos(Number(valor));
  if (!a) return 'Atendimento não encontrado';
  if (!(v > 0)) return 'Informe o valor recebido';
  if (v > f + 0.001) return `O valor passa do que falta (${brl(f)})`;
  if (!FORMAS.includes(forma)) return 'Escolha a forma de pagamento';
  const r = { id, ap: apId, valor: v, forma, data, por };
  F(db).recebimentos.push(r);
  return r;
}
export function desfazerRecebimento(db, id){
  const L = F(db).recebimentos, i = L.findIndex(r => r.id === id);
  if (i < 0) return false; L.splice(i, 1); return true;
}

export function novoPacote(db, { id, pid, serv, total, valor, em, por }){
  const t = Math.round(Number(total)), v = centavos(Number(valor));
  if (!pid || !serv || !(t > 0) || !(v > 0)) return null;
  const k = { id, pid, serv, total: t, valor: v, em, por };
  F(db).pacotes.push(k);
  return k;
}

export function novaDespesa(db, { id, desc, cat, valor, data, repete, por }){
  const d = String(desc || '').trim(), v = centavos(Number(valor));
  if (!d || !(v > 0)) return null;
  const x = { id, desc: d, cat: CATEGORIAS_DESP.includes(cat) ? cat : 'Outros', valor: v, data, repete: !!repete, por };
  F(db).despesas.push(x);
  return x;
}
const mesAnterior = m => { const [a, b] = m.split('-').map(Number); return b === 1 ? `${a - 1}-12` : `${a}-${String(b - 1).padStart(2, '0')}`; };
// Tira a despesa do mês. A que repete e veio de um mês anterior para de repetir a partir deste mês
// (os meses anteriores continuam com ela); a lançada neste mês sai de vez.
export function removerDespesa(db, id, mes){
  const L = F(db).despesas, d = L.find(x => x.id === id);
  if (!d) return false;
  if (d.repete && mesDe(d.data) < mes) d.ate = mesAnterior(mes); else L.splice(L.indexOf(d), 1);
  return true;
}
// Despesas do mês: as lançadas nele e as que repetem (no mesmo dia, até o dia 28).
export function despesasDoMes(db, mes){
  return F(db).despesas.flatMap(d => mesDe(d.data) === mes ? [d]
    : d.repete && mesDe(d.data) < mes && (!d.ate || d.ate >= mes) ? [{ ...d, data: `${mes}-${String(Math.min(28, Number(d.data.slice(8)))).padStart(2, '0')}`, repetida: true }] : [])
    .sort((a, b) => a.data.localeCompare(b.data));
}
export const recebimentosDoMes = (db, mes) => F(db).recebimentos.filter(r => mesDe(r.data) === mes).slice().reverse();

// Resumo do mês: recebido (avulsos + pacotes vendidos no mês), a receber, despesas e saldo.
export function resumoMes(db, mes, hoje){
  const rec = centavos(somaFin(recebimentosDoMes(db, mes)) + somaFin(F(db).pacotes.filter(k => mesDe(k.em) === mes)));
  const cob = coberturaPacotes(db), pend = aReceber(db, hoje), desp = despesasDoMes(db, mes);
  return { rec, aRec: centavos(somaFin(pend, a => faltaDe(db, a, cob))), pend: pend.length, desp: centavos(somaFin(desp)), nDesp: desp.length, saldo: centavos(rec - somaFin(desp)) };
}

// Dados que a nota fiscal vai pedir, prontos para copiar.
export function dadosNota(db, r){
  const a = db.appts.find(x => x.id === r.ap), p = a && db.patients.find(x => x.id === a.pid);
  return [`Paciente: ${p?.name || r.nome || ''}`, `CPF: ${p?.cadastro?.cpf || 'não cadastrado'}`, `Serviço: ${a?.tipo || r.tipo || ''}`, `Valor: ${brl(r.valor)}`, `Data do atendimento: ${a ? fmt(a.date) : ''}`, `Recebido em: ${fmt(r.data)} (${r.forma})`].join('\n');
}

// Cobrar por link (etapa 10): o link de pagamento sai na InfiniteTag da própria clínica, guardada em
// db.config.cobranca.tag. Cada link criado fica em db.financeiro.links [{id, ap, url, valor, em, por}].
// O dinheiro cai direto na conta InfinitePay da clínica; quem recebe confirma em "Receber", como sempre.
export const limparTag = t => String(t ?? '').trim().replace(/^\$/, '').replace(/^@/, '').toLowerCase();
export const tagValida = t => /^[a-z0-9][a-z0-9_.-]{1,39}$/.test(limparTag(t));
export const tagCobranca = db => db.config?.cobranca?.tag || '';
export function salvarTagCobranca(db, t){
  const tag = limparTag(t); if (tag && !tagValida(tag)) return false;
  const C = db.config ||= {};
  if (tag) C.cobranca = { ...(C.cobranca || {}), tag }; else delete C.cobranca;
  return true;
}
export const linkDe = (db, apId) => (db.financeiro?.links || []).filter(l => l.ap === apId).at(-1) || null;
export function guardarLink(db, { id, ap, url, valor, em, por }){
  const [Fin] = financeiroDe(db, em); (Fin.links ||= []).push({ id, ap, url, valor, em, por });
  return Fin.links.at(-1);
}
// Mensagem pronta para o WhatsApp do paciente.
export function textoCobranca(p, a, valor, url, clinica){
  const nome = String(p?.name || '').trim().split(/\s+/)[0] || '';
  return `Olá${nome ? ', ' + nome : ''}! Segue o link para o pagamento de ${a?.tipo || 'atendimento'}${a?.date ? ' do dia ' + fmt(a.date) : ''} (${brl(valor)}): ${url}\nO pagamento pode ser feito por Pix ou cartão de crédito.${clinica ? '\n' + clinica : ''}`;
}
