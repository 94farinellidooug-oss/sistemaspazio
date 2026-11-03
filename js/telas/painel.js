// Tela Painel.
import { spark } from '../componentes/grafico-eva.js';
import { db, patient } from '../dados/repositorio.js';
import { weekStart } from './agenda.js';
import { TODAY, addDays, brl, esc, fmt, initials } from '../util.js';

export function vPainel(){
  const hoje = db.appts.filter(a=>a.date===TODAY).sort((a,b)=>a.time.localeCompare(b.time));
  const s30 = db.patients.reduce((n,p)=>n+p.sessions.filter(s=>s.date>=addDays(-30)).length,0);
  const ws = weekStart(0), we = addDays(6,ws);
  const rec = db.appts.filter(a=>a.date>=ws && a.date<=we).reduce((n,a)=>n+a.valor,0);
  const pend = db.patients.filter(p=>{const l=p.sessions.at(-1); return l && l.date<addDays(-21) && !db.appts.some(a=>a.pid===p.id && a.date>=TODAY);});
  const h=new Date().getHours(), saud = h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  return `<div class="head"><div><h1>${saud}</h1><p>${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p></div><a class="btn pri" href="#agenda">Novo agendamento</a></div>
  <div class="kpis">
    <div class="kpi"><span>Atendimentos hoje</span><b>${hoje.length}</b> <small>${hoje.filter(a=>a.done).length} concluídos</small></div>
    <div class="kpi"><span>Pacientes ativos</span><b>${db.patients.length}</b></div>
    <div class="kpi"><span>Sessões em 30 dias</span><b>${s30}</b></div>
    <div class="kpi"><span>Receita prevista na semana</span><b>${brl(rec)}</b></div>
  </div>
  <div class="grid g-side">
    <div class="card"><div class="card-h"><h2>Agenda de hoje</h2><a class="btn ghost sm" href="#agenda">Ver semana</a></div>
      <div class="list">${hoje.length?hoje.map(a=>{const p=patient(a.pid);return `<div class="row click" data-act="open" data-pid="${p.id}"><span class="t">${a.time}</span><span class="avatar">${initials(p.name)}</span><div class="grow"><div class="trunc"><b>${esc(p.name)}</b></div><div class="muted trunc">${esc(a.tipo)} · ${esc(p.queixa)}</div></div>${a.done?'<span class="pill ok">Concluído</span>':'<span class="pill acc">Agendado</span>'}</div>`}).join(''):'<p class="muted">Nenhum atendimento hoje.</p>'}</div>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card"><h2>Evolução dos pacientes</h2><p class="muted" style="margin:-6px 0 8px;font-size:.82rem">Intensidade da queixa principal, escala EVA de 0 a 10</p>
        <div class="list">${db.patients.map(p=>{const v=p.sessions.map(s=>s.eva);const d=v.length>1?v.at(-1)-v[0]:0;return `<div class="row click" data-act="open" data-pid="${p.id}"><div class="grow trunc">${esc(p.name)}</div>${spark(v)}<span class="eva" style="width:46px;text-align:right;color:${d<0?'var(--ok)':d>0?'var(--crit)':'var(--muted)'}">${d<0?'▼':d>0?'▲':'·'} ${Math.abs(d)}</span></div>`}).join('')}</div>
      </div>
      <div class="card"><h2>Retornos a agendar</h2>${pend.length?`<div class="list">${pend.map(p=>`<div class="row"><div class="grow"><b>${esc(p.name)}</b><div class="muted">Última sessão em ${fmt(p.sessions.at(-1).date)}</div></div><a class="btn sm" href="#agenda" data-act="book" data-pid="${p.id}">Agendar</a></div>`).join('')}</div>`:'<p class="muted">Todos os pacientes estão com retorno marcado.</p>'}</div>
    </div>
  </div>`;
}
