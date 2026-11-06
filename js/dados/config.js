// Etapa 10: Configurações da clínica (proposta aprovada pelo Maicon em 06/11/2026, proposta/etapa-10/sistema.html).
//
// Fica no mesmo documento dos dados, em db.config, criado só quando a clínica salva algo aqui
// (até lá valem os padrões de antes, e a exportação e a equivalência com o protótipo não mudam):
//   clinica:  {nome, cidade, uf, whats, end, doc}
//   servicos: [{nome, dur, valor, ativo}]   (fora de uso some da Agenda, mas continua nos horários antigos)
//   horario:  {dias:[{aberto, ini, fim}] de segunda a domingo, pausa:{tem, ini, fim}}
import { HORARIO, SERVICOS, TODOS_SERVICOS } from './agenda.js';
import { CLINICA, definirNomeClinica } from './documentos.js';

export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DURACOES = [30, 45, 60, 90, 120];
const SERV_PADRAO = SERVICOS.map(([nome, dur, valor]) => ({ nome, dur, valor, ativo:true }));
const HOR_PADRAO = JSON.parse(JSON.stringify(HORARIO));
const CLIN_PADRAO = { nome:CLINICA, cidade:'Caxias do Sul', uf:'RS', whats:'', end:'', doc:'' };
const copia = o => JSON.parse(JSON.stringify(o));
const hora = t => /^\d{2}:\d{2}$/.test(String(t));

// Configuração completa (o que foi salvo, com os padrões no que faltar).
export function configDe(db){
  const C = db.config || {};
  return {
    clinica:{ ...CLIN_PADRAO, ...(C.clinica || {}) },
    servicos:copia(C.servicos?.length ? C.servicos : SERV_PADRAO),
    horario:C.horario ? { dias:DIAS_SEMANA.map((d, i) => ({ ...HOR_PADRAO.dias[i], ...(C.horario.dias?.[i] || {}) })), pausa:{ ...HOR_PADRAO.pausa, ...(C.horario.pausa || {}) } } : copia(HOR_PADRAO)
  };
}

// Leva a configuração para onde o sistema usa: Agenda (serviços e horário) e o nome nos documentos.
export function aplicarConfig(db){
  const C = configDe(db), L = C.servicos.map(s => [s.nome, s.dur, s.valor]);
  TODOS_SERVICOS.splice(0, TODOS_SERVICOS.length, ...L);
  SERVICOS.splice(0, SERVICOS.length, ...L.filter((s, i) => C.servicos[i].ativo !== false));
  if (!SERVICOS.length) SERVICOS.push(L[0] || ['Atendimento', 60, 0]);
  HORARIO.dias.splice(0, 7, ...C.horario.dias); Object.assign(HORARIO.pausa, C.horario.pausa);
  definirNomeClinica(C.clinica.nome);
  return C;
}

// Cada função devolve uma mensagem de erro, ou '' quando salvou.
export function salvarClinica(db, D){
  const nome = String(D.nome || '').trim(), cidade = String(D.cidade || '').trim();
  if (!nome) return 'Escreva o nome da clínica.';
  if (!cidade) return 'Escreva a cidade.';
  if (!UFS.includes(D.uf)) return 'Escolha o estado.';
  const C = db.config ||= {};
  C.clinica = { nome, cidade, uf:D.uf, whats:String(D.whats || '').trim(), end:String(D.end || '').trim(), doc:String(D.doc || '').replace(/\D/g, '') };
  aplicarConfig(db); return '';
}
export function salvarServicos(db, L){
  const S = L.map(s => ({ nome:String(s.nome || '').trim(), dur:Number(s.dur) || 60, valor:Math.max(0, Math.round((Number(s.valor) || 0) * 100) / 100), ativo:s.ativo !== false }));
  if (S.some(s => !s.nome)) return 'Todo serviço precisa de um nome.';
  const nomes = S.map(s => s.nome.toLowerCase());
  if (nomes.some((n, i) => nomes.indexOf(n) !== i)) return 'Há dois serviços com o mesmo nome.';
  if (!S.some(s => s.ativo)) return 'Deixe pelo menos um serviço em uso.';
  (db.config ||= {}).servicos = S;
  aplicarConfig(db); return '';
}
export function salvarHorario(db, H){
  const min = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const dias = H.dias.map(d => ({ aberto:!!d.aberto, ini:d.ini, fim:d.fim }));
  if (!dias.some(d => d.aberto)) return 'Deixe pelo menos um dia aberto.';
  const ruim = dias.findIndex(d => d.aberto && (!hora(d.ini) || !hora(d.fim) || min(d.fim) <= min(d.ini)));
  if (ruim >= 0) return `${DIAS_SEMANA[ruim]}: o horário de fechar precisa ser depois do de abrir.`;
  const pausa = { tem:!!H.pausa.tem, ini:H.pausa.ini, fim:H.pausa.fim };
  if (pausa.tem && (!hora(pausa.ini) || !hora(pausa.fim) || min(pausa.fim) <= min(pausa.ini))) return 'O intervalo precisa terminar depois de começar.';
  (db.config ||= {}).horario = { dias, pausa };
  aplicarConfig(db); return '';
}
// "5 dias abertos · 50 horas de atendimento por semana"
export function resumoHorario(H){
  const min = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const A = H.dias.filter(d => d.aberto), p = H.pausa.tem ? Math.max(0, min(H.pausa.fim) - min(H.pausa.ini)) : 0;
  const tot = A.reduce((n, d) => { const t = Math.max(0, min(d.fim) - min(d.ini)); const corta = H.pausa.tem && min(d.ini) < min(H.pausa.fim) && min(d.fim) > min(H.pausa.ini); return n + t - (corta ? p : 0); }, 0);
  return `${A.length} dia${A.length === 1 ? '' : 's'} aberto${A.length === 1 ? '' : 's'} · ${Math.round(tot / 60)} horas de atendimento por semana`;
}
