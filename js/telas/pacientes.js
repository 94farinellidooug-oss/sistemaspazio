// Tela Pacientes.
import { db } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { age, esc, initials } from '../util.js';

export function vPacientes(){
  return `<div class="head"><div><h1>Pacientes</h1><p>${db.patients.length} cadastrados</p></div></div>
  <div class="grid g-side">
    <div class="card"><div class="field" style="margin-bottom:8px"><label class="lbl" for="pq">Buscar</label><input id="pq" placeholder="Nome ou queixa" value="${esc(ui.pq)}"></div><div class="list" id="plist">${patientRows()}</div></div>
    <div class="card"><h2>Novo paciente</h2>
      <form id="f-patient" class="form">
        <div class="field full"><label class="lbl" for="np-name">Nome completo</label><input id="np-name" required></div>
        <div class="field"><label class="lbl" for="np-birth">Nascimento</label><input id="np-birth" type="date" required></div>
        <div class="field"><label class="lbl" for="np-phone">WhatsApp</label><input id="np-phone" placeholder="(11) 90000-0000"></div>
        <div class="field full"><label class="lbl" for="np-q">Queixa principal</label><input id="np-q" required></div>
        <label class="full" style="display:flex;gap:8px;align-items:flex-start;font-size:.84rem"><input type="checkbox" id="np-lgpd" required style="margin-top:3px"> O paciente autorizou o tratamento dos dados de saúde para fins de atendimento (consentimento LGPD).</label>
        <div class="full"><button class="btn pri">Cadastrar e abrir prontuário</button></div>
      </form>
    </div>
  </div>`;
}
export function patientRows(){
  const q=ui.pq.toLowerCase();
  const list=db.patients.filter(p=>!q || (p.name+p.queixa).toLowerCase().includes(q));
  return list.length?list.map(p=>`<div class="row click" data-act="open" data-pid="${p.id}"><span class="avatar">${initials(p.name)}</span><div class="grow"><div class="trunc"><b>${esc(p.name)}</b> <span class="muted">${age(p.birth)} anos</span></div><div class="muted trunc">${esc(p.queixa)}</div></div>${p.exemplo?'<span class="pill ex">exemplo</span>':''}<span class="muted mono">${p.sessions.length} sess.</span></div>`).join(''):'<p class="muted" style="padding:8px 4px">Nenhum paciente encontrado.</p>';
}
