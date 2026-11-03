// Tela Pacientes: busca, cartões com a evolução da queixa principal e cadastro de novo paciente.
import { linhas } from '../componentes/graficos.js';
import { ic, vazio } from '../componentes/icones.js';
import { db } from '../dados/repositorio.js';
import { alertasDe, melhoraPct } from '../dados/indicadores.js';
import { ui } from '../estado.js';
import { TODAY, age, esc, fmt, initials } from '../util.js';

export function vPacientes(){
  return `<div class="head"><div><h1>Pacientes</h1><p>${db.patients.length} cadastrado${db.patients.length===1?'':'s'}</p></div>
    <div class="quick"><label class="busca">${ic('busca')}<input id="pq" placeholder="Nome ou queixa" aria-label="Buscar paciente por nome ou queixa" value="${esc(ui.pq)}"></label><button class="btn pri" data-act="rolar" data-to="f-patient">${ic('novo')}Novo paciente</button></div></div>
  <div class="grid g-side">
    <div class="pgrid" id="plist">${patientRows()}</div>
    <div class="card" style="align-self:start"><div class="card-h"><h2>Novo paciente</h2><span class="tico sm acc">${ic('novo')}</span></div>
      <form id="f-patient" class="form">
        <div class="field full"><label class="lbl" for="np-name">Nome completo</label><input id="np-name" required></div>
        <div class="field"><label class="lbl" for="np-birth">Nascimento</label><input id="np-birth" type="date" required></div>
        <div class="field"><label class="lbl" for="np-phone">WhatsApp</label><input id="np-phone" placeholder="(11) 90000-0000"></div>
        <div class="field full"><label class="lbl" for="np-q">Queixa principal</label><input id="np-q" required></div>
        <label class="full lgpd"><input type="checkbox" id="np-lgpd" required> O paciente autorizou o tratamento dos dados de saúde para fins de atendimento (consentimento LGPD).</label>
        <div class="full"><button class="btn pri">${ic('check')}Cadastrar e abrir prontuário</button></div>
      </form>
    </div>
  </div>`;
}
export function patientRows(){
  const q=ui.pq.toLowerCase();
  const list=db.patients.filter(p=>!q || (p.name+p.queixa).toLowerCase().includes(q));
  if(!list.length) return vazio('busca','Nenhum paciente encontrado','Confira a grafia ou cadastre um novo paciente.');
  return list.map(p=>{ const s=p.sessions.map(x=>x.eva), m=melhoraPct(s), al=alertasDe(p);
    const prox=db.appts.filter(a=>a.pid===p.id&&a.date>=TODAY&&!a.done).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
    return `<button class="pc" data-act="open" data-pid="${p.id}"><div class="pc-h"><span class="avatar lg">${initials(p.name)}</span><span class="grow"><b>${esc(p.name)}</b><small>${age(p.birth)} anos · ${p.sessions.length} sess${p.sessions.length===1?'ão':'ões'}</small></span>${p.exemplo?'<span class="pill ex">exemplo</span>':''}${al.length?`<span class="pill crit" data-tip="${al.join(', ')}">${ic('escudo')}</span>`:''}</div>
      <div class="pc-q"><span class="trunc">${esc(p.queixa)}</span>${s.length>1?linhas([{cor:'var(--brand)',vals:s}],[],{w:110,h:36,mini:1}):''}</div>
      <div class="pc-f">${m!==null?`<span class="pill ${m>0?'ok':'warn'}">${m>0?'▼ '+m+'%':'sem melhora'}</span>`:!p.assess.length?'<span class="pill acc">sem avaliação</span>':'<span class="pill">em início</span>'}<span class="muted">${prox?`${ic('agenda')} ${fmt(prox.date)} ${prox.time}`:'sem agendamento'}</span></div></button>`; }).join('');
}
