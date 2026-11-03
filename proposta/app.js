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
import { MER, POINTS } from '../js/conhecimento/pontos.js';
import { TODAY, addDays, age, brl, esc, fmt, initials } from '../js/util.js';
import { ICONES as I } from './icones.js';

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
const ic = (k,c='') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
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
    `<div class="foot"><a href="#/guia" class="${atual==='guia'?'on':''}" aria-label="Guia visual">${ic('paleta')}<span>Guia visual</span></a>
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
    <div class="quick"><a class="btn" href="#/pacientes/novo">${ic('novo')}Novo paciente</a><a class="btn pri" href="#/agenda">${ic('agenda')}Novo agendamento</a></div></div>

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
  return `<div class="head"><div><h1>Pacientes</h1><p>${db.patients.length} pacientes</p></div><div class="quick"><label class="busca">${ic('busca')}<input id="pbusca" placeholder="Buscar paciente" aria-label="Buscar paciente"></label><a class="btn pri" href="#/pacientes/novo">${ic('novo')}Novo paciente</a></div></div>
  <div class="pgrid">${db.patients.map(p=>{const q=queixas(p)[0], m=melhora(q.serie), prox=db.appts.filter(a=>a.pid===p.id&&a.date>=TODAY&&!a.done).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
    return `<a class="pc" data-n="${esc(p.name.toLowerCase())}" href="#/paciente/${p.id}"><div class="pc-h"><span class="avatar lg">${initials(p.name)}</span><span class="grow"><b>${esc(p.name)}</b><small>${age(p.birth)} anos · ${p.sessions.length} atendimento${p.sessions.length===1?'':'s'}</small></span>${alertas(p).length?`<span class="pill crit" title="${alertas(p).join(', ')}">${ic('escudo')}</span>`:''}</div>
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
  ${cabecalho(p,`<div class="perfil-a"><a class="btn" href="#/paciente/${p.id}/historico">${ic('doc')}Prontuário</a><a class="btn pri" href="#/atendimento/${p.id}/0">${ic('play')}Novo atendimento</a></div>`)}
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
  return `${migalha([['#/pacientes','Pacientes'],[`#/paciente/${p.id}`,p.name],[null,'Prontuário']])}
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

/* ---------- Gráficos extras ---------- */
function rosca(seg, centro){
  const r=42, c=2*Math.PI*r, tot=seg.reduce((n,s)=>n+s[1],0)||1; let off=0;
  return `<svg class="rosca" viewBox="0 0 110 110" width="132" height="132" role="img" aria-label="${seg.map(s=>`${s[0]} ${Math.round(s[1]/tot*100)}%`).join(', ')}"><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/>`+
    seg.map(([,v,cor])=>{const L=v/tot*c, d=`<circle cx="55" cy="55" r="${r}" fill="none" stroke="${cor}" stroke-width="12" stroke-dasharray="${Math.max(0,L-2).toFixed(1)} ${c.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 55 55)"/>`; off+=L; return d;}).join('')+
    `<text x="55" y="53" text-anchor="middle" class="r1">${centro[0]}</text><text x="55" y="69" text-anchor="middle" class="r2">${centro[1]}</text></svg>`;
}
function barrasV(vals, labels, o={}){
  const W=o.w||560, H=o.h||190, B=24, T=18, max=Math.max(1,...vals), bw=W/vals.length;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'')}">`;
  [0,.5,1].forEach(f=>s+=`<line class="gl" x1="0" x2="${W}" y1="${H-B-f*(H-B-T)}" y2="${H-B-f*(H-B-T)}"/>`);
  vals.forEach((v,i)=>{const h=v/max*(H-B-T), x=i*bw+bw*.22, w=bw*.56, ult=i===vals.length-1;
    s+=`<rect x="${x}" y="${H-B-h}" width="${w}" height="${h}" rx="6" fill="${ult?'var(--brand)':'var(--sage)'}"/><text class="ax" x="${x+w/2}" y="${H-B-h-6}" text-anchor="middle">${o.fmt?o.fmt(v):v}</text><text class="ax" x="${x+w/2}" y="${H-6}" text-anchor="middle">${labels[i]}</text>`;});
  return s+'</svg>';
}
const MESES=['jun','jul','ago','set','out','nov'];

/* ---------- Agenda ---------- */
function vAgenda(){
  const ws=addDays(-((new Date().getDay()+6)%7)), dias=[...Array(6)].map((_,i)=>addDays(i,ws)), H0=8, H1=19, alt=52;
  const hoje=db.appts.filter(a=>a.date===TODAY);
  const cor=a=>a.done?'ok':!P(a.pid).sessions.length?'nova':'ag';
  return `<div class="head"><div><h1>Agenda</h1><p>Semana de ${fmt(dias[0])} a ${fmt(dias[5])}</p></div>
    <div class="quick"><div class="seg-c"><button>Dia</button><button class="on">Semana</button><button>Mês</button></div><button class="btn">${ic('esq')}</button><button class="btn">Hoje</button><button class="btn">${ic('dir')}</button><button class="btn pri" data-a="toast" data-m="Novo agendamento: paciente, serviço, horário e valor, como hoje.">${ic('mais')}Agendar</button></div></div>
  <div class="ag-l">
    <div class="card cal-w"><div class="cal-g" style="--alt:${alt}px">
      <div class="cal-c"></div>${dias.map(d=>`<div class="cal-d ${d===TODAY?'hoje':''}"><small>${new Date(d+'T12:00').toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</small><b>${d.slice(8)}</b></div>`).join('')}
      <div class="cal-hs">${[...Array(H1-H0)].map((_,i)=>`<span>${String(H0+i).padStart(2,'0')}:00</span>`).join('')}</div>
      ${dias.map(d=>`<div class="cal-col ${d===TODAY?'hoje':''}">${db.appts.filter(a=>a.date===d).map(a=>{const [h,m]=a.time.split(':').map(Number), top=(h-H0+m/60)*alt, p=P(a.pid);
        return `<a class="ev ${cor(a)}" style="top:${top}px;height:${alt-6}px" href="#/paciente/${p.id}"><b>${a.time} ${esc(p.name.split(' ')[0])}</b><small>${esc(a.tipo)}</small></a>`;}).join('')}
        ${d===TODAY?`<i class="agora" style="top:${(Math.min(Math.max(new Date().getHours()+new Date().getMinutes()/60,H0),H1)-H0)*alt}px"></i>`:''}</div>`).join('')}
    </div></div>
    <div class="grid" style="align-content:start">
      <div class="card"><h3>Hoje</h3><div class="ag-res">${rosca([['concluídos',hoje.filter(a=>a.done).length,'var(--ok)'],['agendados',hoje.filter(a=>!a.done).length,'var(--brand)']],[hoje.length,'atendimentos'])}
        <div class="leg col"><span><i style="background:var(--brand)"></i>Agendado</span><span><i style="background:var(--ok)"></i>Concluído</span><span><i style="background:#c9a96b"></i>Primeira consulta</span></div></div></div>
      <div class="card"><h3>Ocupação da semana</h3><div class="big" style="margin-top:8px">${Math.round(db.appts.filter(a=>a.date>=dias[0]&&a.date<=dias[5]).length/(6*8)*100)}%</div><div class="meter"><i style="width:${Math.round(db.appts.filter(a=>a.date>=dias[0]&&a.date<=dias[5]).length/(6*8)*100)}%"></i></div><small class="muted">dos horários disponíveis (8 por dia)</small></div>
    </div></div>`;
}

/* ---------- Cadastro ---------- */
function vCadastro(){
  const campo=(id,l,t='text',ph='',cls='')=>`<div class="field ${cls}"><label class="lbl" for="${id}">${l}</label><input id="${id}" type="${t}" placeholder="${ph}"></div>`;
  return `${migalha([['#/pacientes','Pacientes'],[null,'Novo paciente']])}
  <div class="head"><div><h1>Novo paciente</h1><p>Os campos com * são obrigatórios.</p></div></div>
  <div class="cad">
    <div class="grid" style="align-content:start">
      <section class="card fs"><div class="fs-h"><span class="tico acc">${ic('doc_id')}</span><div><h3>Identificação</h3><small class="muted">Dados pessoais e contato</small></div></div>
        <div class="form">${campo('c-nome','Nome completo *','text','Ex.: Marina Costa','full')}${campo('c-nasc','Data de nascimento *','date')}${campo('c-cpf','CPF','text','000.000.000-00')}${campo('c-tel','Telefone (WhatsApp)','tel','(11) 90000-0000')}${campo('c-mail','E-mail','email','nome@email.com')}</div></section>
      <section class="card fs"><div class="fs-h"><span class="tico acc">${ic('local')}</span><div><h3>Local de atendimento</h3><small class="muted">Usado no contexto sazonal (hemisfério e estação)</small></div></div>
        <div class="form">${campo('c-cid','Cidade','text','São Paulo')}<div class="field"><label class="lbl" for="c-hem">Hemisfério</label><select id="c-hem"><option>Sul</option><option>Norte</option></select></div></div></section>
      <section class="card fs"><div class="fs-h"><span class="tico acc">${ic('pulso')}</span><div><h3>Queixa principal</h3><small class="muted">A intensidade inicial vira o valor basal</small></div></div>
        <div class="form"><div class="field full"><label class="lbl" for="c-q">Queixa *</label><input id="c-q" placeholder="Ex.: dor cervical e tensão nos ombros"></div>
        <div class="field full"><label class="lbl">Intensidade inicial</label><div class="qs-r"><input type="range" min="0" max="10" value="6" id="c-eva" aria-label="Intensidade inicial"><span class="qs-v" id="c-eva-v">6</span></div></div></div></section>
      <section class="card fs"><div class="fs-h"><span class="tico crit">${ic('escudo')}</span><div><h3>Alertas de segurança</h3><small class="muted">Avisam sobre pontos e técnicas contraindicados</small></div></div>
        <div class="tgs">${[['gestante','Gestante','Pontos com cautela na gestação'],['anticoagulante','Uso de anticoagulante','Ventosa e sangria'],['marcapasso','Marcapasso','Eletroacupuntura']].map(([k,l,d])=>`<label class="tg"><input type="checkbox" id="c-${k}"><span class="sw"></span><span><b>${l}</b><small>${d}</small></span></label>`).join('')}</div></section>
      <section class="card fs"><label class="lgpd"><input type="checkbox" id="c-lgpd"> <span>Paciente autorizou o tratamento dos dados de saúde para fins de atendimento (LGPD). *</span></label></section>
      <div class="at-f" style="margin-top:0"><a class="btn" href="#/pacientes">Cancelar</a><button class="btn pri" data-a="toast" data-m="Na versão definitiva o paciente é salvo e abre o perfil dele. Nesta proposta nada é salvo.">${ic('check')}Salvar paciente</button></div>
    </div>
    <aside class="card cad-p"><div class="lbl">Pré-visualização</div><div class="cad-pv"><span class="avatar xl" id="pv-av">?</span><b id="pv-n">Nome do paciente</b><small class="muted" id="pv-q">Queixa principal</small></div>
      <div class="lbl" style="margin-top:16px">Próximo passo</div><p class="sm muted" style="margin-top:6px">Depois de salvar, o botão <b>Novo atendimento</b> abre a primeira consulta com a avaliação basal.</p></aside>
  </div>`;
}

/* ---------- Biblioteca ---------- */
function vBiblioteca(){
  const f=S.mer||'', q=(S.bq||'').toLowerCase();
  const L=POINTS.filter(p=>(!f||p.mer===f)&&(!q||(p.code+p.pinyin+p.acoes).toLowerCase().includes(q)));
  const usados=[...new Set(POINTS.map(p=>p.mer))];
  return `<div class="head"><div><h1>Biblioteca clínica</h1><p>${POINTS.length} pontos com localização, ações e cautelas</p></div><label class="busca">${ic('busca')}<input id="bq" placeholder="Buscar ponto, nome ou ação" value="${esc(S.bq||'')}"></label></div>
  <div class="chips" style="margin-bottom:20px"><button class="chip ${!f?'on':''}" data-a="mer" data-m="">Todos</button>${usados.map(m=>`<button class="chip ${f===m?'on':''}" data-a="mer" data-m="${m}">${MER[m]?.[1]?`<i class="dotq" style="background:${EL[MER[m][1]].cor}"></i>`:''}${MER[m]?.[0]||m}</button>`).join('')}</div>
  <div class="bib">${L.map(p=>{const el=MER[p.mer]?.[1];return `<article class="bc"><div class="bc-h"><span class="bc-c" style="${el?`color:${EL[el].cor};background:color-mix(in srgb, ${EL[el].cor} 12%, white)`:''}">${p.code}</span><div class="grow"><b>${esc(p.pinyin)}</b><small class="muted">${MER[p.mer]?.[0]||''}</small></div>${p.cautela?`<span class="pill warn" title="${esc(CAUT[p.cautela])}">${ic('alerta')}</span>`:''}</div>
    <p class="sm">${esc(p.acoes)}</p><details class="mais"><summary>Localização ${ic('baixo')}</summary><p class="sm muted">${esc(p.loc)}</p>${p.cautela?`<p class="sm" style="color:var(--warn)">${esc(CAUT[p.cautela])}</p>`:''}</details></article>`;}).join('')||'<p class="muted">Nenhum ponto encontrado.</p>'}</div>`;
}

/* ---------- Financeiro (fictício, etapa 8) ---------- */
function vFinanceiro(){
  const rec=[8200,9100,8700,9900,10800,6200], L=[['22/10','Helena Prado','Acupuntura',180,'pago'],['20/10','Rafael Monteiro','Acupuntura e moxabustão',200,'pago'],['18/10','Lúcia Andrade','Pacote 5 sessões',800,'parcial'],['15/10','Tiago Sato','Acupuntura',180,'pendente'],['12/10','Helena Prado','Acupuntura',180,'pago']];
  return `<div class="head"><div><h1>Financeiro</h1><p>Visão de novembro · <span class="pill ex">dados fictícios · etapa 8</span></p></div><div class="quick"><button class="btn">${ic('baixar')}Exportar</button><button class="btn pri" data-a="toast" data-m="Lançamentos e NFS-e entram na etapa 8.">${ic('mais')}Lançamento</button></div></div>
  <div class="tiles">
    <div class="tile"><span class="tico acc">${ic('dinheiro')}</span><div><small>Receita no mês</small><b class="num">${brl(6200)}</b><span class="tr bom">${ic('sobe')}12% vs out</span></div></div>
    <div class="tile"><span class="tico">${ic('relogio')}</span><div><small>A receber</small><b class="num">${brl(1340)}</b><span class="tr">4 lançamentos</span></div></div>
    <div class="tile"><span class="tico warn">${ic('alerta')}</span><div><small>Inadimplência</small><b class="num">3,1%</b><span class="tr ruim">${ic('sobe')}0,4 p.p.</span></div></div>
    <div class="tile"><span class="tico">${ic('recibo')}</span><div><small>Ticket médio</small><b class="num">${brl(186)}</b><span class="tr">por atendimento</span></div></div></div>
  <div class="grid g-side"><div class="card"><div class="card-h"><h3>Receita mensal</h3><span class="muted sm">últimos 6 meses</span></div>${barrasV(rec,MESES,{label:'Receita mensal',fmt:v=>(v/1000).toFixed(1).replace('.',',')+' mil'})}</div>
    <div class="card"><h3>Receita por serviço</h3><div class="ag-res">${rosca([['Acupuntura',58,'var(--brand)'],['Pacotes',27,'#b8894a'],['Ventosa',15,'#5f7f9c']],['58%','acupuntura'])}<div class="leg col"><span><i style="background:var(--brand)"></i>Acupuntura 58%</span><span><i style="background:#b8894a"></i>Pacotes 27%</span><span><i style="background:#5f7f9c"></i>Ventosa 15%</span></div></div></div></div>
  <div class="card" style="margin-top:20px"><div class="card-h"><h3>Últimos lançamentos</h3><button class="btn ghost sm">Ver todos ${ic('dir')}</button></div>
    <div class="tab"><div class="tr-h"><span>Data</span><span>Paciente</span><span>Serviço</span><span>Valor</span><span>Status</span></div>${L.map(([d,n,s,v,st])=>`<div class="tr-r"><span class="mono">${d}</span><span><b>${n}</b></span><span class="muted">${s}</span><span class="mono">${brl(v)}</span><span><span class="pill ${st==='pago'?'ok':st==='parcial'?'warn':'crit'}">${st}</span></span></div>`).join('')}</div></div>`;
}

/* ---------- Relatórios (fictício, etapa 9) ---------- */
function vRelatorios(){
  const at=[38,42,40,47,52,21], hrs=['08','10','12','14','16','18'], dd=['seg','ter','qua','qui','sex','sáb'];
  const heat=dd.map((_,i)=>hrs.map((_,j)=>[.8,.6,.3,.7,.9,.5][j]*[1,.9,.8,1,.95,.4][i]));
  return `<div class="head"><div><h1>Relatórios</h1><p>Clínicos, agenda e financeiro · <span class="pill ex">dados fictícios · etapa 9</span></p></div><div class="seg-c"><button>30 dias</button><button class="on">6 meses</button><button>12 meses</button></div></div>
  <div class="tiles">
    <div class="tile">${anel(.72,'72%','var(--ok)')}<div><b>Melhora clínica</b><small>pacientes com queixa principal menor que no basal</small></div></div>
    <div class="tile"><span class="tico acc">${ic('queda')}</span><div><small>Redução média da EVA</small><b class="num">−2,6</b><span class="tr bom">pontos desde o basal</span></div></div>
    <div class="tile"><span class="tico">${ic('pacientes')}</span><div><small>Pacientes ativos</small><b class="num">48</b><span class="tr bom">${ic('sobe')}6 no mês</span></div></div>
    <div class="tile"><span class="tico">${ic('agenda')}</span><div><small>Comparecimento</small><b class="num">94%</b><span class="tr">faltas: 6%</span></div></div></div>
  <div class="grid g2"><div class="card"><div class="card-h"><h3>Atendimentos por mês</h3></div>${barrasV(at,MESES,{label:'Atendimentos por mês'})}</div>
    <div class="card"><div class="card-h"><h3>Intensidade média das queixas</h3><span class="muted sm">EVA 0 a 10</span></div>${linhas([{cor:'var(--brand)',vals:[6.8,6.2,5.6,5.1,4.6,4.2]}],MESES,{w:560,h:190})}</div></div>
  <div class="card" style="margin-top:20px"><div class="card-h"><h3>Ocupação por dia e horário</h3><div class="leg"><span><i style="background:var(--sage)"></i>baixa</span><span><i style="background:var(--brand)"></i>alta</span></div></div>
    <div class="heat"><span></span>${hrs.map(h=>`<small>${h}h</small>`).join('')}${dd.map((d,i)=>`<small>${d}</small>${heat[i].map(v=>`<i style="background:color-mix(in srgb, var(--brand) ${Math.round(v*100)}%, var(--surface-2))" title="${Math.round(v*100)}%"></i>`).join('')}`).join('')}</div></div>`;
}

/* ---------- Documentos e Administração ---------- */
function vDocumentos(){
  const M=[['Ficha de anamnese','folha','12 usos'],['Termo de consentimento','assinatura','assinatura eletrônica'],['Orientações ao paciente','plano','a partir do plano'],['Registro de atendimento','doc','gerado ao finalizar'],['Declaração de comparecimento','conferido','1 clique'],['Recibo','recibo','etapa 8']];
  return `<div class="head"><div><h1>Documentos</h1><p>Modelos preenchidos com os dados do paciente · <span class="pill ex">etapa 6</span></p></div><button class="btn pri" data-a="toast" data-m="Modelos de documento entram na etapa 6.">${ic('mais')}Novo modelo</button></div>
  <div class="docs">${M.map(([t,i,s])=>`<button class="docc" data-a="toast" data-m="${t}: etapa 6.">${ic(i)}<b>${t}</b><small>${s}</small></button>`).join('')}</div>`;
}
function vAdmin(){
  const E=[['Mauren Turcatti','Administradora · Acupuntura','admin'],['Profissional convidada','Fisioterapia · Acupuntura','clínica'],['Recepção','Agenda e financeiro','recepção']];
  return `<div class="head"><div><h1>Administração</h1><p>Equipe, permissões e dados da clínica · <span class="pill ex">etapa 10</span></p></div><button class="btn pri" data-a="toast" data-m="Multiusuário entra na etapa 10.">${ic('novo')}Convidar</button></div>
  <div class="grid g-side"><div class="card"><h3>Equipe</h3>${E.map(([n,d,r])=>`<div class="al-i"><span class="avatar">${initials(n)}</span><span class="grow"><b>${n}</b><small class="muted">${d}</small></span><span class="pill ${r==='admin'?'acc':''}">${r}</span></div>`).join('')}</div>
    <div class="card"><h3>Clínica</h3><dl class="corr" style="margin-top:12px"><dt>Nome</dt><dd>Spazio Terapias Integrativas</dd><dt>Cidade</dt><dd>São Paulo · hemisfério Sul</dd><dt>Serviços</dt><dd>Acupuntura, moxabustão, ventosa, auriculoterapia</dd><dt>Privacidade</dt><dd>LGPD · consentimento por paciente</dd></dl></div></div>`;
}

/* ---------- Guia visual ---------- */
function vGuia(){
  const cores=[['--brand','Verde institucional','#66864b'],['--accent','Verde de texto e botões','#4f6b3a'],['--accent-soft','Verde claro','#eef3e7'],['--sage','Sálvia','#dfe8d3'],['--beige','Bege','#efe7d6'],['--bg','Fundo creme','#f6f3ec'],['--surface','Cartão','#ffffff'],['--ink','Texto','#1f2a1b'],['--muted','Texto secundário','#6b7363']];
  const est=[['ok','Concluído / pago'],['acc','Agendado / ativo'],['warn','Pendente / cautela'],['crit','Alerta de segurança']];
  return `<div class="head"><div><h1>Guia visual</h1><p>O padrão único aplicado a todas as telas do Spazio</p></div></div>
  <div class="grid g2">
    <div class="card"><h3>Cores</h3><div class="sw-g">${cores.map(([v,n,h])=>`<div><i style="background:var(${v})"></i><b>${n}</b><small class="mono">${h}</small></div>`).join('')}</div></div>
    <div class="card"><h3>Tipografia · Inter</h3><div class="ty"><span style="font-size:1.7rem;font-weight:650;letter-spacing:-.025em">Título de página</span><span style="font-size:1.02rem;font-weight:600">Título de cartão</span><span>Texto de leitura, 14,5 px, entrelinha 1,55.</span><span class="muted sm">Texto de apoio e legendas</span><span class="lbl">Rótulo de seção</span><span class="big">4,2</span><span class="mono">09:30 · E36 · JetBrains Mono para horários e códigos</span></div></div>
    <div class="card"><h3>Botões e estados</h3><div class="chips" style="margin:12px 0"><button class="btn pri">${ic('play')}Principal</button><button class="btn">Secundário</button><button class="btn ghost">Discreto</button><button class="btn sm">Pequeno</button></div>
      <div class="chips">${est.map(([k,l])=>`<span class="pill ${k}">${l}</span>`).join('')}</div>
      <div class="chips" style="margin-top:12px"><button class="chip on">Selecionado</button><button class="chip">Opção</button></div></div>
    <div class="card"><h3>Formulário</h3><div class="form" style="margin-top:12px"><div class="field"><label class="lbl" for="g1">Campo</label><input id="g1" placeholder="Texto de exemplo"></div><div class="field"><label class="lbl" for="g2">Seleção</label><select id="g2"><option>Opção</option></select></div>
      <label class="tg full"><input type="checkbox" checked><span class="sw"></span><span><b>Interruptor</b><small>para sim ou não</small></span></label></div></div>
    <div class="card"><h3>Indicadores</h3><div class="tiles" style="margin:12px 0 0;grid-template-columns:1fr"><div class="tile">${anel(.68,'68%')}<div><b>Anel</b><small>proporção</small></div></div><div class="tile"><span class="tico acc">${ic('pacientes')}</span><div><b class="num">48</b><small>número em destaque</small></div></div></div></div>
    <div class="card"><h3>Ícones · Lucide</h3><div class="ico-g">${Object.keys(I).slice(0,40).map(k=>`<span title="${k}">${ic(k)}</span>`).join('')}</div></div>
  </div>`;
}

function migalha(L){ return `<nav class="migalha" aria-label="Caminho">${L.map(([h,t])=>h?`<a href="${h}">${esc(t)}</a>`:`<span>${esc(t)}</span>`).join(ic('dir'))}</nav>`; }

/* ---------- Rotas e eventos ---------- */
function rota(){ const [r='painel',id,x]=location.hash.replace(/^#\/?/,'').split('/'); return {r,id,x}; }
function render(manter){
  const {r,id,x}=rota(), y=scrollY, p=id&&P(id);
  let html, ativo=r;
  if(r==='paciente'&&p){ html=x==='historico'?vHistorico(p):vPerfil(p); ativo='pacientes'; }
  else if(r==='atendimento'&&p){ html=vAtendimento(p,Math.max(0,Math.min(7,Number(x)||0))); ativo='pacientes'; }
  else if(r==='pacientes') html=id==='novo'?vCadastro():vPacientes();
  else if(r==='agenda') html=vAgenda();
  else if(r==='biblioteca') html=vBiblioteca();
  else if(r==='financeiro') html=vFinanceiro();
  else if(r==='relatorios') html=vRelatorios();
  else if(r==='documentos') html=vDocumentos();
  else if(r==='administracao') html=vAdmin();
  else if(r==='guia') html=vGuia();
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
  else if(a==='mer'){ S.mer=t.dataset.m; render(true); }
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
  const t=ev.target, {id}=rota(), A=id&&AT[id];
  if(t.id==='bq'){ S.bq=t.value; const pos=t.selectionStart; render(true); const n=document.getElementById('bq'); n.focus(); n.setSelectionRange(pos,pos); return; }
  if(t.id==='pbusca'){ const q=t.value.toLowerCase(); document.querySelectorAll('.pc').forEach(c=>c.hidden=!c.dataset.n.includes(q)); return; }
  if(t.id==='c-nome'){ document.getElementById('pv-n').textContent=t.value||'Nome do paciente'; document.getElementById('pv-av').textContent=t.value?initials(t.value):'?'; return; }
  if(t.id==='c-q'){ document.getElementById('pv-q').textContent=t.value||'Queixa principal'; return; }
  if(t.id==='c-eva'){ document.getElementById('c-eva-v').textContent=t.value; return; }
  if(!A) return;
  if(t.dataset.q){ A.qx[t.dataset.q]=Number(t.value); document.getElementById('qv-'+t.dataset.q).textContent=t.value; const q=queixas(P(id)).find(z=>z.id===t.dataset.q); if(q.serie.length) document.getElementById('qd-'+q.id).innerHTML=delta(q.serie.at(-1),Number(t.value)); }
  else if(t.dataset.an){ A.anam[t.dataset.an]=t.value; }
  else if(t.dataset.f){ A[t.dataset.f]=t.value; }
});
render();
