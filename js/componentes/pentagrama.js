// Pentagrama dos cinco elementos em SVG.
import { EL, KE, ORDER, SHENG, controlador, mae } from '../conhecimento/elementos.js';

export function pentagram(state, sel, o={}){
  const C=250,R=160,r=46, rad=a=>a*Math.PI/180;
  const pos=e=>[C+R*Math.cos(rad(EL[e].ang)), C+R*Math.sin(rad(EL[e].ang))];
  const rel = (a,b)=>!sel || a===sel || b===sel;
  let s=`<svg viewBox="-80 0 660 480" class="penta" role="img" aria-label="Pentagrama dos cinco elementos com ciclos de geração e controle">
  <defs>
    <marker id="ms" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" style="fill:var(--accent)"/></marker>
    <marker id="mk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" style="fill:var(--muted)"/></marker>
  </defs>`;
  if(o.sheng!==false) ORDER.forEach(e=>{
    const d=(r+10)/R, a1=rad(EL[e].ang)+d, a2=rad(EL[e].ang+72)-d;
    const p1=[C+R*Math.cos(a1),C+R*Math.sin(a1)], p2=[C+R*Math.cos(a2),C+R*Math.sin(a2)];
    const cls = sel ? (rel(e,SHENG[e])?'hi':'dim') : '';
    s+=`<path class="sheng ${cls}" d="M${p1[0].toFixed(1)},${p1[1].toFixed(1)} A${R},${R} 0 0 1 ${p2[0].toFixed(1)},${p2[1].toFixed(1)}" marker-end="url(#ms)"/>`;
  });
  if(o.ke!==false) ORDER.forEach(e=>{
    const [x1,y1]=pos(e),[x2,y2]=pos(KE[e]), L=Math.hypot(x2-x1,y2-y1), ux=(x2-x1)/L, uy=(y2-y1)/L, k=r+8;
    const cls = sel ? (rel(e,KE[e])?'hi':'dim') : '';
    s+=`<path class="ke ${cls}" d="M${(x1+ux*k).toFixed(1)},${(y1+uy*k).toFixed(1)} L${(x2-ux*k).toFixed(1)},${(y2-uy*k).toFixed(1)}" marker-end="url(#mk)"/>`;
  });
  ORDER.forEach(e=>{
    const [x,y]=pos(e), E=EL[e], st=state?state[e]:{def:0,exc:0};
    const kind = st.exc>st.def && st.exc>0 ? 'exc' : st.def>0 ? 'def' : '';
    const dim = sel && sel!==e && SHENG[sel]!==e && mae(sel)!==e && KE[sel]!==e && controlador(sel)!==e;
    s+=`<g class="node" data-act="el" data-e="${e}" tabindex="0" role="button" aria-label="${E.nome}" style="opacity:${dim?.35:1}">
      <circle cx="${x}" cy="${y}" r="${r}" style="fill:${E.cor};fill-opacity:${kind==='def'?.08:.18}"/>
      <circle class="ring" cx="${x}" cy="${y}" r="${r}" style="fill:none;stroke:${E.cor};stroke-width:${kind==='exc'?6:sel===e?5:3}" ${kind==='def'?'stroke-dasharray="6 5"':''}/>
      <text x="${x}" y="${y-2}" text-anchor="middle" style="fill:${E.cor};font-size:28px;font-weight:600">${E.han}</text>
      <text x="${x}" y="${y+20}" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">${E.nome}</text>
      ${(()=>{ const c=Math.cos(rad(E.ang)); let lx=x, ly=y+r+17, an='middle';
        if(e==='fogo') ly=y-r-26; else if(c<-.5){lx=x-r-10;ly=y+4;an='end'} else if(c>.5&&e==='terra'){lx=x+r+10;ly=y+4;an='start'}
        return `<text x="${lx}" y="${ly}" text-anchor="${an}" style="fill:var(--muted);font-size:11.5px">${E.zang.split(' · ')[0]} · ${E.emocao.split(' ')[0]}</text>`+
        (kind?`<text x="${lx}" y="${ly+15}" text-anchor="${an}" style="fill:${kind==='exc'?'var(--crit)':'var(--warn)'};font-size:11px;font-weight:600">${kind==='exc'?'▲ excesso':'▼ deficiência'}</text>`:''); })()}
    </g>`;
  });
  return s+'</svg>';
}
