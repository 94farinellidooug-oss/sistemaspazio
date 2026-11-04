// Ponto de entrada: rotas, renderização e eventos.
import { db, exportarV1, exportarV2, importar, patient, restaurarExemplos, save } from './dados/repositorio.js';
import { adicionarQueixa, alternarQueixa, hidratarPaciente, novoPaciente, registrarAvaliacao, registrarSessao } from './dados/migracao.js';
import { ui } from './estado.js';
import { pointWarnings } from './raciocinio/seguranca.js';
import { vAgenda } from './telas/agenda.js';
import { vAvaliacao } from './telas/avaliacao.js';
import { atendimentoAberto, textoSalvo, vAtendimento } from './telas/atendimento.js';
import { CATEGORIAS, adicionarAchadoLivre, alternarAchado, alternarPulso, avaliacaoEditavel, definirAchado, definirAchadoLivre, definirPulso, notaCategoria, removerAchadoLivre, descartarRascunho, finalizarAtendimento, iniciarAtendimento, rascunhoDe, registrarAlteracao } from './dados/atendimento.js';
import { cpfFormatado, cpfValido, previaCadastro, vCadastro } from './telas/cadastro.js';
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

export const VIEWS={painel:vPainel,agenda:vAgenda,pacientes:vPacientes,prontuario:vProntuario,cadastro:vCadastro,atendimento:vAtendimento,avaliacao:vAvaliacao,pentagrama:vPentagrama,pontos:vPontos,biblioteca:vPontos,administracao:vAdministracao};
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
addEventListener('hashchange',()=>{ if(route()!=='cadastro') ui.editPid=null; ui.menuAberto=false; ui.ov=null; tip.hidden=true; render(); scrollTo(0,0); });
addEventListener('keydown',ev=>{
  const emCampo=ev.target.matches('input, textarea, select');
  if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ ev.preventDefault(); abrir('busca'); return; }
  if(ev.key==='Escape'){ if(ui.ov){ ui.ov=null; render(true); } else if(ui.menuAberto){ ui.menuAberto=false; render(true); } return; }
  if(ui.ov==='busca'&&['ArrowDown','ArrowUp','Enter'].includes(ev.key)){ ev.preventDefault(); const L=document.querySelectorAll('.pal-i');
    if(ev.key==='Enter'){ L[ui.bi]?.click(); return; } ui.bi=(ui.bi+(ev.key==='ArrowDown'?1:-1)+L.length)%Math.max(1,L.length); document.getElementById('pal-l').innerHTML=listaBusca(); return; }
  if(ev.altKey&&route()==='atendimento'&&(ev.key==='ArrowLeft'||ev.key==='ArrowRight')){ ev.preventDefault(); irEtapa((ui.etapa|0)+(ev.key==='ArrowRight'?1:-1)); return; }
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
    if(item.getAttribute('href')==='#cadastro') ui.editPid=null;
    if(item.matches('a[href]')){ ev.preventDefault(); irPara(item.getAttribute('href').slice(1)); return; } }
  const t=ev.target.closest('[data-act]'); if(!t) return;
  const a=t.dataset.act;
  if(a==='open'){ ui.pid=t.dataset.pid; ui.tab='resumo'; irPara('prontuario'); }
  else if(a==='novo-atendimento'){ const p=patient(t.dataset.pid||ui.pid); let x=rascunhoDe(p);
    if(!x){ x=iniciarAtendimento(p,{id:uid(),data:TODAY},new Date().toISOString()); save(); }
    ui.pid=p.id; ui.atId=x.id; ui.etapa=0; ui.avAba=0; ui.el=null; ui.atCmp=false; irPara('atendimento'); scrollTo(0,0); }
  else if(a==='abrir-atendimento'){ ui.pid=t.dataset.pid; ui.atId=t.dataset.id; ui.etapa=0; ui.avAba=0; ui.el=null; ui.atCmp=false; irPara('atendimento'); scrollTo(0,0); }
  else if(a==='etapa'){ ev.preventDefault(); irEtapa(Number(t.dataset.i)); }
  else if(a.startsWith('at-')){ acaoAtendimento(a,t); }
  else if(a==='novo-paciente'){ ui.editPid=null; irPara('cadastro'); }
  else if(a==='editar-paciente'){ ui.editPid=t.dataset.pid; irPara('cadastro'); }
  else if(a==='queixa-ativa'){ const q=alternarQueixa(patient(ui.pid),t.dataset.q,new Date().toISOString()); if(q){ save(); render(true); toast(q.ativa?'Queixa reativada':'Queixa marcada como resolvida'); } }
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
  else if(a==='save-assess'){ const A=ui.assess, p=patient(A.pid); registrarAvaliacao(p,{id:uid(),date:TODAY,signs:[...A.signs],status:{...A.status},nota:A.nota},new Date().toISOString()); save(); ui.pid=p.id; ui.tab='resumo'; ui.assess=null; toast('Avaliação salva no prontuário'); location.hash='prontuario'; }
  else if(a==='el'){ ui.el = t.dataset.e && ui.el!==t.dataset.e ? t.dataset.e : null; render(true); }
  else if(a==='mer'){ ui.ptMer=t.dataset.m; render(true); }
  else if(a==='week'){ ui.week = t.dataset.d==='0'?0:ui.week+Number(t.dataset.d); render(true); }
  else if(a==='appt'){ const x=db.appts.find(z=>z.id===t.dataset.id); x.done=!x.done; save(); render(true); toast(x.done?'Atendimento concluído':'Atendimento reaberto'); }
  else if(a==='addpt'){ const i=document.getElementById('ns-pts'); const L=i.value.split(',').map(s=>s.trim()).filter(Boolean); if(!L.includes(t.dataset.c)) L.push(t.dataset.c); i.value=L.join(', '); i.dispatchEvent(new Event('input',{bubbles:true})); }
  else if(a==='menu-mini'){ ui.menuMini=!ui.menuMini; render(true); }
  else if(a==='menu-abrir'){ ui.menuAberto=!ui.menuAberto; render(true); }
  else if(a==='menu-fechar'){ ui.menuAberto=false; render(true); }
  else if(a==='ir'){ ui.pid=t.dataset.pid; if(t.dataset.to==='avaliacao') ui.assess=null; if(t.dataset.to==='pentagrama') ui.el=null; irPara(t.dataset.to); }
  else if(a==='exportar'){ baixar(t.dataset.f==='v1'?exportarV1():exportarV2(), `${t.dataset.f==='v1'?'spazio-v1':'musubi'}-dados-${TODAY}.json`); toast('Arquivo exportado'); }
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
  else if(t.dataset.q&&t.type==='range'){ document.getElementById(t.id+'-v').textContent=t.value; }
  else if(t.id==='np-name'||t.id==='np-q'){ previaCadastro(); }
  else if(t.id==='np-cpf'){ t.setCustomValidity(''); }
  if(t.id==='ns-pts'||t.name==='tec') sessionWarn();
  // Ambiente de atendimento: salva a cada alteração, sem redesenhar a tela enquanto se digita.
  const x=(t.dataset.atq||t.dataset.atan||t.dataset.atf||t.dataset.vnota||t.dataset.atp||t.dataset.atr||t.dataset.atln)&&atendimentoAberto(); if(!x) return;
  if(t.dataset.atln){ const av=avaliacaoEditavel(x.p,x.a); if(!av) return; notaCategoria(av,t.dataset.atln,t.value); mudou(`avaliação energética: ${catNome(t.dataset.atln)}: anotações`,false); return; }
  if(t.dataset.atp||t.dataset.atr){ const av=avaliacaoEditavel(x.p,x.a); if(!av) return;
    if(t.dataset.atp) definirPulso(av,t.dataset.atp,t.value); else av[t.dataset.atr]=t.value;
    mudou(t.dataset.atp?'avaliação energética: pulso':t.dataset.atr==='linguaObs'?'avaliação energética: língua':'avaliação energética: Ba Gang',false); return; }
  if(t.dataset.atq){ x.a.evolucao.intensidades[t.dataset.atq]=Number(t.value); document.getElementById('qv-'+t.dataset.atq).textContent=t.value; mudou('intensidade das queixas',false); }
  else if(t.dataset.atan){ x.p.anam[t.dataset.atan]=t.value; mudou('anamnese',false); }
  else if(t.dataset.vnota){ const v=(x.a.vasos||={})[t.dataset.vnota]||={considerar:false,nota:''}; v.nota=t.value; mudou('avaliação energética: vasos extraordinários',false); }
  else { const f=t.dataset.atf;
    if(f==='sintese') x.a.sintese=t.value; else if(f==='nota') x.a.evolucao.nota=t.value; else if(f==='mapa') (x.a.mapa||={nota:''}).nota=t.value;
    else if(f==='avnota'){ const av=avaliacaoEditavel(x.p,x.a); if(av) av.nota=t.value; }
    mudou({sintese:'síntese clínica',nota:'evolução',mapa:'mapa corporal',avnota:'avaliação energética: observações'}[f],false); }
});
export function sessionWarn(){
  const p=patient(ui.pid), codes=document.getElementById('ns-pts').value.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
  const tec=[...document.querySelectorAll('input[name=tec]:checked')].map(x=>x.value);
  document.getElementById('ns-warn').innerHTML=pointWarnings(codes,p,tec).map(([k,m])=>`<div class="notice ${k==='crit'?'crit':''}" style="margin-bottom:6px"><b>${k==='crit'?'Atenção':'Cautela'}</b> ${esc(m)}</div>`).join('');
}
// Ambiente de atendimento: troca de etapa, alterações com salvamento automático e histórico.
function irEtapa(i){ const x=atendimentoAberto(); if(!x) return; ui.etapa=Math.max(0,Math.min(7,i));
  if(x.a.status==='rascunho'&&!x.a.etapas.includes(ui.etapa)){ x.a.etapas.push(ui.etapa); save(); }
  render(); scrollTo(0,0); }
function mudou(acao, redesenhar=true){ const x=atendimentoAberto(); if(!x) return; const em=new Date().toISOString();
  registrarAlteracao(x.a,acao,em);
  if(x.a.status==='finalizado'&&/avalia/.test(acao)){ const av=avaliacaoEditavel(x.p,x.a); if(av) registrarAlteracao(av,'avaliação alterada após finalizar o atendimento',em); }
  save(); if(redesenhar) render(true); else { const e=document.getElementById('autosave'); if(e) e.innerHTML=textoSalvo(x.a); } }
const catNome = c => CATEGORIAS.find(x=>x[0]===c)?.[1]||c;
function acaoAtendimento(a,t){
  const x=atendimentoAberto(); if(!x) return; const {p}=x, A=x.a, av=avaliacaoEditavel(p,A);
  const alterna=(L,v)=>{ const i=L.indexOf(v); i<0?L.push(v):L.splice(i,1); };
  if(a==='at-sinal'&&av){ alternarAchado(av,t.dataset.s,t.dataset.o||''); mudou('avaliação energética: sinais'); }
  else if(a==='at-pulso'&&av){ alternarPulso(av,t.dataset.l,t.dataset.k); mudou('avaliação energética: pulso'); }
  else if(a==='at-levar'&&av){ const c=t.dataset.cat, d=t.dataset.dest, it=av.categorias?.[c]?.itens.find(x=>x.id===t.dataset.id); if(!it) return;
    definirAchadoLivre(av,c,it.id,d,!it[d]); const l=d==='plano'?'Plano':'Síntese';
    mudou(`avaliação energética: ${catNome(c)}: "${it.texto}" ${it[d]?'levado para':'retirado'} ${it[d]?(d==='plano'?'o ':'a ')+l:'d'+(d==='plano'?'o ':'a ')+l}`); toast(it[d]?`Levado para ${d==='plano'?'o':'a'} ${l}`:`Retirado d${d==='plano'?'o':'a'} ${l}`,'info'); }
  else if(a==='at-livre-rm'&&av){ const c=t.dataset.cat, it=av.categorias?.[c]?.itens.find(x=>x.id===t.dataset.id); if(!it||!confirm(`Remover o achado "${it.texto}"? A remoção fica registrada no histórico do atendimento.`)) return;
    removerAchadoLivre(av,c,it.id); mudou(`avaliação energética: ${catNome(c)}: achado removido ("${it.texto}")`); }
  else if(a==='at-aba'){ ui.avAba=Number(t.dataset.i); render(true); document.querySelector('.ab-bar')?.scrollIntoView({block:'nearest'}); }
  else if(a==='at-hip'&&av){ const id=t.dataset.p; av.status[id]=av.status[id]===t.dataset.st?'':t.dataset.st; mudou('avaliação energética: hipóteses'); }
  else if(a==='at-pt'){ alterna(A.plano.pontos,t.dataset.c); mudou('plano terapêutico: pontos'); }
  else if(a==='at-tec'){ alterna(A.plano.tec,t.dataset.t); mudou('plano terapêutico: técnicas'); }
  else if(a==='at-cmp'){ ui.atCmp=!ui.atCmp; render(true); }
  else if(a==='at-prontuario'){ ui.pid=p.id; ui.tab='sessoes'; irPara('prontuario'); }
  else if(a==='at-doc'){ if(t.dataset.d==='retorno'){ ui.bookPid=p.id; irPara('agenda'); } else { ui.pid=p.id; ui.tab='sessoes'; irPara('prontuario'); } }
  else if(a==='at-finalizar'){ finalizarAtendimento(p,A,new Date().toISOString(),uid()); save(); ui.pid=p.id; ui.tab='sessoes'; toast('Atendimento finalizado e registrado no prontuário'); irPara('prontuario'); }
  else if(a==='at-descartar'){ if(!confirm('Descartar este rascunho? O que foi preenchido nele será apagado. A anamnese e as queixas do paciente continuam salvas.')) return;
    descartarRascunho(p,A); save(); ui.pid=p.id; ui.tab='resumo'; toast('Rascunho descartado','info'); irPara('prontuario'); }
}
// Baixa um texto como arquivo (cópia de segurança).
function baixar(texto, nome){ const u=URL.createObjectURL(new Blob([texto],{type:'application/json'})), l=document.createElement('a'); l.href=u; l.download=nome; document.body.append(l); l.click(); l.remove(); setTimeout(()=>URL.revokeObjectURL(u),1000); }
document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.id==='imp-arq' && t.files[0]){ const f=t.files[0]; t.value='';
    if(!confirm(`Importar “${f.name}”? Os dados atuais deste navegador serão substituídos. Exporte antes se quiser guardá-los.`)) return;
    f.text().then(x=>{ const erro=importar(x); if(erro){ toast(erro,'info'); return; } ui.assess=null; ui.pid=db.patients[0]?.id||''; toast('Dados importados'); render(); }); return; }
  if(t.dataset.atlsit||t.dataset.atlorig){ const x=atendimentoAberto(), av=x&&avaliacaoEditavel(x.p,x.a); if(av){ const [c,id]=(t.dataset.atlsit||t.dataset.atlorig).split('.'); definirAchadoLivre(av,c,id,t.dataset.atlsit?'sit':'orig',t.value); mudou(`avaliação energética: ${catNome(c)}: ${t.dataset.atlsit?'situação':'origem'} do achado`); } return; }
  if(t.dataset.atsit||t.dataset.atorig){ const x=atendimentoAberto(), av=x&&avaliacaoEditavel(x.p,x.a); if(av){ definirAchado(av,t.dataset.atsit||t.dataset.atorig,t.dataset.atsit?'sit':'orig',t.value); mudou('avaliação energética: '+(t.dataset.atsit?'situação':'origem')+' dos achados'); } return; }
  if(t.dataset.vaso){ const x=atendimentoAberto(); if(x){ const v=(x.a.vasos||={})[t.dataset.vaso]||={considerar:false,nota:''}; v.considerar=t.checked; mudou('avaliação energética: vasos extraordinários'); } return; }
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
    const cpf=document.getElementById('np-cpf');
    if(!cpfValido(cpf.value)){ cpf.setCustomValidity('CPF inválido: confira os 11 números.'); cpf.reportValidity(); return; }
    const em=new Date().toISOString(), lgpd=document.getElementById('np-lgpd');
    const cadastro={cpf:cpf.value.trim()?cpfFormatado(cpf.value.trim()):'',email:v('np-email').trim(),endereco:v('np-end').trim(),cidade:v('np-cid').trim(),hemisferio:v('np-hem'),contatoEmergencia:v('np-emerg').trim()};
    const alerts=Object.fromEntries(['gestante','anticoagulante','marcapasso'].map(k=>[k,document.getElementById('np-al-'+k).checked]));
    if(ui.editPid){ const p=patient(ui.editPid);
      p.name=v('np-name').trim(); p.birth=v('np-birth'); p.phone=v('np-phone'); p.queixas.find(q=>q.id==='q1').descricao=v('np-q').trim();
      Object.assign(p.alerts,alerts); p.cadastro={...p.cadastro,...cadastro,atualizadoEm:em};
      if(lgpd?.checked) p.consentimento=TODAY;
      save(); ui.pid=p.id; ui.editPid=null; ui.tab='resumo'; toast('Cadastro atualizado'); location.hash='prontuario'; return; }
    const p=hidratarPaciente(novoPaciente({id:uid(),name:v('np-name').trim(),birth:v('np-birth'),phone:v('np-phone'),queixa:v('np-q'),consentimento:TODAY,em}));
    Object.assign(p.alerts,alerts); p.cadastro=cadastro;
    db.patients.push(p); save(); ui.pid=p.id; ui.tab='anamnese'; toast('Paciente cadastrado'); location.hash='prontuario';
  } else if(f.classList.contains('livre-f')){
    const x=atendimentoAberto(), av=x&&avaliacaoEditavel(x.p,x.a); if(!av) return; const c=f.dataset.cat, texto=v('lv-'+c).trim(); if(!texto) return;
    adicionarAchadoLivre(av,c,{id:uid(),texto,orig:v(`lv-${c}-o`),sit:v(`lv-${c}-s`)},new Date().toISOString()); mudou(`avaliação energética: ${catNome(c)}: achado registrado`); toast('Achado registrado');
  } else if(f.id==='f-at-queixa'||f.id==='f-at-pt'){
    const x=atendimentoAberto(); if(!x) return;
    if(f.id==='f-at-queixa'){ const d=v('atq-desc').trim(); if(!d) return; const q=adicionarQueixa(x.p,{id:uid(),descricao:d},new Date().toISOString()); x.a.evolucao.intensidades[q.id]=5; mudou('queixa adicionada'); toast('Queixa adicionada'); }
    else { const L=v('at-pt-c').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean).filter(c=>!x.a.plano.pontos.includes(c)); if(!L.length) return; x.a.plano.pontos.push(...L); mudou('plano terapêutico: pontos'); }
  } else if(f.id==='f-queixa'){
    const d=v('nq-desc').trim(); if(!d) return;
    adicionarQueixa(patient(ui.pid),{id:uid(),descricao:d},new Date().toISOString()); save(); render(true); toast('Queixa adicionada');
  } else if(f.id==='f-session'){
    const p=patient(ui.pid);
    registrarSessao(p,{id:uid(),date:v('ns-date'),eva:Number(v('ns-eva')),intensidades:Object.fromEntries([...f.querySelectorAll('input[data-q]')].map(x=>[x.dataset.q,Number(x.value)])),pontos:v('ns-pts').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean),tec:[...document.querySelectorAll('input[name=tec]:checked')].map(x=>x.value),nota:v('ns-nota')},new Date().toISOString());
    save(); ui.tab='sessoes'; toast('Sessão registrada'); render();
  } else if(f.id==='f-appt'){
    db.appts.push({id:uid(),pid:v('na-p'),date:v('na-d'),time:v('na-t'),tipo:v('na-tipo'),valor:Number(v('na-v'))||0,done:false}); save(); ui.bookPid=null; toast('Agendamento criado'); render(true);
  }
});
render();
