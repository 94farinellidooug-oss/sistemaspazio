// Tela Painel: rotina clínica no topo (próximo atendimento, agenda do dia, alertas e pendências),
// indicadores administrativos abaixo, com menos peso visual.
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
  const I = {
    alerta:'<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    relogio:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    retorno:'<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    avaliar:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    ok:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 10"/>',
    escudo:'<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 9v4M12 16v.01"/>'
  };
  const ic = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
  const alertas = alertaHoje.map(p=>['crit','alerta',`<b>${esc(p.name)}</b> · ${Object.keys(p.alerts).filter(k=>p.alerts[k]).map(k=>ALN[k]).join(', ')}`,'Ver prontuário',`data-act="open" data-pid="${p.id}"`]);
  const todo = [
    ...atrasados.map(a=>['warn','relogio',`Agendamento de ${esc(patient(a.pid)?.name||'')} em ${fmt(a.date)} sem conclusão`,'Abrir agenda','href="#agenda"']),
    ...pend.map(p=>['warn','retorno',`${esc(p.name)} sem retorno marcado desde ${fmt(p.sessions.at(-1).date)}`,'Agendar',`href="#agenda" data-act="book" data-pid="${p.id}"`]),
    ...semAval.map(p=>['acc','avaliar',`${esc(p.name)} ainda não tem avaliação energética`,'Avaliar',`data-act="ir" data-to="avaliacao" data-pid="${p.id}"`])
  ];
  const linhas = L => L.map(([k,i,txt,acao,attr])=>`<div class="row"><span class="ico ${k}">${ic(i)}</span><div class="grow" style="font-size:.88rem">${txt}</div>${attr.includes('href=')?`<a class="btn sm" ${attr}>${acao}</a>`:`<button class="btn sm" ${attr}>${acao}</button>`}</div>`).join('');
  const h=agora.getHours(), saud = h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  const pacHoje = prox && patient(prox.pid);
  return `<div class="head"><div><h1>${saud}</h1><p>${agora.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p></div>
    <div class="quick"><a class="btn" href="#pacientes">Novo paciente</a><a class="btn pri" href="#agenda">Novo agendamento</a></div></div>

  <section class="zone" aria-label="Rotina clínica"><div class="lbl">Rotina clínica</div>
    ${pacHoje?`<div class="next"><div><div class="cap">Próximo atendimento</div><div class="hora">${prox.time}</div></div><span class="avatar">${initials(pacHoje.name)}</span><div class="grow"><b style="font-size:1.02rem">${esc(pacHoje.name)}</b><div class="muted trunc">${esc(prox.tipo)} · ${esc(pacHoje.queixa)}</div></div><button class="btn pri" data-act="open" data-pid="${pacHoje.id}">Abrir prontuário</button></div>`:''}
    <div class="grid g-side">
      <div class="card agenda-dia"><div class="card-h"><h2>Agenda do dia<small>${hoje.length} atendimento${hoje.length===1?'':'s'} · ${hoje.filter(a=>a.done).length} concluído${hoje.filter(a=>a.done).length===1?'':'s'}</small></h2><a class="btn ghost sm" href="#agenda">Ver semana</a></div>
        <div class="list">${hoje.length?hoje.map(a=>{const p=patient(a.pid);return `<div class="row click ${a.done?'feito':''}" data-act="open" data-pid="${p.id}"><span class="t">${a.time}</span><span class="avatar">${initials(p.name)}</span><div class="grow"><div class="trunc"><b>${esc(p.name)}</b></div><div class="muted trunc">${esc(a.tipo)} · ${esc(p.queixa)}</div></div>${a.done?'<span class="pill ok">Concluído</span>':'<span class="pill acc">Agendado</span>'}</div>`}).join(''):'<p class="muted">Nenhum atendimento hoje.</p>'}</div>
      </div>
      <div class="clin-side">
        <div class="card todo alertas"><div class="card-h"><h2>${ic('escudo')}Alertas de segurança<small>Pacientes de hoje com alerta no cadastro</small></h2>${alertas.length?`<span class="pill crit">${alertas.length}</span>`:''}</div>
          <div class="list">${alertas.length?linhas(alertas):`<div class="vazio">${ic('ok')}Nenhum alerta para os atendimentos de hoje.</div>`}</div>
        </div>
        <div class="card todo"><div class="card-h"><h2>Pendências<small>Retornos, agendamentos e avaliações</small></h2><span class="pill ${todo.length?'warn':'ok'}">${todo.length}</span></div>
          <div class="list">${todo.length?linhas(todo):`<div class="vazio">${ic('ok')}Nada pendente.</div>`}</div>
        </div>
      </div>
    </div>
  </section>

  <section class="zone gestao" aria-label="Gestão"><div class="lbl">Gestão administrativa</div>
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
