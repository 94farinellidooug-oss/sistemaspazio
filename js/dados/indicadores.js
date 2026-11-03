// Indicadores e avisos calculados só a partir dos dados gravados (pacientes, sessões, avaliações e agenda).
// Não cria números: se um dado não existe, o indicador não aparece.
import { db, patient } from './repositorio.js';
import { TODAY, fmt } from '../util.js';

export const ALERTA_NOME = {gestante:'Gestante',anticoagulante:'Anticoagulante',marcapasso:'Marcapasso'};
export const alertasDe = p => Object.keys(ALERTA_NOME).filter(k=>p.alerts[k]).map(k=>ALERTA_NOME[k]);
export const diasDesde = d => Math.round((new Date(TODAY+'T12:00')-new Date(d+'T12:00'))/864e5);
// Melhora da queixa principal em %, comparando a primeira e a última EVA registradas.
export const melhoraPct = s => s.length>1 && s[0] ? Math.round((s[0]-s.at(-1))/s[0]*100) : null;

// Pacientes que precisam de acompanhamento, com o motivo de cada um.
// Retorno: última sessão há mais de 21 dias e nenhum agendamento futuro (mesmo critério das pendências da etapa 1B).
export function acompanhamento(){
  return db.patients.map(p=>{ const m=[], l=p.sessions.at(-1), s=p.sessions.map(x=>x.eva);
    if(l && l.date<TODAY && diasDesde(l.date)>21 && !db.appts.some(a=>a.pid===p.id && a.date>=TODAY)) m.push(['retorno','warn',`sem retorno há ${diasDesde(l.date)} dias`]);
    if(!p.assess.length) m.push(['yin','acc','sem avaliação energética']);
    if(s.length>=2 && s.at(-1)>=s[0]) m.push(['queda','crit','sem melhora desde a 1ª sessão']);
    return {p,m}; }).filter(x=>x.m.length);
}
// Notificações: alertas de segurança de pacientes de hoje, agendamentos passados sem conclusão e acompanhamento.
export function notificacoes(){
  const N=[], hoje=db.appts.filter(a=>a.date===TODAY);
  [...new Set(hoje.map(a=>a.pid))].map(patient).filter(p=>p && alertasDe(p).length)
    .forEach(p=>N.push({k:'al-'+p.id,i:'escudo',t:'crit',titulo:`Alerta de segurança: ${p.name}`,txt:alertasDe(p).join(', ')+' · atendimento hoje',pid:p.id}));
  db.appts.filter(a=>a.date<TODAY && !a.done).forEach(a=>N.push({k:'at-'+a.id,i:'relogio',t:'warn',titulo:'Agendamento sem conclusão',txt:`${patient(a.pid)?.name||''} · ${fmt(a.date)} ${a.time}`,href:'#agenda'}));
  acompanhamento().forEach(({p,m})=>N.push({k:'ac-'+p.id,i:m[0][0],t:m[0][1],titulo:p.name,txt:m.map(x=>x[2]).join(' · '),pid:p.id}));
  return N;
}
