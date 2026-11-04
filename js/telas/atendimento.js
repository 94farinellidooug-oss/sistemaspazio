// Ambiente de atendimento: as 8 etapas com navegação livre, cabeçalho fixo com o paciente e os
// alertas, preenchimento por etapa e salvamento automático. Usa, sem alterar, o raciocínio clínico
// (evaluate, bagang, elemState), o pentagrama e a verificação de segurança dos pontos.
import { elTag } from '../componentes/campos.js';
import { anel, barrasEl, delta, linhas } from '../componentes/graficos.js';
import { ic, vazio } from '../componentes/icones.js';
import { pentagram } from '../componentes/pentagrama.js';
import { EL, KE, SHENG, controlador, mae } from '../conhecimento/elementos.js';
import { FONTE_INDICACOES, REGIOES_CORPO, indicadosDaRegiao, regioesDoPonto, regioesDoTexto } from '../conhecimento/indicacoes-regiao.js';
import { CAUT, CODIGOS, MER, PT, meridianoDe } from '../conhecimento/pontos.js';
import { FACES, LARGURA, TAM, pontosProximos, VISTAS, desenho, iconeMarca, marcaSvg, pontosSvg, temPosicao, vistaNome, vistasDoPonto } from '../componentes/corpo.js';
import { SIGN, SIGNS } from '../conhecimento/sinais.js';
import { LADOS_MARCA, TIPOS_MARCA, atendimentosAnteriores, marcaComIntensidade, marcasDe, CATEGORIAS, ELEMENTO_ESTACAO, ETAPAS, LADOS_PULSO, PARES_VASOS, categoriaDe, ehBasal, encaminhados, vasoDe, ORIGENS_ACHADO, POSICOES_PULSO, SITUACOES_ACHADO, VASOS, atendimentoDe, avaliacaoEditavel, estacao, finalizados, preenchimento, registroDe } from '../dados/atendimento.js';
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
export const ABAS_AVALIACAO = ['Língua e pulso','Ba Gang','Zang-Fu','Qi e Xue','Jin Ye','Jing e Shen','Fatores patogênicos'];
const SIT_NOME = Object.fromEntries(SITUACOES_ACHADO);
const optsAt = (L,v) => L.map(([k,l])=>`<option value="${k}" ${k===v?'selected':''}>${l}</option>`).join('');
function chipAchadoAt(R,k,l,orig){
  const x=R.achados[k], sit=x?.sit||'na';
  return `<button class="chip achado s-${sit}" data-act="at-sinal" data-s="${k}" data-o="${orig}" aria-pressed="${sit==='pos'}" data-tip="${SIT_NOME[sit]} · toque para alternar">${sit==='pos'?ic('check'):sit==='neg'?ic('x'):''}${l}</button>`;
}
function listaAchadosAt(R,chaves){
  const L=chaves.filter(k=>R.achados[k]);
  return L.length?`<div class="achados">${L.map(k=>{ const x=R.achados[k]; return `<div class="ach-r"><span class="grow">${esc(SIGN[k])}</span>
    <select class="mini-sel" data-atsit="${k}" aria-label="Situação: ${esc(SIGN[k])}">${optsAt(SITUACOES_ACHADO,x.sit)}</select>
    <select class="mini-sel" data-atorig="${k}" aria-label="Origem: ${esc(SIGN[k])}">${x.orig?'':'<option value="" selected>Origem não informada</option>'}${optsAt(ORIGENS_ACHADO,x.orig)}</select></div>`; }).join('')}</div>`:'';
}
function abaLinguaPulso(R){
  const LG=SIGNS['Língua'], PU=SIGNS['Pulso'], ST=SIGNS['Sinais e sintomas'], nome=k=>PU.find(x=>x[0]===k)?.[1]||k;
  const uniao=PU.filter(([k])=>R.pulso.esq.cls.includes(k)||R.pulso.dir.cls.includes(k)||R.pulso.semLado.includes(k));
  return `<div class="card"><div class="card-h"><h3>Língua</h3><span class="muted sm">toque: positivo, negativo, não avaliado</span></div>
      <div class="chips">${LG.map(([k,l])=>chipAchadoAt(R,k,l,'exame')).join('')}</div>${listaAchadosAt(R,LG.map(x=>x[0]))}
      <div class="field" style="margin-top:12px"><label class="lbl" for="at-lgobs">Observações da língua</label><textarea id="at-lgobs" data-atr="linguaObs">${esc(R.linguaObs)}</textarea></div></div>
    <div class="card"><div class="card-h"><h3>Pulsologia bilateral</h3><span class="pill">várias classificações por lado</span></div>
      <div class="pulso-g">${LADOS_PULSO.map(([ld,nm])=>{ const L=R.pulso[ld]; return `<section class="pulso-l" aria-label="${nm}"><h4>${nm}</h4>
        <div class="lbl">Classificações</div><div class="chips">${PU.map(([k,l])=>`<button class="chip ${L.cls.includes(k)?'on':''}" data-act="at-pulso" data-l="${ld}" data-k="${k}" aria-pressed="${L.cls.includes(k)}">${l}</button>`).join('')}</div>
        <div class="form" style="margin-top:12px">
          <div class="field"><label class="lbl" for="at-p-${ld}-def">Deficiência identificada</label><input id="at-p-${ld}-def" data-atp="${ld}.deficiencia" value="${esc(L.deficiencia)}" placeholder="Registro do profissional"></div>
          <div class="field"><label class="lbl" for="at-p-${ld}-org">Órgão ou sistema relacionado</label><input id="at-p-${ld}-org" data-atp="${ld}.orgao" value="${esc(L.orgao)}" placeholder="Registro do profissional"></div>
          <div class="field full"><label class="lbl" for="at-p-${ld}-obs">Observações da avaliação</label><textarea id="at-p-${ld}-obs" data-atp="${ld}.obs">${esc(L.obs)}</textarea></div></div>
        <details class="mais pos-d" ${Object.values(L.pos).some(Boolean)?'open':''}><summary>Por posição: Cun, Guan e Chi ${ic('baixo')}</summary>
          <div class="pos-g">${POSICOES_PULSO.map(([pk,pl])=>`<div class="field"><label class="lbl" for="at-p-${ld}-${pk}">${pl}</label><textarea id="at-p-${ld}-${pk}" data-atp="${ld}.pos.${pk}" placeholder="Características e observações">${esc(L.pos[pk])}</textarea></div>`).join('')}</div></details>
      </section>`; }).join('')}</div>
      ${R.pulso.semLado.length?`<div class="notice" style="margin-top:14px">${ic('info')}<div><b>Registrado antes do pulso bilateral, sem lado:</b> <span class="chips" style="display:inline-flex;margin-top:6px">${R.pulso.semLado.map(k=>`<button class="chip on" data-act="at-pulso" data-l="semLado" data-k="${k}" data-tip="Retirar">${nome(k)} ✕</button>`).join('')}</span><div class="sm" style="margin-top:6px">Continua contando para as hipóteses. Marque no lado certo e retire daqui.</div></div></div>`:''}
      <div class="notice" style="margin-top:14px">${ic('info')}<div><b>Compatibilidade com o cálculo.</b> Uma classificação conta para as hipóteses se estiver marcada em qualquer lado. Hoje entram: ${uniao.map(([,l])=>`<b>${l}</b>`).join(', ')||'nenhuma'}. Deficiência, órgão, observações e posições são registro do profissional e não alteram o cálculo.</div></div></div>
    <div class="card"><div class="card-h"><h3>Sinais e sintomas</h3><span class="muted sm">alimentam as hipóteses, como antes</span></div>
      <div class="chips">${ST.map(([k,l])=>chipAchadoAt(R,k,l,'anamnese')).join('')}</div>${listaAchadosAt(R,ST.map(x=>x[0]))}</div>`;
}
function abaBaGang(av,R){
  const bg=bagang(av.signs);
  return `<div class="card"><div class="card-h"><h3>Oito princípios (Ba Gang)</h3><span class="pill warn">calculado pelo sistema</span></div>
      <div class="grid" style="gap:12px;margin-top:6px">${eixoBg('Frio','Calor',bg.fc)}${eixoBg('Deficiência','Excesso',bg.de)}</div>
      <p class="muted sm" style="margin-top:10px">Mesma lógica de antes, a partir de ${bg.n} sinais.</p></div>
    <div class="card"><div class="field"><label class="lbl" for="at-bgint">Interpretação do profissional</label><textarea id="at-bgint" data-atr="bgInterp" placeholder="Interior/exterior, frio/calor, deficiência/excesso, Yin/Yang segundo a sua avaliação">${esc(R.bgInterp)}</textarea></div></div>`;
}
// Dicas para o tratamento (decisão de 04/11): vasos extraordinários e estação do ano ficam no Plano,
// como opções. A indicação automática depende dos critérios da profissional; até lá nada é sugerido.
function dicasTratamento(p,a){
  const c=p.cadastro||{}, hem=c.hemisferio||'Sul', est=estacao(Number(a.data.slice(5,7))-1,hem), P=a.plano.pontos;
  return `<div class="card dicas"><div class="card-h"><h3>${ic('info')} Dicas para o tratamento</h3><span class="pill">opções</span></div>
    <div class="sazonal dica-est"><b>${ic('sol')} Estação: ${est}</b><span class="sm">${c.cidade?esc(c.cidade)+' · ':''}hemisfério ${hem} · estação ligada a ${elTag(ELEMENTO_ESTACAO[est])}</span></div>
    <details class="mais dica-v" ${PARES_VASOS.some(([v,ab,ac])=>vasoDe(a,v).nota||[ab,ac].every(k=>P.includes(k)))?'open':''}><summary>Vasos extraordinários · 8 pares de abertura e acoplado ${ic('baixo')}</summary>
    <div class="vt" style="margin-top:10px">${PARES_VASOS.map(([v,ab,ac])=>{ const x=vasoDe(a,v), no=[ab,ac].every(k=>P.includes(k)); return `<div class="vt-r ${no?'tem':''}">
      <div class="vt-n"><b>${v}</b><small class="mono">${ab} + ${ac}</small></div>
      ${no?'<span class="pill ok">par no plano</span>':`<button class="btn sm" data-act="at-par" data-v="${v}">${ic('mais')}Incluir ${ab} e ${ac}</button>`}
      <input class="vt-a" data-vnota="${v}" value="${esc(x.nota||'')}" placeholder="Anotação" aria-label="Anotação sobre ${v}"></div>`; }).join('')}</div></details>
    <p class="muted sm" style="margin-top:10px">O sistema ainda não indica vasos nem condutas pela estação: isso entra quando os critérios clínicos forem definidos pela profissional. A escolha é sempre do profissional.</p></div>`;
}
const ORIG_NOME = Object.fromEntries(ORIGENS_ACHADO);
const levarAt = (c,it) => `<div class="levar">${[['sintese','Síntese','camadas'],['plano','Plano','plano']].map(([d,l,i])=>`<button class="chip ${it[d]?'on':''}" data-act="at-levar" data-cat="${c}" data-id="${it.id}" data-dest="${d}" aria-pressed="${!!it[d]}" data-tip="${it[d]?'Retirar da '+l:'Levar para '+(d==='plano'?'o ':'a ')+l}">${ic(i)}${l}</button>`).join('')}</div>`;
function abaLivre(av,c,nome){
  const C=categoriaDe(av,c);
  return `<div class="notice">${ic('info')}<div><b>${nome}: registro livre do profissional.</b> A lista clínica desta categoria ainda será definida. Nada aqui é sugerido, calculado ou encaminhado sozinho.</div></div>
    <div class="card"><div class="card-h"><h3>Achados de ${nome}</h3><span class="pill acc">${C.itens.length}</span></div>
      ${C.itens.length?`<div class="livres">${C.itens.map(it=>`<div class="livre"><div class="livre-t"><b>${esc(it.texto)}</b><div class="livre-m">
          <select class="mini-sel" data-atlsit="${c}.${it.id}" aria-label="Situação: ${esc(it.texto)}">${optsAt(SITUACOES_ACHADO,it.sit)}</select>
          <select class="mini-sel" data-atlorig="${c}.${it.id}" aria-label="Origem: ${esc(it.texto)}">${optsAt(ORIGENS_ACHADO,it.orig)}</select>
          <button class="btn sm ghost" data-act="at-livre-rm" data-cat="${c}" data-id="${it.id}" aria-label="Remover ${esc(it.texto)}">${ic('x')}Remover</button></div></div>${levarAt(c,it)}</div>`).join('')}</div>`
        :vazio('lista','Nenhum achado registrado','Descreva o achado abaixo, com a origem e a situação.')}
      <form class="livre-f" data-cat="${c}"><div class="field full"><label class="lbl" for="lv-${c}">Novo achado</label><input id="lv-${c}" placeholder="Descreva o achado" required maxlength="300"></div>
        <div class="field"><label class="lbl" for="lv-${c}-o">Origem</label><select id="lv-${c}-o">${optsAt(ORIGENS_ACHADO,'exame')}</select></div>
        <div class="field"><label class="lbl" for="lv-${c}-s">Situação</label><select id="lv-${c}-s">${optsAt(SITUACOES_ACHADO,'pos')}</select></div>
        <div class="field" style="align-self:end"><button class="btn sm">${ic('mais')}Registrar achado</button></div></form></div>
    <div class="card"><div class="field"><label class="lbl" for="lv-${c}-n">Anotações gerais de ${nome}</label><textarea id="lv-${c}-n" data-atln="${c}">${esc(C.nota)}</textarea></div></div>`;
}
function contaAbaAt(i,R,a,av){
  if(i>=2&&i<=6) return categoriaDe(av,CATEGORIAS[i-2][0]).itens.length;
  if(i===0) return Object.keys(R.achados).length+R.pulso.esq.cls.length+R.pulso.dir.cls.length+R.pulso.semLado.length;
  return 0;
}
function eAvaliacao(p,a){
  const av=avaliacaoEditavel(p,a);
  if(!av) return vazio('yin','Atendimento finalizado sem avaliação energética','A avaliação deste dia pode ser feita como reavaliação avulsa no perfil do paciente.');
  const H=evaluate(av.signs), R=registroDe(av), i=Math.max(0,Math.min(6,ui.avAba|0)), trava=a.status==='finalizado'&&ehBasal(p,av);
  const corpo=[()=>abaLinguaPulso(R),()=>abaBaGang(av,R),...CATEGORIAS.map(([c,n])=>()=>abaLivre(av,c,n))][i]();
  return `<div class="notice" style="margin-bottom:16px">${ic('info')}<div><b>Apoio ao raciocínio clínico.</b> As hipóteses vêm dos sinais positivos e das classificações de pulso, e não são diagnóstico. Cabe ao profissional aceitar, descartar e decidir.</div></div>
  <div class="ab-bar" role="tablist" aria-label="Abas da avaliação">${ABAS_AVALIACAO.map((t,j)=>{ const n=contaAbaAt(j,R,a,av); return `<button role="tab" class="ab ${i===j?'on':''}" aria-selected="${i===j}" data-act="at-aba" data-i="${j}"><span class="ab-n">${j+1}</span>${t}${n?`<span class="ab-c">${n}</span>`:''}</button>`; }).join('')}</div>
  ${trava?`<div class="notice crit trava" style="margin-bottom:12px">${ic('escudo')}<div><b>Avaliação basal bloqueada.</b> Ela é preservada como referência e não pode ser alterada. Para registrar mudanças, use uma reavaliação avulsa na aba "Versões da avaliação" do perfil.</div></div>`:''}
  <fieldset class="trava-f" ${trava?'disabled':''}><div class="grid g-side"><div class="grid" style="align-content:start">
    ${a.status==='rascunho'&&p.avaliacoes.length&&i===0?'<p class="muted sm">Achados trazidos da última avaliação. Ajuste o que mudou.</p>':''}
    ${corpo}
    <div class="ab-nav">${i?`<a href="#atendimento" class="btn" data-act="at-aba" data-i="${i-1}">${ic('esq')}${ABAS_AVALIACAO[i-1]}</a>`:'<span></span>'}${i<6?`<a href="#atendimento" class="btn" data-act="at-aba" data-i="${i+1}">${ABAS_AVALIACAO[i+1]}${ic('dir')}</a>`:''}</div>
  </div>
  <div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Hipóteses de padrão</h3><span class="muted sm">${av.signs.length} sinais · ${H.length} hipóteses</span></div>
      ${H.length?H.map(h=>{const s=av.status[h.p.id]||'';return `<div class="hp ${s}"><div class="hp-h">${anel(h.score,Math.round(h.score*100)+'%',EL[h.p.el].cor)}<div class="grow"><b>${h.p.nome}</b><div>${elTag(h.p.el)} <span class="muted sm">· ${h.m.length}/${h.p.sinais.length} sinais</span></div></div></div>
        <div class="hp-a"><button class="btn sm ${s==='aceito'?'pri':''}" data-act="at-hip" data-p="${h.p.id}" data-st="aceito">${ic('check')}${s==='aceito'?'Aceito':'Aceitar'}</button><button class="btn sm" data-act="at-hip" data-p="${h.p.id}" data-st="descartado">${s==='descartado'?'Descartado':'Descartar'}</button></div>
        <details class="mais"><summary>Por que aparece ${ic('baixo')}</summary><p class="sm"><b>Presentes:</b> ${h.m.map(x=>SIGN[x]).join(', ')}</p>${h.falta.length?`<p class="sm muted"><b>Esperados, não observados:</b> ${h.falta.map(x=>SIGN[x]).join(', ')}</p>`:''}</details></div>`;}).join(''):vazio('yin','Sem hipóteses ainda','Marque ao menos dois sinais de língua, pulso ou sintomas.')}</div>
    ${cmpBasal(p,a,av)}
    <div class="card"><div class="field"><label class="lbl" for="at-avnota">Observações da avaliação</label><textarea id="at-avnota" data-atf="avnota">${esc(av.nota||'')}</textarea></div></div>
  </div></div></fieldset>`;
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
const CAMADAS_PENTA = [['atual','Combinado (como antes)'],['hip','Hipóteses do sistema'],['conf','Só o confirmado']];
const camadaTag = k => ({obs:`<span class="ly ly-obs">${ic('lista')}Identificado</span>`,hip:`<span class="ly ly-hip">${ic('info')}Hipótese do sistema</span>`,conf:`<span class="ly ly-conf">${ic('check')}Confirmado pelo profissional</span>`})[k];
// Estado dos elementos por camada, sempre com elemState: "atual" é o cálculo de antes (aceito 1,
// pendente 0,6, descartado 0); "hip" ignora as decisões do profissional; "conf" considera só os aceitos.
function estadoPenta(sg,status,k){
  if(k==='hip') return elemState(sg,{});
  if(k==='conf') return elemState(sg,Object.fromEntries(evaluate(sg).map(h=>[h.p.id,status[h.p.id]==='aceito'?'aceito':'descartado'])));
  return elemState(sg,status);
}
function ePentagrama(p,a){
  const av=avaliacaoEditavel(p,a)||{signs:[],status:{}}, cam=CAMADAS_PENTA.some(x=>x[0]===ui.camada)?ui.camada:'atual', st=estadoPenta(av.signs,av.status,cam);
  const a0=p.avaliacoes.find(x=>x.atendimentoId!==a.id), b=a0?elemState(a0.signs,a0.status):null, trava=a.status==='finalizado'&&ehBasal(p,av);
  const porEl=Object.fromEntries(Object.keys(EL).map(e=>[e,{ident:new Set(),hip:[],conf:[]}]));
  evaluate(av.signs).forEach(h=>{ const s=av.status[h.p.id]; h.m.forEach(x=>porEl[h.p.el].ident.add(x)); if(s==='aceito') porEl[h.p.el].conf.push(h.p.nome); else if(s!=='descartado') porEl[h.p.el].hip.push(h.p.nome); });
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Mapa dos cinco elementos</h3>${b?`<button class="chip ${ui.atCmp?'on':''}" data-act="at-cmp" aria-pressed="${!!ui.atCmp}">Comparar com o basal</button>`:'<span class="pill acc">basal</span>'}</div>
    <div class="chips" role="radiogroup" aria-label="Camada exibida" style="margin-bottom:6px">${CAMADAS_PENTA.map(([k,l])=>`<button class="chip ${cam===k?'on':''}" role="radio" aria-checked="${cam===k}" data-act="at-camada" data-k="${k}">${l}</button>`).join('')}</div>
    ${ui.atCmp&&b?`<div class="cmp"><div><div class="lbl">Basal · ${fmt(a0.date)}</div>${pentagram(b,ui.el)}</div><div><div class="lbl">Hoje</div>${pentagram(st,ui.el)}</div></div>`:pentagram(st,ui.el)}
    <p class="muted sm" style="text-align:center">Mesmo cálculo de antes. "Combinado" é o mapa de sempre; "Hipóteses do sistema" ignora as decisões do profissional; "Só o confirmado" considera apenas os padrões aceitos. Anel tracejado: deficiência; anel espesso: excesso.</p></div>
    <div class="grid" style="align-content:start"><div class="card">${barrasEl(st,b)}${b?'<p class="muted sm" style="margin-top:6px">Marca vertical: posição na avaliação basal.</p>':''}</div>
      <div class="card"><div class="card-h"><h3>Por elemento</h3><span class="muted sm">camadas separadas</span></div>
        ${Object.keys(EL).filter(k=>!ui.el||k===ui.el).map(k=>{ const x=porEl[k]; return `<div class="pe"><div class="pe-h">${elTag(k)}</div>
          <div class="pe-l">${camadaTag('obs')}<span>${[...x.ident].map(s=>esc(SIGN[s])).join(', ')||'—'}</span></div>
          <div class="pe-l">${camadaTag('hip')}<span>${x.hip.join(', ')||'—'}</span></div>
          <div class="pe-l">${camadaTag('conf')}<span>${x.conf.join(', ')||'—'}</span></div></div>`; }).join('')}
        <p class="muted sm" style="margin-top:8px">"Identificado" lista os sinais positivos que fazem parte dos padrões já cadastrados de cada elemento. Nenhuma associação nova foi criada.</p></div>
      <div class="card">${detalheEl(ui.el,st,p.name.split(' ')[0])}</div>
      <div class="card"><div class="field"><label class="lbl" for="at-interp">Interpretação do profissional</label><textarea id="at-interp" data-atr="interp" ${trava?'disabled':''} placeholder="Sua leitura dos cinco elementos para este paciente">${esc(av.interp||'')}</textarea></div><p class="muted sm" style="margin-top:6px">Registro do profissional. Não altera o cálculo.</p></div></div></div>`;
}
function resumoPulso(R){
  const PU=SIGNS['Pulso'], nome=k=>PU.find(x=>x[0]===k)?.[1]||k;
  const lado=(ld,t)=>{ const L=R.pulso[ld]; return `<div><small>${t}</small><div class="chips">${L.cls.map(k=>`<span class="pill">${nome(k)}</span>`).join('')||'<span class="muted sm">sem classificação</span>'}</div>
    ${L.deficiencia||L.orgao?`<p class="sm" style="margin-top:6px">${L.deficiencia?`Deficiência: ${esc(L.deficiencia)}`:''}${L.deficiencia&&L.orgao?' · ':''}${L.orgao?`Órgão/sistema: ${esc(L.orgao)}`:''}</p>`:''}${L.obs?`<p class="muted sm">${esc(L.obs)}</p>`:''}</div>`; };
  return `<div class="sx">${lado('esq','Pulso esquerdo')}${lado('dir','Pulso direito')}</div>${R.pulso.semLado.length?`<p class="muted sm" style="margin-top:8px">Sem lado: ${R.pulso.semLado.map(nome).join(', ')}</p>`:''}${R.linguaObs?`<p class="sm" style="margin-top:10px"><b>Língua:</b> ${esc(R.linguaObs)}</p>`:''}`;
}
function eSintese(p,a){
  const av=avaliacaoEditavel(p,a)||{signs:[],status:{}}, ac=evaluate(av.signs).filter(h=>av.status[h.p.id]==='aceito'), bg=bagang(av.signs), st=elemState(av.signs,av.status);
  const R=registroDe(av), cats=encaminhados(av,'sintese');
  return `<div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><h3>Resumo da avaliação</h3><div class="sx">
      <div><small>Padrões validados</small>${ac.length?ac.map(h=>`<div class="sx-p">${elTag(h.p.el)}<b>${h.p.nome}</b><span class="pill ${h.p.tipo==='exc'?'crit':'warn'}">${h.p.tipo==='exc'?'excesso':'deficiência'}</span></div>`).join(''):`<p class="muted sm">Nenhum padrão aceito. <a href="#atendimento" data-act="etapa" data-i="1">Voltar à avaliação</a></p>`}
</div>
      <div><small>Oito princípios</small><div class="grid" style="gap:10px;margin-top:6px">${eixoBg('Frio','Calor',bg.fc)}${eixoBg('Def.','Exc.',bg.de)}</div>${R.bgInterp?`<p class="sm" style="margin-top:8px">${esc(R.bgInterp)}</p>`:''}</div></div></div>
    <div class="card"><div class="card-h"><h3>Língua e pulso</h3><span class="muted sm">registro do profissional</span></div>${resumoPulso(R)}</div>
    ${cats.length?cats.map(([c,nome,L])=>`<div class="card sx-cat"><div class="card-h"><h3>${nome}</h3><span class="muted sm">levado pelo profissional</span></div>${L.map(it=>`<div class="sx-i"><div class="grow"><b>${esc(it.texto)}</b><small class="muted">${ORIG_NOME[it.orig]||'Origem não informada'} · ${SIT_NOME[it.sit]}</small></div>${levarAt(c,it)}</div>`).join('')}</div>`).join('')
      :`<div class="card">${vazio('camadas','Nenhum achado levado das categorias','Use o botão "Síntese" nos achados de Zang-Fu, Qi e Xue, Jin Ye, Jing e Shen e Fatores.')}</div>`}
    <div class="card"><div class="field"><label class="lbl" for="at-sintese">Síntese do profissional</label><textarea id="at-sintese" data-atf="sintese" placeholder="Raciocínio clínico, prioridades do tratamento...">${esc(a.sintese)}</textarea></div><p class="muted sm" style="margin-top:8px">A síntese é escrita e validada pelo profissional. O sistema não conclui diagnóstico.</p></div></div>
    <div class="card"><h3>Elementos</h3>${barrasEl(st)}${av.interp?`<p class="sm" style="margin-top:10px"><b>Interpretação:</b> ${esc(av.interp)}</p>`:''}</div></div>`;
}
/* ---------- Mapa corporal (etapa 4A) ----------
   Seis vistas com silhuetas próprias, marcações tocando no corpo, comparação com os atendimentos
   anteriores e os pontos do plano que já têm posição. Tudo aproximado; nada é calculado. */
const ZOOMS_MAPA = [1, 1.5, 2, 3];
const nomeMarca = k => TIPOS_MARCA.find(t => t[0] === k)?.[1] || k;
const nomeLado = k => LADOS_MARCA.find(l => l[0] === k)?.[1] || 'Não se aplica';
const faceMapa = v => FACES[v] ? ui.mapa.face[v] : '';
const naVistaMapa = (m, v, f) => m.vista === v && (m.face || '') === (f || '');
const larguraMapa = (v, z) => z === 1 ? `min(100%,${LARGURA[v]}px)` : LARGURA[v] * z + 'px';
function dicaMapa(a){
  const M = ui.mapa;
  if (a.status !== 'rascunho') return `${ic('check')}Atendimento finalizado: as marcações estão no prontuário e não mudam mais. Toque numa marcação para ver os detalhes.`;
  if (M.rad) return `${ic('dir')}<b>Irradiação:</b> agora toque no ponto de destino, na mesma vista. <button class="btn ghost sm" data-act="at-mk-radx">Cancelar</button>`;
  if (M.ferr === 'sel') return `${ic('info')}<span>Toque numa marcação para editar e ver os pontos próximos, ou num ponto para ver a ficha. Para marcar, escolha um tipo acima: ele fica ativo até você parar.</span>`;
  const parar = ` Para parar, toque de novo no botão ou em <b>Selecionar</b>.`;
  return M.ferr === 'irradiacao' ? `${ic('dir')}<span><b>Irradiação:</b> toque na origem e depois no destino. Repita para marcar outras. Toque em cima de uma marcação para apagá-la.${parar}</span>` : `${ic('corpo')}<span>Toque no corpo quantas vezes quiser para marcar <b>${nomeMarca(M.ferr).toLowerCase()}</b>. Toque em cima de uma marcação para apagá-la. Os pontos próximos aparecem ao lado.${parar}</span>`;
}
// Pontos perto do local marcado, com o resumo da ficha da Biblioteca. Critério: só a distância no desenho.
function proximosMarca(p, a, m){
  const L = pontosProximos(m), P = a.plano.pontos, rasc = a.status === 'rascunho';
  const linha = c => { const d = PT[c], mer = MER[d.mer], noPlano = P.includes(c), w = pointWarnings([c], p, a.plano.tec);
    return `<div class="px-i"><div class="px-h"><b class="mono">${esc(c)}</b><span>${esc(d.pinyin)}</span><small class="muted">${mer ? esc(mer[0]) : ''} · ponto ${esc(c.slice(d.mer.length))}</small>${noPlano ? '<span class="pill acc">no plano</span>' : ''}</div>
      <p class="px-a">${esc(d.acoes)}</p>${d.cautela ? `<span class="pill warn">${esc(CAUT[d.cautela] || d.cautela)}</span>` : ''}${w.length ? `<span class="pill crit">${ic('escudo')}${w.length} aviso${w.length > 1 ? 's' : ''} de segurança</span>` : ''}
      <div class="px-b"><button class="btn sm ghost" data-act="at-mv-ptv" data-c="${esc(c)}">Ver ficha completa</button>${rasc ? `<button class="btn sm ${noPlano ? '' : 'pri'}" data-act="at-mv-ptx" data-c="${esc(c)}">${noPlano ? `${ic('x')}Tirar do plano` : `${ic('mais')}Incluir no plano`}</button>` : ''}</div></div>`; };
  return `<div class="px" id="mk-prox"><span class="lbl">Pontos próximos deste local</span>
    ${L.length ? L.map(linha).join('') : '<p class="muted sm">Nenhum ponto com posição perto deste local ainda. Mais pontos entram com o Atlas.</p>'}
    <p class="muted sm px-n">Pela posição aproximada no mapa, não é indicação para a queixa.</p></div>`;
}
// Pontos que o livro indica para a região escrita na marcação (tabela conferida por Mauren).
const fonteInd = () => { const F = FONTE_INDICACOES; return `${esc(F.autora)}, <i>${esc(F.obra)}</i> (${esc(F.editora)}), seção Indicações. Lista conferida por ${esc(F.aprovadoPor)} em ${fmt(F.aprovadoEm)}.`; };
export function indicadosMarca(p, a, m){
  const R = regioesDoTexto(m.regiao), P = a.plano.pontos;
  if (!R.length) return `<div class="px ind" id="mk-ind"><span class="lbl">Pontos indicados pelo livro</span><p class="muted sm">${m.regiao ? `Não encontrei "${esc(m.regiao)}" na tabela de regiões.` : 'Sem região.'} Escreva ou escolha a região (ex.: ombro, lombar, joelho) para ver os pontos indicados.</p></div>`;
  const grupo = r => { const L = indicadosDaRegiao(r);
    return `<div class="ind-g" data-regiao="${esc(r)}"><span class="lbl">Indicados para ${esc(r).toLowerCase()} · ${L.length} ponto${L.length === 1 ? '' : 's'}</span>
      <div class="ind-l">${L.map(([c, pg]) => `<button class="ind-b${P.includes(c) ? ' on' : ''}${PT[c] ? '' : ' pend'}" data-act="at-mv-ptv" data-c="${esc(c)}" title="${esc(c)} · livro p. ${pg}${PT[c] ? ' · ' + esc(PT[c].pinyin) : ' · ficha pendente'}${P.includes(c) ? ' · no plano' : ''}"><b class="mono">${esc(c)}</b><small>p. ${pg}</small></button>`).join('')}</div></div>`; };
  return `<div class="px ind" id="mk-ind">${R.map(grupo).join('')}
    <p class="muted sm px-n">Toque num ponto para ver a ficha e incluir no plano. Em destaque, os que já estão no plano. Fonte: ${fonteInd()}</p></div>`;
}
function editorMarca(p, a, ant){
  const M = ui.mapa, todas = [...ant.flatMap(x => marcasDe(x).map(m => [m, x])), ...marcasDe(a).map(m => [m, a])], par = todas.find(([m]) => m.id === M.sel);
  if (!par) return `<div class="card" id="ed-mk"><div class="card-h"><h3>Marcação</h3></div><p class="muted sm">${a.status === 'rascunho' ? 'Escolha um tipo em "Marcar" e toque no corpo. Para editar, toque numa marcação no mapa ou escolha na lista abaixo.' : 'Toque numa marcação para ver os detalhes.'}</p></div>`;
  const [m, at] = par, ro = at !== a || a.status !== 'rascunho';
  const meta = `<div class="ed-meta">${ic('agenda')}<span>${fmt(m.data)}${m.criadaEm ? ' às ' + hhmm(m.criadaEm) : ''} · ${ordemNo(p, at)}º atendimento${at === a ? '' : ' (anterior)'}</span></div><div class="ed-meta">${ic('corpo')}<span>Vista ${vistaNome(m.vista, m.face)} · posição aproximada</span></div>`;
  const cab = `<div class="card-h"><h3><span class="ed-t">${iconeMarca(m.tipo)}${nomeMarca(m.tipo)}</span></h3>${ro ? `<span class="pill">${at === a ? 'no prontuário' : 'somente leitura'}</span>` : '<span class="pill acc">editando</span>'}</div>`;
  if (ro) return `<div class="card" id="ed-mk">${cab}${meta}
    <dl class="ed-dl"><dt>Lado</dt><dd>${nomeLado(m.lado)}</dd>${marcaComIntensidade(m.tipo) ? `<dt>Intensidade</dt><dd>${m.intensidade ?? 'não informada'}${m.intensidade != null ? ' de 10' : ''}</dd>` : `<dt>Procedimento</dt><dd>${esc(m.procedimento) || '—'}</dd>`}<dt>Região</dt><dd>${esc(m.regiao) || '—'}</dd><dt>Anotação</dt><dd>${esc(m.nota) || '—'}</dd></dl>
    ${indicadosMarca(p, a, m)}${proximosMarca(p, a, m)}
    <p class="muted sm">${at === a ? 'Registrada no prontuário com este atendimento.' : 'Marcação de outro atendimento, mostrada só para comparar. Ela não é alterada nem copiada.'}</p></div>`;
  return `<div class="card" id="ed-mk">${cab}${meta}
    ${indicadosMarca(p, a, m)}${proximosMarca(p, a, m)}
    <div class="form ed-f">
      <div class="field"><label class="lbl" for="mk-tipo">Tipo</label><select id="mk-tipo" data-mk="tipo">${TIPOS_MARCA.map(([k, n]) => `<option value="${k}" ${k === m.tipo ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label class="lbl" for="mk-lado">Lado do paciente</label><select id="mk-lado" data-mk="lado">${LADOS_MARCA.map(([k, n]) => `<option value="${k}" ${k === m.lado ? 'selected' : ''}>${n}</option>`).join('')}</select><small class="muted">Sugerido pela posição tocada.</small></div>
      ${marcaComIntensidade(m.tipo) ? `<div class="field full"><span class="lbl" id="mk-int-l">Intensidade (0 a 10)</span><div class="int-r" role="group" aria-labelledby="mk-int-l">${Array.from({ length:11 }, (_, n) => `<button class="int-b${m.intensidade === n ? ' on' : ''}" data-act="at-mk-int" data-n="${n}" aria-pressed="${m.intensidade === n}">${n}</button>`).join('')}</div><small class="muted" id="mk-int-v">${m.intensidade == null ? 'Não informada' : `Registrada: ${m.intensidade} de 10`}</small></div>`
        : `<div class="field full"><label class="lbl" for="mk-proc">Procedimento realizado</label><input id="mk-proc" data-mk="procedimento" value="${esc(m.procedimento)}" placeholder="Ex.: ventosa, moxabustão, acupuntura..."></div>`}
      ${m.tipo === 'irradiacao' ? `<div class="field full"><span class="lbl">Trajeto</span><div class="rad-s">${m.x2 != null ? `${ic('check')}Origem e destino marcados` : `${ic('alerta')}Falta o destino`}<button class="btn sm" data-act="at-mk-rad">${m.x2 != null ? 'Redesenhar destino' : 'Marcar destino'}</button></div></div>` : ''}
      <div class="field full"><label class="lbl" for="mk-reg">Região</label><input id="mk-reg" data-mk="regiao" value="${esc(m.regiao)}" list="mk-regioes" placeholder="Ex.: lombar, ombro, joelho"><small class="muted">Sugerida pelo local tocado. Pode mudar.</small></div>
      <div class="field full"><label class="lbl" for="mk-nota">Anotação</label><textarea id="mk-nota" data-mk="nota" placeholder="Como é, quando piora, o que melhora...">${esc(m.nota)}</textarea></div>
    </div>
    <datalist id="mk-regioes">${[...new Set([...REGIOES_CORPO, ...todas.map(([x]) => x.regiao).filter(Boolean)])].map(r => `<option value="${esc(r)}">`).join('')}</datalist>
    <div class="ed-a">${M.rm ? `<div class="rm-c" role="alert"><span>Remover esta marcação?</span><button class="btn sm crit" data-act="at-mk-rms">Sim, remover</button><button class="btn sm" data-act="at-mk-rmn">Cancelar</button></div>` : `<button class="btn sm" data-act="at-mk-rm">${ic('x')}Remover</button><button class="btn sm ghost" data-act="at-mk-ok">Concluir</button>`}</div></div>`;
}
const linhaMarcaAt = m => `<button class="mk-li${ui.mapa.sel === m.id ? ' on' : ''}" data-act="at-mk-sel" data-id="${esc(m.id)}">${iconeMarca(m.tipo)}<span class="grow"><b>${nomeMarca(m.tipo)}${m.regiao ? ' · ' + esc(m.regiao) : ''}</b><small>${nomeLado(m.lado)} · ${vistaNome(m.vista, m.face)}${marcaComIntensidade(m.tipo) ? ` · ${m.intensidade ?? '—'}/10` : m.procedimento ? ' · ' + esc(m.procedimento) : ''}</small></span></button>`;
// Valores registrados lado a lado, por tipo e região. Nada é calculado.
export function tabelaMarcas(p, ats, atual){
  const grupos = new Map();
  ats.forEach(at => marcasDe(at).forEach(m => { const k = m.tipo + '|' + (m.regiao || '').trim().toLowerCase(); if (!grupos.has(k)) grupos.set(k, { tipo:m.tipo, regiao:m.regiao || 'sem região', por:new Map() }); const g = grupos.get(k); g.por.set(at, [...(g.por.get(at) || []), m]); }));
  if (!grupos.size) return '';
  const val = L => !L ? '<span class="muted">—</span>' : L.map(m => marcaComIntensidade(m.tipo) ? (m.intensidade == null ? '✓' : `<b>${m.intensidade}</b>`) : esc(m.procedimento || '✓')).join(' · ');
  return `<div class="tbl-w"><table class="ev-t"><thead><tr><th>Marcação</th>${ats.map(at => `<th>${fmt(at.data).slice(0,5)}<small>${ordemNo(p, at)}º</small></th>`).join('')}</tr></thead>
    <tbody>${[...grupos.values()].map(g => `<tr><td><span class="ev-n">${iconeMarca(g.tipo)}<span>${nomeMarca(g.tipo)}<small>${esc(g.regiao)}</small></span></span></td>${ats.map(at => `<td class="${at === atual ? 'at' : ''}">${val(g.por.get(at))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
// Reaproveita a verificação de segurança do Plano, sem regra nova.
function avisosMapa(p, a){
  const w = a.plano.pontos.length ? pointWarnings(a.plano.pontos, p, a.plano.tec) : [];
  return w.length ? `<div class="mp-seg" id="mp-seg"><span class="lbl">${ic('escudo')}Verificação de segurança</span>${w.map(([k, m]) => `<div class="notice ${k === 'crit' ? 'crit' : ''}">${ic(k === 'crit' ? 'escudo' : 'alerta')}<div><b>${k === 'crit' ? 'Atenção' : 'Cautela'}</b> ${esc(m)}</div></div>`).join('')}</div>` : '';
}
// Ficha do ponto tocado no mapa: só o conteúdo que já está na Biblioteca clínica.
function fichaPontoMapa(p, a){
  const c = ui.mapa.pt, d = PT[c]; if (!CODIGOS.includes(c)) return '';
  const mer = d ? d.mer : meridianoDe(c), m = MER[mer], n = c.slice(mer.length), noPlano = a.plano.pontos.includes(c), rasc = a.status === 'rascunho';
  const w = d ? pointWarnings([c], p, a.plano.tec) : [], ind = regioesDoPonto(c);
  return `<div class="card" id="ficha-pt"><div class="card-h"><h3><span class="mono">${esc(c)}</span> · ${d ? esc(d.pinyin) : 'nome pendente'}<small>${m ? `Meridiano ${esc(m[0])} (${esc(mer)}) · ponto ${esc(n)}` : esc(mer)}</small></h3><button class="btn ghost sm" data-act="at-mv-ptf" aria-label="${ui.mapa.sel ? 'Voltar à marcação' : 'Fechar a ficha'}">${ui.mapa.sel ? 'Voltar' : ic('x')}</button></div>
    <dl class="ed-dl fp-dl"><dt>Meridiano</dt><dd>${m ? esc(m[0]) : '—'}</dd><dt>Número</dt><dd>${esc(n)}</dd>${d ? `<dt>Localização</dt><dd>${esc(d.loc)}</dd><dt>Ações</dt><dd>${esc(d.acoes)}</dd>${d.cautela ? `<dt>Cautela</dt><dd><span class="pill warn">${esc(CAUT[d.cautela] || d.cautela)}</span></dd>` : ''}` : ''}
      <dt>Indicado para</dt><dd>${ind.length ? `<span class="ind-r">${ind.map(([r, pg]) => `<span class="pill">${esc(r)} · p. ${pg}</span>`).join('')}</span>` : '<span class="muted">Nenhuma região aprovada na tabela.</span>'}</dd></dl>
    ${d ? '' : `<div class="notice" id="fp-pend">${ic('info')}<div><b>Ficha pendente na Biblioteca clínica.</b> Localização, ações e cautelas deste ponto ainda não foram cadastradas. Confira no livro${ind.length ? ` (p. ${ind[0][1]})` : ''} antes de usar.</div></div>`}
    ${w.map(([k, t]) => `<div class="notice ${k === 'crit' ? 'crit' : ''}">${ic(k === 'crit' ? 'escudo' : 'alerta')}<div><b>${k === 'crit' ? 'Atenção' : 'Cautela'}</b> ${esc(t)}</div></div>`).join('')}
    <div class="ed-a">${rasc ? `<button class="btn sm ${noPlano ? '' : 'pri'}" data-act="at-mv-ptx" data-c="${esc(c)}">${noPlano ? `${ic('x')}Tirar do plano` : `${ic('mais')}Incluir no plano`}</button>` : ''}${noPlano ? '<span class="pill acc">no plano</span>' : ''}</div>
    <small class="muted">${d ? 'Conteúdo da Biblioteca clínica. Posição no mapa aproximada.' : 'Sem ficha ainda.'}${ind.length ? ` Indicações: ${fonteInd()}` : ''}</small></div>`;
}
function eMapa(p, a){
  const M = ui.mapa, v = M.vista, f = faceMapa(v), [w, h] = TAM[v], rasc = a.status === 'rascunho';
  const ant = atendimentosAnteriores(p, a), anterior = ant.at(-1), antigos = ant.slice(0, -1);
  if (M.hist && !antigos.some(x => x.id === M.hist)) M.hist = '';
  const hist = antigos.find(x => x.id === M.hist);
  const minhas = marcasDe(a), P = a.plano.pontos, mSel = minhas.find(m => m.id === M.sel && naVistaMapa(m, v, f)), indM = new Set(mSel ? regioesDoTexto(mSel.regiao).flatMap(r => indicadosDaRegiao(r).map(([c]) => c)) : []), prox = mSel ? [...new Set([...pontosProximos(mSel), ...[...indM].filter(temPosicao)])].filter(c => !(M.plano && P.includes(c))) : [];
  const camadas = [
    hist ? marcasDe(hist).filter(m => naVistaMapa(m, v, f)).map(m => marcaSvg(m, 'hist', M.sel === m.id)).join('') : '',
    M.ant && anterior ? marcasDe(anterior).filter(m => naVistaMapa(m, v, f)).map(m => marcaSvg(m, 'ant', M.sel === m.id)).join('') : '',
    M.plano ? pontosSvg(P, v, f, c => 'plano' + (c === M.pt ? ' pt-on' : '')) : '',
    minhas.filter(m => naVistaMapa(m, v, f)).map(m => marcaSvg(m, 'at', M.sel === m.id)).join(''),
    pontosSvg(prox, v, f, c => (P.includes(c) ? 'plano' : 'disp') + ' prox' + (indM.has(c) ? ' ind' : '') + (c === M.pt ? ' pt-on' : ''))].join('');
  const zi = ZOOMS_MAPA.indexOf(M.zoom), com = P.filter(temPosicao), sem = P.filter(c => !temPosicao(c));
  const tabela = tabelaMarcas(p, [...ant.filter(x => marcasDe(x).length), a], a);
  return `<div class="notice">${ic('info')}<div><b>Posições aproximadas.</b> D e E são sempre o lado direito e o lado esquerdo <b>do paciente</b>, em todas as vistas.</div></div>
  <div class="grid g-side mp-g">
    <div class="card mp-card"><div class="card-h"><h3>Mapa corporal<small>${vistaNome(v, f)}</small></h3><span class="pill warn">aproximado</span></div>
      <div class="vbar" role="tablist" aria-label="Vistas do corpo">${VISTAS.map(([k, n]) => `<button class="vb${k === v ? ' on' : ''}" role="tab" aria-selected="${k === v}" data-act="at-mv-vista" data-v="${k}">${n}</button>`).join('')}</div>
      ${FACES[v] ? `<div class="seg-c vface" role="group" aria-label="Face">${FACES[v].map(([k, n]) => `<button class="${k === f ? 'on' : ''}" data-act="at-mv-face" data-f="${k}">${n}</button>`).join('')}</div>` : ''}
      <div class="ferr" role="group" aria-label="Marcar"><span class="lbl">Marcar</span>${TIPOS_MARCA.map(([k, n]) => `<button class="chip fr${M.ferr === k ? ' on' : ''}" data-act="at-mv-ferr" data-t="${k}" aria-pressed="${M.ferr === k}" ${rasc ? '' : 'disabled'}>${iconeMarca(k)}${n}</button>`).join('')}<button class="chip fr${M.ferr === 'sel' ? ' on' : ''}" data-act="at-mv-ferr" data-t="sel" aria-pressed="${M.ferr === 'sel'}">${ic('editar')}Selecionar</button></div>
      <p class="mp-dica" id="mp-dica">${dicaMapa(a)}</p>
      <div class="mp-ctl">
        <div class="zoom" role="group" aria-label="Ampliação"><button class="btn sm" data-act="at-mv-zoom" data-d="-1" aria-label="Diminuir" ${zi === 0 ? 'disabled' : ''}>−</button><span class="zoom-v">${Math.round(M.zoom * 100)}%</span><button class="btn sm" data-act="at-mv-zoom" data-d="1" aria-label="Ampliar" ${zi === ZOOMS_MAPA.length - 1 ? 'disabled' : ''}>${ic('mais')}</button></div>
        <div class="mp-cmp" role="group" aria-label="Comparar">
          <span class="chip on mp-at">${iconeMarca('dor')}Atual · ${fmt(a.data).slice(0,5)}</span>
          ${anterior ? `<button class="chip${M.ant ? ' on' : ''}" data-act="at-mv-ant" aria-pressed="${M.ant}">${iconeMarca('dor','ant')}Anterior · ${fmt(anterior.data).slice(0,5)}</button>` : ''}
          ${antigos.length ? `<label class="hist-l">${iconeMarca('dor','hist')}<select class="mini-sel" data-mvhist aria-label="Atendimento mais antigo"><option value="">Histórico: nenhum</option>${antigos.slice().reverse().map(x => `<option value="${x.id}" ${M.hist === x.id ? 'selected' : ''}>Histórico: ${fmt(x.data).slice(0,5)} (${ordemNo(p, x)}º)</option>`).join('')}</select></label>` : ''}
          <button class="chip${M.plano ? ' on' : ''}" data-act="at-mv-plano" aria-pressed="${M.plano}">Pontos do plano</button>
        </div>
      </div>
      <div class="mp-zoom"><svg class="mapa4${rasc && (M.ferr !== 'sel' || M.rad) ? ' marcando' : ''}${M.zoom > 1 ? ' ampliado' : ''}" data-mapa="atendimento" data-vista="${v}" data-face="${f}" viewBox="0 0 ${w} ${h}" style="width:${larguraMapa(v, M.zoom)}" role="img" aria-label="Mapa corporal, vista ${vistaNome(v, f)}">${desenho(v, f)}${camadas}</svg></div>
      <div class="legenda" aria-label="Legenda">${TIPOS_MARCA.map(([k, n]) => `<span>${iconeMarca(k)}${n}</span>`).join('')}<span class="lg-sep"></span>
        <span>${iconeMarca('dor','ant')}Atendimento anterior</span><span>${iconeMarca('dor','hist')}Histórico</span>
        <span><svg viewBox="0 0 20 20" class="lg-i" aria-hidden="true"><g class="ptp plano"><circle cx="10" cy="10" r="4.5"/></g></svg>Ponto do plano</span><span><svg viewBox="0 0 20 20" class="lg-i" aria-hidden="true"><g class="ptp disp"><circle cx="10" cy="10" r="4.5"/></g></svg>Ponto próximo da marcação</span>
        <span><svg viewBox="0 0 20 20" class="lg-i mk" style="--c:var(--crit)" aria-hidden="true"><g class="esp"><circle cx="10" cy="10" r="6"/></g></svg>Lado espelhado (bilateral)</span></div>
    </div>
    <aside class="grid" style="align-content:start">${ui.mapa.pt && CODIGOS.includes(ui.mapa.pt) ? fichaPontoMapa(p, a) : editorMarca(p, a, ant)}
      <div class="card"><div class="card-h"><h3>Marcações deste atendimento<small>${fmt(a.data)} · ${ordemNo(p, a)}º atendimento</small></h3><span class="pill">${minhas.length}</span></div>
        <div class="mk-l">${minhas.map(linhaMarcaAt).join('') || '<p class="muted sm">Nenhuma marcação ainda.</p>'}</div></div>
      <div class="card" id="plano-mapa"><div class="card-h"><h3>Pontos do plano<small>os mesmos do Plano terapêutico deste atendimento</small></h3>${P.length ? `<span class="pill acc">${P.length}</span>` : ''}</div>
        ${P.length ? `<div class="pp"><span class="lbl">No mapa</span><div class="chips">${com.map(c => `<span class="pill pp-c">${esc(c)}<small>${vistasDoPonto(c).join(', ')}</small></span>`).join('') || '<span class="muted sm">nenhum</span>'}</div></div>
        <div class="pp" id="sem-posicao"><span class="lbl">Sem posição no mapa</span><div class="chips">${sem.map(c => `<span class="pill warn pp-c">${esc(c)}</span>`).join('') || '<span class="muted sm">nenhum</span>'}</div></div>` : `<p class="muted sm">Os pontos escolhidos no Plano terapêutico aparecem aqui e no mapa.${rasc ? ' Também dá para incluir pelos pontos próximos de uma marcação.' : ''}</p>`}${avisosMapa(p, a)}</div>
      ${tabela ? `<div class="card" id="mk-evolucao"><div class="card-h"><h3>Comparação entre atendimentos<small>valores registrados, lado a lado, sem cálculo</small></h3></div>${tabela}<small class="muted">Intensidade de 0 a 10 nos sintomas e limitações; nome do procedimento quando houver.</small></div>` : ''}
      <div class="card"><div class="field"><label class="lbl" for="at-mapa">Observações do mapa corporal</label><textarea id="at-mapa" data-atf="mapa" placeholder="Cicatrizes, áreas sensíveis, outras observações...">${esc(a.mapa?.nota || '')}</textarea></div></div>
    </aside></div>`;
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
    <div class="grid" style="align-content:start">${(()=>{ const L=encaminhados(av,'plano'); return `<div class="card"><div class="card-h"><h3>Trazido pelo profissional</h3><span class="muted sm">só o que foi marcado como "Plano"</span></div>
      ${L.length?L.map(([c,nome,I])=>I.map(it=>`<div class="sx-i"><div class="grow"><b>${esc(it.texto)}</b><small class="muted">${nome}</small></div><button class="btn sm ghost" data-act="at-levar" data-cat="${c}" data-id="${it.id}" data-dest="plano">${ic('x')}Retirar</button></div>`).join('')).join(''):`<p class="muted sm">Nada encaminhado. Marque "Plano" num achado da avaliação para ele aparecer aqui.</p>`}</div>`; })()}
    ${dicasTratamento(p,a)}
    <div class="card"><h3>Sugestões dos padrões validados</h3><p class="muted sm" style="margin-bottom:10px">Toque para incluir. A escolha é do profissional.</p>
      ${ac.length?ac.map(h=>`<div class="sug"><div class="sug-h">${elTag(h.p.el)}<b>${h.p.nome}</b></div><div class="chips">${h.p.pontos.map(([c,j])=>`<button class="chip mono ${P.includes(c)?'on':''}" data-act="at-pt" data-c="${c}" title="${esc(j)}${PT[c]?.cautela?' · '+esc(CAUT[PT[c].cautela]):''}">${c}${PT[c]?.cautela?' ⚠':''}</button>`).join('')}</div></div>`).join(''):`<div class="vazio">${ic('info')}Aceite hipóteses na avaliação para ver sugestões.</div>`}</div></div></div>`;
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
