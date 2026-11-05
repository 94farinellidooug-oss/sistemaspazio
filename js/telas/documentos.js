// Tela Documentos (etapa 6B): paciente + modelo, prévia já preenchida, imprimir e guardar no prontuário;
// lista dos documentos do paciente com a marcação de termo assinado.
// Os modelos são editados na própria página, num campo comum, com botões para inserir os dados do
// sistema (proposta/modelos, aprovada pelo Maicon em 05/11). A folha é só prévia: não se edita ali.
import { CAMPOS_DOC, CLINICA, faltaModelo, modeloDoc, modelosDoc, preencherDoc, valoresDoc } from '../dados/documentos.js';
import { db, patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { LOGO, ic } from '../componentes/icones.js';
import { PROF } from './menu.js';
import { btnWa } from './whatsapp.js';
import { TODAY, dataLocal, esc, fmt, horaLocal } from '../util.js';

const ctxDoc = () => ({ appts:db.appts, hoje:TODAY, prof:PROF.nome });
// Paciente e modelo escolhidos, e o que vai na folha (o modelo em edição, se houver).
export function docAtual(){
  const p = patient(ui.docPid) || patient(ui.pid) || db.patients[0];
  const m = modeloDoc(ui.docMod, db.modelosDoc) || modelosDoc(db.modelosDoc)[0], E = ui.docEd;
  const nome = E ? E.nome.trim() || 'Sem nome' : m[1], assina = E ? E.assina : m[3];
  const texto = p ? preencherDoc(E ? E.texto : m[4], valoresDoc(p, ctxDoc())) : '';
  const A = ui.docAss, ass = !E && assina && A && p && A.pid === p.id && A.k === m[0] ? A : null;
  return { p, k:m[0], m, nome, assina, texto, ass };
}
const paragrafos = t => esc(t).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');
// O texto do modelo com os dados do sistema destacados.
const comCampos = t => paragrafos(t).replace(/\{(\w+)\}/g, (s, k) => { const c = CAMPOS_DOC.find(x => x[0] === k); return c ? `<span class="cp">${c[1]}</span>` : s; });
// Linha de assinatura do paciente; assinada na tela, leva a imagem e quando foi assinada.
const assinatura = (assina, p, ass) => assina ? `<div class="dp-as">${ass ? `<img class="ass-img" src="${ass.img}" alt="Assinatura de ${esc(p.name)}">` : ''}<span></span><small>${esc(p.name)}${ass ? ` · assinado na tela em ${dataLocal(ass.em)} às ${horaLocal(ass.em)}` : ''}</small></div>` : '';
// Folha impressa: cabeçalho, texto, linha de assinatura do paciente (quando o modelo pede) e o profissional.
export function folhaDoc(nome, assina, p, texto, data = TODAY, por = PROF.nome, ass = null){
  return `<div class="imp-h">${LOGO}<div><b>${esc(nome)}</b><small>${CLINICA} · ${fmt(data)}</small></div></div><div class="imp-t">${paragrafos(texto)}</div>${assinatura(assina, p, ass)}<div class="imp-a">${esc(por)}</div>`;
}
// Prévia (só para conferir) e o texto do modelo com os dados destacados: atualizadas enquanto se digita.
export function previaDoc(){
  const { p, nome, assina, texto, ass } = docAtual();
  return `<div class="dp-h">${LOGO}<div><b>${esc(nome)}</b><small>${CLINICA} · ${fmt(TODAY)}</small></div></div>
    <div class="dp-t" id="doc-t">${paragrafos(texto)}</div>${assinatura(assina, p, ass)}<div class="dp-p">${esc(PROF.nome)}</div>`;
}
export const textoComCampos = () => comCampos(ui.docEd?.texto || '');

function formModelo(){
  const E = ui.docEd, m = !E.novo && modeloDoc(ui.docMod, db.modelosDoc);
  return `<form class="card" id="f-mod"><div class="card-h"><h2>${E.novo ? 'Novo modelo' : 'Editar modelo'}<small>vale para os próximos documentos; os já guardados não mudam</small></h2></div>
    <label class="rx-f full"><span class="lbl">Nome do modelo</span><input id="m-nome" data-doced="nome" value="${esc(E.nome)}" required autocomplete="off"></label>
    <div class="lbl" style="margin:12px 0 6px">Inserir dado do sistema</div>
    <div class="chips cps" id="m-campos">${CAMPOS_DOC.map(([k, n]) => `<button type="button" class="chip" data-act="doc-campo" data-k="${k}">${ic('mais')}${n}</button>`).join('')}</div>
    <label class="rx-f full" style="margin-top:10px"><span class="lbl">Texto</span><textarea id="m-texto" data-doced="texto" rows="9">${esc(E.texto)}</textarea></label>
    <small class="muted dica">Deixe uma linha em branco para começar outro parágrafo. Os dados entre chaves são preenchidos sozinhos com o paciente escolhido.</small>
    <label class="ck" style="margin-top:10px"><input type="checkbox" id="m-assina" data-doced="assina" ${E.assina ? 'checked' : ''}> Pede assinatura do paciente</label>
    <div class="rx-a"><div class="chips"><button class="btn pri">${ic('check')}Salvar modelo</button><button type="button" class="btn" data-act="doc-ed-x">Cancelar</button></div>
      ${m && m[5] === 'editado' ? `<button type="button" class="btn ghost sm" data-act="doc-ed-orig">${ic('retorno')}Voltar ao texto original</button>` : ''}
      ${m && m[5] === 'proprio' ? `<button type="button" class="btn ghost sm" data-act="doc-ed-apagar">${ic('x')}Apagar modelo</button>` : ''}</div></form>`;
}

export function vDocumentos(){
  if (!db.patients.length) return `<div class="head"><div><h1>Documentos</h1><p>Cadastre um paciente para gerar documentos.</p></div></div>`;
  const { p, k, m, texto, assina, ass } = docAtual(), E = ui.docEd, L = modelosDoc(db.modelosDoc), meus = p.documentos || [];
  const falta = !E && !texto && (faltaModelo(k) || 'O modelo ficou sem texto.');
  const situacao = s => s === 'proprio' ? '<span class="pill acc">criado por você</span>' : s === 'editado' ? '<span class="pill acc">editado</span>' : '<span class="pill">original</span>';
  return `<div class="head"><div><h1>Documentos</h1><p>Escolha o paciente e o modelo; o resto vem preenchido</p></div></div>
  <div class="grid g-side ag-cols"><div class="grid" style="align-content:start">
    ${E ? formModelo() : `<div class="card" id="doc-novo"><div class="card-h"><h2>Novo documento<small>${esc(p.name)} · ${esc(m[1].toLowerCase())}</small></h2></div>
      <label class="rx-f" style="max-width:360px"><span class="lbl">Paciente</span><select id="doc-p" data-docp="1">${db.patients.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <div class="doc-m" role="group" aria-label="Modelo">${L.map(([c,n,i,,,s])=>`<button class="${c===k?'on':''}" data-act="doc-mod" data-m="${c}" aria-pressed="${c===k}">${ic(i)}<span>${esc(n)}</span>${s!=='original'?'<i class="pill acc">seu</i>':''}</button>`).join('')}
        <button class="novo" data-act="doc-novo-mod">${ic('mais')}<span>Novo modelo</span></button></div>
      ${falta ? `<div class="notice">${ic('info')}<div>${falta}</div></div>` : ''}
      <div class="rx-a"><div class="chips">${assina ? `<button class="btn pri" data-act="doc-assinar" ${ass ? 'disabled' : ''}>${ic('assinatura')}${ass ? 'Assinado na tela' : 'Assinar na tela'}</button>` : ''}<button class="btn ${assina ? '' : 'pri'}" data-act="doc-imp">${ic('doc')}Imprimir</button><button class="btn" data-act="doc-guardar">${ic('check')}Guardar no prontuário</button>${k==='orientacoes' && texto ? btnWa('orientacoes', p.id) : ''}</div>
        <button class="btn ghost" data-act="doc-editar">${ic('editar')}Editar este modelo</button></div></div>`}
    <div class="card" id="doc-pv-card"><div class="card-h"><h2>Prévia<small>${esc(p.name)} · só para conferir; o texto se muda no modelo</small></h2></div>
      <div class="doc-pv" id="doc-pv">${previaDoc()}</div></div>
  </div><div class="grid" style="align-content:start">
    ${E ? `<div class="card"><h2>Como fica o texto</h2><div class="mod-raw" id="mod-raw">${textoComCampos()}</div><p class="muted sm">Os quadros verdes são preenchidos pelo sistema.</p></div>` : ''}
    <div class="card" id="doc-lista"><div class="card-h"><h2>Documentos de ${esc(p.name.split(' ')[0])}<small>ficam no prontuário</small></h2><span class="pill">${meus.length}</span></div>
      ${meus.length ? `<div class="doc-l">${meus.map(d=>{ const md=modeloDoc(d.modelo, db.modelosDoc), nome=d.nome||md?.[1]||'Documento', assina=d.assina??md?.[3]; return `<div class="doc-li" data-doc="${d.id}"><span class="tico sm">${ic(md?.[2]||'doc')}</span><div class="grow"><b>${esc(nome)}</b><small>${fmt(d.em.slice(0,10))} · ${esc(d.por)}${d.assinado?(d.naTela?` · assinado na tela em ${dataLocal(d.assinadoEm)} às ${horaLocal(d.assinadoEm)}`:` · assinado, marcado em ${fmt(d.assinadoEm.slice(0,10))}`):''}</small></div>
        ${assina ? (d.assinado ? `<span class="pill ok">${ic('check')}${d.naTela?'assinado na tela':'assinado'}</span>` : `<button class="btn sm" data-act="doc-ass" data-id="${d.id}">${ic('assinatura')}Marcar assinado</button>`) : ''}<button class="btn sm ghost" data-act="doc-reimp" data-id="${d.id}" aria-label="Imprimir de novo" data-tip="Imprimir de novo">${ic('doc')}</button></div>`; }).join('')}</div>` : '<p class="muted sm">Nenhum documento guardado ainda.</p>'}</div>
    <div class="card" id="doc-modelos"><h2>Seus modelos</h2><p class="muted sm">Os textos são editados aqui na página e ficam salvos como <b>seus</b>. Cada profissional terá os próprios modelos quando o sistema tiver login (etapa 10).</p>
      <ul class="ev-l mod-l">${L.map(([,n,i,,,s])=>`<li>${ic(i)}<span class="grow">${esc(n)}</span>${situacao(s)}</li>`).join('')}</ul></div>
    <div class="card"><h2>Assinatura</h2><p class="muted sm">Em <b>Assinar na tela</b>, o paciente assina com o dedo no celular ou tablet; ao guardar, a assinatura fica no documento com a data, a hora e quem conduziu. É uma assinatura eletrônica simples. Se preferir, continue imprimindo, assinando no papel e marcando aqui como assinado.</p></div></div></div>`;
}

// Quadro de assinatura sobre a tela: o paciente assina com o dedo (ou o mouse).
export function painelAss(){
  const { p, nome } = docAtual(); if (!p) return '';
  return `<div class="veu"></div><div class="pal wa-p ass-p" role="dialog" aria-modal="true" aria-label="Assinatura na tela">
    <div class="card-h"><h3>${ic('assinatura')}Assinatura de ${esc(p.name)}<small>${esc(nome)} · ${fmt(TODAY)}</small></h3></div>
    <p class="muted sm">Entregue o aparelho ao paciente. Ele assina com o dedo no quadro abaixo.</p>
    <canvas id="ass-c" width="640" height="220" aria-label="Quadro de assinatura"></canvas>
    <div class="rx-a"><button class="btn pri" data-act="ass-ok" disabled>${ic('check')}Confirmar assinatura</button><div class="chips"><button class="btn" data-act="ass-limpar">Limpar</button><button class="btn ghost" data-act="fechar">Cancelar</button></div></div></div>`;
}
export function ligarPad(){
  const c = document.getElementById('ass-c'); if (!c) return;
  const g = c.getContext('2d'); let des = false;
  g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1d1d1b';
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { des = true; c.setPointerCapture?.(e.pointerId); g.beginPath(); g.moveTo(...pt(e)); e.preventDefault(); });
  c.addEventListener('pointermove', e => { if (!des) return; g.lineTo(...pt(e)); g.stroke(); document.querySelector('[data-act="ass-ok"]').disabled = false; });
  const fim = () => { des = false; }; c.addEventListener('pointerup', fim); c.addEventListener('pointercancel', fim);
}
