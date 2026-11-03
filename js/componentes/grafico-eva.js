// Minigráfico de evolução da EVA.

export function spark(vals,w=120,h=32){
  if(vals.length<2) return `<span class="muted mono">${vals[0]??'–'}</span>`;
  const x=i=>4+i*(w-8)/(vals.length-1), y=v=>4+(1-v/10)*(h-8);
  const d=vals.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-label="Evolução EVA ${vals.join(', ')}"><path class="a" d="${d}L${x(vals.length-1)},${h}L${x(0)},${h}z"/><path class="l" d="${d}"/><circle cx="${x(vals.length-1)}" cy="${y(vals.at(-1))}" r="3"/></svg>`;
}
