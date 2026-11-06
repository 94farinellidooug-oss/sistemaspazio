// Menu lateral recolhível (8 módulos), barra superior com migalhas, busca global, notificações e perfil,
// e as camadas que abrem por cima da tela (busca e atalhos de teclado).
import { LOGO, ic, vazio } from '../componentes/icones.js';
import { POINTS } from '../conhecimento/pontos.js';
import { db } from '../dados/repositorio.js';
import { notificacoes } from '../dados/indicadores.js';
import { ui } from '../estado.js';
import { esc, initials } from '../util.js';
import { menuConta, seloConta } from './conta.js';

// [rota, rótulo, ícone]
export const NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],
  ['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
export const LABEL = {...Object.fromEntries(NAV.map(([k,l])=>[k,l])), pontos:'Biblioteca clínica', prontuario:'Prontuário', cadastro:'Cadastro do paciente', atendimento:'Atendimento', avaliacao:'Avaliação energética', pentagrama:'Pentagrama',
  crm:'Relacionamento', mensagens:'Modelos de mensagens', equipe:'Equipe e permissões', configuracoes:'Configurações'};
// Item do menu que fica marcado em cada tela.
const ATIVO = {prontuario:'pacientes', cadastro:'pacientes', atendimento:'pacientes', avaliacao:'pacientes', pentagrama:'pacientes', pontos:'biblioteca', crm:'administracao', mensagens:'administracao', equipe:'administracao', configuracoes:'administracao'};
// Profissional exibido no topo. Passa a vir do login no multiusuário (etapa 10).
export const PROF = {nome:'Maicon Farinelli', papel:'Profissional responsável'};

const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
// Itens da busca global: [grupo, ícone, título, detalhe, atributos do link].
export function buscaItens(q){
  const Q=semAcento(q.trim()), ok=s=>!Q||semAcento(s).includes(Q), R=[];
  db.patients.filter(p=>ok(p.name+' '+p.queixa)).forEach(p=>R.push(['Pacientes','pacientes',p.name,p.queixa,`data-act="open" data-pid="${p.id}"`]));
  [['Novo paciente','novo','#cadastro'],['Abrir agenda','agenda','#agenda'],['Avaliação energética','yin','#avaliacao'],['Pentagrama','estrela','#pentagrama']].filter(([t])=>ok(t)).forEach(([t,i,h])=>R.push(['Ações',i,t,'',`href="${h}"`]));
  if(Q) NAV.filter(([,l])=>ok(l)).forEach(([k,l,i])=>R.push(['Telas',i,l,'',`href="#${k}"`]));
  if(Q) POINTS.filter(p=>ok(p.code+' '+p.pinyin+' '+p.acoes)).slice(0,5).forEach(p=>R.push(['Pontos','biblioteca',`${p.code} · ${p.pinyin}`,p.acoes,`data-act="ver-ponto" data-c="${p.code}"`]));
  return R.slice(0,12);
}
export function listaBusca(){
  const R=buscaItens(ui.q||''); ui.bi=Math.min(ui.bi||0,Math.max(0,R.length-1)); let g='';
  return R.length?R.map((r,i)=>{ const cab=r[0]!==g?`<div class="pal-g">${r[0]}</div>`:''; g=r[0];
    const tag=r[4].startsWith('href')?'a':'button';
    return `${cab}<${tag} class="pal-i ${i===ui.bi?'on':''}" ${r[4]}><span class="tico sm">${ic(r[1])}</span><span class="grow"><b>${esc(r[2])}</b>${r[3]?`<small class="trunc">${esc(r[3])}</small>`:''}</span>${i===ui.bi?'<kbd>↵</kbd>':''}</${tag}>`; }).join('')
    : vazio('busca','Nada encontrado',`Nenhum paciente, ponto ou tela para “${esc(ui.q)}”.`);
}
function camada(){
  const el=document.getElementById('camada');
  if(ui.ov==='busca') el.innerHTML=`<div class="veu" data-act="fechar"></div><div class="pal" role="dialog" aria-label="Busca global"><label class="pal-c">${ic('busca')}<input id="pal-q" placeholder="Buscar pacientes, pontos, telas e ações" value="${esc(ui.q||'')}" autocomplete="off"><kbd>Esc</kbd></label><div class="pal-l" id="pal-l">${listaBusca()}</div><div class="pal-r"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>Ctrl</kbd><kbd>K</kbd> busca</span></div></div>`;
  else if(ui.ov==='atalhos') el.innerHTML=`<div class="veu" data-act="fechar"></div><div class="pal atl" role="dialog" aria-label="Atalhos de teclado"><div class="card-h"><h3>Atalhos de teclado</h3><button class="ib" data-act="fechar" aria-label="Fechar">${ic('x')}</button></div>
    ${[['Ctrl K  ou  /','Busca global'],['[','Recolher ou expandir o menu'],['?','Mostrar esta lista'],['Esc','Fechar janelas e menus']].map(([k,l])=>`<div class="atl-i"><span>${l}</span><span>${k.split('  ou  ').map(x=>x.split(' ').map(y=>`<kbd>${y}</kbd>`).join('')).join(' ou ')}</span></div>`).join('')}</div>`;
  else el.innerHTML='';
  if(ui.ov==='busca'){ const i=document.getElementById('pal-q'); i.focus(); i.setSelectionRange(i.value.length,i.value.length); }
}
const notifAttr = n => n.pid?`data-act="open" data-pid="${n.pid}"`:`href="${n.href}"`;

export function renderNav(route){
  const atual=ATIVO[route]||route, app=document.querySelector('.app');
  app.classList.toggle('mini', !!ui.menuMini);
  app.classList.toggle('open', !!ui.menuAberto);
  const N=notificacoes(), nl=N.filter(n=>!ui.lidas.has(n.k)).length;
  const crumbs=ui.crumbs.length?ui.crumbs:[[null,LABEL[route]||'Painel']];
  document.getElementById('topbar').innerHTML=`<button class="menu-btn" data-act="menu-abrir" aria-label="Abrir menu" aria-expanded="${!!ui.menuAberto}">${ic('menu')}</button>
    <a class="tb-logo" href="#painel">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho">${crumbs.map(([h,t],i)=>h&&i<crumbs.length-1?`<a ${h.startsWith('#')?`href="${h}"`:h}>${esc(t)}</a>`:`<span>${esc(t)}</span>`).join(ic('dir'))}</nav>
    <button class="busca-g" data-act="busca" aria-label="Busca global (Ctrl K)">${ic('busca')}<span>Buscar pacientes, pontos e telas</span><kbd>Ctrl K</kbd></button>
    <div class="tb-r">${seloConta()}
      <button class="ib so-cel" data-act="busca" aria-label="Buscar" data-tip="Buscar">${ic('busca')}</button>
      <button class="ib" data-act="atalhos" aria-label="Atalhos de teclado" data-tip="Atalhos de teclado (?)">${ic('teclado')}</button>
      <div class="dd"><button class="ib" data-act="notif" aria-label="Notificações: ${nl} novas" aria-expanded="${ui.ov==='notif'}" data-tip="Notificações">${ic('sino')}${nl?`<span class="badge">${nl}</span>`:''}</button>
        ${ui.ov==='notif'?`<div class="dd-p notif" role="menu"><div class="dd-h"><b>Notificações</b>${nl?'<button class="btn ghost sm" data-act="ler-todas">Marcar como lidas</button>':''}</div>
          ${N.length?N.map(n=>`<a class="nt ${ui.lidas.has(n.k)?'':'nova'}" ${notifAttr(n)} data-lida="${n.k}"><span class="tico sm ${n.t}">${ic(n.i)}</span><span class="grow"><b>${esc(n.titulo)}</b><small>${esc(n.txt)}</small></span></a>`).join(''):vazio('sino','Tudo em dia','Nenhuma notificação no momento.')}
          <div class="dd-f muted sm">Geradas a partir da agenda, dos alertas e dos prontuários.</div></div>`:''}</div>
      <div class="dd"><button class="perfil-b" data-act="perfil" aria-expanded="${ui.ov==='perfil'}" aria-label="Perfil do profissional"><span class="avatar">${initials(PROF.nome)}</span><span class="pf-n">${PROF.nome.split(' ')[0]}</span>${ic('baixo')}</button>
        ${ui.ov==='perfil'?`<div class="dd-p pf" role="menu"><div class="pf-h"><span class="avatar lg">${initials(PROF.nome)}</span><div><b>${PROF.nome}</b><small class="muted">${PROF.papel}</small></div></div>
          <a class="pf-i" href="#configuracoes">${ic('admin')}Preferências</a><button class="pf-i" data-act="atalhos">${ic('teclado')}Atalhos de teclado</button>
          ${menuConta()}</div>`:''}</div>
    </div>`;
  document.getElementById('nav').innerHTML=`<div class="brand">${LOGO}<div><b>Musubi</b><small>Gestão clínica integrativa</small></div></div>`+
    NAV.map(([k,l,i])=>`<a href="#${k}" aria-label="${l}" class="${atual===k?'on':''}" ${atual===k?'aria-current="page"':''}>${ic(i)}<span>${l}</span>${k==='painel'&&nl?`<span class="nb">${nl}</span>`:''}</a>`).join('')+
    `<div class="foot"><button class="toggle reset" data-act="reset" aria-label="Restaurar exemplos" data-tip="${ui.menuMini?'Restaurar exemplos':''}">${ic('retorno')}<span class="tx">Restaurar exemplos</span></button>
     <button class="toggle" data-act="menu-mini" aria-label="${ui.menuMini?'Expandir menu':'Recolher menu'}" data-tip="${ui.menuMini?'Expandir menu ( [ )':''}">${ic(ui.menuMini?'abrir_menu':'fechar_menu')}<span class="tx">Recolher menu</span><kbd class="tx">[</kbd></button></div>`;
  camada();
}
