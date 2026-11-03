// Tela Painel: ações rápidas, indicadores, alertas de segurança, agenda do dia com calendário,
// gráficos e acompanhamento. Todos os números vêm dos dados gravados (sessões, avaliações e agenda).
import { anel, barrasV, linhas } from '../componentes/graficos.js';
import { ic, vazio } from '../componentes/icones.js';
import { db, patient } from '../dados/repositorio.js';
import { acompanhamento, alertasDe, diasDesde, melhoraPct } from '../dados/indicadores.js';
import { ui } from '../estado.js';
import { PROF } from './menu.js';
import { weekStart } from './agenda.js';
import { TODAY, addDays, brl, esc, fmt, initials } from '../util.js';

function calMini(){
  const base=new Date(TODAY+'T12:00'), ano=base.getFullYear(), mes=base.getMonth(), ini=(new Date(ano,mes,1).getDay()+6)%7, nd=new Date(ano,mes+1,0).getDate();
  const dia=d=>`${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, sel=ui.dia||TODAY;
  const cel=[...Array(ini)].map(()=>'<span></span>').join('')+[...Array(nd)].map((_,i)=>{ const d=dia(i+1), n=db.appts.filter(a=>a.date===d).length;
    return `<button class="cm-d ${d===TODAY?'hoje':''} ${d===sel?'sel':''} ${d<TODAY?'pass':''}" data-act="dia" data-d="${d}" aria-label="${fmt(d)}: ${n} agendamento${n===1?'':'s'}" ${n?`data-tip="${n} agendamento${n===1?'':'s'}"`:''}>${i+1}${n?`<i>${'<b></b>'.repeat(Math.min(n,3))}</i>`:''}</button>`; }).join('');
  const L=db.appts.filter(a=>a.date===sel).sort((a,b)=>a.time.localeCompare(b.time));
  return `<div class="card cm"><div class="card-h"><h3>${base.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h3><a class="btn ghost sm" href="#agenda">Agenda ${ic('dir')}</a></div>
    <div class="cm-g">${['S','T','Q','Q','S','S','D'].map(x=>`<small>${x}</small>`).join('')}${cel}</div>
    <div class="cm-l"><div class="lbl">${sel===TODAY?'Hoje':fmt(sel)}</div>${L.length?L.map(a=>{const p=patient(a.pid);return `<button class="cm-i ${a.done?'feito':''}" data-act="open" data-pid="${a.pid}"><span class="mono">${a.time}</span><span class="trunc">${esc(p?.name||'')}</span>${a.done?ic('okc'):''}</button>`;}).join(''):'<p class="muted sm">Nenhum agendamento neste dia.</p>'}</div></div>`;
}

export function vPainel(){
  const agora=new Date(), h=agora.getHours(), hhmm=`${String(h).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;
  const hoje=db.appts.filter(a=>a.date===TODAY).sort((a,b)=>a.time.localeCompare(b.time)), feitos=hoje.filter(a=>a.done).length;
  const prox=hoje.find(a=>!a.done && a.time>=hhmm) || hoje.find(a=>!a.done), pp=prox&&patient(prox.pid);
  const al=[...new Set(hoje.map(a=>a.pid))].map(patient).filter(p=>p && alertasDe(p).length);
  const ac=acompanhamento(), atrasados=db.appts.filter(a=>a.date<TODAY && !a.done);
  const comS=db.patients.filter(p=>p.sessions.length>1), melh=comS.filter(p=>melhoraPct(p.sessions.map(s=>s.eva))>0);
  // Sessões registradas por semana, nas últimas 8 semanas.
  const sem=[...Array(8)].map((_,i)=>{ const ini=weekStart(i-7), fim=addDays(6,ini);
    return [db.patients.reduce((t,p)=>t+p.sessions.filter(s=>s.date>=ini&&s.date<=fim).length,0), fmt(ini).slice(0,5)]; });
  // Intensidade média da queixa principal (EVA) por número da sessão, entre os pacientes que chegaram até ela.
  const maxN=Math.max(0,...db.patients.map(p=>p.sessions.length));
  const med=[...Array(maxN)].map((_,k)=>{ const v=db.patients.map(p=>p.sessions[k]?.eva).filter(x=>x!=null); return [Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10, v.length]; });
  // Financeiro da semana a partir dos agendamentos e seus valores.
  const ws=weekStart(0), we=addDays(6,ws), ag=db.appts.filter(a=>a.date>=ws&&a.date<=we);
  const prev=ag.reduce((n,a)=>n+a.valor,0), real=ag.filter(a=>a.done).reduce((n,a)=>n+a.valor,0), pr=prev?Math.round(real/prev*100):0;
  const atv=[...db.patients.flatMap(p=>[...p.sessions.map((s,i)=>({d:s.date,i:'estet',t:i===0?'Primeira sessão':`${i+1}ª sessão`,p,x:s.tec.join(', ')||'sessão registrada'})),
      ...p.assess.map((a,i)=>({d:a.date,i:'yin',t:i===0?'Avaliação energética':'Reavaliação energética',p,x:`${a.signs.length} sinais`}))]),
    ...db.appts.filter(a=>a.done&&a.date<=TODAY).map(a=>({d:a.date,i:'okc',t:'Agendamento concluído',p:patient(a.pid),x:a.tipo}))].filter(a=>a.p && a.d<=TODAY).sort((a,b)=>b.d.localeCompare(a.d)).slice(0,6);
  const quando = d => { const n=diasDesde(d); return n===0?'hoje':n===1?'ontem':`há ${n} dias`; };

  return `<div class="head"><div><h1>${h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}, ${PROF.nome.split(' ')[0]}</h1><p>${agora.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})} · ${hoje.length} agendamento${hoje.length===1?'':'s'} hoje</p></div></div>

  <div class="acoes">
    ${pp?`<button class="acao pri" data-act="sessao" data-pid="${pp.id}"><span class="tico">${ic('play')}</span><span><b>Iniciar próximo</b><small>${prox.time} · ${esc(pp.name.split(' ')[0])}</small></span></button>`:''}
    <a class="acao" href="#pacientes"><span class="tico acc">${ic('novo')}</span><span><b>Novo paciente</b><small>cadastro</small></span></a>
    <a class="acao" href="#agenda"><span class="tico acc">${ic('agendado')}</span><span><b>Agendar</b><small>abrir a agenda</small></span></a>
    <button class="acao" data-act="busca"><span class="tico acc">${ic('busca')}</span><span><b>Buscar</b><small><kbd>Ctrl</kbd><kbd>K</kbd></small></span></button>
  </div>

  <div class="tiles">
    <a class="tile lk" href="#agenda">${anel(hoje.length?feitos/hoje.length:0,`${feitos}/${hoje.length}`)}<div><b>Agendamentos hoje</b><small>concluídos / marcados</small></div></a>
    <button class="tile lk ${al.length?'t-crit':''}" data-act="rolar" data-to="${al.length?'alertas':'agenda-dia'}"><span class="tico crit">${ic('escudo')}</span><div><b class="num">${al.length}</b><small>alerta${al.length===1?'':'s'} de segurança em pacientes de hoje</small></div></button>
    <button class="tile lk" data-act="rolar" data-to="acomp"><span class="tico warn">${ic('pacientes')}</span><div><b class="num">${ac.length}</b><small>paciente${ac.length===1?'':'s'} precisa${ac.length===1?'':'m'} de acompanhamento</small></div></button>
    <div class="tile">${anel(comS.length?melh.length/comS.length:0,`${melh.length}/${comS.length}`,'var(--ok)')}<div><b>Em melhora</b><small>EVA da última sessão menor que a da 1ª</small></div></div>
  </div>

  ${al.length?`<div class="al-strip" id="alertas"><span class="al-t">${ic('escudo')}<b>Alertas de segurança hoje</b></span>${al.map(p=>`<button class="al-c" data-act="open" data-pid="${p.id}"><span class="avatar">${initials(p.name)}</span><span><b>${esc(p.name)}</b><small>${alertasDe(p).join(', ')} · ${hoje.find(a=>a.pid===p.id).time}</small></span></button>`).join('')}</div>`:''}

  <div class="dash-a">
    <div class="card" id="agenda-dia"><div class="card-h"><h2>Agenda do dia</h2><span class="pill acc">${hoje.length-feitos} a atender</span></div>
      ${hoje.length?`<div class="tl">${hoje.map(a=>{const p=patient(a.pid); if(!p) return ''; const s=p.sessions.map(x=>x.eva);
        return `<div class="tl-i ${a.done?'feito':''} ${a===prox?'proximo':''}"><span class="tl-h">${a.time}</span><span class="tl-dot"></span>
        <button class="tl-c" data-act="open" data-pid="${p.id}"><span class="avatar">${initials(p.name)}</span><span class="grow"><b class="trunc">${esc(p.name)}</b><small class="trunc">${esc(a.tipo)}${a===prox?' · próximo':a.done?' · concluído':''}</small></span>
        ${alertasDe(p).length?`<span class="pill crit" data-tip="${alertasDe(p).join(', ')}">${ic('escudo')}</span>`:''}${s.length>1?`<span class="mini-ch" data-tip="EVA da queixa principal: ${s.join(' → ')}">${linhas([{cor:'var(--brand)',vals:s}],[],{w:90,h:34,mini:1})}</span>`:p.sessions.length?'':'<span class="pill acc">1ª sessão</span>'}</button>
        <button class="btn sm ${a===prox?'pri':''}" data-act="sessao" data-pid="${p.id}" aria-label="Registrar sessão de ${esc(p.name)}" data-tip="Registrar sessão">${ic('play')}</button></div>`}).join('')}</div>`
      :vazio('agenda','Dia livre','Nenhum agendamento para hoje.',`<a class="btn sm" href="#agenda">${ic('mais')}Agendar</a>`)}</div>
    ${calMini()}
  </div>

  <div class="dash-b">
    <div class="card"><div class="card-h"><h3>Sessões por semana</h3><span class="muted sm">últimas 8 semanas</span></div>${barrasV(sem.map(x=>x[0]),sem.map(x=>x[1]),{label:'Sessões registradas por semana',h:170,tips:sem.map(([n,l])=>`Semana de ${l}: ${n} sess${n===1?'ão':'ões'}`)})}</div>
    <div class="card"><div class="card-h"><h3>Evolução média da queixa</h3><span class="muted sm">EVA por sessão</span></div>
      ${med.length?linhas([{cor:'var(--brand)',vals:med.map(x=>x[0]),nome:'Média'}],med.map((_,k)=>`${k+1}ª`),{w:420,h:170,label:'EVA média por número da sessão',tips:med.map(([v,n],k)=>`${k+1}ª sessão: média ${String(v).replace('.',',')} (${n} paciente${n===1?'':'s'})`)})
        :vazio('evolucao','Sem sessões','O gráfico aparece com as primeiras sessões registradas.')}</div>
    <div class="card fin-r"><div class="card-h"><h3>Financeiro da semana</h3><a class="btn ghost sm" href="#agenda" aria-label="Abrir agenda">${ic('dir')}</a></div>
      <div class="fin"><div><small>Previsto</small><b>${brl(prev)}</b></div><div><small>Realizado</small><b>${brl(real)}</b></div></div>
      <div class="meter" data-tip="${pr}% do previsto"><i style="width:${pr}%"></i></div>
      <div class="fin-m"><span>${ic('relogio')}A realizar <b>${brl(prev-real)}</b></span><span>${ic('lista')}Agendamentos <b>${ag.length}</b></span></div>
      <small class="muted">Soma dos valores dos agendamentos da semana; realizado = concluídos.</small></div>
  </div>

  <div class="dash-c">
    <div class="card" id="acomp"><div class="card-h"><h2>Precisam de acompanhamento</h2><span class="pill ${ac.length+atrasados.length?'warn':'ok'}">${ac.length+atrasados.length}</span></div>
      ${ac.length||atrasados.length?ac.map(({p,m})=>`<details class="ac"><summary><span class="avatar">${initials(p.name)}</span><span class="grow"><b>${esc(p.name)}</b><span class="chips">${m.map(([i,k,t])=>`<span class="pill ${k}">${ic(i)}${t}</span>`).join('')}</span></span>${ic('baixo')}</summary>
        <div class="ac-b"><div class="ac-s"><div><small>Queixa principal</small><b>${esc(p.queixa)}</b></div><div><small>Última sessão</small><b>${p.sessions.length?fmt(p.sessions.at(-1).date):'—'}</b></div><div><small>Sessões</small><b>${p.sessions.length}</b></div></div>
        <div class="chips"><button class="btn sm" data-act="open" data-pid="${p.id}">${ic('pacientes')}Prontuário</button>${!p.assess.length?`<button class="btn sm pri" data-act="ir" data-to="avaliacao" data-pid="${p.id}">${ic('yin')}Avaliar</button>`:''}<a class="btn sm" href="#agenda" data-act="book" data-pid="${p.id}">${ic('agendado')}Agendar</a></div></div></details>`).join('')
        +atrasados.map(a=>`<div class="ac-r"><span class="tico sm warn">${ic('relogio')}</span><span class="grow"><b>${esc(patient(a.pid)?.name||'')}</b><small class="muted">agendamento de ${fmt(a.date)} às ${a.time} sem conclusão</small></span><a class="btn sm" href="#agenda">Abrir agenda</a></div>`).join('')
      :vazio('okc','Todos acompanhados','Nenhum paciente com retorno atrasado, avaliação pendente ou sem melhora.')}</div>
    <div class="card"><div class="card-h"><h2>Atividades recentes</h2></div>
      ${atv.length?`<div class="atv">${atv.map(a=>`<button class="atv-i" data-act="open" data-pid="${a.p.id}"><span class="tico sm acc">${ic(a.i)}</span><span class="grow"><b>${a.t}</b><small>${esc(a.p.name)} · ${esc(a.x)}</small></span><time class="muted sm">${quando(a.d)}</time></button>`).join('')}</div>`
        :vazio('historico','Sem atividades','As sessões, avaliações e agendamentos concluídos aparecem aqui.')}</div>
  </div>`;
}
