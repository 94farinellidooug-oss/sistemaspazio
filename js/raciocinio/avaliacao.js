// Raciocínio clínico de apoio: hipóteses de padrão, Ba Gang e estado dos elementos.
import { ORDER } from '../conhecimento/elementos.js';
import { BAGANG, PATTERNS } from '../conhecimento/padroes.js';

export function evaluate(signs){
  const s = new Set(signs);
  return PATTERNS.map(p=>{
    const m = p.sinais.filter(x=>s.has(x));
    return {p, m, falta:p.sinais.filter(x=>!s.has(x)), score:m.length/p.sinais.length};
  }).filter(h=>h.m.length>=2).sort((a,b)=>b.score-a.score);
}
export function elemState(signs, status){
  const st = {}; ORDER.forEach(e=>st[e]={def:0,exc:0});
  evaluate(signs).forEach(h=>{ if((status||{})[h.p.id]==='descartado') return; st[h.p.el][h.p.tipo] += h.score * ((status||{})[h.p.id]==='aceito'?1:.6); });
  return st;
}
export function bagang(signs){
  const s=new Set(signs), c=k=>BAGANG[k].filter(x=>s.has(x)).length;
  const t=(a,b)=>{const A=c(a),B=c(b);return A+B?(B-A)/(A+B):0};
  return {fc:t('frio','calor'), de:t('def','exc'), n:signs.length};
}
