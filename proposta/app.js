// Proposta navegável do novo fluxo clínico (painel, perfil do paciente, atendimento integrado e
// histórico). Reaproveita, sem alterar, os módulos clínicos do sistema: sinais, padrões, raciocínio,
// alertas de segurança e pentagrama. Os dados são os exemplos do sistema mais alguns valores
// fictícios marcados abaixo, e ficam só na memória da página: nada é gravado no navegador.
import { pentagram } from '../js/componentes/pentagrama.js';
import { EL, KE, SHENG, controlador, mae } from '../js/conhecimento/elementos.js';
import { CAUT, PT } from '../js/conhecimento/pontos.js';
import { SIGN, SIGNS } from '../js/conhecimento/sinais.js';
import { seed } from '../js/dados/exemplos.js';
import { bagang, elemState, evaluate } from '../js/raciocinio/avaliacao.js';
import { pointWarnings } from '../js/raciocinio/seguranca.js';
import { TODAY, addDays, age, brl, esc, fmt, initials } from '../js/util.js';

/* ---------- Dados de demonstração ---------- */
const db = seed();
// Fictício: uma paciente nova, para mostrar a primeira consulta com avaliação basal.
db.patients.push({id:'p5',name:'Marina Costa',birth:'1991-08-07',phone:'(11) 95544-2210',exemplo:true,queixa:'Dor cervical e tensão nos ombros',
  anam:{historia:'',sono:'',alimentacao:'',evacuacao:'',emocoes:'',medicamentos:''},alerts:{gestante:true,anticoagulante:false,marcapasso:false},sessions:[],assess:[]});
db.appts.push({id:'a-p5',pid:'p5',date:TODAY,time:'14:00',tipo:'Primeira consulta',valor:220,done:false});
// Fictício: reavaliações, para mostrar a comparação com a avaliação basal.
const REAV = {p1:{d:-14,signs:['bordas_vermelhas','pulso_corda','cefaleia_temporal','tpm'],status:{f_yang:'aceito'}},
              p2:{d:-8,signs:['lingua_palida','pulso_profundo','frio_extremidades','lombalgia','cansaco'],status:{r_yang:'aceito'}}};
Object.entries(REAV).forEach(([id,r])=>db.patients.find(p=>p.id===id).assess.push({id:'re-'+id,date:addDays(r.d),signs:r.signs,status:r.status,nota:''}));
// Fictício: segunda queixa de cada paciente, com a intensidade (0 a 10) em cada atendimento.
const Q2 = {p1:['Irritabilidade pré-menstrual',[8,6,5]],p2:['Cansaço',[7,7,5,4]],p3:['Palpitações',[6,4]],p4:['Distensão após refeições',[6]]};
const QCOR = ['var(--brand)','#b8894a','#5f7f9c'];
const P = id => db.patients.find(p=>p.id===id);
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
function queixas(p){
  const L=[{id:'q1',nome:cap(p.queixa.split(' e ')[0]),serie:p.sessions.map(s=>s.eva)}];
  const q=Q2[p.id]; if(q) L.push({id:'q2',nome:q[0],serie:q[1].slice(0,p.sessions.length)});
  return L;
}
const alertas = p => [['gestante','Gestante'],['anticoagulante','Anticoagulante'],['marcapasso','Marcapasso']].filter(([k])=>p.alerts[k]).map(([,l])=>l);
const melhora = s => s.length>1 && s[0] ? Math.round((s[0]-s.at(-1))/s[0]*100) : null;

/* ---------- Estado da proposta (só memória) ---------- */
const S = { mini:false, aberto:false, el:null, histAberto:{} };
const AT = {};
const STEPS = [['anamnese','Anamnese','folha'],['avaliacao','Avaliação energética','yin'],['pentagrama','Pentagrama','estrela'],['sintese','Síntese clínica','camadas'],['mapa','Mapa corporal','corpo'],['plano','Plano terapêutico','plano'],['evolucao','Evolução','evolucao'],['documentos','Documentos','doc']];
function atend(pid){
  if(!AT[pid]){
    const p=P(pid), ult=p.assess.at(-1);
    AT[pid]={pid,n:p.sessions.length+1,basal:!p.sessions.length,visit:new Set([0]),
      qx:Object.fromEntries(queixas(p).map(q=>[q.id,q.serie.at(-1)??5])),anam:{...p.anam},
      signs:ult?[...ult.signs]:[],status:ult?{...ult.status}:{},sintese:'',pontos:[],tec:[],evol:'',cmp:false,final:false};
  }
  return AT[pid];
}

/* ---------- Ícones (traço único, 24px) ---------- */
const I = {
  painel:'<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  agenda:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pacientes:'<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-4-5.5"/>',
  biblioteca:'<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 3 15.5-3.5 1z"/>',
  financeiro:'<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 10v5M18 10v5"/>',
  doc:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  relatorios:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  admin:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  alerta:'<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  escudo:'<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 9v4M12 16v.01"/>',
  relogio:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  retorno:'<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  mais:'<path d="M12 5v14M5 12h14"/>',
  play:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  okc:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 10"/>',
  dir:'<path d="M9 6l6 6-6 6"/>', esq:'<path d="M15 6l-6 6 6 6"/>', baixo:'<path d="M6 9l6 6 6-6"/>',
  folha:'<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
  yin:'<circle cx="12" cy="12" r="9"/><path d="M12 3a4.5 4.5 0 0 1 0 9a4.5 4.5 0 0 0 0 9"/>',
  estrela:'<path d="M12 3l2.6 6.3H21l-5.2 4.1 2 6.6L12 16l-5.8 4 2-6.6L3 9.3h6.4z"/>',
  camadas:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  corpo:'<circle cx="12" cy="4.5" r="2"/><path d="M6 9h12M12 9v6M9 21l3-6 3 6"/>',
  plano:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  evolucao:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  tel:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  sol:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  lista:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>'
};
const ic = (k,c='') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
const LOGO = `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" style="fill:none;stroke:var(--brand);stroke-width:1.6"/><path d="M12 2a5 5 0 0 1 0 10a5 5 0 0 0 0 10a10 10 0 0 1 0-20" style="fill:var(--brand)"/></svg>`;

/* ---------- Gráficos ---------- */
function linhas(series, labels, o={}){
  const W=o.w||640, H=o.h||220, [L,R,T,B]=o.mini?[6,8,6,6]:[28,14,12,26], n=Math.max(2,...series.map(s=>s.vals.length));
  const x=i=>L+i*(W-L-R)/(n-1), y=v=>T+(1-v/10)*(H-T-B);
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'Gráfico de evolução')}">`;
  [0,5,10].forEach(v=>s+=`<line class="gl" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L-8}" y="${y(v)+4}" text-anchor="end">${v}</text>`);
  labels.forEach((l,i)=>s+=`<text class="ax" x="${x(i)}" y="${H-6}" text-anchor="middle">${esc(l)}</text>`);
  series.forEach(se=>{ if(!se.vals.length) return;
    const d=se.vals.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    s+=`<path d="${d}" fill="none" stroke="${se.cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" ${se.tr?'stroke-dasharray="5 5"':''}/>`;
    s+=se.vals.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="${i===se.vals.length-1?5:3.5}" fill="${i===se.vals.length-1?se.cor:'var(--surface)'}" stroke="${se.cor}" stroke-width="2"/>`).join('');
  });
  return s+'</svg>';
}
function barras(vals, labels){
  const W=420, H=140, B=22, T=10, max=Math.max(1,...vals.map(v=>v[0])), bw=W/vals.length;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Atendimentos por dia na semana">`;
  vals.forEach(([t,d],i)=>{ const h=t/max*(H-B-T), hd=d/max*(H-B-T), x=i*bw+bw*.28, w=bw*.44;
    s+=`<rect x="${x}" y="${H-B-h}" width="${w}" height="${h}" rx="5" fill="var(--sage)"/><rect x="${x}" y="${H-B-hd}" width="${w}" height="${hd}" rx="5" fill="var(--brand)"/>`;
    if(t) s+=`<text class="ax" x="${x+w/2}" y="${H-B-h-4}" text-anchor="middle">${t}</text>`;
    s+=`<text class="ax" x="${x+w/2}" y="${H-6}" text-anchor="middle">${labels[i]}</text>`; });
  return s+'</svg>';
}
function anel(pct, txt, cor='var(--brand)'){
  const r=24, c=2*Math.PI*r;
  return `<svg class="anel" viewBox="0 0 60 60" width="60" height="60" aria-hidden="true"><circle cx="30" cy="30" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="30" cy="30" r="${r}" fill="none" stroke="${cor}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(Math.max(0,Math.min(1,pct))*c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 30 30)"/><text x="30" y="34.5" text-anchor="middle">${txt}</text></svg>`;
}
const ORDEM = ['madeira','fogo','terra','metal','agua'];
const tipoEl = s => s.exc>s.def&&s.exc>0?'exc':s.def>0?'def':'';
function barrasEl(st, base){
  const pct = s => Math.min(100,Math.round(Math.max(s.def,s.exc)/1.6*100));
  return `<div class="elbars">${ORDEM.map(e=>{ const s=st[e], k=tipoEl(s), E=EL[e], b=base?pct(base[e]):null;
    return `<div class="elb"><span class="han" style="color:${E.cor}">${E.han}</span><span class="nm">${E.nome}</span>
      <div class="trk">${b!==null?`<i class="base" style="left:${b}%" title="Basal"></i>`:''}<i class="fill ${k}" style="width:${Math.max(k?6:0,pct(s))}%;background:${E.cor}"></i></div>
      <span class="st ${k}">${k==='exc'?'Excesso':k==='def'?'Deficiência':'Equilíbrio'}</span></div>`;}).join('')}</div>`;
}
function eixo(l,r,v){ return `<div class="axis"><span>${l}</span><div class="track"><span class="dot" style="left:${50+v*50}%"></span></div><span>${r}</span></div>`; }
const elTag = e => e?`<span class="el-tag"><i style="background:${EL[e].cor}"></i>${EL[e].nome}</span>`:'';
const delta = (a,b) => { if(a==null||b==null) return ''; const d=b-a; return `<span class="delta ${d<0?'bom':d>0?'ruim':''}">${d<0?'▼':d>0?'▲':'='} ${Math.abs(d)}</span>`; };

/* ---------- Menu ---------- */
const NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
function menu(atual){
  const app=document.querySelector('.app'); app.classList.toggle('mini',S.mini); app.classList.toggle('open',S.aberto);
  document.getElementById('topbar').innerHTML=`<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button>${LOGO}<b>Spazio</b>`;
  document.getElementById('nav').innerHTML=`<div class="brand">${LOGO}<div><b>Spazio</b><small>Gestão clínica integrativa</small></div></div>`+
    NAV.map(([k,l,i])=>`<a href="#/${k}" aria-label="${l}" class="${atual===k?'on':''}" ${atual===k?'aria-current="page"':''}>${ic(i)}<span>${l}</span></a>`).join('')+
    `<div class="foot"><p class="proposta">Proposta do fluxo clínico. Avaliação e Pentagrama ficam dentro do atendimento.</p>
     <button class="toggle" data-a="menu-mini" aria-label="${S.mini?'Expandir menu':'Recolher menu'}">${ic(S.mini?'dir':'esq')}<span class="tx">Recolher menu</span></button></div>`;
}

/* ---------- Painel ---------- */
function vPainel(){
  const hoje=db.appts.filter(a=>a.date===TODAY).sort((a,b)=>a.time.localeCompare(b.time));
  const prox=hoje.find(a=>!a.done), pp=prox&&P(prox.pid);
  const al=hoje.map(a=>P(a.pid)).filter(p=>alertas(p).length);
  const pend=[...db.patients.filter(p=>{const l=p.sessions.at(-1);return l&&l.date<addDays(-21)&&!db.appts.some(a=>a.pid===p.id&&a.date>=TODAY);}).map(p=>['retorno','warn',`${esc(p.name)}`,`sem retorno desde ${fmt(p.sessions.at(-1).date)}`,`#/paciente/${p.id}`,'Ver perfil']),
              ...db.patients.filter(p=>!p.assess.length).map(p=>['yin','acc',`${esc(p.name)}`,'avaliação basal na primeira consulta',`#/paciente/${p.id}`,'Ver perfil'])];
  const melh=db.patients.filter(p=>(melhora(queixas(p)[0].serie)||0)>0).length, comS=db.patients.filter(p=>p.sessions.length>1).length;
  const ws=addDays(-((new Date().getDay()+6)%7)), dias=[...Array(7)].map((_,i)=>addDays(i,ws));
  const sem=db.appts.filter(a=>a.date>=dias[0]&&a.date<=dias[6]), prev=sem.reduce((n,a)=>n+a.valor,0), real=sem.filter(a=>a.done).reduce((n,a)=>n+a.valor,0);
  const h=new Date().getHours();
  return `<div class="head"><div><h1>${h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}</h1><p>${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p></div>
    <div class="quick"><a class="btn" href="#/pacientes">${ic('mais')}Novo paciente</a><a class="btn pri" href="#/agenda">${ic('agenda')}Novo agendamento</a></div></div>

  ${pp?`<div class="hero"><div class="hero-t"><span class="cap">Próximo atendimento</span><span class="hora">${prox.time}</span></div>
    <a class="pessoa" href="#/paciente/${pp.id}"><span class="avatar lg">${initials(pp.name)}</span><span><b>${esc(pp.name)}</b><small>${esc(prox.tipo)} · ${pp.sessions.length?`${pp.sessions.length+1}º atendimento`:'primeira consulta'}</small></span></a>
    <div class="hero-tags">${alertas(pp).map(a=>`<span class="pill crit">${ic('escudo')}${a}</span>`).join('')}${queixas(pp).slice(0,2).map(q=>`<span class="pill">${esc(q.nome)}${q.serie.length?` · ${q.serie.at(-1)}/10`:''}</span>`).join('')}</div>
    <div class="hero-a"><a class="btn" href="#/paciente/${pp.id}">Perfil</a><a class="btn pri" href="#/atendimento/${pp.id}/0">${ic('play')}Iniciar atendimento</a></div></div>`:''}

  <div class="tiles">
    <div class="tile">${anel(hoje.length?hoje.filter(a=>a.done).length/hoje.length:0,`${hoje.filter(a=>a.done).length}/${hoje.length}`)}<div><b>Atendimentos hoje</b><small>concluídos / agendados</small></div></div>
    <div class="tile ${al.length?'t-crit':''}"><span class="tico crit">${ic('escudo')}</span><div><b class="num">${al.length}</b><small>alertas de segurança hoje</small></div></div>
    <div class="tile"><span class="tico warn">${ic('lista')}</span><div><b class="num">${pend.length}</b><small>pendências clínicas</small></div></div>
    <div class="tile">${anel(comS?melh/comS:0,`${melh}/${comS}`,'var(--ok)')}<div><b>Em melhora</b><small>queixa principal menor que no início</small></div></div>
  </div>

  <div class="grid g-side">
    <div class="card"><div class="card-h"><h2>Agenda do dia</h2><a class="btn ghost sm" href="#/agenda">Semana ${ic('dir')}</a></div>
      <div class="tl">${hoje.map(a=>{const p=P(a.pid),q=queixas(p)[0];return `<div class="tl-i ${a.done?'feito':''} ${a===prox?'agora':''}"><span class="tl-h">${a.time}</span><span class="tl-dot"></span>
        <a class="tl-c" href="#/paciente/${p.id}"><span class="avatar">${initials(p.name)}</span><span class="grow"><b class="trunc">${esc(p.name)}</b><small class="trunc">${esc(a.tipo)}</small></span>
        ${alertas(p).length?`<span class="pill crit" title="${alertas(p).join(', ')}">${ic('escudo')}</span>`:''}${q.serie.length>1?`<span class="mini-ch" title="Evolução da queixa principal">${linhas([{cor:'var(--brand)',vals:q.serie}],[],{w:90,h:34,mini:1})}</span>`:p.sessions.length?'':'<span class="pill acc">1ª consulta</span>'}</a>
        <a class="btn sm ${a===prox?'pri':''}" href="#/atendimento/${p.id}/0" aria-label="Iniciar atendimento de ${esc(p.name)}">${ic('play')}</a></div>`}).join('')||'<p class="muted">Nenhum atendimento hoje.</p>'}</div></div>
    <div class="clin-side">
      <div class="card alertas"><div class="card-h"><h2>${ic('escudo')} Alertas de segurança</h2></div>
        ${al.length?al.map(p=>`<a class="al-i" href="#/paciente/${p.id}"><span class="avatar">${initials(p.name)}</span><span class="grow"><b>${esc(p.name)}</b><span class="chips">${alertas(p).map(a=>`<span class="pill crit">${a}</span>`).join('')}</span></span>${ic('dir')}</a>`).join(''):`<div class="vazio">${ic('okc')}Nenhum alerta hoje.</div>`}</div>
      <div class="card"><div class="card-h"><h2>Pendências</h2><span class="pill warn">${pend.length}</span></div>
        ${pend.map(([i,k,n,t,href,acao])=>`<a class="pd-i" href="${href}"><span class="ico ${k}">${ic(i)}</span><span class="grow"><b>${n}</b><small>${t}</small></span>${ic('dir')}</a>`).join('')||`<div class="vazio">${ic('okc')}Nada pendente.</div>`}</div>
    </div>
  </div>

  <details class="gestao-d"><summary><span class="lbl">Gestão administrativa</span><span class="muted">Semana: ${sem.length} atendimentos · ${brl(prev)} previsto</span>${ic('baixo')}</summary>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h3>Atendimentos na semana</h3>${barras(dias.map(d=>[db.appts.filter(a=>a.date===d).length,db.appts.filter(a=>a.date===d&&a.done).length]),['seg','ter','qua','qui','sex','sáb','dom'])}
        <div class="leg"><span><i style="background:var(--brand)"></i>concluídos</span><span><i style="background:var(--sage)"></i>agendados</span></div></div>
      <div class="card"><h3>Faturamento da semana</h3><div class="fin"><div><small>Previsto</small><b>${brl(prev)}</b></div><div><small>Realizado</small><b>${brl(real)}</b></div></div>
        <div class="meter"><i style="width:${prev?Math.round(real/prev*100):0}%"></i></div><small class="muted">${prev?Math.round(real/prev*100):0}% do previsto · ${db.patients.length} pacientes ativos</small></div>
    </div></details>`;
}

/* ---------- Pacientes ---------- */
function vPacientes(){
  return `<div class="head"><div><h1>Pacientes</h1><p>${db.patients.length} pacientes</p></div><button class="btn pri" data-a="toast" data-m="Cadastro de paciente: mesmo formulário de hoje, detalhado na etapa 2.">${ic('mais')}Novo paciente</button></div>
  <div class="pgrid">${db.patients.map(p=>{const q=queixas(p)[0], m=melhora(q.serie), prox=db.appts.filter(a=>a.pid===p.id&&a.date>=TODAY&&!a.done).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
    return `<a class="pc" href="#/paciente/${p.id}"><div class="pc-h"><span class="avatar lg">${initials(p.name)}</span><span class="grow"><b>${esc(p.name)}</b><small>${age(p.birth)} anos · ${p.sessions.length} atendimento${p.sessions.length===1?'':'s'}</small></span>${alertas(p).length?`<span class="pill crit" title="${alertas(p).join(', ')}">${ic('escudo')}</span>`:''}</div>
      <div class="pc-q"><span class="trunc">${esc(q.nome)}</span>${q.serie.length>1?linhas([{cor:'var(--brand)',vals:q.serie}],[],{w:110,h:36,mini:1}):''}</div>
      <div class="pc-f">${m!==null?`<span class="pill ${m>0?'ok':'warn'}">${m>0?'▼ '+m+'%':'sem melhora'}</span>`:'<span class="pill acc">Aguarda avaliação basal</span>'}<span class="muted">${prox?`${ic('agenda')} ${fmt(prox.date)} ${prox.time}`:'sem agendamento'}</span></div></a>`;}).join('')}</div>`;
}

/* ---------- Perfil do paciente ---------- */
function cabecalho(p, extra=''){
  return `<div class="perfil-h"><span class="avatar xl">${initials(p.name)}</span><div class="grow"><h1>${esc(p.name)}</h1>
    <div class="meta"><span>${age(p.birth)} anos</span><span>${ic('tel')}${esc(p.phone)}</span>${p.exemplo?'<span class="pill ex">exemplo</span>':''}</div>
    ${alertas(p).length?`<div class="chips" style="margin-top:8px">${alertas(p).map(a=>`<span class="pill crit">${ic('escudo')}${a}</span>`).join('')}</div>`:''}</div>${extra}</div>`;
}
function vPerfil(p){
  const Q=queixas(p), a0=p.assess[0], a1=p.assess.at(-1), st=a1?elemState(a1.signs,a1.status):null, ac=a1?evaluate(a1.signs).filter(h=>a1.status[h.p.id]==='aceito'):[];
  const prox=db.appts.filter(a=>a.pid===p.id&&a.date>=TODAY&&!a.done).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
  const m=melhora(Q[0].serie);
  return `${migalha([['#/pacientes','Pacientes'],[null,p.name]])}
  ${cabecalho(p,`<div class="perfil-a"><a class="btn" href="#/paciente/${p.id}/historico">${ic('evolucao')}Histórico e evolução</a><a class="btn pri" href="#/atendimento/${p.id}/0">${ic('play')}Novo atendimento</a></div>`)}
  <div class="tiles">
    <div class="tile"><span class="tico acc">${ic('lista')}</span><div><b class="num">${p.sessions.length}</b><small>atendimentos${p.sessions[0]?` desde ${fmt(p.sessions[0].date)}`:''}</small></div></div>
    <div class="tile">${m!==null?anel(Math.max(0,m)/100,m+'%','var(--ok)'):`<span class="tico">${ic('evolucao')}</span>`}<div><b>${m!==null?'Melhora':'Sem histórico'}</b><small>${m!==null?`${esc(Q[0].nome.toLowerCase())}, desde o basal`:'a primeira consulta gera a avaliação basal'}</small></div></div>
    <div class="tile"><span class="tico acc">${ic('yin')}</span><div><b>${p.assess.length?p.assess.length+(p.assess.length===1?' avaliação':' avaliações'):'Sem avaliação'}</b><small>${a0?`basal em ${fmt(a0.date)}`:'será feita no 1º atendimento'}</small></div></div>
    <div class="tile"><span class="tico">${ic('agenda')}</span><div><b>${prox?`${fmt(prox.date)} · ${prox.time}`:'—'}</b><small>${prox?esc(prox.tipo):'sem próximo agendamento'}</small></div></div>
  </div>
  <div class="grid g-side">
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-h"><h2>Queixas</h2><span class="muted sm">intensidade de 0 a 10</span></div>
        <div class="qgrid">${Q.map((q,i)=>`<div class="qc"><div class="qc-h"><i style="background:${QCOR[i]}"></i><b>${esc(q.nome)}</b></div>
          ${q.serie.length?`<div class="qc-v"><span class="big">${q.serie.at(-1)}</span><span class="muted">/10</span>${delta(q.serie[0],q.serie.at(-1))}<span class="muted sm">desde o basal (${q.serie[0]})</span></div>${q.serie.length>1?linhas([{cor:QCOR[i],vals:q.serie}],[],{w:300,h:64,mini:1}):''}`:'<p class="muted sm">Será medida na primeira consulta.</p>'}</div>`).join('')}</div></div>
      <div class="card"><div class="card-h"><h2>Atendimentos recentes</h2><a class="btn ghost sm" href="#/paciente/${p.id}/historico">Ver todos ${ic('dir')}</a></div>
        ${p.sessions.length?linhaTempo(p,3):'<div class="vazio">'+ic('info')+'Nenhum atendimento ainda.</div>'}</div>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-h"><h2>Avaliação energética</h2>${a1?`<span class="pill">${p.assess.length>1?'reavaliação':'basal'} · ${fmt(a1.date)}</span>`:''}</div>
        ${st?`${barrasEl(st, p.assess.length>1?elemState(a0.signs,a0.status):null)}${p.assess.length>1?'<p class="muted sm" style="margin-top:6px">Marca vertical: posição na avaliação basal.</p>':''}
        <div class="lbl" style="margin:14px 0 6px">Padrões validados</div><div class="chips">${ac.map(h=>`<span class="pill ${h.p.tipo==='exc'?'crit':'warn'}">${h.p.nome}</span>`).join('')||'<span class="muted">nenhum</span>'}</div>
        <details class="mais"><summary>Ver pentagrama ${ic('baixo')}</summary>${pentagram(st,null)}</details>`
        :`<div class="vazio">${ic('info')}A avaliação basal é feita dentro do primeiro atendimento.</div>`}</div>
      <details class="card mais-card"><summary><h2>Dados e anamnese</h2>${ic('baixo')}</summary>
        <dl class="corr" style="margin-top:12px">${[['historia','História'],['sono','Sono'],['alimentacao','Alimentação'],['evacuacao','Evacuação'],['emocoes','Emoções'],['medicamentos','Medicamentos']].map(([k,l])=>`<dt>${l}</dt><dd>${esc(p.anam[k])||'<span class="muted">—</span>'}</dd>`).join('')}</dl></details>
    </div>
  </div>`;
}
function linhaTempo(p, max){
  const L=[...p.sessions].reverse().slice(0,max||99), Q=queixas(p);
  return `<div class="hist">${L.map(s=>{const i=p.sessions.indexOf(s), k='h'+p.id+i, aberto=S.histAberto[k];
    return `<div class="hi ${aberto?'on':''}"><button class="hi-h" data-a="hist" data-k="${k}" aria-expanded="${!!aberto}"><span class="hi-n">${i+1}</span><span class="grow"><b>${fmt(s.date)}</b><small>${i===0?'Avaliação basal · ':''}${s.tec.join(', ')}</small></span>
      <span class="chips">${Q.map((q,j)=>q.serie[i]!=null?`<span class="pill" title="${esc(q.nome)}"><i class="dotq" style="background:${QCOR[j]}"></i>${q.serie[i]}</span>`:'').join('')}</span>${ic('baixo')}</button>
      ${aberto?`<div class="hi-b"><div class="chips">${s.pontos.map(c=>`<span class="pill acc mono" title="${esc(PT[c]?.pinyin||'')}">${c}</span>`).join('')}</div><p>${esc(s.nota)||'<span class="muted">Sem anotações.</span>'}</p></div>`:''}</div>`;}).join('')}</div>`;
}

/* ---------- Histórico e evolução ---------- */
function vHistorico(p){
  const Q=queixas(p), a0=p.assess[0], a1=p.assess.at(-1), labels=p.sessions.map((s,i)=>i===0?'basal':`${i+1}º`);
  const s0=a0&&new Set(a0.signs), s1=a1&&new Set(a1.signs);
  const resolv=a0&&p.assess.length>1?a0.signs.filter(x=>!s1.has(x)):[], novos=a0&&p.assess.length>1?a1.signs.filter(x=>!s0.has(x)):[];
  return `${migalha([['#/pacientes','Pacientes'],[`#/paciente/${p.id}`,p.name],[null,'Histórico e evolução']])}
  ${cabecalho(p,`<div class="perfil-a"><a class="btn pri" href="#/atendimento/${p.id}/0">${ic('play')}Novo atendimento</a></div>`)}
  <div class="card"><div class="card-h"><h2>Evolução das queixas</h2><div class="leg">${Q.map((q,i)=>`<span><i style="background:${QCOR[i]}"></i>${esc(q.nome)}</span>`).join('')}</div></div>
    ${p.sessions.length?`${linhas(Q.map((q,i)=>({cor:QCOR[i],vals:q.serie})),labels,{label:'Intensidade das queixas por atendimento',w:1000,h:240})}
    <div class="qsum">${Q.map((q,i)=>`<div><i style="background:${QCOR[i]}"></i><span>${esc(q.nome)}</span><b>${q.serie[0]??'–'} → ${q.serie.at(-1)??'–'}</b>${delta(q.serie[0],q.serie.at(-1))}</div>`).join('')}</div>`:'<div class="vazio">'+ic('info')+'Ainda sem atendimentos.</div>'}</div>
  ${a0?`<div class="card" style="margin-top:20px"><div class="card-h"><h2>Avaliação basal × atual</h2><span class="muted sm">${fmt(a0.date)}${p.assess.length>1?` → ${fmt(a1.date)}`:''}</span></div>
    ${p.assess.length>1?`<div class="cmp"><div><div class="lbl">Basal</div>${pentagram(elemState(a0.signs,a0.status),null)}</div><div><div class="lbl">Atual</div>${pentagram(elemState(a1.signs,a1.status),null)}</div></div>
    <div class="grid g2" style="margin-top:8px"><div>${barrasEl(elemState(a1.signs,a1.status),elemState(a0.signs,a0.status))}</div>
      <div class="sinais-cmp"><div><span class="pill ok">${ic('check')}${resolv.length} sinais resolvidos</span><p class="muted sm">${resolv.map(x=>SIGN[x]).join(', ')||'—'}</p></div>
      <div><span class="pill warn">${ic('mais')}${novos.length} sinais novos</span><p class="muted sm">${novos.map(x=>SIGN[x]).join(', ')||'—'}</p></div></div></div>`
    :`<div class="grid g2"><div>${pentagram(elemState(a0.signs,a0.status),null)}</div><div>${barrasEl(elemState(a0.signs,a0.status))}<p class="muted sm" style="margin-top:10px">Só existe a avaliação basal. A comparação aparece depois da primeira reavaliação.</p></div></div>`}</div>`:''}
  <div class="card" style="margin-top:20px"><div class="card-h"><h2>Linha do tempo dos atendimentos</h2><span class="muted sm">toque para ver detalhes</span></div>${p.sessions.length?linhaTempo(p):'<p class="muted">Nenhum atendimento.</p>'}</div>`;
}

/* ---------- Ambiente de atendimento ---------- */
function feito(A,i){ return [A.visit.has(0), A.signs.length>0, A.visit.has(2), Object.values(A.status).includes('aceito')||!!A.sintese, A.visit.has(4), A.pontos.length>0, A.visit.has(6), A.final][i]; }
function vAtendimento(p, step){
  const A=atend(p.id); A.visit.add(step);
  const [k,l]=STEPS[step];
  const corpo={anamnese:eAnamnese,avaliacao:eAvaliacao,pentagrama:ePentagrama,sintese:eSintese,mapa:eMapa,plano:ePlano,evolucao:eEvolucao,documentos:eDocumentos}[k](p,A);
  return `${migalha([['#/pacientes','Pacientes'],[`#/paciente/${p.id}`,p.name],[null,`Atendimento ${A.n}`]])}
  <div class="at-h"><span class="avatar lg">${initials(p.name)}</span><div class="grow"><b>${esc(p.name)}</b><small>${A.basal?'Primeira consulta · avaliação basal':`${A.n}º atendimento · retorno`} · ${fmt(TODAY)}</small></div>
    ${alertas(p).map(a=>`<span class="pill crit">${ic('escudo')}${a}</span>`).join('')}<span class="salvo">${ic('check')}Rascunho mantido ao trocar de etapa</span></div>
  <nav class="steps" aria-label="Etapas do atendimento">${STEPS.map(([,n,i],j)=>`<a href="#/atendimento/${p.id}/${j}" class="${j===step?'on':''} ${feito(A,j)?'ok':''}" ${j===step?'aria-current="step"':''}><span class="sn">${feito(A,j)&&j!==step?ic('check'):j+1}</span><span class="sl">${n}</span></a>`).join('')}</nav>
  <div class="et-h"><span class="tico acc">${ic(STEPS[step][2])}</span><div><h2>${l}</h2><small class="muted">Etapa ${step+1} de 8 · navegação livre entre as etapas</small></div></div>
  ${corpo}
  <div class="at-f">${step?`<a class="btn" href="#/atendimento/${p.id}/${step-1}">${ic('esq')}${STEPS[step-1][1]}</a>`:'<span></span>'}
    ${step<7?`<a class="btn pri" href="#/atendimento/${p.id}/${step+1}">${STEPS[step+1][1]}${ic('dir')}</a>`:`<button class="btn pri" data-a="finalizar" data-pid="${p.id}">${ic('check')}Finalizar atendimento</button>`}</div>`;
}
function eAnamnese(p,A){
  const Q=queixas(p);
  const F=[['historia','História da queixa','folha'],['sono','Sono','relogio'],['alimentacao','Alimentação e sede','folha'],['evacuacao','Evacuação e micção','info'],['emocoes','Emoções','yin'],['medicamentos','Medicamentos em uso','plano']];
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Queixas e intensidade hoje</h3>${A.basal?'<span class="pill acc">valores basais</span>':'<span class="pill">compare com o último atendimento</span>'}</div>
    ${Q.map((q,i)=>`<div class="qs"><div class="qs-h"><i style="background:${QCOR[i]}"></i><b>${esc(q.nome)}</b>${q.serie.length?`<span class="muted sm">último: ${q.serie.at(-1)} · basal: ${q.serie[0]}</span>`:''}</div>
      <div class="qs-r"><input type="range" min="0" max="10" value="${A.qx[q.id]}" data-q="${q.id}" aria-label="Intensidade de ${esc(q.nome)}"><span class="qs-v" id="qv-${q.id}">${A.qx[q.id]}</span><span id="qd-${q.id}">${q.serie.length?delta(q.serie.at(-1),A.qx[q.id]):''}</span></div></div>`).join('')}
    <button class="btn ghost sm" data-a="toast" data-m="Nova queixa: entra com a intensidade basal de hoje e passa a ter evolução própria.">${ic('mais')}Adicionar queixa</button></div>
    <div class="card"><h3>Anamnese</h3><p class="muted sm" style="margin-bottom:10px">${A.basal?'Preencha na primeira consulta.':'Trazida do atendimento anterior. Abra só o que mudou.'}</p>
      <div class="anam">${F.map(([k,l,i])=>`<details ${A.basal&&k==='historia'?'open':''}><summary>${ic(i)}<span class="grow">${l}</span>${A.anam[k]?`<span class="pill ok">${ic('check')}</span>`:'<span class="pill">vazio</span>'}${ic('baixo')}</summary><textarea data-an="${k}" aria-label="${l}">${esc(A.anam[k])}</textarea></details>`).join('')}</div></div></div>`;
}
function eAvaliacao(p,A){
  const H=evaluate(A.signs), bg=bagang(A.signs), a0=p.assess[0];
  const hem='Sul', mes=new Date().getMonth(), est=['Verão','Verão','Outono','Outono','Outono','Inverno','Inverno','Inverno','Primavera','Primavera','Primavera','Verão'][mes];
  const elEst={Primavera:'madeira',Verão:'fogo',Outono:'metal',Inverno:'agua'}[est];
  return `<div class="notice" style="margin-bottom:16px">${ic('info')}<div><b>Apoio ao raciocínio clínico.</b> As hipóteses vêm dos sinais marcados e não são diagnóstico. Cabe ao profissional aceitar, descartar e decidir.</div></div>
  <div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Sinais observados</h3><span class="pill acc">${A.signs.length} marcados</span></div>
      ${!A.basal&&a0?'<p class="muted sm" style="margin-bottom:10px">Sinais trazidos da última avaliação. Desmarque o que não está mais presente.</p>':''}
      <div class="sigs">${Object.entries(SIGNS).map(([g,L])=>`<div><div class="lbl" style="margin-bottom:8px">${g}</div><div class="chips">${L.map(([k,l])=>`<button class="chip ${A.signs.includes(k)?'on':''}" data-a="sinal" data-s="${k}" aria-pressed="${A.signs.includes(k)}">${l}</button>`).join('')}</div></div>`).join('')}</div></div>
    <details class="card mais-card"><summary><h3>Oito vasos extraordinários</h3><span class="pill">etapa 3</span>${ic('baixo')}</summary><p class="muted sm" style="margin-top:10px">Avaliação dos vasos Chong, Ren, Du, Dai, Yin Qiao, Yang Qiao, Yin Wei e Yang Wei, ligável à síntese e ao plano. Entra aqui, como bloco recolhível da avaliação.</p></details>
  </div>
  <div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Hipóteses de padrão</h3><span class="muted sm">${H.length} encontradas</span></div>
      ${H.length?H.map(h=>{const s=A.status[h.p.id]||'';return `<div class="hp ${s}"><div class="hp-h">${anel(h.score,Math.round(h.score*100)+'%',EL[h.p.el].cor)}<div class="grow"><b>${h.p.nome}</b><div>${elTag(h.p.el)} <span class="muted sm">· ${h.m.length}/${h.p.sinais.length} sinais</span></div></div></div>
        <div class="hp-a"><button class="btn sm ${s==='aceito'?'pri':''}" data-a="hip" data-p="${h.p.id}" data-st="aceito">${ic('check')}${s==='aceito'?'Aceito':'Aceitar'}</button><button class="btn sm" data-a="hip" data-p="${h.p.id}" data-st="descartado">${s==='descartado'?'Descartado':'Descartar'}</button></div>
        <details class="mais"><summary>Por que aparece ${ic('baixo')}</summary><p class="sm"><b>Presentes:</b> ${h.m.map(x=>SIGN[x]).join(', ')}</p>${h.falta.length?`<p class="sm muted"><b>Esperados, não observados:</b> ${h.falta.map(x=>SIGN[x]).join(', ')}</p>`:''}</details></div>`;}).join(''):'<p class="muted">Marque ao menos dois sinais para ver hipóteses.</p>'}</div>
    <div class="card"><h3>Oito princípios (Ba Gang)</h3><div class="grid" style="gap:12px;margin-top:10px">${eixo('Frio','Calor',bg.fc)}${eixo('Deficiência','Excesso',bg.de)}</div></div>
    <div class="card sazonal"><div class="card-h"><h3>${ic('sol')} Contexto sazonal</h3><span class="pill">complementar</span></div><p class="sm">São Paulo · hemisfério ${hem} · <b>${est}</b>, estação ligada a ${elTag(elEst)}.</p><p class="muted sm" style="margin-top:6px">Informação de contexto. Não indica pontos nem conduta.</p></div>
  </div></div>`;
}
function detalheEl(e, st, nome){
  if(!e) return '<div class="vazio">'+ic('info')+'Toque em um elemento para ver correspondências e relações.</div>';
  const E=EL[e], k=st?tipoEl(st[e]):'';
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:2rem;color:${E.cor}">${E.han}</span><h3>${E.nome}</h3>${k?`<span class="pill ${k==='exc'?'crit':'warn'}">${k==='exc'?'excesso':'deficiência'}</span>`:''}</div>
  <div class="corr-g">${[['Zang',E.zang],['Fu',E.fu],['Emoção',E.emocao],['Estação',E.estacao],['Clima',E.clima],['Tecido',E.tecido]].map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
  <div class="rel"><span>Gera ${elTag(SHENG[e])}</span><span>Gerado por ${elTag(mae(e))}</span><span>Controla ${elTag(KE[e])}</span><span>Controlado por ${elTag(controlador(e))}</span></div>
  ${k?`<div class="notice" style="margin-top:12px">${ic('info')}<div>${k==='def'?`Na deficiência, a regra mãe-filho sugere avaliar a tonificação da mãe (${EL[mae(e)].nome}).`:`No excesso, a regra mãe-filho sugere avaliar a sedação do filho (${EL[SHENG[e]].nome}).`} Decisão do profissional${nome?` para ${esc(nome)}`:''}.</div></div>`:''}`;
}
function ePentagrama(p,A){
  const st=elemState(A.signs,A.status), a0=p.assess[0], b=a0&&!A.basal?elemState(a0.signs,a0.status):null;
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Mapa dos cinco elementos</h3>${b?`<label class="chip ${A.cmp?'on':''}"><input type="checkbox" data-a="cmp" ${A.cmp?'checked':''} hidden>Comparar com o basal</label>`:'<span class="pill acc">basal</span>'}</div>
    ${A.cmp&&b?`<div class="cmp"><div><div class="lbl">Basal · ${fmt(a0.date)}</div>${pentagram(b,S.el)}</div><div><div class="lbl">Hoje</div>${pentagram(st,S.el)}</div></div>`:pentagram(st,S.el)}
    <p class="muted sm" style="text-align:center">Atualiza com os sinais e hipóteses desta consulta. Anel tracejado: deficiência; anel espesso: excesso.</p></div>
    <div class="grid" style="align-content:start"><div class="card">${barrasEl(st,b)}</div><div class="card">${detalheEl(S.el,st,p.name.split(' ')[0])}</div></div></div>`;
}
function eSintese(p,A){
  const H=evaluate(A.signs), ac=H.filter(h=>A.status[h.p.id]==='aceito'), bg=bagang(A.signs), st=elemState(A.signs,A.status);
  return `<div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><h3>Resumo da avaliação de hoje</h3><div class="sx">
      <div><small>Padrões validados</small>${ac.length?ac.map(h=>`<div class="sx-p">${elTag(h.p.el)}<b>${h.p.nome}</b><span class="pill ${h.p.tipo==='exc'?'crit':'warn'}">${h.p.tipo==='exc'?'excesso':'deficiência'}</span></div>`).join(''):`<p class="muted sm">Nenhum padrão aceito. <a href="#/atendimento/${p.id}/1">Voltar à avaliação</a></p>`}</div>
      <div><small>Oito princípios</small><div class="grid" style="gap:10px;margin-top:6px">${eixo('Frio','Calor',bg.fc)}${eixo('Def.','Exc.',bg.de)}</div></div></div></div>
    <div class="card"><div class="field"><label class="lbl" for="sx">Síntese do profissional</label><textarea id="sx" data-f="sintese" placeholder="Raciocínio clínico, prioridades do tratamento...">${esc(A.sintese)}</textarea></div><p class="muted sm" style="margin-top:8px">A síntese é escrita e validada pelo profissional. O sistema não conclui diagnóstico.</p></div></div>
    <div class="card"><h3>Elementos</h3>${barrasEl(st)}</div></div>`;
}
const MAPA = {VG20:[310,16],VB20:[296,60],B13:[298,104],B15:[298,116],B17:[298,132],B23:[298,180],VG4:[310,182],
  VC17:[100,118],VC12:[100,158],VC4:[100,200],IG11:[40,168],CS6:[44,214],CS7:[44,224],P9:[50,222],C7:[54,226],C8:[40,240],IG4:[30,236],
  BP10:[88,292],BP9:[90,322],VB34:[78,320],E36:[86,334],E40:[80,352],BP6:[92,370],R7:[94,384],R3:[94,396],R6:[97,401],BP3:[90,409],F3:[82,414]};
function silhueta(dx){
  return `<g transform="translate(${dx},0)" class="corpo"><circle cx="100" cy="30" r="20"/><rect x="91" y="48" width="18" height="16" rx="5"/>
  <path d="M62 66h76q10 0 12 12l3 120q0 8-8 10H55q-8-2-8-10l3-120q2-12 12-12z"/><path d="M50 74q-12 4-14 20l-10 140q0 8 7 9t8-7l11-118z"/><path d="M150 74q12 4 14 20l10 140q0 8-7 9t-8-7l-11-118z"/>
  <path d="M58 206h40l-2 200q0 14 -12 14t-12-14z"/><path d="M102 206h40l-14 200q0 14-12 14t-12-14z"/></g>`;
}
function eMapa(p,A){
  const pts=A.pontos.filter(c=>MAPA[c]);
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Mapa corporal</h3><span class="pill">atlas completo na etapa 4</span></div>
    <svg viewBox="0 0 420 458" class="mapa" role="img" aria-label="Mapa corporal com os pontos do plano">${silhueta(0)}${silhueta(210)}
    <text x="100" y="452" text-anchor="middle" class="ax">frente</text><text x="310" y="452" text-anchor="middle" class="ax">costas</text>
    ${pts.map(c=>`<g><circle cx="${MAPA[c][0]}" cy="${MAPA[c][1]}" r="6" class="pt"/><text x="${MAPA[c][0]+9}" y="${MAPA[c][1]+4}" class="ptl">${c}</text></g>`).join('')}</svg>
    <p class="muted sm" style="text-align:center">Posições ilustrativas.</p></div>
    <div class="card"><h3>Pontos marcados</h3>${A.pontos.length?`<div class="chips" style="margin-top:10px">${A.pontos.map(c=>`<span class="pill acc mono">${c}${PT[c]?` · ${PT[c].pinyin}`:''}</span>`).join('')}</div>`:`<div class="vazio">${ic('info')}Os pontos escolhidos no plano terapêutico aparecem aqui.</div><a class="btn sm" href="#/atendimento/${p.id}/5" style="margin-top:8px">Ir ao plano</a>`}</div></div>`;
}
function ePlano(p,A){
  const ac=evaluate(A.signs).filter(h=>A.status[h.p.id]==='aceito'), w=pointWarnings(A.pontos,p,A.tec);
  const TEC=['Acupuntura','Auriculoterapia','Moxabustão','Ventosa','Eletroacupuntura','Massagem Tuiná','Sangria'];
  return `<div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Pontos do plano</h3><span class="pill acc">${A.pontos.length}</span></div>
      ${A.pontos.length?`<div class="chips">${A.pontos.map(c=>`<button class="chip on mono" data-a="pt" data-c="${c}" title="Remover">${c} ✕</button>`).join('')}</div>`:'<p class="muted sm">Escolha nas sugestões ao lado.</p>'}
      <div class="lbl" style="margin:16px 0 8px">Técnicas</div><div class="chips">${TEC.map(t=>`<button class="chip ${A.tec.includes(t)?'on':''}" data-a="tec" data-t="${t}">${t}</button>`).join('')}</div></div>
    <div class="card seg"><div class="card-h"><h3>${ic('escudo')} Verificação de segurança</h3>${w.length?`<span class="pill crit">${w.length}</span>`:'<span class="pill ok">ok</span>'}</div>
      ${w.length?w.map(([k,m])=>`<div class="notice ${k==='crit'?'crit':''}" style="margin-bottom:8px">${ic(k==='crit'?'escudo':'alerta')}<div><b>${k==='crit'?'Atenção':'Cautela'}</b> ${esc(m)}</div></div>`).join(''):`<div class="vazio">${ic('okc')}Nenhuma contraindicação encontrada para os pontos e técnicas escolhidos.</div>`}</div></div>
    <div class="card"><h3>Sugestões dos padrões validados</h3><p class="muted sm" style="margin-bottom:10px">Toque para incluir. A escolha é do profissional.</p>
      ${ac.length?ac.map(h=>`<div class="sug"><div class="sug-h">${elTag(h.p.el)}<b>${h.p.nome}</b></div><div class="chips">${h.p.pontos.map(([c,j])=>`<button class="chip mono ${A.pontos.includes(c)?'on':''}" data-a="pt" data-c="${c}" title="${esc(j)}">${c}${PT[c]?.cautela?' ⚠':''}</button>`).join('')}</div></div>`).join(''):`<div class="vazio">${ic('info')}Aceite hipóteses na avaliação para ver sugestões.</div>`}</div></div>`;
}
function eEvolucao(p,A){
  const Q=queixas(p), labels=[...p.sessions.map((s,i)=>i===0?'basal':`${i+1}º`),'hoje'];
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Queixas ao longo do tratamento</h3><div class="leg">${Q.map((q,i)=>`<span><i style="background:${QCOR[i]}"></i>${esc(q.nome)}</span>`).join('')}</div></div>
    ${linhas(Q.map((q,i)=>({cor:QCOR[i],vals:[...q.serie,A.qx[q.id]]})),labels)}
    <div class="qsum">${Q.map((q,i)=>`<div><i style="background:${QCOR[i]}"></i><span>${esc(q.nome)}</span><b>${q.serie[0]??A.qx[q.id]} → ${A.qx[q.id]}</b>${q.serie.length?delta(q.serie[0],A.qx[q.id]):'<span class="pill acc">basal</span>'}</div>`).join('')}</div>
    <p class="muted sm">Os valores de hoje vêm da etapa Anamnese.</p></div>
    <div class="card"><div class="field"><label class="lbl" for="ev">Evolução e observações</label><textarea id="ev" data-f="evol" placeholder="Como o paciente respondeu, o que mudou desde o último atendimento...">${esc(A.evol)}</textarea></div></div></div>`;
}
function eDocumentos(p,A){
  const D=[['doc','Registro do atendimento','Gerado ao finalizar, com todas as etapas','ok'],['plano','Orientações ao paciente','A partir do plano terapêutico','acc'],['escudo','Termo de consentimento','Assinatura eletrônica (etapa 6)',''],['agenda','Agendar retorno','Sugestão: 14 dias','']];
  return `<div class="docs">${D.map(([i,t,s,k])=>`<button class="docc" data-a="toast" data-m="${t}: detalhado na etapa 6 (documentos).">${ic(i)}<b>${t}</b><small>${s}</small>${k?`<span class="pill ${k}">${k==='ok'?'automático':'sugerido'}</span>`:''}</button>`).join('')}</div>
  <div class="card" style="margin-top:20px"><h3>Antes de finalizar</h3><div class="chk">${STEPS.slice(0,7).map(([,n],j)=>`<a href="#/atendimento/${p.id}/${j}" class="${feito(A,j)?'ok':''}">${ic(feito(A,j)?'okc':'relogio')}${n}</a>`).join('')}</div>
    <p class="muted sm" style="margin-top:10px">Etapas incompletas não impedem finalizar. O atendimento pode ser documentado depois, com registro de data e autor de cada alteração.</p></div>`;
}

/* ---------- Telas fora do escopo da proposta ---------- */
function vOutra(k){
  const T={agenda:['Agenda','Continua como no sistema atual, com o botão "Iniciar atendimento" em cada horário.','agenda','spazio.html#agenda'],
    biblioteca:['Biblioteca clínica','Continua como no sistema atual: pontos, meridianos e cautelas.','biblioteca','spazio.html#pontos'],
    financeiro:['Financeiro','Planejado para a etapa 8.','financeiro'],documentos:['Documentos','Planejado para a etapa 6.','doc'],
    relatorios:['Relatórios','Planejado para a etapa 9.','relatorios'],administracao:['Administração','Equipe, permissões e configurações. Planejado para a etapa 10.','admin']}[k];
  return `<div class="fora"><span class="tico acc xl">${ic(T[2])}</span><h1>${T[0]}</h1><p class="muted">${T[1]}</p>${T[3]?`<a class="btn" href="/${T[3]}">Abrir no sistema atual</a>`:''}<p class="muted sm">Esta proposta cobre o painel, o perfil do paciente, o atendimento integrado e o histórico.</p></div>`;
}
function migalha(L){ return `<nav class="migalha" aria-label="Caminho">${L.map(([h,t])=>h?`<a href="${h}">${esc(t)}</a>`:`<span>${esc(t)}</span>`).join(ic('dir'))}</nav>`; }

/* ---------- Rotas e eventos ---------- */
function rota(){ const [r='painel',id,x]=location.hash.replace(/^#\/?/,'').split('/'); return {r,id,x}; }
function render(manter){
  const {r,id,x}=rota(), y=scrollY, p=id&&P(id);
  let html, ativo=r;
  if(r==='paciente'&&p){ html=x==='historico'?vHistorico(p):vPerfil(p); ativo='pacientes'; }
  else if(r==='atendimento'&&p){ html=vAtendimento(p,Math.max(0,Math.min(7,Number(x)||0))); ativo='pacientes'; }
  else if(r==='pacientes') html=vPacientes();
  else if(['agenda','biblioteca','financeiro','documentos','relatorios','administracao'].includes(r)) html=vOutra(r);
  else { html=vPainel(); ativo='painel'; }
  menu(ativo); document.getElementById('view').innerHTML=html;
  if(manter) scrollTo(0,y);
}
function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>t.hidden=true,3200); }
addEventListener('hashchange',()=>{ S.aberto=false; const {r}=rota(); if(r!=='atendimento') S.el=null; render(); scrollTo(0,0); });
document.addEventListener('click',ev=>{
  const t=ev.target.closest('[data-a],[data-act]'); if(!t) return;
  const a=t.dataset.a||t.dataset.act, {id}=rota(), A=id&&AT[id];
  if(a==='menu-mini'){ S.mini=!S.mini; render(true); }
  else if(a==='menu-abrir'){ S.aberto=!S.aberto; render(true); }
  else if(a==='menu-fechar'){ S.aberto=false; render(true); }
  else if(a==='toast'){ toast(t.dataset.m); }
  else if(a==='hist'){ S.histAberto[t.dataset.k]=!S.histAberto[t.dataset.k]; render(true); }
  else if(a==='el'){ S.el=t.dataset.e&&S.el!==t.dataset.e?t.dataset.e:null; render(true); }
  else if(a==='sinal'&&A){ const i=A.signs.indexOf(t.dataset.s); i<0?A.signs.push(t.dataset.s):A.signs.splice(i,1); render(true); }
  else if(a==='hip'&&A){ A.status[t.dataset.p]=A.status[t.dataset.p]===t.dataset.st?'':t.dataset.st; render(true); }
  else if(a==='pt'&&A){ const i=A.pontos.indexOf(t.dataset.c); i<0?A.pontos.push(t.dataset.c):A.pontos.splice(i,1); render(true); }
  else if(a==='tec'&&A){ const i=A.tec.indexOf(t.dataset.t); i<0?A.tec.push(t.dataset.t):A.tec.splice(i,1); render(true); }
  else if(a==='finalizar'&&A){ A.final=true; render(true); toast('Na versão definitiva: o atendimento entra no histórico do paciente e o registro é gerado. Nesta proposta nada é salvo.'); }
});
document.addEventListener('change',ev=>{ const t=ev.target, {id}=rota(), A=id&&AT[id]; if(t.dataset.a==='cmp'&&A){ A.cmp=t.checked; render(true); } });
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&S.aberto){ S.aberto=false; render(true); } if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('.node')){ ev.preventDefault(); ev.target.dispatchEvent(new MouseEvent('click',{bubbles:true})); } });
document.addEventListener('input',ev=>{
  const t=ev.target, {id}=rota(), A=id&&AT[id]; if(!A) return;
  if(t.dataset.q){ A.qx[t.dataset.q]=Number(t.value); document.getElementById('qv-'+t.dataset.q).textContent=t.value; const q=queixas(P(id)).find(z=>z.id===t.dataset.q); if(q.serie.length) document.getElementById('qd-'+q.id).innerHTML=delta(q.serie.at(-1),Number(t.value)); }
  else if(t.dataset.an){ A.anam[t.dataset.an]=t.value; }
  else if(t.dataset.f){ A[t.dataset.f]=t.value; }
});
render();
