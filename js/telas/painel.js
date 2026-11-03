// Tela Painel: rotina clínica no topo, gestão abaixo.
import { spark } from '../componentes/grafico-eva.js';
import { db, patient } from '../dados/repositorio.js';
import { weekStart } from './agenda.js';
import { TODAY, addDays, brl, esc, fmt, initials } from '../util.js';

export function vPainel(){
  const hoje = db.appts.filter(a=>a.date===TODAY).sort((a,b)=>a.time.localeCompare(b.time));
  const agora = new Date(), hhmm = `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;
  const prox = hoje.find(a=>!a.done && a.time>=hhmm) || hoje.find(a=>!a.done);
  const s30 = db.patients.reduce((n,p)=>n+p.sessions.filter(s=>s.date>=addDays(-30)).length,0);
  const ws = weekStart(0), we = addDays(6,ws);
  const sem = db.appts.filter(a=>a.date>=ws && a.date<=we);
  const prev = sem.reduce((n,a)=>n+a.valor,0), real = sem.filter(a=>a.done).reduce((n,a)=>n+a.valor,0);
  const pend = db.patients.filter(p=>{const l=p.sessions.at(-1); return l && l.date<addDays(-21) && !db.appts.some(a=>a.pid===p.id && a.date>=TODAY);});
  const atrasados = db.appts.filter(a=>a.date<TODAY && !a.done);
  const semAval = db.patients.filter(p=>!p.assess.length);
  const alertaHoje = hoje.map(a=>patient(a.pid)).filter(p=>p && Object.values(p.alerts).some(Boolean));
  const ALN = {gestante:'gestante',anticoagulante:'anticoagulante',marcapasso:'marcapasso'};
  const todo = [
    ...alertaHoje.map(p=>['crit','!',`${esc(p.name)} tem alerta de segurança: ${Object.keys(p.alerts).filter(k=>p.alerts[k]).map(k=>ALN[k]).join(', ')}`,'Ver prontuário',`data-act="open" data-pid="${p.id}"`]),
    ...atrasados.map(a=>['warn','◷',`Agendamento de ${esc(patient(a.pid)?.name||'')} em ${fmt(a.date)} sem conclusão`,'Abrir agenda','href="#agenda"']),
    ...pend.map(p=>['warn','↻',`${esc(p.name)} sem retorno marcado desde ${fmt(p.sessions.at(-1).date)}`,'Agendar',`href="#agenda" data-act="book" data-pid="${p.id}"`]),
    ...semAval.map(p=>['acc','○',`${esc(p.name)} ainda não tem avaliação energética`,'Avaliar',`data-act="ir" data-to="avaliacao" data-pid="${p.id}"`])
  ];
  const h=agora.getHours(), saud = h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  const pacHoje = prox && patient(prox.pid);
  return `<div class="head"><div><h1>${saud}</h1><p>${agora.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p></div>
    <div class="quick"><a class="btn" href="#pacientes">Novo paciente</a><a class="btn pri" href="#agenda">Novo agendamento</a></div></div>

  <section class="zone" aria-label="Rotina clínica"><div class="lbl">Rotina clínica</div>
    ${pacHoje?`<div class="next"><span class="pill acc">Próximo</span><span class="mono" style="font-size:1rem">${prox.time}</span><span class="avatar">${initials(pacHoje.name)}</span><div class="grow"><b>${esc(pacHoje.name)}</b><div class="muted trunc">${esc(prox.tipo)} · ${esc(pacHoje.queixa)}</div></div><button class="btn pri sm" data-act="open" data-pid="${pacHoje.id}">Abrir prontuário</button></div>`:''}
    <div class="grid g-side">
      <div class="card"><div class="card-h"><h2>Atendimentos de hoje</h2><a class="btn ghost sm" href="#agenda">Ver semana</a></div>
        <div class="list">${hoje.length?hoje.map(a=>{const p=patient(a.pid);return `<div class="row click" data-act="open" data-pid="${p.id}"><span class="t">${a.time}</span><span class="avatar">${initials(p.name)}</span><div class="grow"><div class="trunc"><b>${esc(p.name)}</b></div><div class="muted trunc">${esc(a.tipo)} · ${esc(p.queixa)}</div></div>${a.done?'<span class="pill ok">Concluído</span>':'<span class="pill acc">Agendado</span>'}</div>`}).join(''):'<p class="muted">Nenhum atendimento hoje.</p>'}</div>
      </div>
      <div class="card todo"><div class="card-h"><h2>Pendências e alertas</h2><span class="pill ${todo.length?'warn':'ok'}">${todo.length}</span></div>
        <div class="list">${todo.length?todo.map(([k,i,txt,acao,attr])=>`<div class="row"><span class="ico ${k}" aria-hidden="true">${i}</span><div class="grow" style="font-size:.9rem">${txt}</div>${attr.includes('href=')?`<a class="btn sm" ${attr}>${acao}</a>`:`<button class="btn sm" ${attr}>${acao}</button>`}</div>`).join(''):'<p class="muted">Nada pendente.</p>'}</div>
      </div>
    </div>
  </section>

  <section class="zone" aria-label="Gestão"><div class="lbl">Gestão</div>
    <div class="kpis" style="margin-bottom:0">
      <div class="kpi"><span>Pacientes ativos</span><b>${db.patients.length}</b><em>${semAval.length} sem avaliação energética</em></div>
      <div class="kpi"><span>Atendimentos na semana</span><b>${sem.length}</b><em>${sem.filter(a=>a.done).length} concluídos · ${s30} sessões em 30 dias</em></div>
      <div class="kpi"><span>Previsto na semana</span><b>${brl(prev)}</b><em>soma dos agendamentos</em></div>
      <div class="kpi"><span>Realizado na semana</span><b>${brl(real)}</b><div class="meter" role="img" aria-label="${prev?Math.round(real/prev*100):0}% do previsto"><i style="width:${prev?Math.round(real/prev*100):0}%"></i></div><em>${prev?Math.round(real/prev*100):0}% do previsto · atendimentos concluídos</em></div>
    </div>
    <div class="card"><div class="card-h"><h2>Evolução dos pacientes</h2><span class="muted" style="font-size:.82rem">Intensidade da queixa principal, EVA de 0 a 10</span></div>
      <div class="list">${db.patients.map(p=>{const v=p.sessions.map(s=>s.eva);const d=v.length>1?v.at(-1)-v[0]:0;return `<div class="row click" data-act="open" data-pid="${p.id}"><div class="grow trunc">${esc(p.name)} <span class="muted">· ${esc(p.queixa)}</span></div>${spark(v)}<span class="eva" style="width:46px;text-align:right;color:${d<0?'var(--ok)':d>0?'var(--crit)':'var(--muted)'}">${d<0?'▼':d>0?'▲':'·'} ${Math.abs(d)}</span></div>`}).join('')}</div>
    </div>
  </section>`;
}
