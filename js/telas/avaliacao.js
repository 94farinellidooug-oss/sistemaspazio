// Tela Avaliação energética.
import { elTag, patientSelect } from '../componentes/campos.js';
import { pentagram } from '../componentes/pentagrama.js';
import { CAUT, PT } from '../conhecimento/pontos.js';
import { SIGN, SIGNS } from '../conhecimento/sinais.js';
import { patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { bagang, elemState, evaluate } from '../raciocinio/avaliacao.js';
import { ic } from '../componentes/icones.js';
import { esc } from '../util.js';

export function vAvaliacao(){
  if(!ui.assess || !patient(ui.assess.pid)) ui.assess={pid:ui.pid,signs:[],status:{},nota:''};
  const A=ui.assess, p=patient(A.pid);
  ui.crumbs=[['#pacientes','Pacientes'],[`data-act="open" data-pid="${p.id}"`,p.name],[null,'Avaliação energética']];
  const hyps=evaluate(A.signs), st=elemState(A.signs,A.status), bg=bagang(A.signs);
  const axis=(l,r,v)=>`<div class="axis"><span>${l}</span><div class="track"><span class="dot" style="left:${50+v*50}%"></span></div><span>${r}</span></div>`;
  return `<div class="head"><div><h1>Avaliação energética</h1><p>Língua, pulso e manifestações organizados segundo a MTC</p></div>
    <div class="field" style="min-width:200px"><label class="lbl" for="as-patient">Paciente</label>${patientSelect('as-patient',A.pid)}</div></div>
  <div class="notice" style="margin-bottom:16px">${ic('info')}<div><b>Apoio ao raciocínio clínico.</b> As hipóteses abaixo são geradas a partir dos sinais marcados e não constituem diagnóstico. Cabe ao profissional aceitar, descartar e decidir a conduta.</div></div>
  <div class="grid g-side">
    <div class="grid" style="align-content:start">
      <div class="card sigs">${Object.entries(SIGNS).map(([g,list])=>`<div><div class="lbl" style="margin-bottom:6px">${g}</div><div class="chips">${list.map(([k,l])=>`<button class="chip ${A.signs.includes(k)?'on':''}" data-act="sign" data-s="${k}" aria-pressed="${A.signs.includes(k)}">${l}</button>`).join('')}</div></div>`).join('')}</div>
      <div class="card"><div class="card-h"><h2>Hipóteses de padrão</h2><span class="muted">${hyps.length} encontradas</span></div>
        <div class="grid">${hyps.length?hyps.map(h=>{const s=A.status[h.p.id]||'';return `<div class="hyp ${s}">
          <div class="hyp-h"><div><b>${h.p.nome}</b> <span style="margin-left:6px">${elTag(h.p.el)}</span></div>
            <div style="display:flex;gap:6px"><button class="btn sm ${s==='aceito'?'pri':''}" data-act="hyp" data-p="${h.p.id}" data-st="aceito">${s==='aceito'?'Aceito':'Aceitar'}</button><button class="btn sm" data-act="hyp" data-p="${h.p.id}" data-st="descartado">${s==='descartado'?'Descartado':'Descartar'}</button></div></div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center"><div class="bar"><i style="width:${Math.round(h.score*100)}%"></i></div><span class="mono muted">${h.m.length}/${h.p.sinais.length} sinais</span></div>
          <div style="font-size:.86rem"><span class="lbl">Por que aparece</span><br>${h.m.map(x=>SIGN[x]).join(', ')}</div>
          ${h.falta.length?`<div style="font-size:.86rem" class="muted"><span class="lbl">Sinais esperados não observados</span><br>${h.falta.map(x=>SIGN[x]).join(', ')}</div>`:''}
          <div class="pts"><span class="lbl">Pontos frequentemente considerados</span>${h.p.pontos.map(([c,j])=>`<div><span class="mono">${c}</span> ${esc(PT[c]?.pinyin||'')} · <span class="muted">${esc(j)}</span>${PT[c]?.cautela?` <span class="pill warn">${CAUT[PT[c].cautela]}</span>`:''}</div>`).join('')}</div>
        </div>`}).join(''):'<p class="muted">Marque ao menos dois sinais para ver hipóteses.</p>'}</div>
      </div>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card"><h3>Oito princípios (Ba Gang)</h3><div class="grid" style="gap:10px">${axis('Frio','Calor',bg.fc)}${axis('Deficiência','Excesso',bg.de)}</div>
        <p class="muted" style="font-size:.8rem;margin-top:10px">${bg.n?`Calculado a partir de ${bg.n} sinais marcados.`:'Marque sinais para posicionar os eixos.'}</p></div>
      <div class="card"><h3>Cinco elementos</h3>${pentagram(st,null)}<p class="muted" style="font-size:.8rem">Atualiza conforme você marca sinais e valida hipóteses.</p></div>
      <div class="card"><div class="field"><label class="lbl" for="as-nota">Observações do profissional</label><textarea id="as-nota">${esc(A.nota)}</textarea></div>
        <button class="btn pri" style="margin-top:10px" data-act="save-assess" ${A.signs.length?'':'disabled'}>Salvar avaliação no prontuário de ${esc(p.name.split(' ')[0])}</button></div>
    </div>
  </div>`;
}
