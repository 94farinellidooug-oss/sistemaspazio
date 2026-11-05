// Proposta navegável: modelos de documento editados na própria página (pedido do Maicon em 05/11).
// O texto de cada modelo é editado num campo comum, com botões para inserir os dados que o sistema
// preenche ({paciente}, {data} etc.). A folha passa a ser só a prévia: não se edita mais ali.
// Cada profissional guarda os seus modelos; dá para criar modelos novos. Dados fictícios.
import { LOGO, ic } from '../../js/componentes/icones.js';
import { esc, fmt } from '../../js/util.js';

const PROF = 'Maicon Farinelli', CLINICA = 'Spazio Stabilità', HOJE = '2026-11-05';
const PAC = [{ id:'p1', nome:'Marina Costa', cpf:'123.456.789-00' }, { id:'p2', nome:'João Pereira', cpf:'' }, { id:'p3', nome:'Helena Souza', cpf:'987.654.321-00' }];
// Dados que o sistema preenche: [campo, rótulo, exemplo]
const CAMPOS = [['paciente','Paciente'], ['cpf','CPF do paciente'], ['data','Data de hoje'], ['horario','Horário de hoje'], ['profissional','Profissional'], ['clinica','Clínica'], ['orientacoes','Orientações do atendimento'], ['registro','Registro do atendimento']];
const valores = p => ({ paciente:p.nome, cpf:p.cpf || '(sem CPF)', data:fmt(HOJE), horario:'das 09:00 às 10:00', profissional:PROF, clinica:CLINICA,
  orientacoes:'Compressa morna na nuca à noite.\nEvitar telas uma hora antes de dormir.', registro:'Atendimento de 22/10/2026 · Acupuntura, Moxabustão.\nPontos realizados: VB20 (bilateral); F3 (bilateral); VG20 (linha média).' });
const ORIGINAIS = {
  termo:['Termo de consentimento', 'assinatura', true, 'Eu, {paciente}, declaro que fui informado(a) por {profissional} sobre o tratamento com acupuntura e técnicas associadas, seus objetivos e possíveis reações, e que tive minhas dúvidas esclarecidas.\n\nInformei corretamente minhas condições de saúde e os medicamentos em uso, e sei que posso interromper o tratamento quando quiser.'],
  declaracao:['Declaração de comparecimento', 'doc_id', false, 'Declaro, para os devidos fins, que {paciente} esteve em atendimento na {clinica} no dia {data}, {horario}.'],
  orientacoes:['Orientações para casa', 'folha', false, '{orientacoes}'],
  registro:['Registro do atendimento', 'doc', false, '{registro}']
};
const copia = () => Object.fromEntries(Object.entries(ORIGINAIS).map(([k, [n, i, a, t]]) => [k, { nome:n, ic:i, assina:a, texto:t, proprio:false }]));
const S = { aberto:false, pid:'p1', mod:'termo', modelos:copia(), ed:null, seq:0, alterados:new Set() };

const preencher = (t, p) => { const v = valores(p); return t.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m); };
const paragrafos = t => esc(t).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');
const comCampos = t => paragrafos(t).replace(/\{(\w+)\}/g, (m, k) => { const c = CAMPOS.find(x => x[0] === k); return c ? `<span class="cp">${c[1]}</span>` : m; });

function vDocumentos(){
  const p = PAC.find(x => x.id === S.pid), m = S.modelos[S.mod], E = S.ed;
  return `<div class="grid g-side ag-cols"><div class="grid" style="align-content:start">
    ${E ? `<form class="card" id="f-mod"><div class="card-h"><h3>${E.novo ? 'Novo modelo' : 'Editar modelo'}<small>vale para os próximos documentos; os já guardados não mudam</small></h3></div>
      <label class="rx-f full"><span class="lbl">Nome do modelo</span><input id="m-nome" data-e="nome" value="${esc(E.nome)}" required></label>
      <div class="lbl" style="margin:12px 0 6px">Inserir dado do sistema</div>
      <div class="chips cps" id="m-campos">${CAMPOS.map(([k, n]) => `<button type="button" class="chip" data-a="campo" data-k="${k}">${ic('mais')}${n}</button>`).join('')}</div>
      <label class="rx-f full" style="margin-top:10px"><span class="lbl">Texto</span><textarea id="m-texto" data-e="texto" rows="9">${esc(E.texto)}</textarea></label>
      <small class="muted">Deixe uma linha em branco para começar outro parágrafo. Os dados entre chaves são preenchidos sozinhos com o paciente escolhido.</small>
      <label class="ck" style="margin-top:10px"><input type="checkbox" id="m-assina" data-e="assina" ${E.assina ? 'checked' : ''}> Pede assinatura do paciente</label>
      <div class="rx-a"><div class="chips"><button class="btn pri">${ic('check')}Salvar modelo</button><button type="button" class="btn" data-a="ed-x">Cancelar</button></div>
        ${!E.novo && !S.modelos[S.mod].proprio && S.alterados.has(S.mod) ? `<button type="button" class="btn ghost sm" data-a="ed-orig">${ic('retorno')}Voltar ao texto original</button>` : ''}
        ${!E.novo && S.modelos[S.mod].proprio ? `<button type="button" class="btn ghost sm" data-a="ed-apagar">${ic('x')}Apagar modelo</button>` : ''}</div></form>`
    : `<div class="card" id="doc-novo"><div class="card-h"><h3>Novo documento<small>escolha o paciente e o modelo; o resto vem preenchido</small></h3></div>
      <label class="rx-f" style="max-width:340px"><span class="lbl">Paciente</span><select id="d-p">${PAC.map(x => `<option value="${x.id}" ${x.id === S.pid ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
      <div class="doc-m" role="group" aria-label="Modelo">${Object.entries(S.modelos).map(([k, x]) => `<button class="${k === S.mod ? 'on' : ''}" data-a="mod" data-m="${k}" aria-pressed="${k === S.mod}">${ic(x.ic)}<span>${esc(x.nome)}</span>${S.alterados.has(k) || x.proprio ? '<i class="pill acc">seu</i>' : ''}</button>`).join('')}
        <button class="novo" data-a="novo">${ic('mais')}<span>Novo modelo</span></button></div>
      <div class="rx-a"><div class="chips"><button class="btn pri" data-a="imp">${ic('doc')}Imprimir</button><button class="btn" data-a="guardar">${ic('check')}Guardar no prontuário</button></div>
        <button class="btn ghost" data-a="editar">${ic('editar')}Editar este modelo</button></div></div>`}
    <div class="card" id="doc-pv-card"><div class="card-h"><h3>Prévia<small>${esc(p.nome)} · só para conferir, não se edita aqui</small></h3></div>
      <div class="doc-pv" id="doc-pv"><div class="dp-h">${LOGO}<div><b>${esc(E ? E.nome || 'Sem nome' : m.nome)}</b><small>${CLINICA} · ${fmt(HOJE)}</small></div></div>
        <div class="dp-t">${paragrafos(preencher(E ? E.texto : m.texto, p))}</div>${(E ? E.assina : m.assina) ? `<div class="dp-as"><span></span><small>${esc(p.nome)}</small></div>` : ''}<div class="dp-p">${PROF}</div></div></div>
  </div><div class="grid" style="align-content:start">
    <div class="card"><h3>Seus modelos</h3><p class="muted sm">Os textos são editados aqui na página, num campo comum, e ficam salvos como <b>seus</b>. Cada profissional terá os próprios modelos quando o sistema tiver login (etapa 10).</p>
      <ul class="ev-l mod-l">${Object.entries(S.modelos).map(([k, x]) => `<li>${ic(x.ic)}<span class="grow">${esc(x.nome)}</span>${x.proprio ? '<span class="pill acc">criado por você</span>' : S.alterados.has(k) ? '<span class="pill acc">editado</span>' : '<span class="pill">original</span>'}</li>`).join('')}</ul></div>
    ${E ? `<div class="card"><h3>Como fica o texto</h3><div class="mod-raw">${comCampos(E.texto)}</div><p class="muted sm">Os quadros verdes são preenchidos pelo sistema.</p></div>` : ''}
  </div></div>`;
}

function menu(){
  const NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
  document.querySelector('.app').classList.toggle('open', S.aberto);
  document.getElementById('nav').innerHTML = `<div class="brand">${LOGO}<div><b>Musubi</b><small>Gestão clínica integrativa</small></div></div>` +
    NAV.map(([k, l, i]) => `<a href="#/documentos" ${k === 'documentos' ? '' : 'data-a="fora"'} aria-label="${l}" class="${k === 'documentos' ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  document.getElementById('topbar').innerHTML = `<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button><a class="tb-logo" href="#/documentos">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho"><span>Documentos</span>${S.ed ? `${ic('dir')}<span>${S.ed.novo ? 'Novo modelo' : 'Editar modelo'}</span>` : ''}</nav><div class="tb-r"><span class="pill acc">Proposta · modelos</span></div>`;
}
function render(manter){
  const y = scrollY; menu();
  document.getElementById('view').innerHTML = `<div class="et-h"><span class="tico acc">${ic('doc')}</span><div class="grow"><h2>Documentos</h2><small class="muted">Modelos editados na própria página</small></div></div>` + vDocumentos();
  if (manter) scrollTo(0, y);
}
function toast(m, k = 'ok'){ const t = document.getElementById('toast'); t.className = 'toast ' + k; t.innerHTML = `${ic(k === 'ok' ? 'okc' : 'info')}<span></span>`; t.lastChild.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
// Atualiza só a prévia ao digitar, para não perder o cursor do campo de texto.
function previa(){ const v = document.getElementById('view'), html = vDocumentos(), tmp = document.createElement('div'); tmp.innerHTML = html;
  ['#doc-pv', '.mod-raw'].forEach(s => { const a = v.querySelector(s), b = tmp.querySelector(s); if (a && b) a.innerHTML = b.innerHTML; }); }

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
  if (a === 'mod') { S.mod = t.dataset.m; render(true); }
  else if (a === 'editar') { const m = S.modelos[S.mod]; S.ed = { nome:m.nome, texto:m.texto, assina:m.assina }; render(true); }
  else if (a === 'novo') { S.ed = { novo:true, nome:'', texto:'Eu, {paciente}, ', assina:true }; render(true); document.getElementById('m-nome').focus(); }
  else if (a === 'ed-x') { S.ed = null; render(true); }
  else if (a === 'ed-orig') { const [n, , as, tx] = ORIGINAIS[S.mod]; S.ed = { nome:n, texto:tx, assina:as }; render(true); toast('Texto original de volta; salve para confirmar', 'info'); }
  else if (a === 'ed-apagar') { const n = S.modelos[S.mod].nome; delete S.modelos[S.mod]; S.mod = 'termo'; S.ed = null; render(true); toast(`Modelo “${n}” apagado; documentos já guardados continuam no prontuário`, 'info'); }
  else if (a === 'campo') { const ta = document.getElementById('m-texto'), k = `{${t.dataset.k}}`, i = ta.selectionStart ?? ta.value.length, f = ta.selectionEnd ?? i;
    ta.value = ta.value.slice(0, i) + k + ta.value.slice(f); S.ed.texto = ta.value; ta.focus(); ta.setSelectionRange(i + k.length, i + k.length); previa(); }
  else if (a === 'imp') { document.getElementById('imp').innerHTML = document.getElementById('doc-pv').innerHTML; window.print(); }
  else if (a === 'guardar') toast(`${S.modelos[S.mod].nome} guardado no prontuário de ${PAC.find(x => x.id === S.pid).nome.split(' ')[0]}`);
  else if (a === 'menu-abrir') { S.aberto = !S.aberto; render(true); }
  else if (a === 'fora') { ev.preventDefault(); toast('Nesta proposta só os Documentos são navegáveis', 'info'); }
});
document.addEventListener('input', ev => { const t = ev.target; if (!S.ed || !t.dataset.e) return; S.ed[t.dataset.e] = t.type === 'checkbox' ? t.checked : t.value; previa(); });
document.addEventListener('change', ev => { const t = ev.target;
  if (t.id === 'd-p') { S.pid = t.value; render(true); }
  if (t.id === 'm-assina') { S.ed.assina = t.checked; previa(); render(true); } });
document.addEventListener('submit', ev => { ev.preventDefault(); const E = S.ed; if (!E) return;
  if (!E.nome.trim() || !E.texto.trim()) { toast('Dê um nome e escreva o texto do modelo', 'info'); return; }
  if (E.novo) { const k = 'm' + (++S.seq); S.modelos[k] = { nome:E.nome.trim(), ic:'doc', assina:E.assina, texto:E.texto, proprio:true }; S.mod = k; toast('Modelo criado'); }
  else { Object.assign(S.modelos[S.mod], { nome:E.nome.trim(), texto:E.texto, assina:E.assina }); const [n, , as, tx] = ORIGINAIS[S.mod] || [];
    if (n === E.nome.trim() && tx === E.texto && as === E.assina) S.alterados.delete(S.mod); else if (!S.modelos[S.mod].proprio) S.alterados.add(S.mod); toast('Modelo salvo'); }
  S.ed = null; render(true); });
addEventListener('hashchange', () => { S.aberto = false; render(); });
render();
