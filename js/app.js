// Ponto de entrada: rotas, renderização e eventos.
import { db, patient, restaurarExemplos, save } from './dados/repositorio.js';
import { ui } from './estado.js';
import { pointWarnings } from './raciocinio/seguranca.js';
import { vAgenda } from './telas/agenda.js';
import { vAvaliacao } from './telas/avaliacao.js';
import { EM_BREVE, vAdministracao, vEmBreve } from './telas/em-breve.js';
import { listaBusca, renderNav } from './telas/menu.js';
import { notificacoes } from './dados/indicadores.js';
import { ic } from './componentes/icones.js';
import { patientRows, vPacientes } from './telas/pacientes.js';
import { vPainel } from './telas/painel.js';
import { vPentagrama } from './telas/pentagrama.js';
import { pointCards, vPontos } from './telas/pontos.js';
import { vProntuario } from './telas/prontuario.js';
import { TODAY, esc, uid } from './util.js';

export const VIEWS={painel:vPainel,agenda:vAgenda,pacientes:vPacientes,prontuario:vProntuario,avaliacao:vAvaliacao,pentagrama:vPentagrama,pontos:vPontos,biblioteca:vPontos,administracao:vAdministracao};
EM_BREVE.forEach(k=>VIEWS[k]=()=>vEmBreve(k));
export function route(){ const r=location.hash.slice(1); return VIEWS[r]?r:'painel'; }
let ultimaRota='';
export function render(keepScroll){
  const r=route(), y=scrollY, v=document.getElementById('view');
  ui.crumbs=[]; const html=VIEWS[r](); renderNav(r);
  v.innerHTML=html;
  // Transição suave só quando a tela muda (não a cada clique dentro dela).
  if(r!==ultimaRota){ v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra'); ultimaRota=r; }
  if(keepScroll) scrollTo(0,y);
}
export function toast(m, tipo='ok'){ const t=document.getElementById('toast'); t.className='toast '+tipo; t.innerHTML=`${ic(tipo==='ok'?'okc':'info')}<span></span>`; t.lastChild.textContent=m; t.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>t.hidden=true,2600); }
// Camadas sobre a tela: busca global, notificações, perfil e atalhos.
function abrir(ov){ ui.ov=ui.ov===ov?null:ov; if(ov==='busca'){ ui.q=''; ui.bi=0; } render(true); }
// Abre a tela (ou a re-renderiza, se já estiver nela).
function irPara(h){ if(location.hash.slice(1)===h) render(); else location.hash=h; }
// Dica flutuante para elementos com data-tip (botões de ícone, gráficos, calendário).
const tip=document.getElementById('tip');
document.addEventListener('mouseover',ev=>{ const t=ev.target.closest('[data-tip]'); if(!t||!t.dataset.tip){ tip.hidden=true; return; }
  tip.textContent=t.dataset.tip; tip.hidden=false; const b=t.getBoundingClientRect(), w=tip.offsetWidth;
  tip.style.left=Math.max(8,Math.min(innerWidth-w-8,b.left+b.width/2-w/2))+'px'; tip.style.top=(b.top-tip.offsetHeight-8<4?b.bottom+8:b.top-tip.offsetHeight-8)+'px'; });
addEventListener('scroll',()=>{ tip.hidden=true; },{passive:true});
addEventListener('hashchange',()=>{ ui.menuAberto=false; ui.ov=null; tip.hidden=true; render(); scrollTo(0,0); });
addEventListener('keydown',ev=>{
  const emCampo=ev.target.matches('input, textarea, select');
  if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ ev.preventDefault(); abrir('busca'); return; }
  if(ev.key==='Escape'){ if(ui.ov){ ui.ov=null; render(true); } else if(ui.menuAberto){ ui.menuAberto=false; render(true); } return; }
  if(ui.ov==='busca'&&['ArrowDown','ArrowUp','Enter'].includes(ev.key)){ ev.preventDefault(); const L=document.querySelectorAll('.pal-i');
    if(ev.key==='Enter'){ L[ui.bi]?.click(); return; } ui.bi=(ui.bi+(ev.key==='ArrowDown'?1:-1)+L.length)%Math.max(1,L.length); document.getElementById('pal-l').innerHTML=listaBusca(); return; }
  if(emCampo||ev.ctrlKey||ev.metaKey||ev.altKey) return;
  if(ev.key==='/'){ ev.preventDefault(); abrir('busca'); }
  else if(ev.key==='['){ ui.menuMini=!ui.menuMini; render(true); }
  else if(ev.key==='?'){ abrir('atalhos'); }
});
document.addEventListener('click',ev=>{
  tip.hidden=true;
  // Clique fora de uma camada aberta fecha a camada.
  if(ui.ov && !ev.target.closest('.dd-p, .pal, [data-act="busca"], [data-act="notif"], [data-act="perfil"], [data-act="atalhos"]')){ const fora=!ev.target.closest('[data-act],a'); ui.ov=null; render(true); if(fora) return; }
  // Itens da busca e das notificações: marcam como lida, fecham a camada e abrem o destino.
  const item=ev.target.closest('.pal-i, .dd-p .nt');
  if(item){ if(item.dataset.lida) ui.lidas.add(item.dataset.lida); ui.ov=null;
    if(item.matches('a[href]')){ ev.preventDefault(); irPara(item.getAttribute('href').slice(1)); return; } }
  const t=ev.target.closest('[data-act]'); if(!t) return;
  const a=t.dataset.act;
  if(a==='open'){ ui.pid=t.dataset.pid; ui.tab='resumo'; irPara('prontuario'); }
  else if(a==='sessao'){ ui.pid=t.dataset.pid; ui.tab='nova'; irPara('prontuario'); }
  else if(a==='ver-ponto'){ ui.ptQ=t.dataset.c; ui.ptMer=''; irPara('biblioteca'); }
  else if(a==='busca'||a==='notif'||a==='perfil'||a==='atalhos'){ abrir(a); }
  else if(a==='fechar'){ ui.ov=null; render(true); }
  else if(a==='ler-todas'){ notificacoes().forEach(n=>ui.lidas.add(n.k)); ui.ov=null; render(true); toast('Notificações marcadas como lidas'); }
  else if(a==='aviso'){ ui.ov=null; render(true); toast(t.dataset.m,'info'); }
  else if(a==='dia'){ ui.dia=t.dataset.d; render(true); }
  else if(a==='rolar'){ const d=document.getElementById(t.dataset.to); d?.scrollIntoView({behavior:'smooth',block:'start'}); d?.querySelector('input')?.focus({preventScroll:true}); }
  else if(a==='serie'){ const on=t.getAttribute('aria-pressed')!=='false'; t.setAttribute('aria-pressed',String(!on)); t.closest('.card').querySelectorAll(`.chart .se[data-s="${t.dataset.s}"]`).forEach(g=>g.classList.toggle('oculta',on)); }
  else if(a==='book'){ ui.bookPid=t.dataset.pid; }
  else if(a==='tab'){ ui.tab=t.dataset.t; render(true); }
  else if(a==='sign'){ const s=t.dataset.s, L=ui.assess.signs; const i=L.indexOf(s); i<0?L.push(s):L.splice(i,1); render(true); }
  else if(a==='hyp'){ const id=t.dataset.p; ui.assess.status[id] = ui.assess.status[id]===t.dataset.st ? '' : t.dataset.st; render(true); }
  else if(a==='save-assess'){ const A=ui.assess, p=patient(A.pid); p.assess.push({id:uid(),date:TODAY,signs:[...A.signs],status:{...A.status},nota:A.nota}); save(); ui.pid=p.id; ui.tab='resumo'; ui.assess=null; toast('Avaliação salva no prontuário'); location.hash='prontuario'; }
  else if(a==='el'){ ui.el = t.dataset.e && ui.el!==t.dataset.e ? t.dataset.e : null; render(true); }
  else if(a==='mer'){ ui.ptMer=t.dataset.m; render(true); }
  else if(a==='week'){ ui.week = t.dataset.d==='0'?0:ui.week+Number(t.dataset.d); render(true); }
  else if(a==='appt'){ const x=db.appts.find(z=>z.id===t.dataset.id); x.done=!x.done; save(); render(true); toast(x.done?'Atendimento concluído':'Atendimento reaberto'); }
  else if(a==='addpt'){ const i=document.getElementById('ns-pts'); const L=i.value.split(',').map(s=>s.trim()).filter(Boolean); if(!L.includes(t.dataset.c)) L.push(t.dataset.c); i.value=L.join(', '); i.dispatchEvent(new Event('input',{bubbles:true})); }
  else if(a==='menu-mini'){ ui.menuMini=!ui.menuMini; render(true); }
  else if(a==='menu-abrir'){ ui.menuAberto=!ui.menuAberto; render(true); }
  else if(a==='menu-fechar'){ ui.menuAberto=false; render(true); }
  else if(a==='ir'){ ui.pid=t.dataset.pid; if(t.dataset.to==='avaliacao') ui.assess=null; if(t.dataset.to==='pentagrama') ui.el=null; irPara(t.dataset.to); }
  else if(a==='reset'){ restaurarExemplos(); ui.assess=null; ui.pid='p1'; toast('Dados de exemplo restaurados'); render(); }
});
document.addEventListener('keydown',ev=>{ if((ev.key==='Enter'||ev.key===' ') && ev.target.matches('.node')){ ev.preventDefault(); ev.target.dispatchEvent(new MouseEvent('click',{bubbles:true})); }});
document.addEventListener('input',ev=>{
  const t=ev.target;
  if(t.id==='pal-q'){ ui.q=t.value; ui.bi=0; document.getElementById('pal-l').innerHTML=listaBusca(); return; }
  if(t.id==='pq'){ ui.pq=t.value; document.getElementById('plist').innerHTML=patientRows(); }
  else if(t.id==='pt-q'){ ui.ptQ=t.value; document.getElementById('ptlist').innerHTML=pointCards(); }
  else if(t.id==='as-nota'){ ui.assess.nota=t.value; }
  else if(t.id==='ns-eva'){ document.getElementById('ns-eva-v').textContent=t.value; }
  if(t.id==='ns-pts'||t.name==='tec') sessionWarn();
});
export function sessionWarn(){
  const p=patient(ui.pid), codes=document.getElementById('ns-pts').value.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
  const tec=[...document.querySelectorAll('input[name=tec]:checked')].map(x=>x.value);
  document.getElementById('ns-warn').innerHTML=pointWarnings(codes,p,tec).map(([k,m])=>`<div class="notice ${k==='crit'?'crit':''}" style="margin-bottom:6px"><b>${k==='crit'?'Atenção':'Cautela'}</b> ${esc(m)}</div>`).join('');
}
document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.id==='pr-patient'){ ui.pid=t.value; render(true); }
  else if(t.id==='as-patient'){ ui.pid=t.value; ui.assess={pid:t.value,signs:[],status:{},nota:''}; render(true); }
  else if(t.id==='pt-patient'){ ui.pid=t.value; render(true); }
  else if(t.id==='cb-sheng'){ ui.sheng=t.checked; render(true); }
  else if(t.id==='cb-ke'){ ui.ke=t.checked; render(true); }
  else if(t.dataset.anam){ patient(ui.pid).anam[t.dataset.anam]=t.value; save(); toast('Anamnese salva'); }
  else if(t.dataset.alert){ patient(ui.pid).alerts[t.dataset.alert]=t.checked; save(); render(true); }
  else if(t.name==='tec'){ t.closest('.chip').classList.toggle('on',t.checked); }
});
document.addEventListener('submit',ev=>{
  ev.preventDefault(); const f=ev.target, v=id=>document.getElementById(id).value;
  if(f.id==='f-patient'){
    const p={id:uid(),name:v('np-name').trim(),birth:v('np-birth'),phone:v('np-phone'),queixa:v('np-q'),exemplo:false,consentimento:TODAY,anam:{historia:'',sono:'',alimentacao:'',evacuacao:'',emocoes:'',medicamentos:''},alerts:{gestante:false,anticoagulante:false,marcapasso:false},sessions:[],assess:[]};
    db.patients.push(p); save(); ui.pid=p.id; ui.tab='anamnese'; toast('Paciente cadastrado'); location.hash='prontuario';
  } else if(f.id==='f-session'){
    const p=patient(ui.pid);
    p.sessions.push({id:uid(),date:v('ns-date'),eva:Number(v('ns-eva')),pontos:v('ns-pts').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean),tec:[...document.querySelectorAll('input[name=tec]:checked')].map(x=>x.value),nota:v('ns-nota')});
    p.sessions.sort((a,b)=>a.date.localeCompare(b.date)); save(); ui.tab='sessoes'; toast('Sessão registrada'); render();
  } else if(f.id==='f-appt'){
    db.appts.push({id:uid(),pid:v('na-p'),date:v('na-d'),time:v('na-t'),tipo:v('na-tipo'),valor:Number(v('na-v'))||0,done:false}); save(); ui.bookPid=null; toast('Agendamento criado'); render(true);
  }
});
render();
