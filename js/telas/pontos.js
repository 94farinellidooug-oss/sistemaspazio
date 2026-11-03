// Tela Pontos e meridianos.
import { elTag } from '../componentes/campos.js';
import { CAUT, MER, POINTS } from '../conhecimento/pontos.js';
import { ui } from '../estado.js';
import { ic } from '../componentes/icones.js';
import { esc } from '../util.js';

export function vPontos(){
  return `<div class="head"><div><h1>Biblioteca clínica</h1><p>Pontos e meridianos · ${POINTS.length} pontos de uso frequente, com localização e cautelas</p></div></div>
  <div class="card" style="margin-bottom:16px;display:grid;gap:10px">
    <div class="field"><label class="lbl" for="pt-q">Buscar por código, nome ou ação</label><label class="busca">${ic('busca')}<input id="pt-q" value="${esc(ui.ptQ)}" placeholder="Ex.: Shen, umidade, BP6"></label></div>
    <div class="chips"><button class="chip ${!ui.ptMer?'on':''}" data-act="mer" data-m="">Todos</button>${Object.entries(MER).filter(([k])=>POINTS.some(p=>p.mer===k)).map(([k,[n,e]])=>`<button class="chip ${ui.ptMer===k?'on':''}" data-act="mer" data-m="${k}">${k} · ${n}</button>`).join('')}</div>
  </div>
  <div class="pcards" id="ptlist">${pointCards()}</div>`;
}
export function pointCards(){
  const q=ui.ptQ.toLowerCase();
  const l=POINTS.filter(p=>(!ui.ptMer||p.mer===ui.ptMer)&&(!q||(p.code+p.pinyin+p.acoes+p.loc).toLowerCase().includes(q)));
  return l.map(p=>`<div class="pcard"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span class="code">${p.code}</span><span class="muted">${p.pinyin}</span></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="muted" style="font-size:.8rem">${MER[p.mer][0]}</span>${elTag(MER[p.mer][1])}</div>
    <div><span class="lbl">Localização</span><br>${p.loc}</div><div><span class="lbl">Ações</span><br>${p.acoes}</div>${p.cautela?`<span class="pill warn" style="justify-self:start">${CAUT[p.cautela]}</span>`:''}</div>`).join('')||'<p class="muted">Nenhum ponto encontrado.</p>';
}
