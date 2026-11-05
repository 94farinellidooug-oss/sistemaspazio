// Funções utilitárias de data, formatação e texto.

export const pad = n => String(n).padStart(2,'0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const addDays = (n, base) => { const d = base ? new Date(base+'T12:00:00') : new Date(); d.setDate(d.getDate()+n); return iso(d); };
export const TODAY = addDays(0);
export const fmt = s => s.split('-').reverse().join('/');
// Hora local (hh:mm) de um instante ISO, como ficou registrado.
export const horaLocal = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
export const uid = () => Math.random().toString(36).slice(2,9);
export const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const brl = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const age = b => { const d=new Date(b), n=new Date(); let a=n.getFullYear()-d.getFullYear(); if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate())) a--; return a; };
export const initials = n => n.split(' ').map(x=>x[0]).slice(0,2).join('');
