// Tela Agenda (etapa 6A): o dia escolhido embaixo da semana, a situação de cada horário ao lado,
// horários livres conforme o serviço e agendar com paciente, serviço, dia e horário.
import { SERVICOS, SITUACOES_HORARIO, fimHorario, horariosDoDia, horariosLivres, inicioSemana, servicoDe, situacaoHorario } from '../dados/agenda.js';
import { db, patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { ic } from '../componentes/icones.js';
import { btnWa } from './whatsapp.js';
import { lembreteDe } from '../dados/whatsapp.js';
import { TODAY, addDays, brl, esc, fmt } from '../util.js';

// Usado pelo Painel: início da semana atual (off = 0), anterior (-1) etc.
export function weekStart(off){ const d=new Date(); const wd=(d.getDay()+6)%7; return addDays(-wd+off*7); }
const diaSem = (d, o={weekday:'short'}) => new Date(d+'T12:00:00').toLocaleDateString('pt-BR',o).replace('.','');
// Formulário de agendar: paciente, serviço, dia e horário. Começa no paciente escolhido e no dia aberto.
export function formAgenda(){
  const F = ui.agForm ||= { pid:null, date:null, time:'', tipo:SERVICOS[0][0] };
  F.pid ||= ui.bookPid || ui.pid; F.date ||= ui.agDia || TODAY;
  return F;
}
const proximoDe = pid => db.appts.filter(a=>a.pid===pid && a.date>=TODAY && !a.done && a.st!=='desmarcado' && a.st!=='faltou').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];

function linhaHorario(a){
  const p = patient(a.pid), st = situacaoHorario(a), fora = a.st === 'desmarcado', [, dur] = servicoDe(a.tipo);
  return `<div class="hor ${fora ? 'desmarcado' : st}" data-hor="${a.id}">
    <div class="hor-h"><b class="mono">${a.time}</b><small>${fimHorario(a)}</small></div>
    <div class="hor-p"><button class="lk" data-act="open" data-pid="${a.pid}">${esc(p?.name||'Paciente removido')}</button><small>${esc(a.tipo)} · ${dur} min${a.hist?.length ? ` · <span class="hor-hi">${esc(a.hist[0])}</span>` : ''}</small></div>
    ${fora ? '<span class="pill">Desmarcado</span>' : `<div class="rx-seg st" role="group" aria-label="Situação">${SITUACOES_HORARIO.map(([k,n,i])=>`<button class="${k}${st===k?' on':''}" data-act="ag-st" data-id="${a.id}" data-s="${k}" aria-pressed="${st===k}" aria-label="${n}" data-tip="${n}">${ic(i)}</button>`).join('')}</div>`}
    <div class="hor-a">${fora ? `<button class="btn sm" data-act="ag-rem" data-id="${a.id}">${ic('agenda')}Reagendar</button>`
      : `${a.date===TODAY && st!=='atendido' && st!=='faltou' && p ? `<button class="btn sm pri" data-act="novo-atendimento" data-pid="${a.pid}">${ic('play')}Atender</button>` : ''}${p && a.date>=TODAY && st!=='atendido' && st!=='faltou' ? btnWa('lembrete', a.pid, a.id, true) : ''}<button class="btn sm ghost" data-act="ag-rem" data-id="${a.id}" aria-label="Remarcar" data-tip="Remarcar">${ic('agenda')}</button><button class="btn sm ghost" data-act="ag-desm" data-id="${a.id}" aria-label="Desmarcar" data-tip="Desmarcar">${ic('x')}</button>`}</div></div>`;
}

// Lembretes de amanhã: um toque abre o WhatsApp com a mensagem pronta; fica anotado quando foi aberta.
function lembretes(){
  const am = addDays(1, TODAY), L = horariosDoDia(db.appts, am).filter(a => a.st !== 'faltou' && patient(a.pid));
  if (!L.length) return '';
  const falta = L.filter(a => !lembreteDe(patient(a.pid), a.id)).length;
  return `<div class="card" id="lembretes"><div class="card-h"><h2>Lembretes de amanhã<small>um toque abre o WhatsApp com a mensagem pronta</small></h2><span class="pill ${falta ? 'warn' : 'ok'}" id="lem-falta">${falta ? `${falta} a enviar` : 'todos enviados'}</span></div>
    <div class="hor-l">${L.map(a => { const p = patient(a.pid), m = lembreteDe(p, a.id); return `<div class="hor lem" data-lem="${a.id}"><div class="hor-h"><b class="mono">${a.time}</b><small>${fimHorario(a)}</small></div><div class="hor-p"><b>${esc(p.name)}</b><small>${esc(a.tipo)}</small>${m ? `<small class="wa-ok">${ic('check')}mensagem aberta às ${m.em.slice(11,16)}</small>` : ''}</div><div class="hor-a">${btnWa('lembrete', a.pid, a.id)}</div></div>`; }).join('')}</div></div>`;
}

export function vAgenda(){
  const dia = ui.agDia ||= TODAY, ws = inicioSemana(dia), dias = [...Array(7)].map((_,i)=>addDays(i,ws));
  const L = horariosDoDia(db.appts, dia), fora = db.appts.filter(a=>a.date===dia && a.st==='desmarcado');
  const conta = k => L.filter(a=>situacaoHorario(a)===k).length;
  const sem = db.appts.filter(a=>a.date>=dias[0] && a.date<=dias[6] && a.st!=='desmarcado');
  const R = ui.remarcar && db.appts.find(a=>a.id===ui.remarcar), F = formAgenda(), sv = servicoDe(F.tipo), pid = R ? R.pid : F.pid;
  const livres = horariosLivres(db.appts, F.date, F.tipo, R?.id), prox = !R && proximoDe(pid);
  return `<div class="head"><div><h1>Agenda</h1><p>Semana de ${fmt(dias[0])} a ${fmt(dias[6])} · ${sem.length} horário${sem.length===1?'':'s'} · ${brl(sem.reduce((n,a)=>n+a.valor,0))}</p></div>
    <div class="quick"><button class="btn" data-act="week" data-d="-1" aria-label="Semana anterior" data-tip="Semana anterior">${ic('esq')}</button><button class="btn" data-act="week" data-d="0">Hoje</button><button class="btn" data-act="week" data-d="1" aria-label="Próxima semana" data-tip="Próxima semana">${ic('dir')}</button><button class="btn pri" data-act="rolar" data-to="f-appt">${ic('mais')}Agendar</button></div></div>
  <div class="ag-sem" role="tablist" aria-label="Dias da semana">${dias.map(d=>{ const n=horariosDoDia(db.appts,d).length;
    return `<button role="tab" class="${d===dia?'on':''} ${d===TODAY?'hoje':''}" data-act="ag-dia" data-d="${d}" aria-selected="${d===dia}"><span>${diaSem(d)}</span><b>${d.slice(8)}</b><small>${n?`${n} hor.`:'livre'}</small></button>`; }).join('')}</div>
  <div class="grid g-side ag-cols"><div class="card" id="ag-dia"><div class="card-h"><h2>${diaSem(dia,{weekday:'long',day:'2-digit',month:'2-digit'})}${dia===TODAY?' · hoje':''}<small>${L.length} horário${L.length===1?'':'s'} · ${brl(L.reduce((n,a)=>n+a.valor,0))}</small></h2>
      <div class="rx-res"><span class="pill ok" data-cont="confirmado">Confirmados ${conta('confirmado')}</span><span class="pill" data-cont="agendado">A confirmar ${conta('agendado')}</span>${conta('atendido')?`<span class="pill acc" data-cont="atendido">Atendidos ${conta('atendido')}</span>`:''}${conta('faltou')?`<span class="pill crit" data-cont="faltou">Faltas ${conta('faltou')}</span>`:''}</div></div>
    <div class="rx-leg" aria-hidden="true">${SITUACOES_HORARIO.map(([,n,i])=>`<span>${ic(i)}${n}</span>`).join('')}</div>
    <div class="hor-l" id="ag-l">${L.map(linhaHorario).join('') || `<div class="vazio">${ic('agenda')}Nenhum horário neste dia.</div>`}</div>
    ${fora.length?`<details class="ag-fora"><summary>${fora.length} desmarcado${fora.length>1?'s':''}</summary><div class="hor-l">${fora.map(linhaHorario).join('')}</div></details>`:''}
    <div class="lbl" style="margin:14px 0 8px">Horários livres para ${esc(F.tipo.toLowerCase())}${F.date===dia?'':` em ${fmt(F.date)}`}</div>
    <div class="chips" id="ag-livres">${livres.map(h=>`<button class="chip ${F.time===h?'on':''}" data-act="ag-livre" data-h="${h}">${h}</button>`).join('') || '<span class="muted sm">Dia cheio.</span>'}</div></div>
  <div class="grid" style="align-content:start"><form class="card" id="f-appt"><div class="card-h"><h2>${R?'Remarcar':'Agendar'}<small>${R?`${esc(patient(R.pid)?.name||'')} · era ${fmt(R.date)} às ${R.time}`:'paciente, serviço e horário'}</small></h2>${R?'<button type="button" class="btn sm ghost" data-act="ag-rem-x">Cancelar</button>':''}</div>
      <div class="ag-f">
        <label class="rx-f full"><span class="lbl">Paciente</span><select id="na-p" data-agf="pid" ${R?'disabled':''}>${db.patients.map(p=>`<option value="${p.id}" ${p.id===pid?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label class="rx-f full"><span class="lbl">Serviço</span><select id="na-tipo" data-agf="tipo">${[...SERVICOS, ...(SERVICOS.some(s=>s[0]===F.tipo)?[]:[servicoDe(F.tipo)])].map(([n,m])=>`<option value="${esc(n)}" ${n===F.tipo?'selected':''}>${esc(n)} · ${m} min</option>`).join('')}</select></label>
        <label class="rx-f"><span class="lbl">Dia</span><input id="na-d" type="date" data-agf="date" value="${F.date}" required></label>
        <label class="rx-f"><span class="lbl">Horário</span><input id="na-t" type="time" data-agf="time" value="${F.time}" required></label>
      </div>
      <p class="muted sm" style="margin:10px 0">${sv[1]} min · ${brl(sv[2])} (valor do serviço).${prox?` Próximo horário: ${fmt(prox.date)} às ${prox.time}.`:''}</p>
      <button class="btn pri">${ic('check')}${R?'Salvar novo horário':'Agendar'}</button></form>
    ${lembretes()}
    <div class="card"><h2>Como funciona</h2><p class="muted sm">Toque num dia da semana para ver os horários. Ao lado de cada horário, marque confirmado, atendido ou faltou. <b>Atender</b> abre o atendimento; ao finalizar, o horário fica como atendido. Remarcar guarda de onde veio e desmarcar não apaga.</p>
      <p class="muted sm" style="margin-top:8px">O botão do WhatsApp abre a mensagem de lembrete pronta; é só conferir e enviar.</p></div></div></div>`;
}
