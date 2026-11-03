// Menu lateral recolhível, em quatro grupos, e barra superior no celular.
import { ui } from '../estado.js';

export const ICON = {
  painel:'<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  agenda:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pacientes:'<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-4-5.5"/>',
  prontuario:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  avaliacao:'<circle cx="12" cy="12" r="9"/><path d="M12 3a4.5 4.5 0 0 1 0 9a4.5 4.5 0 0 0 0 9"/><circle cx="12" cy="7.5" r="1"/><circle cx="12" cy="16.5" r="1"/>',
  pentagrama:'<path d="M12 3l2.6 6.3H21l-5.2 4.1 2 6.6L12 16l-5.8 4 2-6.6L3 9.3h6.4z"/>',
  pontos:'<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 3 15.5-3.5 1z"/>',
  crm:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  financeiro:'<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 10v5M18 10v5"/>',
  documentos:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 15c1.5-2 2.5 1 4-1s2 1 3 0"/>',
  relatorios:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  equipe:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',
  configuracoes:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'
};
// [rota, rótulo, opções]. "sub": item dentro de Prontuários até as etapas 2 e 3; "breve": módulo planejado.
export const NAV = [
  ['Visão geral',[['painel','Painel'],['agenda','Agenda']]],
  ['Gestão clínica',[['pacientes','Pacientes'],['prontuario','Prontuários'],['avaliacao','Avaliação energética',{sub:true}],['pentagrama','Pentagrama',{sub:true}],['pontos','Biblioteca clínica']]],
  ['Gestão administrativa',[['crm','CRM',{breve:true}],['financeiro','Financeiro',{breve:true}],['documentos','Documentos e assinaturas',{breve:true}],['relatorios','Relatórios',{breve:true}]]],
  ['Administração',[['equipe','Equipe e permissões',{breve:true}],['configuracoes','Configurações',{breve:true}]]]
];
export const LABEL = Object.fromEntries(NAV.flatMap(([,it])=>it.map(([k,l])=>[k,l])));
const LOGO = `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" style="fill:none;stroke:var(--brand);stroke-width:1.6"/><path d="M12 2a5 5 0 0 1 0 10a5 5 0 0 0 0 10a10 10 0 0 1 0-20" style="fill:var(--brand)"/></svg>`;
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON[k]}</svg>`;

export function renderNav(route){
  const app = document.querySelector('.app');
  app.classList.toggle('mini', !!ui.menuMini);
  app.classList.toggle('open', !!ui.menuAberto);
  document.getElementById('topbar').innerHTML = `<button class="menu-btn" data-act="menu-abrir" aria-label="Abrir menu" aria-expanded="${!!ui.menuAberto}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>${LOGO}<b>Spazio</b><span class="where">${LABEL[route]||''}</span>`;
  document.getElementById('nav').innerHTML = `<div class="brand">${LOGO}<div><b>Spazio</b><small>Gestão clínica integrativa</small></div></div>`+
  NAV.map(([g,items])=>`<div class="grp">${g}</div>`+items.map(([k,l,o={}])=>`<a href="#${k}" aria-label="${l}" class="${route===k?'on':''} ${o.sub?'sub':''}" ${route===k?'aria-current="page"':''}>${svg(k)}<span>${l}</span>${o.breve?'<span class="soon">em breve</span>':''}</a>`).join('')).join('')+
  `<div class="foot"><p>Protótipo com dados de exemplo.</p><button class="btn ghost sm" data-act="reset" style="justify-content:flex-start">Restaurar exemplos</button>
    <button class="toggle" data-act="menu-mini" aria-label="${ui.menuMini?'Expandir menu':'Recolher menu'}" title="${ui.menuMini?'Expandir menu':'Recolher menu'}">${ui.menuMini?'»':'« Recolher menu'}</button></div>`;
}
