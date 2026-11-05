// Tela Pacientes: busca e cartões com a evolução da queixa principal. O cadastro fica em cadastro.js.
import { linhas } from '../componentes/graficos.js';
import { ic, vazio } from '../componentes/icones.js';
import { ativo } from '../dados/agenda.js';
import { db } from '../dados/repositorio.js';
import { alertasDe, melhoraPct } from '../dados/indicadores.js';
import { ui } from '../estado.js';
import { TODAY, age, esc, fmt, initials } from '../util.js';

export function vPacientes(){
  const n=db.patients.length;
  return `<div class="head"><div><h1>Pacientes</h1><p>${n} cadastrado${n===1?'':'s'}</p></div>
    <div class="quick">${n?`<label class="busca">${ic('busca')}<input id="pq" placeholder="Nome, queixa ou telefone" aria-label="Buscar paciente por nome, queixa ou telefone" value="${esc(ui.pq)}"></label>`:''}<button class="btn pri" data-act="novo-paciente">${ic('novo')}Novo paciente</button></div></div>
  ${n?`<div class="pgrid" id="plist">${patientRows()}</div>`:vazio('pacientes','Nenhum paciente cadastrado','Cadastre o primeiro paciente para começar os atendimentos.',`<button class="btn pri sm" data-act="novo-paciente">${ic('novo')}Cadastrar paciente</button>`)}`;
}
const outras = p => { const n=p.queixas.filter(x=>x.ativa&&x.id!=='q1').length; return n?` <span class="muted sm">+${n} queixa${n===1?'':'s'}</span>`:''; };
export function patientRows(){
  const q=ui.pq.toLowerCase();
  const list=db.patients.filter(p=>!q || [p.name,p.phone,...p.queixas.map(x=>x.descricao)].join(' ').toLowerCase().includes(q));
  if(!list.length) return vazio('busca','Nenhum paciente encontrado','Confira a grafia ou cadastre um novo paciente.',`<button class="btn sm" data-act="novo-paciente">${ic('novo')}Novo paciente</button>`);
  return list.map(p=>{ const s=p.sessions.map(x=>x.eva), m=melhoraPct(s), al=alertasDe(p);
    const prox=db.appts.filter(ativo).filter(a=>a.pid===p.id&&a.date>=TODAY&&!a.done).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
    return `<button class="pc" data-act="open" data-pid="${p.id}"><div class="pc-h"><span class="avatar lg">${initials(p.name)}</span><span class="grow"><b>${esc(p.name)}</b><small>${age(p.birth)} anos · ${p.sessions.length} sess${p.sessions.length===1?'ão':'ões'}</small></span>${p.exemplo?'<span class="pill ex">exemplo</span>':''}${al.length?`<span class="pill crit" data-tip="${al.join(', ')}">${ic('escudo')}</span>`:''}</div>
      <div class="pc-q"><span class="trunc">${esc(p.queixa)}${outras(p)}</span>${s.length>1?linhas([{cor:'var(--brand)',vals:s}],[],{w:110,h:36,mini:1}):''}</div>
      <div class="pc-f">${m!==null?`<span class="pill ${m>0?'ok':'warn'}">${m>0?'▼ '+m+'%':'sem melhora'}</span>`:!p.assess.length?'<span class="pill acc">sem avaliação</span>':'<span class="pill">em início</span>'}<span class="muted">${prox?`${ic('agenda')} ${fmt(prox.date)} ${prox.time}`:'sem agendamento'}</span></div></button>`; }).join('');
}
