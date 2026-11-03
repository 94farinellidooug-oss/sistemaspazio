// Ambiente de atendimento: as 8 etapas com navegação livre, cabeçalho fixo com o paciente e os
// alertas, preenchimento por etapa e salvamento automático. Usa, sem alterar, o raciocínio clínico
// (evaluate, bagang, elemState), o pentagrama e a verificação de segurança dos pontos.
import { elTag } from '../componentes/campos.js';
import { anel, barrasEl, delta, linhas } from '../componentes/graficos.js';
import { ic, vazio } from '../componentes/icones.js';
import { pentagram } from '../componentes/pentagrama.js';
import { EL, KE, SHENG, controlador, mae } from '../conhecimento/elementos.js';
import { CAUT, PT } from '../conhecimento/pontos.js';
import { SIGN, SIGNS } from '../conhecimento/sinais.js';
import { ELEMENTO_ESTACAO, ETAPAS, VASOS, atendimentoDe, avaliacaoEditavel, estacao, finalizados, preenchimento } from '../dados/atendimento.js';
import { alertasDe } from '../dados/indicadores.js';
import { QUEIXA_PRINCIPAL, serieQueixa } from '../dados/migracao.js';
import { db, patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { bagang, elemState, evaluate } from '../raciocinio/avaliacao.js';
import { pointWarnings } from '../raciocinio/seguranca.js';
import { QCOR } from './prontuario.js';
import { age, esc, fmt, initials } from '../util.js';

export const TECNICAS = ['Acupuntura','Auriculoterapia','Moxabustão','Ventosa','Eletroacupuntura','Massagem Tuiná','Sangria'];
const hhmm = t => new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
export const textoSalvo = a => `${ic('check')}${a.atualizadoEm===a.inicio?'Rascunho iniciado':'Salvo'} às ${hhmm(a.atualizadoEm)}`;
const eixoBg = (l,r,v) => `<div class="axis"><span>${l}</span><div class="track"><span class="dot" style="left:${50+v*50}%"></span></div><span>${r}</span></div>`;
const corDe = (p,q) => QCOR[p.queixas.indexOf(q)%QCOR.length];
const ordemNo = (p,a) => a.status==='finalizado' ? finalizados(p).indexOf(a)+1 : finalizados(p).filter(x=>x.data<=a.data).length+1;

// Atendimento aberto no ambiente (ui.atId), ou null se não existir mais.
export function atendimentoAberto(){
  const p=patient(ui.pid), a=p&&atendimentoDe(p,ui.atId);
  return a?{p,a}:null;
}

function eAnamnese(p,a){
  const Q=p.queixas.filter(q=>q.ativa||a.evolucao.intensidades[q.id]!=null), basal=!finalizados(p).filter(x=>x!==a).length;
  const F=[['historia','História da queixa','folha'],['sono','Sono','relogio'],['alimentacao','Alimentação e sede','folha'],['evacuacao','Evacuação e micção','info'],['emocoes','Emoções','yin'],['medicamentos','Medicamentos em uso','plano']];
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Queixas e intensidade hoje</h3>${basal?'<span class="pill acc">valores basais</span>':'<span class="pill">compare com o último atendimento</span>'}</div>
    ${Q.map(q=>{ const s=serieQueixa(p,q.id).filter(x=>x.data!==a.data||a.status!=='finalizado').map(x=>x.valor), v=a.evolucao.intensidades[q.id]??5;
      return `<div class="qs"><div class="qs-h"><i style="background:${corDe(p,q)}"></i><b>${esc(q.descricao)}</b>${s.length&&a.status==='rascunho'?`<span class="muted sm">último: ${s.at(-1)} · 1ª medida: ${s[0]}</span>`:''}</div>
      <div class="qs-r"><input type="range" min="0" max="10" value="${v}" data-atq="${q.id}" aria-label="Intensidade de ${esc(q.descricao)}"><span class="qs-v" id="qv-${q.id}">${v}</span></div></div>`; }).join('')}
    <form id="f-at-queixa" class="nq"><label class="so-leitor" for="atq-desc">Nova queixa</label><input id="atq-desc" placeholder="Adicionar outra queixa" required maxlength="120"><button class="btn sm">${ic('mais')}Adicionar</button></form></div>
    <div class="card"><h3>Anamnese</h3><p class="muted sm" style="margin-bottom:10px">${basal?'Preencha na primeira consulta.':'Trazida do cadastro do paciente. Abra só o que mudou.'} As alterações valem para o paciente.</p>
      <div class="anam">${F.map(([k,l,i])=>`<details ${basal&&k==='historia'?'open':''}><summary>${ic(i)}<span class="grow">${l}</span>${p.anam[k]?`<span class="pill ok">${ic('check')}</span>`:'<span class="pill">vazio</span>'}${ic('baixo')}</summary><textarea data-atan="${k}" aria-label="${l}">${esc(p.anam[k])}</textarea></details>`).join('')}</div></div></div>`;
}

function cmpBasal(p,a,av){
  const a0=p.avaliacoes.find(x=>x.atendimentoId!==a.id); if(!a0||!av) return '';
  const s0=new Set(a0.signs), s1=new Set(av.signs), res=a0.signs.filter(x=>!s1.has(x)), nov=av.signs.filter(x=>!s0.has(x)), man=av.signs.filter(x=>s0.has(x));
  return `<div class="card"><div class="card-h"><h3>Comparado à avaliação basal</h3><span class="muted sm">${fmt(a0.date)}</span></div>
    <div class="cmp3"><div class="ok"><b>${res.length}</b><small>não aparecem mais</small></div><div><b>${man.length}</b><small>mantidos</small></div><div class="warn"><b>${nov.length}</b><small>novos</small></div></div>
    <details class="mais"><summary>Ver sinais ${ic('baixo')}</summary>${[['Não aparecem mais',res,'ok'],['Novos',nov,'warn'],['Mantidos',man,'']].filter(x=>x[1].length).map(([t,L,k])=>`<div class="lbl" style="margin:10px 0 6px">${t}</div><div class="chips">${L.map(x=>`<span class="pill ${k}">${esc(SIGN[x]||x)}</span>`).join('')}</div>`).join('')}</details></div>`;
}
function eAvaliacao(p,a){
  const av=avaliacaoEditavel(p,a);
  if(!av) return vazio('yin','Atendimento finalizado sem avaliação energética','A avaliação deste dia pode ser feita como reavaliação avulsa no perfil do paciente.');
  const H=evaluate(av.signs), bg=bagang(av.signs), c=p.cadastro||{}, hem=c.hemisferio||'Sul', est=estacao(Number(a.data.slice(5,7))-1,hem);
  return `<div class="notice" style="margin-bottom:16px">${ic('info')}<div><b>Apoio ao raciocínio clínico.</b> As hipóteses vêm dos sinais marcados e não são diagnóstico. Cabe ao profissional aceitar, descartar e decidir.</div></div>
  <div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Sinais observados</h3><span class="pill acc">${av.signs.length} marcados</span></div>
      ${a.status==='rascunho'&&p.avaliacoes.length?'<p class="muted sm" style="margin-bottom:10px">Sinais trazidos da última avaliação. Desmarque o que não está mais presente.</p>':''}
      <div class="sigs">${Object.entries(SIGNS).map(([g,L])=>`<div><div class="lbl" style="margin-bottom:8px">${g}</div><div class="chips">${L.map(([k,l])=>`<button class="chip ${av.signs.includes(k)?'on':''}" data-act="at-sinal" data-s="${k}" aria-pressed="${av.signs.includes(k)}">${l}</button>`).join('')}</div></div>`).join('')}</div></div>
    <details class="card mais-card" ${Object.values(a.vasos||{}).some(v=>v.considerar||v.nota)?'open':''}><summary><h3>Oito vasos extraordinários</h3><span class="pill">conteúdo completo na etapa 3</span>${ic('baixo')}</summary>
      <p class="muted sm" style="margin:10px 0">Marque os vasos que o profissional considerou e anote o raciocínio. Critérios e pontos de abertura entram na etapa 3; aqui nada é sugerido automaticamente.</p>
      <div class="vasos">${VASOS.map(v=>{ const x=a.vasos?.[v]||{}; return `<div class="vaso"><label class="chip ${x.considerar?'on':''}"><input type="checkbox" data-vaso="${v}" ${x.considerar?'checked':''}>${v}</label><input class="vaso-n" data-vnota="${v}" placeholder="Anotação" value="${esc(x.nota||'')}" aria-label="Anotação sobre ${v}"></div>`; }).join('')}</div></details>
  </div>
  <div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Hipóteses de padrão</h3><span class="muted sm">${H.length} encontradas</span></div>
      ${H.length?H.map(h=>{const s=av.status[h.p.id]||'';return `<div class="hp ${s}"><div class="hp-h">${anel(h.score,Math.round(h.score*100)+'%',EL[h.p.el].cor)}<div class="grow"><b>${h.p.nome}</b><div>${elTag(h.p.el)} <span class="muted sm">· ${h.m.length}/${h.p.sinais.length} sinais</span></div></div></div>
        <div class="hp-a"><button class="btn sm ${s==='aceito'?'pri':''}" data-act="at-hip" data-p="${h.p.id}" data-st="aceito">${ic('check')}${s==='aceito'?'Aceito':'Aceitar'}</button><button class="btn sm" data-act="at-hip" data-p="${h.p.id}" data-st="descartado">${s==='descartado'?'Descartado':'Descartar'}</button></div>
        <details class="mais"><summary>Por que aparece ${ic('baixo')}</summary><p class="sm"><b>Presentes:</b> ${h.m.map(x=>SIGN[x]).join(', ')}</p>${h.falta.length?`<p class="sm muted"><b>Esperados, não observados:</b> ${h.falta.map(x=>SIGN[x]).join(', ')}</p>`:''}</details></div>`;}).join(''):vazio('yin','Sem hipóteses ainda','Marque ao menos dois sinais de língua, pulso ou sintomas.')}</div>
    ${cmpBasal(p,a,av)}
    <div class="card"><h3>Oito princípios (Ba Gang)</h3><div class="grid" style="gap:12px;margin-top:10px">${eixoBg('Frio','Calor',bg.fc)}${eixoBg('Deficiência','Excesso',bg.de)}</div></div>
    <div class="card sazonal"><div class="card-h"><h3>${ic('sol')} Contexto sazonal</h3><span class="pill">complementar</span></div>
      <p class="sm">${c.cidade?esc(c.cidade)+' · ':''}hemisfério ${hem} · <b>${est}</b>, estação ligada a ${elTag(ELEMENTO_ESTACAO[est])}.</p>
      <p class="muted sm" style="margin-top:6px">Informação de contexto pela data do atendimento${c.cidade?'':' (cidade não cadastrada; hemisfério Sul por padrão)'}. Não indica pontos nem conduta.</p></div>
    <div class="card"><div class="field"><label class="lbl" for="at-avnota">Observações da avaliação</label><textarea id="at-avnota" data-atf="avnota">${esc(av.nota||'')}</textarea></div></div>
  </div></div>`;
}

const tipoElAt = s => s.exc>s.def&&s.exc>0?'exc':s.def>0?'def':'';
function detalheEl(e, st, nome){
  if(!e) return `<div class="vazio">${ic('info')}Toque em um elemento para ver correspondências e relações.</div>`;
  const E=EL[e], k=st?tipoElAt(st[e]):'';
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:2rem;color:${E.cor}">${E.han}</span><h3>${E.nome}</h3>${k?`<span class="pill ${k==='exc'?'crit':'warn'}">${k==='exc'?'excesso':'deficiência'}</span>`:''}</div>
  <div class="corr-g">${[['Zang',E.zang],['Fu',E.fu],['Emoção',E.emocao],['Estação',E.estacao],['Clima',E.clima],['Tecido',E.tecido]].map(([x,y])=>`<div><small>${x}</small><b>${y}</b></div>`).join('')}</div>
  <div class="rel"><span>Gera ${elTag(SHENG[e])}</span><span>Gerado por ${elTag(mae(e))}</span><span>Controla ${elTag(KE[e])}</span><span>Controlado por ${elTag(controlador(e))}</span></div>
  ${k?`<div class="notice" style="margin-top:12px">${ic('info')}<div>${k==='def'?`Na deficiência, a regra mãe-filho sugere avaliar a tonificação da mãe (${EL[mae(e)].nome}).`:`No excesso, a regra mãe-filho sugere avaliar a sedação do filho (${EL[SHENG[e]].nome}).`} Decisão do profissional${nome?` para ${esc(nome)}`:''}.</div></div>`:''}`;
}
function ePentagrama(p,a){
  const av=avaliacaoEditavel(p,a)||{signs:[],status:{}}, st=elemState(av.signs,av.status);
  const a0=p.avaliacoes.find(x=>x.atendimentoId!==a.id), b=a0?elemState(a0.signs,a0.status):null;
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Mapa dos cinco elementos</h3>${b?`<button class="chip ${ui.atCmp?'on':''}" data-act="at-cmp" aria-pressed="${!!ui.atCmp}">Comparar com o basal</button>`:'<span class="pill acc">basal</span>'}</div>
    ${ui.atCmp&&b?`<div class="cmp"><div><div class="lbl">Basal · ${fmt(a0.date)}</div>${pentagram(b,ui.el)}</div><div><div class="lbl">Hoje</div>${pentagram(st,ui.el)}</div></div>`:pentagram(st,ui.el)}
    <p class="muted sm" style="text-align:center">Atualiza com os sinais e hipóteses deste atendimento. Anel tracejado: deficiência; anel espesso: excesso.</p></div>
    <div class="grid" style="align-content:start"><div class="card">${barrasEl(st,b)}${b?'<p class="muted sm" style="margin-top:6px">Marca vertical: posição na avaliação basal.</p>':''}</div><div class="card">${detalheEl(ui.el,st,p.name.split(' ')[0])}</div></div></div>`;
}
function eSintese(p,a){
  const av=avaliacaoEditavel(p,a)||{signs:[],status:{}}, ac=evaluate(av.signs).filter(h=>av.status[h.p.id]==='aceito'), bg=bagang(av.signs), st=elemState(av.signs,av.status);
  const vs=Object.entries(a.vasos||{}).filter(([,v])=>v.considerar);
  return `<div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><h3>Resumo da avaliação</h3><div class="sx">
      <div><small>Padrões validados</small>${ac.length?ac.map(h=>`<div class="sx-p">${elTag(h.p.el)}<b>${h.p.nome}</b><span class="pill ${h.p.tipo==='exc'?'crit':'warn'}">${h.p.tipo==='exc'?'excesso':'deficiência'}</span></div>`).join(''):`<p class="muted sm">Nenhum padrão aceito. <a href="#atendimento" data-act="etapa" data-i="1">Voltar à avaliação</a></p>`}
        ${vs.length?`<small style="margin-top:12px">Vasos extraordinários considerados</small><div class="chips">${vs.map(([v])=>`<span class="pill">${v}</span>`).join('')}</div>`:''}</div>
      <div><small>Oito princípios</small><div class="grid" style="gap:10px;margin-top:6px">${eixoBg('Frio','Calor',bg.fc)}${eixoBg('Def.','Exc.',bg.de)}</div></div></div></div>
    <div class="card"><div class="field"><label class="lbl" for="at-sintese">Síntese do profissional</label><textarea id="at-sintese" data-atf="sintese" placeholder="Raciocínio clínico, prioridades do tratamento...">${esc(a.sintese)}</textarea></div><p class="muted sm" style="margin-top:8px">A síntese é escrita e validada pelo profissional. O sistema não conclui diagnóstico.</p></div></div>
    <div class="card"><h3>Elementos</h3>${barrasEl(st)}</div></div>`;
}
// Posições ilustrativas (frente: x até 200; costas: x de 210 a 410). O atlas completo é da etapa 4.
const MAPA = {VG20:[310,16],VB20:[296,60],B13:[298,104],B15:[298,116],B17:[298,132],B23:[298,180],VG4:[310,182],
  VC17:[100,118],VC12:[100,158],VC4:[100,200],IG11:[40,168],CS6:[44,214],CS7:[44,224],P9:[50,222],C7:[54,226],C8:[40,240],IG4:[30,236],
  BP10:[88,292],BP9:[90,322],VB34:[78,320],E36:[86,334],E40:[80,352],BP6:[92,370],R7:[94,384],R3:[94,396],R6:[97,401],BP3:[90,409],F3:[82,414]};
const silhueta = dx => `<g transform="translate(${dx},0)" class="corpo"><circle cx="100" cy="30" r="20"/><rect x="91" y="48" width="18" height="16" rx="5"/>
  <path d="M62 66h76q10 0 12 12l3 120q0 8-8 10H55q-8-2-8-10l3-120q2-12 12-12z"/><path d="M50 74q-12 4-14 20l-10 140q0 8 7 9t8-7l11-118z"/><path d="M150 74q12 4 14 20l10 140q0 8-7 9t-8-7l-11-118z"/>
  <path d="M58 206h40l-2 200q0 14 -12 14t-12-14z"/><path d="M102 206h40l-14 200q0 14-12 14t-12-14z"/></g>`;
function eMapa(p,a){
  const P=a.plano.pontos, pts=P.filter(c=>MAPA[c]), fora=P.filter(c=>!MAPA[c]);
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Mapa corporal</h3><span class="pill">atlas completo na etapa 4</span></div>
    <svg viewBox="0 0 420 458" class="mapa" role="img" aria-label="Mapa corporal com os pontos do plano">${silhueta(0)}${silhueta(210)}
    <text x="100" y="452" text-anchor="middle" class="ax">frente</text><text x="310" y="452" text-anchor="middle" class="ax">costas</text>
    ${pts.map(c=>`<g><circle cx="${MAPA[c][0]}" cy="${MAPA[c][1]}" r="6" class="pt"/><text x="${MAPA[c][0]+9}" y="${MAPA[c][1]+4}" class="ptl">${c}</text></g>`).join('')}</svg>
    <p class="muted sm" style="text-align:center">Posições ilustrativas.${fora.length?` Sem posição no mapa ainda: ${fora.join(', ')}.`:''}</p></div>
    <div class="grid" style="align-content:start"><div class="card"><h3>Pontos do plano</h3>${P.length?`<div class="chips" style="margin-top:10px">${P.map(c=>`<span class="pill acc mono">${esc(c)}${PT[c]?` · ${PT[c].pinyin}`:''}</span>`).join('')}</div>`:`<div class="vazio">${ic('info')}Os pontos escolhidos no plano terapêutico aparecem aqui.</div><button class="btn sm" data-act="etapa" data-i="5" style="margin-top:8px">Ir ao plano</button>`}</div>
      <div class="card"><div class="field"><label class="lbl" for="at-mapa">Observações do mapa corporal</label><textarea id="at-mapa" data-atf="mapa" placeholder="Regiões de dor, cicatrizes, áreas sensíveis...">${esc(a.mapa?.nota||'')}</textarea></div></div></div></div>`;
}
function ePlano(p,a){
  const av=avaliacaoEditavel(p,a)||{signs:[],status:{}}, ac=evaluate(av.signs).filter(h=>av.status[h.p.id]==='aceito'), P=a.plano.pontos, w=pointWarnings(P,p,a.plano.tec);
  return `<div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Pontos do plano</h3><span class="pill acc">${P.length}</span></div>
      ${P.length?`<div class="chips">${P.map(c=>`<button class="chip on mono" data-act="at-pt" data-c="${esc(c)}" title="Remover">${esc(c)} ✕</button>`).join('')}</div>`:'<p class="muted sm">Escolha nas sugestões ao lado ou digite abaixo.</p>'}
      <form id="f-at-pt" class="nq"><label class="so-leitor" for="at-pt-c">Código do ponto</label><input id="at-pt-c" class="mono" placeholder="Ex.: E36, BP6" required><button class="btn sm">${ic('mais')}Incluir</button></form>
      <div class="lbl" style="margin:16px 0 8px">Técnicas</div><div class="chips">${TECNICAS.map(t=>`<button class="chip ${a.plano.tec.includes(t)?'on':''}" data-act="at-tec" data-t="${t}" aria-pressed="${a.plano.tec.includes(t)}">${t}</button>`).join('')}</div></div>
    <div class="card seg" id="at-seg"><div class="card-h"><h3>${ic('escudo')} Verificação de segurança</h3>${w.length?`<span class="pill crit">${w.length}</span>`:'<span class="pill ok">ok</span>'}</div>
      ${w.length?w.map(([k,m])=>`<div class="notice ${k==='crit'?'crit':''}" style="margin-bottom:8px">${ic(k==='crit'?'escudo':'alerta')}<div><b>${k==='crit'?'Atenção':'Cautela'}</b> ${esc(m)}</div></div>`).join(''):`<div class="vazio">${ic('okc')}Nenhuma contraindicação encontrada para os pontos e técnicas escolhidos.</div>`}</div></div>
    <div class="card"><h3>Sugestões dos padrões validados</h3><p class="muted sm" style="margin-bottom:10px">Toque para incluir. A escolha é do profissional.</p>
      ${ac.length?ac.map(h=>`<div class="sug"><div class="sug-h">${elTag(h.p.el)}<b>${h.p.nome}</b></div><div class="chips">${h.p.pontos.map(([c,j])=>`<button class="chip mono ${P.includes(c)?'on':''}" data-act="at-pt" data-c="${c}" title="${esc(j)}${PT[c]?.cautela?' · '+esc(CAUT[PT[c].cautela]):''}">${c}${PT[c]?.cautela?' ⚠':''}</button>`).join('')}</div></div>`).join(''):`<div class="vazio">${ic('info')}Aceite hipóteses na avaliação para ver sugestões.</div>`}</div></div>`;
}
function eEvolucao(p,a){
  const fin=finalizados(p).filter(x=>x!==a), Q=p.queixas.filter(q=>a.evolucao.intensidades[q.id]!=null||serieQueixa(p,q.id).length);
  const lista=[...fin,a].sort((x,y)=>x.data.localeCompare(y.data)), labels=lista.map(x=>x===a?'hoje':fmt(x.data).slice(0,5));
  const series=Q.map(q=>({cor:corDe(p,q),nome:q.descricao,vals:lista.map(x=>x.evolucao.intensidades[q.id]??null)})).filter(s=>s.vals.some(v=>v!=null));
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Queixas ao longo do tratamento</h3>${series.length>1?`<div class="leg">${series.map((s,i)=>`<button class="leg-b" data-act="serie" data-s="${i}" aria-pressed="true" data-tip="Mostrar ou ocultar"><i style="background:${s.cor}"></i>${esc(s.nome)}</button>`).join('')}</div>`:''}</div>
    ${linhas(series,labels,{label:'Intensidade das queixas por atendimento'})}
    <div class="qsum">${series.map(s=>{ const v=s.vals.filter(x=>x!=null); return `<div><i style="background:${s.cor}"></i><span>${esc(s.nome)}</span><b>${v[0]} → ${v.at(-1)}</b>${v.length>1?delta(v[0],v.at(-1)):'<span class="pill acc">1ª medida</span>'}</div>`; }).join('')}</div>
    <p class="muted sm">Os valores de hoje vêm da etapa Anamnese.</p></div>
    <div class="card"><div class="field"><label class="lbl" for="at-nota">Evolução e observações</label><textarea id="at-nota" data-atf="nota" placeholder="Como o paciente respondeu, o que mudou desde o último atendimento...">${esc(a.evolucao.nota)}</textarea></div></div></div>`;
}
function eDocumentos(p,a,H){
  const D=[['doc','Registro do atendimento',a.status==='finalizado'?'Disponível no prontuário':'Entra no prontuário ao finalizar','ok','prontuario'],['agenda','Agendar retorno','Abre a agenda com o paciente escolhido','acc','retorno'],
    ['plano','Orientações ao paciente','Modelos na etapa 6','',''],['escudo','Termo de consentimento','Assinatura eletrônica na etapa 6','','']];
  return `<div class="docs">${D.map(([i,t,s,k,acao])=>acao?`<button class="docc" data-act="at-doc" data-d="${acao}">${ic(i)}<b>${t}</b><small>${s}</small>${k?`<span class="pill ${k}">${k==='ok'?'automático':'disponível'}</span>`:''}</button>`
    :`<div class="docc off">${ic(i)}<b>${t}</b><small>${s}</small><span class="pill">em breve</span></div>`).join('')}</div>
  <div class="card" style="margin-top:20px"><h3>${a.status==='finalizado'?'Etapas registradas':'Antes de finalizar'}</h3><div class="chk">${ETAPAS.slice(0,7).map(([,n],j)=>{ const ok=preenchimento(p,a,j,H)>=1; return `<a href="#atendimento" data-act="etapa" data-i="${j}" class="${ok?'ok':''}">${ic(ok?'okc':'relogio')}${n}</a>`; }).join('')}</div>
    <p class="muted sm" style="margin-top:10px">${a.status==='finalizado'?'O atendimento pode ser complementado depois; cada alteração fica no histórico com data e hora.':'Etapas incompletas não impedem finalizar. O atendimento pode ser complementado depois, com data e hora de cada alteração no histórico.'}</p></div>
  <div class="card" style="margin-top:20px"><div class="card-h"><h3>Histórico de alterações</h3><span class="muted sm">${a.historico.length} registro${a.historico.length===1?'':'s'}</span></div>
    <div class="hist-alt">${[...a.historico].reverse().map(h=>`<div><span class="mono muted">${fmt(h.em.slice(0,10))} ${hhmm(h.em)}</span><span>${esc(h.acao)}</span></div>`).join('')}</div></div>`;
}

const CORPO = [eAnamnese,eAvaliacao,ePentagrama,eSintese,eMapa,ePlano,eEvolucao,eDocumentos];
export function vAtendimento(){
  const x=atendimentoAberto();
  if(!x){ ui.crumbs=[['#pacientes','Pacientes'],[null,'Atendimento']];
    return `<div class="head"><div><h1>Atendimento</h1></div></div>${vazio('play','Nenhum atendimento aberto','Abra o perfil de um paciente e use “Novo atendimento”.',`<a class="btn pri sm" href="#pacientes">${ic('pacientes')}Ver pacientes</a>`)}`; }
  const {p,a}=x, i=Math.max(0,Math.min(7,ui.etapa|0)), av=avaliacaoEditavel(p,a), H=evaluate(av?.signs||[]);
  const n=ordemNo(p,a), basal=n===1, al=alertasDe(p), fin=a.status==='finalizado';
  const f=ETAPAS.map((_,j)=>preenchimento(p,a,j,H)), tot=f.reduce((s,v)=>s+v,0)/8;
  ui.crumbs=[['#pacientes','Pacientes'],[`data-act="open" data-pid="${p.id}"`,p.name],[null,`${n}º atendimento`]];
  const anelP=(v,j,on)=>{ const r=15, c=2*Math.PI*r; return `<svg viewBox="0 0 36 36" class="sr" aria-hidden="true"><circle cx="18" cy="18" r="${r}" class="sr-b"/><circle cx="18" cy="18" r="${r}" class="sr-f" stroke-dasharray="${(v*c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)"/></svg><span class="sn">${v>=1&&!on?ic('check'):j+1}</span>`; };
  const [,l,ico]=ETAPAS[i];
  return `<div class="at-top">
    <div class="at-h"><span class="avatar lg">${initials(p.name)}</span><div class="at-id"><b>${esc(p.name)}</b><small>${p.birth?age(p.birth)+' anos · ':''}${fmt(a.data)} · ${basal?'1ª consulta · avaliação basal':`${n}º atendimento · retorno`}</small></div>
      <div class="at-al">${al.length?al.map(t=>`<span class="pill crit" data-tip="Alerta de segurança do cadastro">${ic('escudo')}${t}</span>`).join(''):`<span class="pill ok">${ic('okc')}Sem alertas de segurança</span>`}</div>
      <div class="at-m">${fin?`<span class="pill ok">${ic('check')}Finalizado</span>`:''}<span class="autosave ok" id="autosave" aria-live="polite">${textoSalvo(a)}</span>
        <span class="at-pr" data-tip="${Math.round(tot*100)}% do atendimento preenchido">${anel(tot,Math.round(tot*100)+'%')}</span></div></div>
    <nav class="steps" aria-label="Etapas do atendimento">${ETAPAS.map(([,nome],j)=>`<a href="#atendimento" data-act="etapa" data-i="${j}" class="${j===i?'on':''} ${f[j]>=1?'ok':f[j]>0?'parcial':''}" ${j===i?'aria-current="step"':''} data-tip="${nome} · ${Math.round(f[j]*100)}% preenchido">${anelP(f[j],j,j===i)}<span class="sl">${nome}</span></a>`).join('')}</nav>
  </div>
  ${fin?`<div class="notice" style="margin-bottom:16px">${ic('info')}<div>Atendimento finalizado em ${fmt(a.finalizadoEm.slice(0,10))} às ${hhmm(a.finalizadoEm)}. Você pode complementar o registro; cada alteração fica no histórico.</div></div>`:''}
  <div class="et-h"><span class="tico acc">${ic(ico)}</span><div class="grow"><h2>${l}</h2><small class="muted">Etapa ${i+1} de 8 · <kbd>Alt</kbd> <kbd>←</kbd> <kbd>→</kbd> para trocar de etapa</small></div><button class="btn sm" data-act="at-prontuario" data-pid="${p.id}">${ic('doc')}Prontuário</button></div>
  <div class="et-c">${CORPO[i](p,a,H)}</div>
  <div class="at-f">${i?`<button class="btn" data-act="etapa" data-i="${i-1}">${ic('esq')}${ETAPAS[i-1][1]}</button>`:fin?'<span></span>':`<button class="btn ghost" data-act="at-descartar">${ic('x')}Descartar rascunho</button>`}
    ${i<7?`<button class="btn pri" data-act="etapa" data-i="${i+1}">${ETAPAS[i+1][1]}${ic('dir')}</button>`:fin?`<button class="btn pri" data-act="at-prontuario" data-pid="${p.id}">${ic('doc')}Voltar ao prontuário</button>`:`<button class="btn pri" data-act="at-finalizar">${ic('check')}Finalizar atendimento</button>`}</div>`;
}
