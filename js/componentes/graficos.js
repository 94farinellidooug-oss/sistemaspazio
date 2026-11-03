// Gráficos em SVG do design system: linhas, barras, anel de progresso e barras dos cinco elementos.
// Pontos e barras levam data-tip, que mostra o valor ao passar o mouse.
import { EL } from '../conhecimento/elementos.js';
import { esc } from '../util.js';

// Linhas de 0 a 10 (intensidade da queixa). series: [{vals, cor, nome}], vals pode ter null; o.mini desenha sem eixos.
export function linhas(series, labels, o={}){
  const W=o.w||640, H=o.h||220, [L,R,T,B]=o.mini?[6,8,6,6]:[28,14,12,26], n=Math.max(2,...series.map(s=>s.vals.length));
  const x=i=>L+i*(W-L-R)/(n-1), y=v=>T+(1-v/10)*(H-T-B);
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'Gráfico de evolução')}">`;
  if(!o.mini) [0,5,10].forEach(v=>s+=`<line class="gl" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L-8}" y="${y(v)+4}" text-anchor="end">${v}</text>`);
  labels.forEach((l,i)=>s+=`<text class="ax" x="${x(i)}" y="${H-6}" text-anchor="middle">${esc(l)}</text>`);
  series.forEach((se,k)=>{ if(!se.vals.some(v=>v!=null)) return;
    // Valores ausentes (null) ficam sem ponto e interrompem a linha (queixa não medida naquele atendimento).
    const ult=se.vals.reduce((u,v,i)=>v!=null?i:u,-1);
    const d=se.vals.map((v,i)=>v==null?'':`${i&&se.vals[i-1]!=null?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    s+=`<g class="se" data-s="${k}"><path d="${d}" fill="none" stroke="${se.cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    s+=se.vals.map((v,i)=>{ if(v==null) return ''; const tip=o.mini?'':(o.tips?.[i]||`${se.nome?se.nome+' · ':''}${labels[i]||''}: ${String(v).replace('.',',')}`);
      return `<circle class="${tip?'pt-i':''}" cx="${x(i)}" cy="${y(v)}" r="${i===ult?5:3.5}" fill="${i===ult?se.cor:'var(--surface)'}" stroke="${se.cor}" stroke-width="2" ${tip?`data-tip="${esc(tip)}"`:''}/>`; }).join('')+'</g>';
  });
  return s+'</svg>';
}
// Barras verticais; a última fica destacada (período atual).
export function barrasV(vals, labels, o={}){
  const W=o.w||560, H=o.h||190, B=24, T=18, max=Math.max(1,...vals), bw=W/vals.length;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'')}">`;
  [0,.5,1].forEach(f=>s+=`<line class="gl" x1="0" x2="${W}" y1="${H-B-f*(H-B-T)}" y2="${H-B-f*(H-B-T)}"/>`);
  vals.forEach((v,i)=>{ const h=v/max*(H-B-T), x=i*bw+bw*.22, w=bw*.56, ult=i===vals.length-1;
    s+=`<rect class="br-i" x="${x}" y="${H-B-h}" width="${w}" height="${Math.max(h,2)}" rx="6" fill="${ult?'var(--brand)':'var(--sage)'}" data-tip="${esc(o.tips?o.tips[i]:`${labels[i]}: ${v}`)}"/><text class="ax" x="${x+w/2}" y="${H-B-h-6}" text-anchor="middle">${v}</text><text class="ax" x="${x+w/2}" y="${H-6}" text-anchor="middle">${esc(labels[i])}</text>`; });
  return s+'</svg>';
}
// Anel de progresso (0 a 1) com texto no centro.
export function anel(pct, txt, cor='var(--brand)'){
  const r=24, c=2*Math.PI*r;
  return `<svg class="anel" viewBox="0 0 60 60" width="60" height="60" aria-hidden="true"><circle cx="30" cy="30" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="30" cy="30" r="${r}" fill="none" stroke="${cor}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(Math.max(0,Math.min(1,pct))*c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 30 30)"/><text x="30" y="34.5" text-anchor="middle">${txt}</text></svg>`;
}
// Barras dos cinco elementos a partir do estado calculado pela avaliação (elemState), sem recalcular nada.
// base: estado da avaliação basal, mostrado como marca vertical.
const ORDEM_EL = ['madeira','fogo','terra','metal','agua'];
const tipoEl = s => s.exc>s.def&&s.exc>0?'exc':s.def>0?'def':'';
export function barrasEl(st, base){
  const pct = s => Math.min(100,Math.round(Math.max(s.def,s.exc)/1.6*100));
  return `<div class="elbars">${ORDEM_EL.map(e=>{ const s=st[e], k=tipoEl(s), E=EL[e], b=base?pct(base[e]):null;
    return `<div class="elb"><span class="han" style="color:${E.cor}">${E.han}</span><span class="nm">${E.nome}</span>
      <div class="trk">${b!==null?`<i class="base" style="left:${b}%" title="Basal"></i>`:''}<i class="fill ${k}" style="width:${Math.max(k?6:0,pct(s))}%;background:${E.cor}"></i></div>
      <span class="st ${k}">${k==='exc'?'Excesso':k==='def'?'Deficiência':'Equilíbrio'}</span></div>`;}).join('')}</div>`;
}
// Variação entre dois valores de intensidade (queda é melhora).
export const delta = (a,b) => { if(a==null||b==null) return ''; const d=b-a; return `<span class="delta ${d<0?'bom':d>0?'ruim':''}">${d<0?'▼':d>0?'▲':'='} ${Math.abs(d)}</span>`; };
