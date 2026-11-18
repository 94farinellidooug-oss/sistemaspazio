// Indicadores e avisos calculados só a partir dos dados gravados (pacientes, sessões, avaliações e agenda).
// Não cria números: se um dado não existe, o indicador não aparece.
import { ativo } from './agenda.js';
import { db, patient } from './repositorio.js';
import { TODAY, fmt } from '../util.js';

// Alertas de segurança: [chave, nome curto (selo), dica]. Os três primeiros geram avisos automáticos no plano
// (raciocinio/seguranca.js); os outros (pedido do Maicon em 18/11/2026) só lembram o profissional, sem mudar regra clínica.
// "Outro": p.alerts.outro guarda o texto escrito (ou true, se marcado sem texto).
export const ALERTAS = [
  ['gestante','Gestante','Pontos com cautela na gestação'],
  ['anticoagulante','Anticoagulante','Ventosa e sangria'],
  ['marcapasso','Marcapasso','Eletroacupuntura'],
  ['coagulacao','Distúrbio de coagulação','Hemofilia, plaquetas baixas: agulhamento, ventosa e sangria'],
  ['diabetes','Diabetes','Cicatrização lenta e menos sensibilidade: moxa, calor e pés'],
  ['epilepsia','Epilepsia','Convulsões: eletroacupuntura e estímulos fortes'],
  ['pressao','Pressão alta ou baixa','Aferir antes; cuidado com estímulos fortes'],
  ['imunidade','Imunidade baixa','Quimioterapia, transplante, corticoide: assepsia redobrada'],
  ['cancer','Câncer em tratamento','Combinar com o médico; não agulhar sobre a região'],
  ['implante','Implante metálico ou prótese','Eletroacupuntura e calor perto do local'],
  ['alergia','Alergia a metal ou látex','Escolha da agulha, luvas e adesivos'],
  ['desmaio','Medo de agulha ou desmaio','Atender deitado e observar depois da sessão'],
  ['pele','Feridas, varizes ou lesões de pele','Não agulhar nem aplicar ventosa sobre a região'],
  ['infecciosa','Doença infectocontagiosa','Biossegurança no manuseio e descarte']
];
export const ALERTAS_FIXOS = ['gestante','anticoagulante','marcapasso'];   // sempre gravados (formato do protótipo v1)
export const ALERTA_NOME = Object.fromEntries(ALERTAS.map(([k,n])=>[k,n]));
export const ALERTA_DICA = Object.fromEntries(ALERTAS.map(([k,,d])=>[k,d]));
export const alertasDe = p => [...ALERTAS.filter(([k])=>p.alerts?.[k]).map(([,n])=>n), ...(p.alerts?.outro ? [p.alerts.outro===true?'Outro alerta':String(p.alerts.outro).trim()] : [])];
// Junta o que foi marcado: os três fixos sempre (true/false); os outros só quando marcados; "outro" com o texto.
export function montarAlertas(antes, marcado, outro, outroTexto){
  const A = Object.fromEntries(Object.entries(antes || {}).filter(([k])=>!ALERTA_NOME[k] && k!=='outro'));
  ALERTAS.forEach(([k])=>{ const c=!!marcado(k); if(ALERTAS_FIXOS.includes(k)||c) A[k]=c; });
  if(outro) A.outro = String(outroTexto||'').trim().slice(0,120) || true;
  return A;
}
export const diasDesde = d => Math.round((new Date(TODAY+'T12:00')-new Date(d+'T12:00'))/864e5);
// Melhora da queixa principal em %, comparando a primeira e a última EVA registradas.
export const melhoraPct = s => s.length>1 && s[0] ? Math.round((s[0]-s.at(-1))/s[0]*100) : null;

// Pacientes que precisam de acompanhamento, com o motivo de cada um.
// Retorno: última sessão há mais de 21 dias e nenhum agendamento futuro (mesmo critério das pendências da etapa 1B).
export function acompanhamento(){
  return db.patients.map(p=>{ const m=[], l=p.sessions.at(-1), s=p.sessions.map(x=>x.eva);
    if(l && l.date<TODAY && diasDesde(l.date)>21 && !db.appts.some(a=>ativo(a)&&a.pid===p.id && a.date>=TODAY)) m.push(['retorno','warn',`sem retorno há ${diasDesde(l.date)} dias`]);
    if(!p.assess.length) m.push(['yin','acc','sem avaliação energética']);
    if(s.length>=2 && s.at(-1)>=s[0]) m.push(['queda','crit','sem melhora desde a 1ª sessão']);
    return {p,m}; }).filter(x=>x.m.length);
}
// Notificações: alertas de segurança de pacientes de hoje, agendamentos passados sem conclusão e acompanhamento.
export function notificacoes(){
  const N=[], hoje=db.appts.filter(ativo).filter(a=>a.date===TODAY);
  [...new Set(hoje.map(a=>a.pid))].map(patient).filter(p=>p && alertasDe(p).length)
    .forEach(p=>N.push({k:'al-'+p.id,i:'escudo',t:'crit',titulo:`Alerta de segurança: ${p.name}`,txt:alertasDe(p).join(', ')+' · atendimento hoje',pid:p.id}));
  db.appts.filter(ativo).filter(a=>a.date<TODAY && !a.done && a.st!=='faltou').forEach(a=>N.push({k:'at-'+a.id,i:'relogio',t:'warn',titulo:'Agendamento sem conclusão',txt:`${patient(a.pid)?.name||''} · ${fmt(a.date)} ${a.time}`,href:'#agenda'}));
  acompanhamento().forEach(({p,m})=>N.push({k:'ac-'+p.id,i:m[0][0],t:m[0][1],titulo:p.name,txt:m.map(x=>x[2]).join(' · '),pid:p.id}));
  return N;
}
