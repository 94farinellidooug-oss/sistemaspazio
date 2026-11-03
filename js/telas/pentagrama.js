// Tela Pentagrama.
import { elTag, patientSelect } from '../componentes/campos.js';
import { pentagram } from '../componentes/pentagrama.js';
import { EL, KE, SHENG, controlador, mae } from '../conhecimento/elementos.js';
import { patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { elemState } from '../raciocinio/avaliacao.js';
import { esc, fmt } from '../util.js';

export function vPentagrama(){
  const p=patient(ui.pid), a=p?.assess.at(-1), st=a?elemState(a.signs,a.status):null, e=ui.el;
  let det='<p class="muted">Clique em um elemento para ver correspondências, funções e relações.</p>';
  if(e){
    const E=EL[e], s=st?st[e]:{def:0,exc:0}, kind=s.exc>s.def&&s.exc>0?'exc':s.def>0?'def':'';
    det=`<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px"><span style="font-size:2rem;color:${E.cor};font-family:var(--f-display)">${E.han}</span><h2>${E.nome}</h2>${kind?`<span class="pill ${kind==='exc'?'crit':'warn'}">${kind==='exc'?'excesso':'deficiência'} em ${esc(p.name.split(' ')[0])}</span>`:''}</div>
    <dl class="corr"><dt>Zang (Yin)</dt><dd>${E.zang}</dd><dt>Fu (Yang)</dt><dd>${E.fu}</dd><dt>Emoção</dt><dd>${E.emocao}</dd><dt>Aspecto mental</dt><dd>${E.espirito}</dd><dt>Estação</dt><dd>${E.estacao}</dd><dt>Clima</dt><dd>${E.clima}</dd><dt>Órgão dos sentidos</dt><dd>${E.sentido}</dd><dt>Tecido</dt><dd>${E.tecido}</dd><dt>Sabor</dt><dd>${E.sabor}</dd><dt>Som</dt><dd>${E.som}</dd></dl>
    <div class="lbl" style="margin:14px 0 4px">Funções tradicionais</div><ul style="margin:0;padding-left:18px">${E.funcoes.map(f=>`<li>${f}</li>`).join('')}</ul>
    <div class="lbl" style="margin:14px 0 4px">Relações</div>
    <dl class="corr"><dt>Gera (mãe de)</dt><dd>${elTag(SHENG[e])}</dd><dt>É gerado por</dt><dd>${elTag(mae(e))}</dd><dt>Controla</dt><dd>${elTag(KE[e])}</dd><dt>É controlado por</dt><dd>${elTag(controlador(e))}</dd></dl>
    ${kind?`<div class="notice" style="margin-top:14px"><div><b>Considerações para o raciocínio:</b> ${kind==='def'
      ?`na deficiência, a regra mãe-filho sugere avaliar a tonificação da mãe (${EL[mae(e)].nome}). Verifique também se ${EL[controlador(e)].nome} está em sobredominância.`
      :`no excesso, a regra mãe-filho sugere avaliar a sedação do filho (${EL[SHENG[e]].nome}). Observe se ${E.nome} está sobredominando ${EL[KE[e]].nome} ou insultando ${EL[controlador(e)].nome}.`} Decisão do profissional.</div></div>`:''}`;
  }
  return `<div class="head"><div><h1>Pentagrama dos cinco elementos</h1><p>Wu Xing com ciclo de geração (Sheng) e de controle (Ke)</p></div>
    <div class="field" style="min-width:200px"><label class="lbl" for="pt-patient">Sobrepor avaliação de</label>${patientSelect('pt-patient',ui.pid)}</div></div>
  <div class="grid g-side">
    <div class="card"><div class="chips" style="margin-bottom:8px">
      <label class="chip ${ui.sheng?'on':''}"><input type="checkbox" id="cb-sheng" ${ui.sheng?'checked':''} hidden>Geração (Sheng)</label>
      <label class="chip ${ui.ke?'on':''}"><input type="checkbox" id="cb-ke" ${ui.ke?'checked':''} hidden>Controle (Ke)</label>
      ${e?`<button class="chip" data-act="el" data-e="">Limpar seleção</button>`:''}</div>
      ${pentagram(st,e,{sheng:ui.sheng,ke:ui.ke})}
      <div class="chips muted" style="font-size:.8rem;justify-content:center;gap:16px;margin-top:6px"><span><span style="color:var(--accent)">⟶</span> gera</span><span>- - ➝ controla</span><span>◌ deficiência</span><span>◯ excesso (anel espesso)</span></div>
      <p class="muted" style="font-size:.8rem;text-align:center;margin-top:4px">${a?`Avaliação de ${esc(p.name)} em ${fmt(a.date)}`:'Sem avaliação para este paciente.'}</p>
    </div>
    <div class="card" style="align-self:start">${det}</div>
  </div>`;
}
