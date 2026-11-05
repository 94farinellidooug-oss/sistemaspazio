// Proposta navegável da etapa 3: avaliação energética em 9 abas, pulsologia bilateral, origem e
// situação dos achados, pentagrama em camadas, Síntese e Plano por escolha do profissional e versões
// da avaliação. Usa, sem alterar, os módulos clínicos do sistema (sinais, padrões, evaluate, bagang,
// elemState, pentagrama e verificação de segurança). Dados fictícios, só na memória da página.
import { anel, barrasEl } from '../../js/componentes/graficos.js';
import { LOGO, ic, vazio } from '../../js/componentes/icones.js';
import { pentagram } from '../../js/componentes/pentagrama.js';
import { EL, KE, SHENG, controlador, mae } from '../../js/conhecimento/elementos.js';
import { CAUT, PT } from '../../js/conhecimento/pontos.js';
import { SIGN, SIGNS } from '../../js/conhecimento/sinais.js';
import { bagang, elemState, evaluate } from '../../js/raciocinio/avaliacao.js';
import { pointWarnings } from '../../js/raciocinio/seguranca.js';
import { esc, fmt, initials } from '../../js/util.js';

/* ---------- Paciente e profissional fictícios ---------- */
const PROF = 'Maicon Farinelli';
const P = { name:'Marina Costa', idade:35, alerts:{gestante:false,anticoagulante:false,marcapasso:false}, cidade:'Caxias do Sul, RS', hemisferio:'Sul' };
const HOJE = '2026-11-03';

/* ---------- Opções ---------- */
const ORIGENS = [['anamnese','Anamnese'],['exame','Exame'],['obs','Observação profissional']];
const SITS = [['pos','Positivo'],['neg','Negativo'],['na','Não avaliado']];
const ABAS = ['Língua e pulso','Ba Gang','Zang-Fu','Qi e Xue','Jin Ye','Jing e Shen','Fatores patogênicos','Vasos extraordinários','Contexto sazonal'];
const LIVRES = {2:'zangfu',3:'qixue',4:'jinye',5:'jingshen',6:'fatores'};
const CAT_NOME = {zangfu:'Zang-Fu',qixue:'Qi e Xue',jinye:'Jin Ye',jingshen:'Jing e Shen',fatores:'Fatores patogênicos'};
const VASOS = [['Du Mai','ID3','B62'],['Ren Mai','P7','R6'],['Chong Mai','BP4','CS6'],['Dai Mai','VB41','TA5'],['Yin Qiao Mai','R6','P7'],['Yang Qiao Mai','B62','ID3'],['Yin Wei Mai','CS6','BP4'],['Yang Wei Mai','TA5','VB41']];
const PULSO = SIGNS.Pulso;                       // as 7 classificações atuais [chave, rótulo]
const LADOS = [['esq','Pulso esquerdo'],['dir','Pulso direito']];
const POS = [['cun','Cun'],['guan','Guan'],['chi','Chi']];
const TEC = ['Acupuntura','Auriculoterapia','Moxabustão','Ventosa','Eletroacupuntura','Massagem Tuiná','Sangria'];
const ETAPAS = [['anamnese','Anamnese','folha',0],['avaliacao','Avaliação energética','yin',1],['pentagrama','Pentagrama','estrela',1],['sintese','Síntese clínica','camadas',1],['mapa','Mapa corporal','corpo',0],['plano','Plano terapêutico','plano',1],['evolucao','Evolução','evolucao',0],['documentos','Documentos','doc',0]];

/* ---------- Estado da avaliação atual (rascunho do 3º atendimento) ---------- */
const lado = () => ({ cls:[], deficiencia:'', orgao:'', obs:'', pos:{cun:'',guan:'',chi:''} });
const S = {
  aba:0, el:null, camada:'atual', interp:'', mini:false, aberto:false,
  // Achados de língua e sinais e sintomas: situação e origem de cada um.
  ach:{ bordas_vermelhas:{sit:'pos',orig:'exame'}, irritabilidade:{sit:'pos',orig:'anamnese'}, tpm:{sit:'pos',orig:'anamnese'}, suspiros:{sit:'pos',orig:'obs'},
        cefaleia_temporal:{sit:'pos',orig:'anamnese'}, insonia:{sit:'neg',orig:'anamnese'}, lingua_palida:{sit:'neg',orig:'exame'} },
  linguaObs:'Bordas avermelhadas, saburra fina.',
  pulso:{ esq:{...lado(), cls:['pulso_corda'], deficiencia:'', orgao:'Fígado', obs:'Tenso, mais evidente na posição Guan.', pos:{cun:'',guan:'Em corda, tenso',chi:''}},
          dir:{...lado(), cls:['pulso_fino'], deficiencia:'Xue', orgao:'Baço', obs:'Discretamente fino.', pos:{cun:'',guan:'Fino',chi:'Fraco à pressão profunda'}} },
  status:{ f_estag:'aceito' },
  bgInterp:'',
  livres:{ zangfu:{nota:'',itens:[{id:'z1',texto:'Fígado com sinais de excesso no exame de pulso',orig:'exame',sit:'pos',sintese:true,plano:false}]},
           qixue:{nota:'',itens:[{id:'q1',texto:'Estagnação de Qi relatada em períodos de estresse',orig:'anamnese',sit:'pos',sintese:true,plano:true}]},
           jinye:{nota:'',itens:[]}, jingshen:{nota:'Shen agitado no período pré-menstrual.',itens:[]}, fatores:{nota:'',itens:[]} },
  vasos:{ 'Chong Mai':{achado:'TPM com distensão abdominal',sit:'conf',sintese:true,plano:true}, 'Yang Qiao Mai':{achado:'Despertar precoce',sit:'hip',sintese:false,plano:false} },
  sintese:'', pontos:['F3'], tec:['Acupuntura'], novos:0,
  cmpA:'v1', cmpB:'atual', corr:null
};

/* ---------- Camada de compatibilidade com o cálculo atual ----------
   O raciocínio existente recebe uma lista de sinais. Entram:
   - língua e sinais e sintomas com situação "Positivo";
   - cada classificação de pulso marcada em pelo menos um dos lados (esquerdo ou direito).
   "Negativo" e "Não avaliado" não entram, como um sinal não marcado hoje. Nada mais é calculado. */
function sinaisCalculo(){
  const s = Object.entries(S.ach).filter(([,a])=>a.sit==='pos').map(([k])=>k);
  PULSO.forEach(([k])=>{ if(S.pulso.esq.cls.includes(k)||S.pulso.dir.cls.includes(k)) s.push(k); });
  return s;
}

/* ---------- Versões da avaliação (fictícias) ---------- */
const V = [
  { id:'v1', n:1, basal:true, em:'2026-09-22T09:10', prof:PROF, contexto:'1º atendimento', motivo:'Avaliação basal da primeira consulta',
    signs:['bordas_vermelhas','pulso_corda','irritabilidade','tpm','suspiros','cefaleia_temporal','distensao_hipo'], status:{f_estag:'aceito',f_yang:'aceito'},
    historico:[{em:'2026-09-22T09:48',acao:'Versão registrada e bloqueada como basal'}] },
  { id:'v2', n:2, em:'2026-10-14T16:40', prof:PROF, contexto:'Reavaliação avulsa (fora de atendimento)', motivo:'Piora da cefaleia após viagem',
    signs:['bordas_vermelhas','pulso_corda','irritabilidade','tpm','cefaleia_temporal'], status:{f_estag:'aceito'},
    historico:[{em:'2026-10-14T16:52',acao:'Versão registrada'},{em:'2026-10-15T08:05',acao:'Correção: retirado "Pulso fino", marcado por engano. Motivo informado: erro de digitação. O valor anterior continua no histórico desta versão.'}] }
];
const atualComoVersao = () => ({ id:'atual', n:V.length+1, em:HOJE+'T14:20', prof:PROF, contexto:'3º atendimento (em andamento)', motivo:'Retorno de rotina', signs:sinaisCalculo(), status:S.status, historico:[] });
const versao = id => id==='atual'?atualComoVersao():V.find(v=>v.id===id);

/* ---------- Utilidades de interface ---------- */
const elTag = e => e?`<span class="el-tag"><i style="background:${EL[e].cor}"></i>${EL[e].nome}</span>`:'';
const sitTxt = k => SITS.find(x=>x[0]===k)?.[1]||'Não avaliado';
const origTxt = k => ORIGENS.find(x=>x[0]===k)?.[1]||'';
const hhmm = t => t.slice(11,16);
const dataHora = t => `${fmt(t.slice(0,10))} às ${hhmm(t)}`;
const eixo = (l,r,v) => `<div class="axis"><span>${l}</span><div class="track"><span class="dot" style="left:${50+v*50}%"></span></div><span>${r}</span></div>`;
const camadaPill = k => ({obs:`<span class="ly ly-obs">${ic('lista')}Observado</span>`,hip:`<span class="ly ly-hip">${ic('info')}Hipótese do sistema</span>`,conf:`<span class="ly ly-conf">${ic('check')}Confirmado pelo profissional</span>`,int:`<span class="ly ly-int">${ic('editar')}Interpretação profissional</span>`})[k];
const selOrig = (attr,v) => `<select class="mini-sel" ${attr} aria-label="Origem do achado">${ORIGENS.map(([k,l])=>`<option value="${k}" ${k===v?'selected':''}>${l}</option>`).join('')}</select>`;
const selSit = (attr,v) => `<select class="mini-sel" ${attr} aria-label="Situação do achado">${SITS.map(([k,l])=>`<option value="${k}" ${k===v?'selected':''}>${l}</option>`).join('')}</select>`;
const levar = (attrs,item) => `<div class="levar"><button class="chip ${item.sintese?'on':''}" ${attrs} data-dest="sintese" aria-pressed="${!!item.sintese}">${ic('camadas')}Síntese</button><button class="chip ${item.plano?'on':''}" ${attrs} data-dest="plano" aria-pressed="${!!item.plano}">${ic('plano')}Plano</button></div>`;

/* ---------- Painel lateral: camadas separadas ---------- */
function painelCamadas(){
  const sg=sinaisCalculo(), H=evaluate(sg), conf=H.filter(h=>S.status[h.p.id]==='aceito');
  return `<aside class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Achados e hipóteses</h3><span class="muted sm">separados por camada</span></div>
      <div class="cam"><div class="cam-h">${camadaPill('obs')}<span class="muted sm">${sg.length} sinais positivos</span></div>
        <div class="chips">${sg.map(k=>`<span class="pill">${esc(SIGN[k])}</span>`).join('')||'<span class="muted sm">nenhum</span>'}</div>
        <p class="muted sm">Só os sinais "Positivo" e as classificações de pulso marcadas em qualquer lado entram no cálculo, como hoje.</p></div>
      <div class="cam"><div class="cam-h">${camadaPill('hip')}<span class="muted sm">${H.length}</span></div>
        ${H.length?H.map(h=>{const s=S.status[h.p.id]||''; return `<div class="hp ${s}"><div class="hp-h">${anel(h.score,Math.round(h.score*100)+'%',EL[h.p.el].cor)}<div class="grow"><b>${h.p.nome}</b><div>${elTag(h.p.el)} <span class="muted sm">· ${h.m.length}/${h.p.sinais.length} sinais</span></div></div></div>
          <div class="hp-a"><button class="btn sm ${s==='aceito'?'pri':''}" data-a="hip" data-p="${h.p.id}" data-st="aceito">${ic('check')}${s==='aceito'?'Confirmado':'Confirmar'}</button><button class="btn sm" data-a="hip" data-p="${h.p.id}" data-st="descartado">${s==='descartado'?'Descartado':'Descartar'}</button></div></div>`;}).join(''):'<p class="muted sm">Marque ao menos dois sinais.</p>'}</div>
      <div class="cam"><div class="cam-h">${camadaPill('conf')}<span class="muted sm">${conf.length}</span></div>
        <div class="chips">${conf.map(h=>`<span class="pill ok">${h.p.nome}</span>`).join('')||'<span class="muted sm">nenhum padrão confirmado</span>'}</div></div>
      <p class="muted sm">${ic('info')} O sistema sugere; quem confirma é o profissional. Nada é diagnóstico.</p></div>
  </aside>`;
}

/* ---------- Abas da avaliação ---------- */
function chipAchado(k,l){
  const a=S.ach[k]||{sit:'na'};
  return `<button class="chip achado s-${a.sit}" data-a="ach" data-s="${k}" data-tip="${sitTxt(a.sit)} · toque para alternar">${a.sit==='pos'?ic('check'):a.sit==='neg'?ic('x'):''}${l}</button>`;
}
function listaAchados(chaves){
  const L=chaves.filter(k=>S.ach[k]&&S.ach[k].sit!=='na');
  return L.length?`<div class="achados">${L.map(k=>`<div class="ach-r"><span class="grow">${esc(SIGN[k])}</span>${selSit(`data-sit="${k}"`,S.ach[k].sit)}${selOrig(`data-orig="${k}"`,S.ach[k].orig)}</div>`).join('')}</div>`:'';
}
function aLinguaPulso(){
  const LG=SIGNS['Língua'], ST=SIGNS['Sinais e sintomas'];
  return `<div class="card"><div class="card-h"><h3>Língua</h3><span class="muted sm">toque: positivo → negativo → não avaliado</span></div>
      <div class="chips">${LG.map(([k,l])=>chipAchado(k,l)).join('')}</div>
      ${listaAchados(LG.map(x=>x[0]))}
      <div class="field" style="margin-top:12px"><label class="lbl" for="lg-obs">Observações da língua</label><textarea id="lg-obs" data-f="linguaObs">${esc(S.linguaObs)}</textarea></div></div>
    <div class="card"><div class="card-h"><h3>Pulsologia bilateral</h3><span class="pill">classificações em vários lados ao mesmo tempo</span></div>
      <div class="pulso-g">${LADOS.map(([ld,nome])=>{ const L=S.pulso[ld]; return `<section class="pulso-l"><h4>${nome}</h4>
        <div class="lbl">Classificações</div><div class="chips">${PULSO.map(([k,l])=>`<button class="chip ${L.cls.includes(k)?'on':''}" data-a="pcls" data-l="${ld}" data-k="${k}" aria-pressed="${L.cls.includes(k)}">${l}</button>`).join('')}</div>
        <div class="form" style="margin-top:12px">
          <div class="field"><label class="lbl" for="p-${ld}-def">Deficiência identificada</label><input id="p-${ld}-def" data-p="${ld}.deficiencia" value="${esc(L.deficiencia)}" placeholder="Registro do profissional"></div>
          <div class="field"><label class="lbl" for="p-${ld}-org">Órgão ou sistema relacionado</label><input id="p-${ld}-org" data-p="${ld}.orgao" value="${esc(L.orgao)}" placeholder="Registro do profissional"></div>
          <div class="field full"><label class="lbl" for="p-${ld}-obs">Observações da avaliação</label><textarea id="p-${ld}-obs" data-p="${ld}.obs">${esc(L.obs)}</textarea></div></div>
        <details class="mais pos-d" ${Object.values(L.pos).some(Boolean)?'open':''}><summary>Por posição: Cun, Guan e Chi ${ic('baixo')}</summary>
          <div class="pos-g">${POS.map(([pk,pl])=>`<div class="field"><label class="lbl" for="p-${ld}-${pk}">${pl}</label><textarea id="p-${ld}-${pk}" data-p="${ld}.pos.${pk}" placeholder="Características e observações">${esc(L.pos[pk])}</textarea></div>`).join('')}</div></details>
      </section>`; }).join('')}</div>
      <div class="notice" style="margin-top:14px">${ic('info')}<div><b>Compatibilidade com o cálculo atual.</b> Para as hipóteses, uma classificação conta se estiver marcada em qualquer lado: hoje entram ${PULSO.filter(([k])=>S.pulso.esq.cls.includes(k)||S.pulso.dir.cls.includes(k)).map(([,l])=>`<b>${l}</b>`).join(', ')||'nenhuma'}. Deficiência, órgão, observações e posições são registro do profissional e não alteram o cálculo.</div></div></div>
    <div class="card"><div class="card-h"><h3>Sinais e sintomas</h3><span class="muted sm">alimentam as hipóteses, como hoje</span></div>
      <div class="chips">${ST.map(([k,l])=>chipAchado(k,l)).join('')}</div>${listaAchados(ST.map(x=>x[0]))}</div>`;
}
function aBaGang(){
  const bg=bagang(sinaisCalculo());
  return `<div class="card"><div class="card-h"><h3>Oito princípios (Ba Gang)</h3>${camadaPill('hip')}</div>
      <div class="grid" style="gap:12px;margin-top:6px">${eixo('Frio','Calor',bg.fc)}${eixo('Deficiência','Excesso',bg.de)}</div>
      <p class="muted sm" style="margin-top:10px">Calculado pelo sistema a partir de ${bg.n} sinais, com a mesma lógica de hoje.</p></div>
    <div class="card"><div class="card-h"><h3>Interpretação do profissional</h3>${camadaPill('int')}</div>
      <div class="field"><label class="lbl so-leitor" for="bg-int">Interpretação</label><textarea id="bg-int" data-f="bgInterp" placeholder="Interior/exterior, frio/calor, deficiência/excesso, Yin/Yang segundo a sua avaliação">${esc(S.bgInterp)}</textarea></div></div>`;
}
function aLivre(cat){
  const C=S.livres[cat];
  return `<div class="notice" style="margin-bottom:14px">${ic('info')}<div><b>${CAT_NOME[cat]}: campos livres.</b> A lista clínica desta categoria será definida pela profissional. Até lá, nada é sugerido nem calculado aqui.</div></div>
    <div class="card"><div class="card-h"><h3>Achados de ${CAT_NOME[cat]}</h3><span class="pill acc">${C.itens.length}</span></div>
      ${C.itens.length?`<div class="livres">${C.itens.map(it=>`<div class="livre"><div class="livre-t"><b>${esc(it.texto)}</b><div class="livre-m">${selSit(`data-lsit="${cat}.${it.id}"`,it.sit)}${selOrig(`data-lorig="${cat}.${it.id}"`,it.orig)}</div></div>${levar(`data-a="levar" data-cat="${cat}" data-id="${it.id}"`,it)}</div>`).join('')}</div>`:vazio('lista','Nenhum achado registrado','Descreva o achado abaixo, com a origem e a situação.')}
      <form class="livre-f" data-cat="${cat}"><div class="field full"><label class="lbl" for="lv-${cat}">Novo achado</label><input id="lv-${cat}" placeholder="Descreva o achado" required></div>
        <div class="field"><label class="lbl" for="lv-${cat}-o">Origem</label>${selOrig(`id="lv-${cat}-o"`,'exame')}</div><div class="field"><label class="lbl" for="lv-${cat}-s">Situação</label>${selSit(`id="lv-${cat}-s"`,'pos')}</div>
        <div class="field" style="align-self:end"><button class="btn sm">${ic('mais')}Registrar achado</button></div></form></div>
    <div class="card"><div class="field"><label class="lbl" for="lv-${cat}-n">Anotações gerais de ${CAT_NOME[cat]}</label><textarea id="lv-${cat}-n" data-ln="${cat}">${esc(C.nota)}</textarea></div></div>`;
}
function aVasos(){
  return `<div class="card"><div class="card-h"><h3>Oito vasos extraordinários</h3><span class="muted sm">pares conferidos pela profissional</span></div>
    <div class="vt">${VASOS.map(([v,ab,ac])=>{ const x=S.vasos[v]||{achado:'',sit:'',sintese:false,plano:false}; return `<div class="vt-r ${x.sit?'tem':''}">
      <div class="vt-n"><b>${v}</b><small class="mono">abertura ${ab} · acoplado ${ac}</small></div>
      <input class="vt-a" data-va="${v}" value="${esc(x.achado)}" placeholder="Achado" aria-label="Achado em ${v}">
      <select class="mini-sel" data-vs="${v}" aria-label="Situação em ${v}"><option value="" ${!x.sit?'selected':''}>Sem registro</option><option value="hip" ${x.sit==='hip'?'selected':''}>Hipótese</option><option value="conf" ${x.sit==='conf'?'selected':''}>Confirmado pelo profissional</option></select>
      ${x.sit?levar(`data-a="levar-vaso" data-v="${v}"`,x):'<span class="muted sm">registre para encaminhar</span>'}</div>`; }).join('')}</div>
    <p class="muted sm" style="margin-top:10px">Nada é encaminhado sozinho. "Plano" só leva o par de pontos como opção; quem inclui os pontos é o profissional, na etapa Plano.</p></div>`;
}
const ESTACOES_SUL = [['Primavera','22/09','20/12','madeira'],['Verão','21/12','19/03','fogo'],['Outono','20/03','20/06','metal'],['Inverno','21/06','21/09','agua']];
function estacaoSul(d){ const md=d.slice(5,7)+d.slice(8,10);
  return md>='0922'&&md<='1220'?ESTACOES_SUL[0]:(md>='1221'||md<='0319')?ESTACOES_SUL[1]:md<='0620'?ESTACOES_SUL[2]:ESTACOES_SUL[3]; }
function aSazonal(){
  const e=estacaoSul(HOJE);
  return `<div class="card sazonal"><div class="card-h"><h3>${ic('sol')} Contexto sazonal</h3><span class="pill">complementar</span></div>
      <div class="saz"><div><small class="muted">Local da clínica</small><b>${P.cidade} · Serra Gaúcha</b><small class="muted">hemisfério ${P.hemisferio}</small></div>
        <div><small class="muted">Data do atendimento</small><b>${fmt(HOJE)}</b></div><div><small class="muted">Estação</small><b>${e[0]}</b><span>${elTag(e[3])}</span></div></div>
      <p class="muted sm" style="margin-top:10px">Calculado pelo calendário do hemisfério Sul, nunca pelo do Norte. Só informação de contexto: não indica pontos, não altera hipóteses.</p></div>
    <div class="card"><h3>Calendário usado (hemisfério Sul)</h3><div class="saz-t">${ESTACOES_SUL.map(([n,a,b,el])=>`<div class="${n===e[0]?'on':''}"><b>${n}</b><span class="mono">${a} a ${b}</span>${elTag(el)}</div>`).join('')}</div>
      <p class="muted sm" style="margin-top:8px">Datas aproximadas dos equinócios e solstícios. A localização vem do cadastro da clínica; atendimento on-line usa a cidade do paciente.</p></div>`;
}
const CORPO_ABA = [aLinguaPulso,aBaGang,()=>aLivre('zangfu'),()=>aLivre('qixue'),()=>aLivre('jinye'),()=>aLivre('jingshen'),()=>aLivre('fatores'),aVasos,aSazonal];
function contaAba(i){
  if(i===0) return Object.values(S.ach).filter(a=>a.sit!=='na').length+S.pulso.esq.cls.length+S.pulso.dir.cls.length;
  if(LIVRES[i]) return S.livres[LIVRES[i]].itens.length;
  if(i===7) return Object.values(S.vasos).filter(v=>v.sit).length;
  return 0;
}
function vAvaliacao(){
  return `<div class="ab-bar" role="tablist" aria-label="Abas da avaliação">${ABAS.map((t,i)=>`<button role="tab" class="ab ${S.aba===i?'on':''}" aria-selected="${S.aba===i}" data-a="aba" data-i="${i}"><span class="ab-n">${i+1}</span>${t}${contaAba(i)?`<span class="ab-c">${contaAba(i)}</span>`:''}</button>`).join('')}</div>
  <div class="grid g-side"><div class="grid" style="align-content:start">${CORPO_ABA[S.aba]()}
    <div class="ab-nav">${S.aba?`<button class="btn" data-a="aba" data-i="${S.aba-1}">${ic('esq')}${ABAS[S.aba-1]}</button>`:'<span></span>'}${S.aba<8?`<button class="btn" data-a="aba" data-i="${S.aba+1}">${ABAS[S.aba+1]}${ic('dir')}</button>`:`<a class="btn pri" href="#/pentagrama">Pentagrama${ic('dir')}</a>`}</div></div>
  ${painelCamadas()}</div>`;
}

/* ---------- Pentagrama em camadas ---------- */
function estadoCamada(sg,k){
  const H=evaluate(sg);
  if(k==='hip') return elemState(sg,{});
  if(k==='conf') return elemState(sg,Object.fromEntries(H.map(h=>[h.p.id,S.status[h.p.id]==='aceito'?'aceito':'descartado'])));
  return elemState(sg,S.status);
}
function vPentagrama(){
  const sg=sinaisCalculo(), H=evaluate(sg), st=estadoCamada(sg,S.camada);
  const porEl=Object.fromEntries(Object.keys(EL).map(e=>[e,{ident:new Set(),hip:[],conf:[]}]));
  H.forEach(h=>{ h.m.forEach(x=>porEl[h.p.el].ident.add(x)); (S.status[h.p.id]==='aceito'?porEl[h.p.el].conf:S.status[h.p.id]==='descartado'?[]:porEl[h.p.el].hip).push(h.p.nome); });
  const C=[['atual','Combinado (como hoje)'],['hip','Hipóteses do sistema'],['conf','Só o confirmado']];
  const e=S.el;
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Mapa dos cinco elementos</h3></div>
      <div class="chips" role="radiogroup" aria-label="Camada exibida">${C.map(([k,l])=>`<button class="chip ${S.camada===k?'on':''}" role="radio" aria-checked="${S.camada===k}" data-a="camada" data-k="${k}">${l}</button>`).join('')}</div>
      ${pentagram(st,e)}
      <p class="muted sm" style="text-align:center">Mesmo componente de hoje. "Combinado" é o cálculo atual; "Hipóteses do sistema" ignora as decisões do profissional; "Só o confirmado" considera apenas os padrões confirmados.</p></div>
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-h"><h3>Por elemento</h3><span class="muted sm">toque num elemento</span></div>
        ${Object.keys(EL).filter(k=>!e||k===e).map(k=>{ const x=porEl[k]; return `<div class="pe ${e===k?'on':''}"><div class="pe-h">${elTag(k)}</div>
          <div class="pe-l">${camadaPill('obs')}<span>${[...x.ident].map(s=>esc(SIGN[s])).join(', ')||'—'}</span></div>
          <div class="pe-l">${camadaPill('hip')}<span>${x.hip.join(', ')||'—'}</span></div>
          <div class="pe-l">${camadaPill('conf')}<span>${x.conf.join(', ')||'—'}</span></div></div>`; }).join('')}
        <p class="muted sm" style="margin-top:8px">"Observado" lista os sinais positivos que fazem parte dos padrões já cadastrados de cada elemento. Nenhuma associação nova foi criada.</p></div>
      ${e?`<div class="card">${detalheEl(e,st)}</div>`:''}
      <div class="card"><div class="card-h"><h3>Interpretação profissional</h3>${camadaPill('int')}</div>
        <div class="field"><label class="lbl so-leitor" for="pt-int">Interpretação</label><textarea id="pt-int" data-f="interp" placeholder="Sua leitura dos cinco elementos para esta paciente">${esc(S.interp)}</textarea></div></div></div></div>`;
}
const tipoEl3 = s => s.exc>s.def&&s.exc>0?'exc':s.def>0?'def':'';
function detalheEl(e, st){
  const E=EL[e], k=tipoEl3(st[e]);
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:2rem;color:${E.cor}">${E.han}</span><h3>${E.nome}</h3>${k?`<span class="pill ${k==='exc'?'crit':'warn'}">${k==='exc'?'excesso':'deficiência'}</span>`:''}</div>
  <div class="corr-g">${[['Zang',E.zang],['Fu',E.fu],['Emoção',E.emocao],['Estação',E.estacao]].map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
  <div class="rel"><span>Gera ${elTag(SHENG[e])}</span><span>Gerado por ${elTag(mae(e))}</span><span>Controla ${elTag(KE[e])}</span><span>Controlado por ${elTag(controlador(e))}</span></div>`;
}

/* ---------- Síntese ---------- */
function vSintese(){
  const sg=sinaisCalculo(), conf=evaluate(sg).filter(h=>S.status[h.p.id]==='aceito'), bg=bagang(sg);
  const cats=Object.entries(S.livres).map(([c,C])=>[c,C.itens.filter(i=>i.sintese)]).filter(([,L])=>L.length);
  const vs=Object.entries(S.vasos).filter(([,x])=>x.sintese);
  const lado=ld=>{ const L=S.pulso[ld]; return `<div><small class="muted">${ld==='esq'?'Esquerdo':'Direito'}</small><div class="chips">${L.cls.map(k=>`<span class="pill">${PULSO.find(x=>x[0]===k)[1]}</span>`).join('')||'<span class="muted sm">sem classificação</span>'}</div>
    ${L.deficiencia||L.orgao?`<p class="sm">${L.deficiencia?`Deficiência: ${esc(L.deficiencia)}`:''}${L.deficiencia&&L.orgao?' · ':''}${L.orgao?`Órgão/sistema: ${esc(L.orgao)}`:''}</p>`:''}${L.obs?`<p class="muted sm">${esc(L.obs)}</p>`:''}</div>`; };
  return `<div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Padrões</h3>${camadaPill('conf')}</div>${conf.length?conf.map(h=>`<div class="sx-p">${elTag(h.p.el)}<b>${h.p.nome}</b><span class="pill ${h.p.tipo==='exc'?'crit':'warn'}">${h.p.tipo==='exc'?'excesso':'deficiência'}</span></div>`).join(''):'<p class="muted sm">Nenhum padrão confirmado.</p>'}</div>
    <div class="card"><div class="card-h"><h3>Língua e pulso</h3>${camadaPill('obs')}</div><div class="sx">${lado('esq')}${lado('dir')}</div>${S.linguaObs?`<p class="sm" style="margin-top:10px"><b>Língua:</b> ${esc(S.linguaObs)}</p>`:''}</div>
    ${cats.map(([c,L])=>`<div class="card"><div class="card-h"><h3>${CAT_NOME[c]}</h3>${camadaPill('obs')}</div>${L.map(it=>`<div class="sx-i"><div class="grow"><b>${esc(it.texto)}</b><small class="muted">${origTxt(it.orig)} · ${sitTxt(it.sit)}</small></div>${levar(`data-a="levar" data-cat="${c}" data-id="${it.id}"`,it)}</div>`).join('')}</div>`).join('')}
    ${vs.length?`<div class="card"><div class="card-h"><h3>Vasos extraordinários</h3></div>${vs.map(([v,x])=>`<div class="sx-i"><div class="grow"><b>${v}</b><small class="muted">${esc(x.achado)} · ${x.sit==='conf'?'confirmado pelo profissional':'hipótese'}</small></div>${levar(`data-a="levar-vaso" data-v="${v}"`,x)}</div>`).join('')}</div>`:''}
    ${!cats.length&&!vs.length?'<div class="card">'+vazio('camadas','Nada encaminhado das abas clínicas','Use os botões "Síntese" nas abas da avaliação.')+'</div>':''}
    <div class="card"><div class="card-h"><h3>Síntese do profissional</h3>${camadaPill('int')}</div><div class="field"><label class="lbl so-leitor" for="sx">Síntese</label><textarea id="sx" data-f="sintese" placeholder="Raciocínio clínico e prioridades do tratamento">${esc(S.sintese)}</textarea></div><p class="muted sm" style="margin-top:8px">Escrita e validada pelo profissional. O sistema não conclui diagnóstico.</p></div></div>
    <div class="grid" style="align-content:start"><div class="card"><h3>Ba Gang</h3><div class="grid" style="gap:10px;margin-top:8px">${eixo('Frio','Calor',bg.fc)}${eixo('Def.','Exc.',bg.de)}</div>${S.bgInterp?`<p class="sm" style="margin-top:10px">${esc(S.bgInterp)}</p>`:''}</div>
      <div class="card"><h3>Elementos</h3>${barrasEl(elemState(sg,S.status))}${S.interp?`<p class="sm" style="margin-top:10px"><b>Interpretação:</b> ${esc(S.interp)}</p>`:''}</div></div></div>`;
}

/* ---------- Plano ---------- */
function vPlano(){
  const sg=sinaisCalculo(), conf=evaluate(sg).filter(h=>S.status[h.p.id]==='aceito'), w=pointWarnings(S.pontos,P,S.tec);
  const itens=Object.entries(S.livres).flatMap(([c,C])=>C.itens.filter(i=>i.plano).map(i=>[c,i])), vs=Object.entries(S.vasos).filter(([,x])=>x.plano);
  return `<div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Pontos do plano</h3><span class="pill acc">${S.pontos.length}</span></div>
      ${S.pontos.length?`<div class="chips">${S.pontos.map(c=>`<button class="chip on mono" data-a="pt" data-c="${c}" title="Remover">${c} ✕</button>`).join('')}</div>`:'<p class="muted sm">Nenhum ponto escolhido.</p>'}
      <div class="lbl" style="margin:16px 0 8px">Técnicas</div><div class="chips">${TEC.map(t=>`<button class="chip ${S.tec.includes(t)?'on':''}" data-a="tec" data-t="${t}">${t}</button>`).join('')}</div></div>
    <div class="card seg"><div class="card-h"><h3>${ic('escudo')} Verificação de segurança</h3>${w.length?`<span class="pill crit">${w.length}</span>`:'<span class="pill ok">ok</span>'}</div>
      ${w.length?w.map(([k,m])=>`<div class="notice ${k==='crit'?'crit':''}" style="margin-bottom:8px">${ic('escudo')}<div>${esc(m)}</div></div>`).join(''):`<div class="vazio">${ic('okc')}Nenhuma contraindicação para os pontos e técnicas escolhidos.</div>`}</div></div>
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-h"><h3>Trazido pelo profissional</h3><span class="muted sm">só o que foi marcado como "Plano"</span></div>
        ${itens.length||vs.length?`${itens.map(([c,i])=>`<div class="sx-i"><div class="grow"><b>${esc(i.texto)}</b><small class="muted">${CAT_NOME[c]}</small></div></div>`).join('')}
          ${vs.map(([v,x])=>{ const par=VASOS.find(y=>y[0]===v); return `<div class="sx-i"><div class="grow"><b>${v}</b><small class="muted">${esc(x.achado)} · par ${par[1]} + ${par[2]}</small></div>${[par[1],par[2]].every(c=>S.pontos.includes(c))?'<span class="pill ok">no plano</span>':`<button class="btn sm" data-a="par" data-v="${v}">${ic('mais')}Incluir ${par[1]} e ${par[2]}</button>`}</div>`; }).join('')}`
          :vazio('plano','Nada encaminhado','Marque "Plano" num achado ou vaso extraordinário para ele aparecer aqui.')}</div>
      <div class="card"><h3>Sugestões dos padrões confirmados</h3><p class="muted sm" style="margin-bottom:10px">Como hoje. Toque para incluir.</p>
        ${conf.length?conf.map(h=>`<div class="sug"><div class="sug-h">${elTag(h.p.el)}<b>${h.p.nome}</b></div><div class="chips">${h.p.pontos.map(([c,j])=>`<button class="chip mono ${S.pontos.includes(c)?'on':''}" data-a="pt" data-c="${c}" title="${esc(j)}${PT[c]?.cautela?' · '+esc(CAUT[PT[c].cautela]):''}">${c}</button>`).join('')}</div></div>`).join(''):'<p class="muted sm">Confirme padrões na avaliação.</p>'}</div></div></div>`;
}

/* ---------- Versões da avaliação ---------- */
function vVersoes(){
  const L=[...V,atualComoVersao()], A=versao(S.cmpA), B=versao(S.cmpB);
  const sA=new Set(A.signs), sB=new Set(B.signs), sai=A.signs.filter(x=>!sB.has(x)), entra=B.signs.filter(x=>!sA.has(x));
  const opt=(id,sel)=>L.map(v=>`<option value="${v.id}" ${v.id===sel?'selected':''}>Versão ${v.n}${v.basal?' · basal':''} · ${fmt(v.em.slice(0,10))}</option>`).join('');
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Histórico de versões</h3><button class="btn sm pri" data-a="reav">${ic('mais')}Nova reavaliação avulsa</button></div>
      ${S.reav?`<form class="reav-f" id="f-reav"><div class="field full"><label class="lbl" for="rv-m">Motivo da reavaliação *</label><input id="rv-m" required placeholder="Ex.: piora dos sintomas"></div><div class="full chips"><button class="btn sm pri">Criar versão</button><button type="button" class="btn sm ghost" data-a="reav">Cancelar</button></div></form>`:''}
      <div class="vers">${[...L].reverse().map(v=>`<div class="ver ${v.basal?'basal':''}"><div class="ver-h"><span class="hi-n">${v.n}</span><div class="grow"><b>Versão ${v.n}${v.basal?' · avaliação basal':''}</b><small class="muted">${dataHora(v.em)} · ${esc(v.prof)}</small></div>
          ${v.basal?`<span class="pill">${ic('escudo')}bloqueada</span>`:v.id==='atual'?'<span class="pill acc">em andamento</span>':''}</div>
        <div class="ver-m"><span>${ic(/avulsa/.test(v.contexto)?'yin':'play')}${esc(v.contexto)}</span><span>${ic('info')}Motivo: ${esc(v.motivo)}</span><span>${ic('lista')}${v.signs.length} sinais</span></div>
        ${v.historico.length?`<details class="mais"><summary>Histórico desta versão (${v.historico.length}) ${ic('baixo')}</summary><div class="hist-alt">${v.historico.map(h=>`<div><span class="mono muted">${dataHora(h.em)}</span><span>${esc(h.acao)}</span></div>`).join('')}</div></details>`:''}
        ${v.basal||v.id==='atual'?'':S.corr===v.id?`<form class="corr-f" data-v="${v.id}"><div class="field full"><label class="lbl" for="cr-${v.id}">Motivo da correção *</label><input id="cr-${v.id}" required placeholder="O que foi corrigido e por quê"></div><div class="chips"><button class="btn sm pri">Registrar correção</button><button type="button" class="btn sm ghost" data-a="corr" data-v="">Cancelar</button></div></form>`:`<button class="btn ghost sm" data-a="corr" data-v="${v.id}">${ic('editar')}Corrigir com registro</button>`}
      </div>`).join('')}</div>
      <p class="muted sm" style="margin-top:10px">A basal nunca é sobrescrita: uma nova avaliação sempre cria outra versão. Correções ficam no histórico da versão, com data, hora, profissional e motivo, e o valor anterior é mantido.</p></div>
    <div class="grid" style="align-content:start"><div class="card"><div class="card-h"><h3>Comparar duas versões</h3></div>
      <div class="form"><div class="field"><label class="lbl" for="cmp-a">De</label><select id="cmp-a" data-cmp="cmpA">${opt('',S.cmpA)}</select></div><div class="field"><label class="lbl" for="cmp-b">Para</label><select id="cmp-b" data-cmp="cmpB">${opt('',S.cmpB)}</select></div></div>
      <div class="cmp" style="margin-top:10px"><div><div class="lbl">Versão ${A.n}</div>${pentagram(elemState(A.signs,A.status),null)}</div><div><div class="lbl">Versão ${B.n}</div>${pentagram(elemState(B.signs,B.status),null)}</div></div>
      ${barrasEl(elemState(B.signs,B.status),elemState(A.signs,A.status))}<p class="muted sm" style="margin-top:6px">Marca vertical: versão ${A.n}.</p>
      <div class="sinais-cmp" style="margin-top:12px"><div><span class="pill ok">${sai.length} não aparecem mais</span><p class="muted sm">${sai.map(x=>esc(SIGN[x])).join(', ')||'—'}</p></div><div><span class="pill warn">${entra.length} novos</span><p class="muted sm">${entra.map(x=>esc(SIGN[x])).join(', ')||'—'}</p></div></div></div></div></div>`;
}

/* ---------- Estrutura ---------- */
const TELAS = { avaliacao:['Avaliação energética',vAvaliacao,1], pentagrama:['Pentagrama',vPentagrama,2], sintese:['Síntese clínica',vSintese,3], plano:['Plano terapêutico',vPlano,5], versoes:['Versões da avaliação',vVersoes,-1] };
const rota = () => { const r=location.hash.replace(/^#\/?/,'').split('/')[0]; return TELAS[r]?r:'avaliacao'; };
function cabecalho(r){
  const passo=TELAS[r][2];
  return `<div class="at-top"><div class="at-h"><span class="avatar lg">${initials(P.name)}</span><div class="at-id"><b>${P.name}</b><small>${P.idade} anos · ${fmt(HOJE)} · 3º atendimento · retorno</small></div>
      <div class="at-al"><span class="pill ok">${ic('okc')}Sem alertas de segurança</span><a class="pill acc" href="#/versoes">${ic('historico')}Versões da avaliação</a></div>
      <div class="at-m"><span class="autosave ok">${ic('check')}Rascunho · proposta</span></div></div>
    <nav class="steps" aria-label="Etapas do atendimento">${ETAPAS.map(([k,n,,ativo],j)=>ativo?`<a href="#/${k}" class="${j===passo?'on':''}" ${j===passo?'aria-current="step"':''}><svg viewBox="0 0 36 36" class="sr" aria-hidden="true"><circle cx="18" cy="18" r="15" class="sr-b"/></svg><span class="sn">${j+1}</span><span class="sl">${n}</span></a>`
      :`<span class="st-off" data-tip="Fora desta proposta: já está no sistema (etapa 2D)"><svg viewBox="0 0 36 36" class="sr" aria-hidden="true"><circle cx="18" cy="18" r="15" class="sr-b"/></svg><span class="sn">${j+1}</span><span class="sl">${n}</span></span>`).join('')}</nav></div>`;
}
function menu(){
  const NAV=[['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
  document.querySelector('.app').classList.toggle('open',S.aberto);
  document.getElementById('nav').innerHTML=`<div class="brand">${LOGO}<div><b>Musubi</b><small>Gestão clínica integrativa</small></div></div>`+
    NAV.map(([k,l,i])=>`<a href="#/avaliacao" data-a="fora" aria-label="${l}" class="${k==='pacientes'?'on':''}">${ic(i)}<span>${l}</span></a>`).join('');
  const r=rota();
  document.getElementById('topbar').innerHTML=`<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button><a class="tb-logo" href="#/avaliacao">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho"><span>Pacientes</span>${ic('dir')}<span>${P.name}</span>${ic('dir')}<span>${TELAS[r][0]}</span></nav><div class="tb-r"><span class="pill acc">Proposta da etapa 3</span></div>`;
}
let ultima='';
function render(manter){
  const r=rota(), y=scrollY, v=document.getElementById('view'); menu();
  v.innerHTML=cabecalho(r)+`<div class="et-h"><span class="tico acc">${ic(r==='versoes'?'historico':ETAPAS[TELAS[r][2]][2])}</span><div class="grow"><h2>${TELAS[r][0]}</h2><small class="muted">${r==='versoes'?'Abre pelo perfil do paciente e pelo cabeçalho do atendimento':'Etapa '+(TELAS[r][2]+1)+' de 8'}</small></div></div>`+TELAS[r][1]();
  if(r+S.aba!==ultima){ v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra'); ultima=r+S.aba; }
  if(manter) scrollTo(0,y);
}
function toast(m){ const t=document.getElementById('toast'); t.className='toast ok'; t.innerHTML=`${ic('okc')}<span></span>`; t.lastChild.textContent=m; t.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>t.hidden=true,2600); }
const set = (obj,path,v) => { const k=path.split('.'), u=k.pop(); k.reduce((o,x)=>o[x],obj)[u]=v; };

/* ---------- Eventos ---------- */
const tip=document.getElementById('tip');
document.addEventListener('mouseover',ev=>{ const t=ev.target.closest('[data-tip]'); if(!t){ tip.hidden=true; return; } tip.textContent=t.dataset.tip; tip.hidden=false; const b=t.getBoundingClientRect(), w=tip.offsetWidth;
  tip.style.left=Math.max(8,Math.min(innerWidth-w-8,b.left+b.width/2-w/2))+'px'; tip.style.top=(b.top-tip.offsetHeight-8<4?b.bottom+8:b.top-tip.offsetHeight-8)+'px'; });
addEventListener('hashchange',()=>{ S.aberto=false; render(); scrollTo(0,0); });
document.addEventListener('click',ev=>{
  tip.hidden=true;
  const n=ev.target.closest('.node'); if(n){ S.el=S.el===n.dataset.e?null:n.dataset.e; render(true); return; }
  const t=ev.target.closest('[data-a]'); if(!t) return; const a=t.dataset.a;
  if(a==='aba'){ S.aba=Number(t.dataset.i); render(); scrollTo(0,0); }
  else if(a==='ach'){ const k=t.dataset.s, cur=S.ach[k]; const prox={na:'pos',pos:'neg',neg:'na'}[cur?.sit||'na'];
    if(prox==='na') delete S.ach[k]; else S.ach[k]={sit:prox,orig:cur?.orig||(k in Object.fromEntries(SIGNS['Língua'])?'exame':'anamnese')}; render(true); }
  else if(a==='pcls'){ const L=S.pulso[t.dataset.l].cls, i=L.indexOf(t.dataset.k); i<0?L.push(t.dataset.k):L.splice(i,1); render(true); }
  else if(a==='hip'){ S.status[t.dataset.p]=S.status[t.dataset.p]===t.dataset.st?'':t.dataset.st; render(true); }
  else if(a==='levar'){ const it=S.livres[t.dataset.cat].itens.find(x=>x.id===t.dataset.id); it[t.dataset.dest]=!it[t.dataset.dest]; render(true); toast(it[t.dataset.dest]?`Levado para ${t.dataset.dest==='sintese'?'a Síntese':'o Plano'}`:'Retirado'); }
  else if(a==='levar-vaso'){ const x=S.vasos[t.dataset.v]; x[t.dataset.dest]=!x[t.dataset.dest]; render(true); toast(x[t.dataset.dest]?`Levado para ${t.dataset.dest==='sintese'?'a Síntese':'o Plano'}`:'Retirado'); }
  else if(a==='camada'){ S.camada=t.dataset.k; render(true); }
  else if(a==='pt'){ const i=S.pontos.indexOf(t.dataset.c); i<0?S.pontos.push(t.dataset.c):S.pontos.splice(i,1); render(true); }
  else if(a==='tec'){ const i=S.tec.indexOf(t.dataset.t); i<0?S.tec.push(t.dataset.t):S.tec.splice(i,1); render(true); }
  else if(a==='par'){ const par=VASOS.find(y=>y[0]===t.dataset.v); par.slice(1).forEach(c=>{ if(!S.pontos.includes(c)) S.pontos.push(c); }); render(true); toast(`${par[1]} e ${par[2]} incluídos pelo profissional`); }
  else if(a==='reav'){ S.reav=!S.reav; render(true); }
  else if(a==='corr'){ S.corr=t.dataset.v||null; render(true); }
  else if(a==='menu-abrir'){ S.aberto=!S.aberto; render(true); }
  else if(a==='menu-fechar'){ S.aberto=false; render(true); }
  else if(a==='fora'){ ev.preventDefault(); toast('Nesta proposta só a avaliação, o pentagrama, a síntese, o plano e as versões são navegáveis'); }
});
document.addEventListener('input',ev=>{ const t=ev.target;
  if(t.dataset.f) S[t.dataset.f]=t.value;
  else if(t.dataset.p) set(S.pulso,t.dataset.p,t.value);
  else if(t.dataset.ln) S.livres[t.dataset.ln].nota=t.value;
  else if(t.dataset.va){ (S.vasos[t.dataset.va]||={achado:'',sit:'',sintese:false,plano:false}).achado=t.value; }
});
document.addEventListener('change',ev=>{ const t=ev.target;
  if(t.dataset.sit){ S.ach[t.dataset.sit].sit=t.value; if(t.value==='na') delete S.ach[t.dataset.sit]; render(true); }
  else if(t.dataset.orig){ S.ach[t.dataset.orig].orig=t.value; render(true); }
  else if(t.dataset.lsit||t.dataset.lorig){ const [c,id]=(t.dataset.lsit||t.dataset.lorig).split('.'); S.livres[c].itens.find(x=>x.id===id)[t.dataset.lsit?'sit':'orig']=t.value; render(true); }
  else if(t.dataset.vs){ const x=(S.vasos[t.dataset.vs]||={achado:'',sit:'',sintese:false,plano:false}); x.sit=t.value; if(!t.value){ x.sintese=false; x.plano=false; } render(true); }
  else if(t.dataset.cmp){ S[t.dataset.cmp]=t.value; render(true); }
});
document.addEventListener('submit',ev=>{ ev.preventDefault(); const f=ev.target;
  if(f.classList.contains('livre-f')){ const c=f.dataset.cat, txt=document.getElementById('lv-'+c).value.trim(); if(!txt) return;
    S.livres[c].itens.push({id:'n'+(++S.novos),texto:txt,orig:document.getElementById(`lv-${c}-o`).value,sit:document.getElementById(`lv-${c}-s`).value,sintese:false,plano:false}); render(true); toast('Achado registrado'); }
  else if(f.id==='f-reav'){ const m=document.getElementById('rv-m').value.trim(); if(!m) return;
    V.push({id:'v'+(V.length+1),n:V.length+1,em:HOJE+'T'+new Date().toTimeString().slice(0,5),prof:PROF,contexto:'Reavaliação avulsa (fora de atendimento)',motivo:m,signs:[...V.at(-1).signs],status:{...V.at(-1).status},historico:[{em:HOJE+'T'+new Date().toTimeString().slice(0,5),acao:'Versão registrada'}]});
    S.reav=false; render(true); toast('Nova versão criada; a basal continua intacta'); }
  else if(f.classList.contains('corr-f')){ const v=V.find(x=>x.id===f.dataset.v), m=document.getElementById('cr-'+v.id).value.trim(); if(!m) return;
    v.historico.push({em:HOJE+'T'+new Date().toTimeString().slice(0,5),acao:`Correção registrada por ${PROF}. Motivo: ${m}. Valores anteriores mantidos neste histórico.`}); S.corr=null; render(true); toast('Correção registrada no histórico'); }
});
render();
