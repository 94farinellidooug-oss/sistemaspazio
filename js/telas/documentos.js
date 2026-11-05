// Tela Documentos (etapa 6B): paciente + modelo, texto já preenchido e ajustável, imprimir e guardar
// no prontuário; lista dos documentos do paciente com a marcação de termo assinado.
import { CLINICA, MODELOS_DOC, faltaModelo, modeloDoc, textoModelo } from '../dados/documentos.js';
import { db, patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { LOGO, ic } from '../componentes/icones.js';
import { PROF } from './menu.js';
import { TODAY, esc, fmt } from '../util.js';

// Paciente e modelo escolhidos, e o texto (o preenchido ou o que foi ajustado na folha).
export function docAtual(){
  const p = patient(ui.docPid) || patient(ui.pid) || db.patients[0];
  const k = modeloDoc(ui.docMod) ? ui.docMod : MODELOS_DOC[0][0];
  const texto = ui.docTexto ?? textoModelo(k, p || { name:'', atendimentos:[], queixas:[] }, { appts:db.appts, hoje:TODAY, prof:PROF.nome });
  return { p, k, texto };
}
const paragrafos = t => esc(t).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');
const assinatura = (k, p) => modeloDoc(k)[3] ? `<div class="dp-as"><span></span><small>${esc(p.name)}</small></div>` : '';
// Folha impressa: cabeçalho, texto, linha de assinatura do paciente (termo) e o profissional.
export function folhaDoc(k, p, texto, data = TODAY, por = PROF.nome){
  return `<div class="imp-h">${LOGO}<div><b>${modeloDoc(k)[1]}</b><small>${CLINICA} · ${fmt(data)}</small></div></div><div class="imp-t">${paragrafos(texto)}</div>${assinatura(k, p)}<div class="imp-a">${esc(por)}</div>`;
}

export function vDocumentos(){
  if (!db.patients.length) return `<div class="head"><div><h1>Documentos</h1><p>Cadastre um paciente para gerar documentos.</p></div></div>`;
  const { p, k, texto } = docAtual(), m = modeloDoc(k), meus = p.documentos || [], falta = !texto.trim() && faltaModelo(k);
  return `<div class="head"><div><h1>Documentos</h1><p>Escolha o paciente e o modelo; o resto vem preenchido</p></div></div>
  <div class="grid g-side ag-cols"><div class="card" id="doc-novo"><div class="card-h"><h2>Novo documento<small>${esc(p.name)} · ${m[1].toLowerCase()}</small></h2></div>
      <label class="rx-f" style="max-width:360px"><span class="lbl">Paciente</span><select id="doc-p" data-docp="1">${db.patients.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <div class="doc-m" role="group" aria-label="Modelo">${MODELOS_DOC.map(([c,n,i])=>`<button class="${c===k?'on':''}" data-act="doc-mod" data-m="${c}" aria-pressed="${c===k}">${ic(i)}<span>${n}</span></button>`).join('')}</div>
      ${falta ? `<div class="notice">${ic('info')}<div>${falta} Você pode escrever o texto direto na folha.</div></div>` : ''}
      <div class="doc-pv" id="doc-pv"><div class="dp-h">${LOGO}<div><b>${m[1]}</b><small>${CLINICA} · ${fmt(TODAY)}</small></div></div>
        <div class="dp-t" id="doc-t" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Texto do documento">${paragrafos(texto)}</div>${assinatura(k, p)}<div class="dp-p">${esc(PROF.nome)}</div></div>
      <small class="muted">Dá para ajustar o texto direto na folha antes de imprimir. <button class="lk-s" data-act="doc-refazer" ${ui.docTexto==null?'hidden':''}>Voltar ao texto do modelo</button></small>
      <div class="rx-a"><button class="btn pri" data-act="doc-imp">${ic('doc')}Imprimir</button><button class="btn" data-act="doc-guardar">${ic('check')}Guardar no prontuário</button></div></div>
    <div class="grid" style="align-content:start"><div class="card" id="doc-lista"><div class="card-h"><h2>Documentos de ${esc(p.name.split(' ')[0])}<small>ficam no prontuário</small></h2><span class="pill">${meus.length}</span></div>
      ${meus.length ? `<div class="doc-l">${meus.map(d=>{ const md=modeloDoc(d.modelo); return `<div class="doc-li" data-doc="${d.id}"><span class="tico sm">${ic(md[2])}</span><div class="grow"><b>${md[1]}</b><small>${fmt(d.em.slice(0,10))} · ${esc(d.por)}${d.assinado?` · assinado, marcado em ${fmt(d.assinadoEm.slice(0,10))}`:''}</small></div>
        ${md[3] ? (d.assinado ? `<span class="pill ok">${ic('check')}assinado</span>` : `<button class="btn sm" data-act="doc-ass" data-id="${d.id}">${ic('assinatura')}Marcar assinado</button>`) : ''}<button class="btn sm ghost" data-act="doc-reimp" data-id="${d.id}" aria-label="Imprimir de novo" data-tip="Imprimir de novo">${ic('doc')}</button></div>`; }).join('')}</div>` : '<p class="muted sm">Nenhum documento guardado ainda.</p>'}</div>
      <div class="card"><h2>Assinatura</h2><p class="muted sm">Por enquanto o termo é impresso, assinado no papel e marcado aqui como assinado. A assinatura pelo celular, por um serviço externo, vamos escolher juntos na etapa 7.</p>
        <p class="muted sm" style="margin-top:8px">Os textos dos modelos são exemplos; você vai poder trocar pelos seus em Configurações.</p></div></div></div>`;
}
