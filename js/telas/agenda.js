// Tela Agenda.
import { patientSelect } from '../componentes/campos.js';
import { db, patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { ic } from '../componentes/icones.js';
import { TODAY, addDays, brl, esc, fmt } from '../util.js';

export function weekStart(off){ const d=new Date(); const wd=(d.getDay()+6)%7; return addDays(-wd+off*7); }
export function vAgenda(){
  const ws=weekStart(ui.week), days=[...Array(7)].map((_,i)=>addDays(i,ws));
  const tot=db.appts.filter(a=>a.date>=days[0]&&a.date<=days[6]);
  return `<div class="head"><div><h1>Agenda</h1><p>Semana de ${fmt(days[0])} a ${fmt(days[6])} · ${tot.length} atendimentos · ${brl(tot.reduce((n,a)=>n+a.valor,0))}</p></div>
    <div class="quick"><button class="btn" data-act="week" data-d="-1" aria-label="Semana anterior" data-tip="Semana anterior">${ic('esq')}</button><button class="btn" data-act="week" data-d="0">Hoje</button><button class="btn" data-act="week" data-d="1" aria-label="Próxima semana" data-tip="Próxima semana">${ic('dir')}</button><button class="btn pri" data-act="rolar" data-to="f-appt">${ic('mais')}Agendar</button></div></div>
  <div class="wscroll"><div class="week">${days.map(d=>{const l=db.appts.filter(a=>a.date===d).sort((a,b)=>a.time.localeCompare(b.time));const dt=new Date(d+'T12:00:00');
    return `<div class="day ${d===TODAY?'today':''}"><h3>${dt.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}</h3>${l.map(a=>{const p=patient(a.pid);return `<div class="appt ${a.done?'done':''}" data-act="appt" data-id="${a.id}" title="Clique para marcar como ${a.done?'pendente':'concluído'}"><b>${a.time}</b> ${esc(p?.name.split(' ')[0]||'')}<div class="muted">${esc(a.tipo)}</div></div>`}).join('')||'<span class="muted" style="font-size:.8rem">Livre</span>'}</div>`}).join('')}</div></div>
  <div class="card" style="margin-top:20px;max-width:760px"><div class="card-h"><h2>Novo agendamento</h2><span class="tico sm acc">${ic('agendado')}</span></div>
    <form id="f-appt" class="form">
      <div class="field"><label class="lbl" for="na-p">Paciente</label>${patientSelect('na-p',ui.bookPid||ui.pid)}</div>
      <div class="field"><label class="lbl" for="na-d">Data</label><input id="na-d" type="date" value="${TODAY}" required></div>
      <div class="field"><label class="lbl" for="na-t">Horário</label><input id="na-t" type="time" value="09:00" required></div>
      <div class="field"><label class="lbl" for="na-tipo">Atendimento</label><select id="na-tipo"><option>Acupuntura</option><option>Auriculoterapia</option><option>Ventosaterapia</option><option>Massoterapia</option><option>Avaliação inicial</option></select></div>
      <div class="field"><label class="lbl" for="na-v">Valor (R$)</label><input id="na-v" type="number" min="0" step="10" value="180"></div>
      <div class="full"><button class="btn pri">${ic('check')}Agendar</button></div>
    </form></div>`;
}
