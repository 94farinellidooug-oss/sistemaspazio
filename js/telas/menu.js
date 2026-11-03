// Menu lateral.
import { route } from '../app.js';

export const ICON = {
  painel:'<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  agenda:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pacientes:'<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-4-5.5"/>',
  prontuario:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  avaliacao:'<circle cx="12" cy="12" r="9"/><path d="M12 3a4.5 4.5 0 0 1 0 9a4.5 4.5 0 0 0 0 9"/><circle cx="12" cy="7.5" r="1"/><circle cx="12" cy="16.5" r="1"/>',
  pentagrama:'<path d="M12 3l2.6 6.3H21l-5.2 4.1 2 6.6L12 16l-5.8 4 2-6.6L3 9.3h6.4z"/>',
  pontos:'<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/>'
};
export const NAV = [['Clínica',[['painel','Painel'],['agenda','Agenda'],['pacientes','Pacientes']]],['Clínico',[['prontuario','Prontuário'],['avaliacao','Avaliação energética'],['pentagrama','Pentagrama'],['pontos','Pontos e meridianos']]]];
export function renderNav(route){
  document.getElementById('nav').innerHTML = `<div class="brand"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" style="fill:none;stroke:var(--accent);stroke-width:1.6"/><path d="M12 2a5 5 0 0 1 0 10a5 5 0 0 0 0 10a10 10 0 0 1 0-20" style="fill:var(--accent)"/></svg><div><b>Spazio</b><small>Gestão clínica integrativa</small></div></div>`+
  NAV.map(([g,items])=>`<div class="grp">${g}</div>`+items.map(([k,l])=>`<a href="#${k}" class="${route===k?'on':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON[k]}</svg>${l}</a>`).join('')).join('')+
  `<div class="foot">Protótipo com dados de exemplo.<br><button class="btn ghost sm" data-act="reset" style="padding-left:0">Restaurar exemplos</button></div>`;
}
