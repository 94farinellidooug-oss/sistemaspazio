// Tela Prontuário (perfil do paciente): resumo com evolução e avaliação, anamnese e alertas,
// sessões e registro de nova sessão. As abas e os dados gravados são os mesmos de antes.
import { elTag } from '../componentes/campos.js';
import { anel, barrasEl, delta, linhas } from '../componentes/graficos.js';
import { ic, vazio } from '../componentes/icones.js';
import { pentagram } from '../componentes/pentagrama.js';
import { PT } from '../conhecimento/pontos.js';
import { db, patient } from '../dados/repositorio.js';
import { alertasDe, melhoraPct } from '../dados/indicadores.js';
import { ui } from '../estado.js';
import { elemState, evaluate } from '../raciocinio/avaliacao.js';
import { TODAY, age, esc, fmt, initials } from '../util.js';

export function vProntuario(){
  const p=patient(ui.pid)||db.patients[0]; ui.pid=p.id;
  const a=p.assess.at(-1), st=a?elemState(a.signs,a.status):null;
  const alerts=alertasDe(p);
  const tabs=[['resumo','Resumo','painel'],['anamnese','Anamnese e alertas','folha'],['sessoes','Sessões','lista'],['nova','Registrar sessão','mais']];
  ui.crumbs=[['#pacientes','Pacientes'],[null,p.name]];
  let body='';
  if(ui.tab==='resumo'){
    const ac = a?evaluate(a.signs).filter(h=>a.status[h.p.id]==='aceito'):[];
    const s=p.sessions.map(x=>x.eva), m=melhoraPct(s), a0=p.assess[0];
    const prox=db.appts.filter(x=>x.pid===p.id&&x.date>=TODAY&&!x.done).sort((x,y)=>(x.date+x.time).localeCompare(y.date+y.time))[0];
    body=`<div class="tiles">
      <div class="tile"><span class="tico acc">${ic('lista')}</span><div><b class="num">${p.sessions.length}</b><small>sess${p.sessions.length===1?'ão':'ões'}${p.sessions[0]?` desde ${fmt(p.sessions[0].date)}`:''}</small></div></div>
      <div class="tile">${m!==null?anel(Math.max(0,m)/100,m+'%','var(--ok)'):`<span class="tico">${ic('evolucao')}</span>`}<div><b>${m!==null?(m>0?'Melhora':'Sem melhora'):'Sem evolução'}</b><small>${m!==null?'EVA da queixa principal desde a 1ª sessão':'registre ao menos duas sessões'}</small></div></div>
      <div class="tile"><span class="tico acc">${ic('yin')}</span><div><b>${p.assess.length?p.assess.length+(p.assess.length===1?' avaliação':' avaliações'):'Sem avaliação'}</b><small>${a?`última em ${fmt(a.date)}`:'avaliação energética pendente'}</small></div></div>
      <div class="tile"><span class="tico">${ic('agenda')}</span><div><b>${prox?`${fmt(prox.date)} · ${prox.time}`:'—'}</b><small>${prox?esc(prox.tipo):'sem próximo agendamento'}</small></div></div>
    </div>
    <div class="grid g-side">
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-h"><h2>Queixa principal</h2><span class="muted sm">EVA de 0 a 10</span></div>
          <div class="qc"><div class="qc-h"><b>${esc(p.queixa)}</b></div>
          ${s.length?`<div class="qc-v"><span class="big">${s.at(-1)}</span><span class="muted">/10</span>${delta(s[0],s.at(-1))}<span class="muted sm">desde a 1ª sessão (${s[0]})</span></div>
            ${s.length>1?linhas([{cor:'var(--brand)',vals:s,nome:'EVA'}],p.sessions.map(x=>fmt(x.date).slice(0,5)),{w:520,h:170,label:'Evolução da EVA por sessão'}):''}`:'<p class="muted sm">A intensidade aparece com a primeira sessão registrada.</p>'}</div></div>
        <div class="card"><div class="card-h"><h2>Sessões recentes</h2>${p.sessions.length?`<button class="btn ghost sm" data-act="tab" data-t="sessoes">Ver todas ${ic('dir')}</button>`:''}</div>
          ${p.sessions.length?`<div class="hist">${[...p.sessions].reverse().slice(0,3).map(x=>`<div class="hi on"><div class="hi-h"><span class="hi-n">${p.sessions.indexOf(x)+1}</span><span class="grow"><b>${fmt(x.date)}</b><small>${esc(x.tec.join(', '))||'sessão'}</small></span><span class="pill">EVA ${x.eva}</span></div>${x.nota?`<div class="hi-b"><p>${esc(x.nota)}</p></div>`:''}</div>`).join('')}</div>`
            :vazio('lista','Nenhuma sessão','Use “Novo atendimento” para registrar a primeira sessão.')}</div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-h"><h2>Mapa dos cinco elementos</h2>${a?`<span class="pill">${fmt(a.date)}</span>`:''}</div>
          ${st?`${barrasEl(st, p.assess.length>1?elemState(a0.signs,a0.status):null)}${p.assess.length>1?`<p class="muted sm" style="margin-top:6px">Marca vertical: posição na primeira avaliação (${fmt(a0.date)}).</p>`:''}
            <details class="mais"><summary>Ver pentagrama ${ic('baixo')}</summary>${pentagram(st,null)}</details>`
          :vazio('yin','Sem avaliação energética','Faça a avaliação para ver o mapa dos cinco elementos.',`<button class="btn sm pri" data-act="ir" data-to="avaliacao" data-pid="${p.id}">${ic('yin')}Avaliar</button>`)}</div>
        <div class="card"><div class="card-h"><h2>Padrões validados</h2><a class="btn sm" href="#avaliacao">Nova avaliação</a></div>
          ${ac.length?ac.map(h=>`<div class="row"><div class="grow"><b>${h.p.nome}</b></div>${elTag(h.p.el)}<span class="pill ${h.p.tipo==='exc'?'crit':'warn'}">${h.p.tipo==='exc'?'excesso':'deficiência'}</span></div>`).join(''):'<p class="muted sm">Nenhum padrão validado.</p>'}
          ${a?.nota?`<p class="muted" style="margin-top:8px">Nota: ${esc(a.nota)}</p>`:''}
        </div>
      </div>
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
  return `<div class="perfil-h"><span class="avatar xl">${initials(p.name)}</span><div class="grow"><h1>${esc(p.name)}</h1>
    <div class="meta"><span>${age(p.birth)} anos</span>${p.phone?`<span>${ic('tel')}${esc(p.phone)}</span>`:''}${p.exemplo?'<span class="pill ex">exemplo</span>':''}</div>
    ${alerts.length?`<div class="chips" style="margin-top:8px">${alerts.map(x=>`<span class="pill crit">${ic('escudo')}${x}</span>`).join('')}</div>`:''}</div>
    <div class="perfil-a"><button class="btn" data-act="ir" data-to="avaliacao" data-pid="${p.id}">${ic('yin')}Avaliação energética</button><button class="btn" data-act="ir" data-to="pentagrama" data-pid="${p.id}">${ic('estrela')}Pentagrama</button><button class="btn pri" data-act="tab" data-t="nova">${ic('play')}Novo atendimento</button></div></div>
    <div class="tabs" role="tablist">${tabs.map(([k,l,i])=>`<button role="tab" data-act="tab" data-t="${k}" class="${ui.tab===k?'on':''}" aria-selected="${ui.tab===k}">${ic(i)}${l}</button>`).join('')}</div>${body}`;
}
