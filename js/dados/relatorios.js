// Etapa 9: relatórios (aprovados pelo Maicon em 06/11/2026, proposta/etapa-9). Só leitura: tudo sai
// do que já é registrado (agenda, financeiro e atendimentos); nada é gravado e nada muda na exportação v1.
//
// Atendimento do mês = horário atendido na agenda, mais o atendimento finalizado no prontuário em um dia
// sem horário atendido daquele paciente (para contar também o que foi registrado sem agenda).
// As dicas são de gestão, nunca clínicas.
import { ativo, horariosLivres } from './agenda.js';
import { aReceber, coberturaPacotes, faltaDe, usosPacote } from './financeiro.js';
import { paraRetomar } from './relacionamento.js';
import { addDays } from '../util.js';

export const MESES_REL = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mesRel = d => d.slice(0, 7);
const somarMes = (m, n) => { const [a, b] = m.split('-').map(Number), t = a * 12 + (b - 1) + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
const faixa = (fim, n) => Array.from({ length: n }, (_, i) => somarMes(fim, i - n + 1));
export const nomeMesRel = m => MESES_REL[Number(m.slice(5, 7)) - 1];

// [chave, rótulo]
export const PERIODOS_REL = [['mes', 'Este mês'], ['passado', 'Mês passado'], ['tri', 'Últimos 3 meses'], ['ano', 'Este ano']];
// Meses do período, meses do período anterior (para comparar) e como chamar cada um.
export function periodoRel(k, hoje){
  const m = mesRel(hoje), r = PERIODOS_REL.find(p => p[0] === k) || PERIODOS_REL[1];
  if (r[0] === 'mes') return { k: 'mes', rotulo: r[1], meses: [m], ant: [somarMes(m, -1)], em: `em ${nomeMesRel(m)} (até hoje)`, antA: `a ${nomeMesRel(somarMes(m, -1))}`, antEm: `em ${nomeMesRel(somarMes(m, -1))}` };
  if (r[0] === 'tri') return { k: 'tri', rotulo: r[1], meses: faixa(m, 3), ant: faixa(somarMes(m, -3), 3), em: 'nos últimos 3 meses', antA: 'aos 3 meses antes', antEm: 'nos 3 meses antes' };
  if (r[0] === 'ano') return { k: 'ano', rotulo: r[1], meses: faixa(m, Number(m.slice(5, 7))), ant: [], em: `em ${m.slice(0, 4)}`, antA: '', antEm: '' };
  const p = somarMes(m, -1);
  return { k: 'passado', rotulo: r[1], meses: [p], ant: [somarMes(p, -1)], em: `em ${nomeMesRel(p)}`, antA: `a ${nomeMesRel(somarMes(p, -1))}`, antEm: `em ${nomeMesRel(somarMes(p, -1))}` };
}

// Atendimentos até hoje: [{pid, date, tipo|null, valor}]
export function atendidosRel(db, hoje){
  const L = db.appts.filter(a => a.done && ativo(a) && a.date <= hoje).map(a => ({ pid: a.pid, date: a.date, tipo: a.tipo, valor: a.valor || 0 }));
  const tem = new Set(L.map(a => a.pid + a.date));
  db.patients.forEach(p => p.sessions.forEach(s => { if (s.date <= hoje && !tem.has(p.id + s.date)) { L.push({ pid: p.id, date: s.date, tipo: null, valor: 0 }); tem.add(p.id + s.date); } }));
  return L;
}
const faltasRel = (db, hoje) => db.appts.filter(a => a.st === 'faltou' && a.date <= hoje);
const recebidoRel = (db, M) => { const F = db.financeiro; if (!F) return 0;
  return F.recebimentos.filter(r => M.includes(mesRel(r.data))).reduce((n, r) => n + r.valor, 0) + F.pacotes.filter(k => M.includes(mesRel(k.em))).reduce((n, k) => n + k.valor, 0); };
// Primeiro atendimento de cada paciente.
const primeiros = L => L.reduce((o, a) => { if (!o[a.pid] || a.date < o[a.pid]) o[a.pid] = a.date; return o; }, {});

// Números de um conjunto de meses.
function numerosRel(db, hoje, M, L, F, P1){
  const at = L.filter(a => M.includes(mesRel(a.date))).length, falt = F.filter(a => M.includes(mesRel(a.date))).length;
  return { at, falt, pf: at + falt ? Math.round(falt / (at + falt) * 100) : 0, rec: Math.round(recebidoRel(db, M) * 100) / 100, novos: Object.values(P1).filter(d => M.includes(mesRel(d))).length };
}

export function relatorio(db, hoje, k){
  const P = periodoRel(k, hoje), L = atendidosRel(db, hoje), F = faltasRel(db, hoje), P1 = primeiros(L), dentro = a => P.meses.includes(mesRel(a.date));
  const num = numerosRel(db, hoje, P.meses, L, F, P1), ant = P.ant.length ? numerosRel(db, hoje, P.ant, L, F, P1) : null;
  // Atendimentos por mês: o ano até agora, ou os últimos 6 meses.
  const meses = (P.k === 'ano' ? P.meses : faixa(mesRel(hoje), 6)).map(m => ({ m, at: L.filter(a => mesRel(a.date) === m).length, falt: F.filter(a => mesRel(a.date) === m).length, rec: recebidoRel(db, [m]), on: P.meses.includes(m) }));
  const porServ = {}; L.filter(dentro).forEach(a => { const s = a.tipo || 'Registrado sem agenda'; (porServ[s] ||= { s, q: 0, v: 0 }).q++; porServ[s].v += a.valor; });
  const servicos = Object.values(porServ).sort((a, b) => b.q - a.q || a.s.localeCompare(b.s));
  const formas = {}; (db.financeiro?.recebimentos || []).filter(r => P.meses.includes(mesRel(r.data))).forEach(r => { formas[r.forma] = (formas[r.forma] || 0) + r.valor; });
  const pac = (db.financeiro?.pacotes || []).filter(k => P.meses.includes(mesRel(k.em))).reduce((n, k) => n + k.valor, 0);
  const porForma = Object.entries(formas).map(([f, v]) => ({ f, v })).sort((a, b) => b.v - a.v).concat(pac ? [{ f: 'Pacotes', v: pac }] : []);
  // Evolução: pacientes atendidos no período com a queixa principal registrada em pelo menos 2 atendimentos.
  const ev = { melhorou: 0, igual: 0, piorou: 0, total: 0 };
  db.patients.forEach(p => { const S = p.sessions.filter(s => s.date <= hoje && s.eva != null);
    if (S.length < 2 || !S.some(s => P.meses.includes(mesRel(s.date)))) return;
    const d = S.at(-1).eva - S[0].eva; ev.total++; ev[d < 0 ? 'melhorou' : d > 0 ? 'piorou' : 'igual']++; });
  return { P, num, ant, meses, servicos, porForma, ev, dicas: dicasRel(db, hoje, num, ant, P) };
}

// Dicas de gestão do que dá para fazer agora; só entram as que têm o que fazer.
export function dicasRel(db, hoje, num, ant, P){
  const D = [], nome = id => db.patients.find(p => p.id === id)?.name || '';
  const ret = paraRetomar(db, hoje).filter(x => !x.oculto).length;
  if (ret) D.push({ k: 'retomar', ic: 'tel', t: `${ret} paciente${ret > 1 ? 's' : ''} sem vir há mais de 21 dias`, d: 'Sem nada agendado. Um contato pelo WhatsApp costuma trazer de volta.', b: 'Ver em Relacionamento', ir: 'crm' });
  const cob = coberturaPacotes(db), pend = aReceber(db, hoje), v = pend.reduce((n, a) => n + faltaDe(db, a, cob), 0);
  if (v > 0) D.push({ k: 'receber', ic: 'dinheiro', t: `${v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em atendimentos ainda não pagos`, d: `${pend.length} atendimento${pend.length > 1 ? 's' : ''} feito${pend.length > 1 ? 's' : ''} esperando o recebimento.`, b: 'Abrir Financeiro', ir: 'financeiro' });
  if (ant && num.falt > ant.falt) D.push({ k: 'faltas', ic: 'alerta', t: `As faltas subiram: ${num.falt} ${P.em}`, d: 'Mandar o lembrete do dia seguinte pelo WhatsApp ajuda a reduzir as faltas.', b: 'Ver lembretes de amanhã', ir: 'agenda' });
  const fim = (db.financeiro?.pacotes || []).map(k => ({ k, r: k.total - usosPacote(db, k, cob) })).filter(x => x.r >= 1 && x.r <= 2);
  if (fim.length) D.push({ k: 'pacotes', ic: 'camadas', t: `${fim.length} pacote${fim.length > 1 ? 's' : ''} perto do fim`, d: `${fim.slice(0, 3).map(x => `${nome(x.k.pid)} (falta${x.r > 1 ? 'm' : ''} ${x.r})`).join(', ')}. Bom momento para oferecer a renovação.`, b: 'Ver pacotes', ir: 'financeiro' });
  // Horários livres de uma hora nos próximos 7 dias, de segunda a sexta (o horário da clínica entra na etapa 10).
  let liv = 0; for (let i = 0; i < 7; i++) { const d = addDays(i, hoje), w = new Date(d + 'T12:00').getDay(); if (w > 0 && w < 6) liv += horariosLivres(db.appts, d, 'Acupuntura').length; }
  if (liv) D.push({ k: 'livres', ic: 'cal', t: `${liv} horários livres nos próximos 7 dias`, d: 'De segunda a sexta. Dá para oferecer a quem está para retomar ou a quem procurou e ainda não é paciente.', b: 'Abrir Agenda', ir: 'agenda' });
  return D;
}
