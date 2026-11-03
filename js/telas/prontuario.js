// Tela Prontuário.
import { elTag, patientSelect } from '../componentes/campos.js';
import { spark } from '../componentes/grafico-eva.js';
import { pentagram } from '../componentes/pentagrama.js';
import { PT } from '../conhecimento/pontos.js';
import { db, patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { elemState, evaluate } from '../raciocinio/avaliacao.js';
import { TODAY, age, esc, fmt, initials } from '../util.js';

export function vProntuario(){
  const p=patient(ui.pid)||db.patients[0]; ui.pid=p.id;
  const a=p.assess.at(-1), st=a?elemState(a.signs,a.status):null;
  const alerts=[p.alerts.gestante&&'Gestante',p.alerts.anticoagulante&&'Anticoagulante',p.alerts.marcapasso&&'Marcapasso'].filter(Boolean);
  const tabs=[['resumo','Resumo'],['anamnese','Anamnese'],['sessoes','Sessões'],['nova','Registrar sessão']];
  let body='';
  if(ui.tab==='resumo'){
    const ac = a?evaluate(a.signs).filter(h=>a.status[h.p.id]==='aceito'):[];
    body=`<div class="grid g-side">
      <div class="grid" style="align-content:start">
        <div class="card"><h3>Queixa principal</h3><p>${esc(p.queixa)}</p></div>
        <div class="card"><div class="card-h"><h3>Evolução (EVA)</h3><span class="muted">${p.sessions.length} sessões</span></div>${spark(p.sessions.map(s=>s.eva),320,70)}
          <div class="muted" style="font-size:.8rem;margin-top:6px">De ${p.sessions[0]?.eva??'–'} para ${p.sessions.at(-1)?.eva??'–'} desde ${p.sessions[0]?fmt(p.sessions[0].date):'–'}</div></div>
        <div class="card"><div class="card-h"><h3>Padrões validados pelo profissional</h3><a class="btn sm" href="#avaliacao">Nova avaliação</a></div>
          ${ac.length?ac.map(h=>`<div class="row"><div class="grow"><b>${h.p.nome}</b></div>${elTag(h.p.el)}<span class="pill ${h.p.tipo==='exc'?'crit':'warn'}">${h.p.tipo==='exc'?'excesso':'deficiência'}</span></div>`).join(''):'<p class="muted">Nenhum padrão validado ainda.</p>'}
          ${a?.nota?`<p class="muted" style="margin-top:8px">Nota: ${esc(a.nota)}</p>`:''}
        </div>
      </div>
      <div class="card"><div class="card-h"><h3>Mapa dos cinco elementos</h3><a class="btn ghost sm" href="#pentagrama">Abrir</a></div>${st?pentagram(st,null):'<p class="muted">Faça uma avaliação energética para gerar o mapa.</p>'}<p class="muted" style="font-size:.8rem">Avaliação de ${a?fmt(a.date):'–'}. Anel tracejado indica deficiência; anel espesso indica excesso.</p></div>
    </div>`;
  } else if(ui.tab==='anamnese'){
    const F=[['historia','História da queixa'],['sono','Sono'],['alimentacao','Alimentação e sede'],['evacuacao','Evacuação e micção'],['emocoes','Emoções'],['medicamentos','Medicamentos em uso']];
    body=`<div class="grid g-side"><div class="card"><h3>Anamnese integrativa</h3><div class="form">${F.map(([k,l])=>`<div class="field full"><label class="lbl" for="an-${k}">${l}</label><textarea id="an-${k}" data-anam="${k}">${esc(p.anam[k])}</textarea></div>`).join('')}</div><p class="muted" style="font-size:.8rem;margin-top:8px">Salvo automaticamente ao sair do campo.</p></div>
      <div class="card" style="align-self:start"><h3>Alertas de segurança</h3><p class="muted" style="margin-bottom:10px;font-size:.86rem">Usados para avisar sobre pontos e técnicas contraindicados ao registrar a sessão.</p>
      ${[['gestante','Gestante'],['anticoagulante','Uso de anticoagulante'],['marcapasso','Portador de marcapasso']].map(([k,l])=>`<label style="display:flex;gap:8px;padding:6px 0"><input type="checkbox" id="al-${k}" data-alert="${k}" ${p.alerts[k]?'checked':''}> ${l}</label>`).join('')}</div></div>`;
  } else if(ui.tab==='sessoes'){
    body=`<div class="card"><div class="timeline">${[...p.sessions].reverse().map(s=>`<div class="sess"><div><b class="mono">${fmt(s.date)}</b><div class="eva muted">EVA ${s.eva}/10</div></div><div><div class="chips" style="margin-bottom:6px">${s.tec.map(t=>`<span class="pill">${esc(t)}</span>`).join('')}${s.pontos.map(c=>`<span class="pill acc mono" title="${esc(PT[c]?.pinyin||'')}">${esc(c)}</span>`).join('')}</div>${s.nota?`<p>${esc(s.nota)}</p>`:'<p class="muted">Sem anotações.</p>'}</div></div>`).join('')||'<p class="muted">Nenhuma sessão registrada.</p>'}</div></div>`;
  } else {
    const TEC=['Acupuntura','Auriculoterapia','Moxabustão','Ventosa','Eletroacupuntura','Massagem Tuiná','Sangria'];
    body=`<div class="grid g-side"><div class="card"><h3>Registrar sessão</h3>
      <form id="f-session" class="form">
        <div class="field"><label class="lbl" for="ns-date">Data</label><input id="ns-date" type="date" value="${TODAY}" required></div>
        <div class="field"><label class="lbl" for="ns-eva">Intensidade da queixa (EVA): <b id="ns-eva-v">5</b></label><input id="ns-eva" type="range" min="0" max="10" value="5"></div>
        <div class="field full"><span class="lbl">Técnicas</span><div class="chips">${TEC.map(t=>`<label class="chip"><input type="checkbox" name="tec" value="${t}" style="margin-right:4px">${t}</label>`).join('')}</div></div>
        <div class="field full"><label class="lbl" for="ns-pts">Pontos utilizados (separe por vírgula)</label><input id="ns-pts" class="mono" placeholder="E36, BP6, F3"></div>
        <div class="full" id="ns-warn"></div>
        <div class="field full"><label class="lbl" for="ns-nota">Evolução e observações</label><textarea id="ns-nota"></textarea></div>
        <div class="full"><button class="btn pri">Salvar no prontuário</button></div>
      </form></div>
      <div class="card" style="align-self:start"><h3>Sugestões da última avaliação</h3><p class="muted" style="font-size:.82rem;margin-bottom:8px">Pontos ligados aos padrões validados. Clique para adicionar.</p>
      ${a?evaluate(a.signs).filter(h=>a.status[h.p.id]==='aceito').map(h=>`<div style="margin-bottom:10px"><b>${h.p.nome}</b><div class="chips" style="margin-top:6px">${h.p.pontos.map(([c,j])=>`<button type="button" class="chip mono" data-act="addpt" data-c="${c}" title="${esc(j)}">${c}</button>`).join('')}</div></div>`).join('')||'<p class="muted">Nenhum padrão validado.</p>':'<p class="muted">Sem avaliação.</p>'}</div></div>`;
  }
  return `<div class="head"><div style="display:flex;gap:12px;align-items:center"><span class="avatar" style="width:46px;height:46px;font-size:1rem">${initials(p.name)}</span><div><h1>${esc(p.name)}</h1><p>${age(p.birth)} anos · ${esc(p.phone)} ${p.exemplo?'<span class="pill ex">exemplo</span>':''}</p></div></div>
    <div class="field" style="min-width:200px"><label class="lbl" for="pr-patient">Paciente</label>${patientSelect('pr-patient',p.id)}</div></div>
    ${alerts.length?`<div class="notice crit" style="margin-bottom:14px"><b>Alertas:</b> ${alerts.join(' · ')}</div>`:''}
    <div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" data-act="tab" data-t="${k}" class="${ui.tab===k?'on':''}">${l}</button>`).join('')}</div>${body}`;
}
