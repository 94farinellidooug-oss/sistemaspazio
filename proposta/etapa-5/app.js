// Proposta navegável da etapa 5: Plano e prescrição (lista curta de pontos com lado, bilateral ou
// unilateral, e situação ao lado), Evolução por queixa e retificação no prontuário depois de finalizar.
// Usa, sem alterar, a verificação de segurança do sistema (pointWarnings), aplicada a cada linha com
// a técnica daquela linha. Nenhuma regra clínica nova: a situação de cada queixa e de cada linha é
// escolha do profissional. Dados fictícios, só na memória da página.
import { LOGO, ic } from '../../js/componentes/icones.js';
import { CAUT, MER, PT } from '../../js/conhecimento/pontos.js';
import { pointWarnings } from '../../js/raciocinio/seguranca.js';
import { esc, fmt, initials } from '../../js/util.js';

/* ---------- Paciente, profissional e atendimentos fictícios ---------- */
const PROF = 'Maicon Farinelli';
const P = { name:'Marina Costa', idade:35, alerts:{ gestante:false, anticoagulante:true, marcapasso:false } };
const HOJE = '2026-11-05';
const ETAPAS = [['anamnese','Anamnese'],['avaliacao','Avaliação energética'],['pentagrama','Pentagrama'],['sintese','Síntese clínica'],['mapa','Mapa corporal'],['plano','Plano e prescrição'],['evolucao','Evolução'],['documentos','Documentos']];
const TECNICAS = ['Acupuntura','Auriculoterapia','Moxabustão','Ventosa','Eletroacupuntura','Massagem Tuiná','Sangria'];
const LADOS = [['bil','Bilateral'],['uni','Unilateral'],['med','Linha média']];
const STATUS = [['plan','Planejado'],['real','Realizado'],['nao','Não realizado']];
const SITUACOES = [['melhora','Melhora'],['estavel','Estável'],['piora','Piora'],['resolvida','Resolvida'],['nova','Nova']];
const nome = (L, k) => (L.find(x => x[0] === k) || ['', '—'])[1];
const ehMedia = c => /^V[CG]\d/.test(c);

/* ---------- Estado ---------- */
let seq = 0;
// Cada ponto da prescrição guarda só o lado (bilateral ou unilateral; VC e VG ficam na linha média) e a situação.
const linha = (c, extra = {}) => ({ id:'l' + (++seq), c, lado:ehMedia(c) ? 'med' : 'bil', status:'plan', motivo:'', ...extra });
const S = {
  aberto:false,
  rx:[ linha('VB20'), linha('F3'), linha('C7', { lado:'uni' }), linha('B23'), linha('VG20') ],
  tec:['Acupuntura','Ventosa'],
  // Queixas: intensidade anterior e de hoje (vêm da Anamnese) e a situação escolhida pelo profissional.
  qx:[ { id:'q1', nome:'Cefaleia temporal', ant:6, hoje:3, sit:'' }, { id:'q2', nome:'Insônia', ant:5, hoje:5, sit:'' }, { id:'q3', nome:'Dor lombar', ant:4, hoje:0, sit:'' }, { id:'q4', nome:'Ansiedade', ant:null, hoje:6, sit:'nova' } ],
  resposta:'', orient:'',
  // Atendimento anterior (2º), já finalizado no prontuário.
  ant:{ data:'2026-10-22', tec:['Acupuntura','Moxabustão'], rx:[ { id:'a1', c:'VB20', lado:'bil', status:'real' }, { id:'a2', c:'F3', lado:'bil', status:'real' }, { id:'a3', c:'BP6', lado:'bil', status:'plan' } ],
    qx:[ ['Cefaleia temporal', 8, 6, 'melhora'], ['Insônia', 6, 5, 'melhora'], ['Dor lombar', 4, 4, 'estavel'] ], nota:'Respondeu bem; relatou sono mais contínuo nas duas primeiras noites.' },
  ret:[], corr:null, novo:''
};

/* ---------- Componentes ---------- */
const sel = (dados, attr, L, v, rot) => `<label class="rx-f"><span class="lbl">${rot}</span><select ${dados} data-k="${attr}">${L.map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
const ICS = { plan:'relogio', real:'check', nao:'x' };
const avisosHtml = w => w.map(([k, m]) => `<div class="notice ${k === 'crit' ? 'crit' : ''}">${ic(k === 'crit' ? 'escudo' : 'alerta')}<div><b>${k === 'crit' ? 'Atenção' : 'Cautela'}</b> ${esc(m)}</div></div>`).join('');
// Uma linha curta por ponto: código e nome, lado e situação lado a lado, sem rolar a tela.
function linhaRx(l){
  const d = PT[l.c], dd = `data-id="${l.id}"`, w = pointWarnings([l.c], P, []);
  return `<div class="rx ${l.status}" data-rx="${l.id}">
    <div class="rx-p"><b class="mono rx-c">${esc(l.c)}</b><span class="rx-nm">${d ? esc(d.pinyin) : '<span class="muted">ficha pendente</span>'}</span>${w.length ? `<span class="rx-w" data-tip="${esc(w.map(x => x[1]).join(' · '))}" aria-label="Cautela">${ic('alerta')}</span>` : ''}</div>
    ${l.lado === 'med' ? '<span class="rx-med">linha média</span>' : `<div class="rx-seg" role="group" aria-label="Lado">${LADOS.slice(0, 2).map(([k, n]) => `<button class="${l.lado === k ? 'on' : ''}" ${dd} data-a="lado" data-l="${k}" aria-pressed="${l.lado === k}">${n}</button>`).join('')}</div>`}
    <div class="rx-seg st" role="group" aria-label="Situação">${STATUS.map(([k, n]) => `<button class="${k}${l.status === k ? ' on' : ''}" ${dd} data-a="st" data-s="${k}" aria-pressed="${l.status === k}" aria-label="${n}" data-tip="${n}">${ic(ICS[k])}<span>${n}</span></button>`).join('')}</div>
    <button class="btn ghost sm rx-x" ${dd} data-a="rx-rm" aria-label="Tirar ${esc(l.c)}">${ic('x')}</button>
    ${l.status === 'nao' ? `<input class="rx-mot" ${dd} data-k="motivo" value="${esc(l.motivo)}" placeholder="Motivo (opcional)" aria-label="Motivo de não ter sido feito">` : ''}</div>`;
}
const contagem = L => STATUS.map(([k, n]) => [k, n, L.filter(x => x.status === k).length]);

/* ---------- Telas ---------- */
function vPlano(){
  const c = contagem(S.rx), w = pointWarnings(S.rx.map(l => l.c), P, S.tec);
  return `<div class="grid g-side rx-cols"><div class="grid" style="align-content:start">
    <div class="card" id="rx-card"><div class="card-h"><h3>Pontos de hoje<small>${S.rx.length} ponto${S.rx.length === 1 ? '' : 's'}</small></h3>
      <div class="rx-res">${c.map(([k, n, q]) => `<span class="pill ${k === 'real' ? 'ok' : k === 'nao' ? 'crit' : ''}" data-cont="${k}">${n} ${q}</span>`).join('')}</div></div>
      <div class="rx-leg" aria-hidden="true">${STATUS.map(([k, n]) => `<span>${ic(ICS[k])}${n}</span>`).join('')}</div><div class="rx-l" id="rx-l">${S.rx.map(linhaRx).join('') || '<p class="muted sm">Nenhum ponto ainda.</p>'}</div>
      <div class="rx-a"><form id="f-rx" class="rx-novo"><label class="so-leitor" for="rx-c">Código do ponto</label><input id="rx-c" class="mono" placeholder="Incluir ponto (ex.: E36)" value="${esc(S.novo)}" required><button class="btn sm pri">${ic('mais')}Incluir</button></form>
        <button class="btn sm" data-a="todos-real">${ic('check')}Todos realizados</button></div>
      <div class="lbl" style="margin:16px 0 8px">Técnicas</div><div class="chips" id="rx-tec">${TECNICAS.map(t => `<button class="chip ${S.tec.includes(t) ? 'on' : ''}" data-a="tec" data-t="${t}" aria-pressed="${S.tec.includes(t)}">${t}</button>`).join('')}</div></div>
  </div><div class="grid" style="align-content:start">
    <div class="card seg" id="rx-seg"><div class="card-h"><h3>${ic('escudo')} Verificação de segurança</h3>${w.length ? `<span class="pill crit">${w.length}</span>` : '<span class="pill ok">ok</span>'}</div>
      <p class="muted sm">Paciente com alerta: <b>uso de anticoagulante</b> (dado fictício para mostrar o aviso).</p>
      ${w.length ? avisosHtml(w) : `<div class="vazio">${ic('okc')}Nenhuma contraindicação para os pontos e técnicas.</div>`}</div>
    <div class="card"><h3>Como funciona</h3><p class="muted sm">Os pontos continuam entrando como hoje: pelo mapa corporal, pelos indicados para a região, pelas sugestões e à mão. Cada ponto entra como <b>bilateral</b> e <b>planejado</b> (VC e VG na linha média). Ao lado de cada um, toque para mudar o lado e para marcar <b>realizado</b> ou <b>não realizado</b>.</p></div>
    <div class="card"><div class="field"><label class="lbl" for="orient">Orientações para casa <span class="pill">opcional</span></label><textarea id="orient" data-campo="orient" placeholder="Ex.: compressa morna na nuca à noite">${esc(S.orient)}</textarea></div>
      <button class="btn sm" data-a="imprimir" style="margin-top:10px">${ic('doc')}Imprimir para o paciente</button><small class="muted" style="display:block;margin-top:6px">Sai uma folha só com as orientações, o nome do paciente, a data e o seu nome.</small></div>
  </div></div>`;
}
function vEvolucao(){
  const feitos = S.rx.filter(l => l.status === 'real').map(l => `${l.c} · ${nome(LADOS, l.lado).toLowerCase()}`);
  const nao = S.rx.filter(x => x.status === 'nao'), plan = S.rx.filter(x => x.status === 'plan');
  const semSit = S.qx.filter(q => !q.sit).length;
  return `<div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card" id="ev-q"><div class="card-h"><h3>Queixas neste atendimento<small>Intensidade da Anamnese · situação escolhida por você</small></h3>${semSit ? `<span class="pill warn">${semSit} sem situação</span>` : '<span class="pill ok">todas com situação</span>'}</div>
      <div class="qx-l">${S.qx.map(q => { const dif = q.ant == null ? null : q.hoje - q.ant;
        return `<div class="qx" data-q="${q.id}"><div class="qx-h"><b>${esc(q.nome)}</b><span class="qx-v">${q.ant == null ? '<span class="pill acc">1º registro</span>' : `<span class="muted">anterior</span> <b>${q.ant}</b>`}<span class="muted">hoje</span> <b>${q.hoje}</b>${dif == null ? '' : `<span class="qx-d ${dif < 0 ? 'cai' : dif > 0 ? 'sobe' : ''}">${dif > 0 ? '+' : ''}${dif}</span>`}</span></div>
          <div class="qx-s" role="group" aria-label="Situação de ${esc(q.nome)}">${SITUACOES.map(([k, n]) => `<button class="chip ${q.sit === k ? 'on' : ''}" data-a="sit" data-q="${q.id}" data-s="${k}" aria-pressed="${q.sit === k}">${n}</button>`).join('')}</div></div>`; }).join('')}</div>
      <p class="muted sm">A diferença só mostra os números da Anamnese. O sistema não escolhe a situação por você.</p></div>
    <div class="card"><div class="field"><label class="lbl" for="resp">Resposta ao tratamento</label><textarea id="resp" data-campo="resposta" placeholder="Como o paciente respondeu, o que mudou desde o último atendimento...">${esc(S.resposta)}</textarea></div></div>
  </div><div class="grid" style="align-content:start">
    <div class="card" id="ev-feito"><div class="card-h"><h3>Feito hoje<small>vem da prescrição</small></h3><span class="pill ok">${feitos.length}</span></div>
      ${feitos.length ? `<ul class="ev-l">${feitos.map(t => `<li>${ic('check')}${esc(t)}</li>`).join('')}</ul>` : '<p class="muted sm">Nada marcado como realizado ainda.</p>'}
      ${nao.length ? `<div class="lbl" style="margin-top:10px">Não realizado</div><ul class="ev-l nao">${nao.map(x => `<li>${ic('x')}${esc(x.c)}${x.motivo ? ' · ' + esc(x.motivo) : ''}</li>`).join('')}</ul>` : ''}
      ${plan.length ? `<div class="notice" id="ev-plan">${ic('alerta')}<div><b>${plan.length} ponto${plan.length > 1 ? 's' : ''} ainda planejado${plan.length > 1 ? 's' : ''}.</b> Se finalizar assim, fica${plan.length > 1 ? 'm' : ''} registrado${plan.length > 1 ? 's' : ''} como planejado${plan.length > 1 ? 's' : ''}, sem dizer se foi feito. <a href="#/plano">Voltar à prescrição</a></div></div>` : ''}</div>
    <div class="card"><h3>Comparação com o 2º atendimento</h3><table class="ev-t"><thead><tr><th>Queixa</th><th>${fmt(S.ant.data).slice(0, 5)}</th><th>hoje</th></tr></thead><tbody>${S.qx.map(q => { const a = S.ant.qx.find(x => x[0] === q.nome); return `<tr><td>${esc(q.nome)}</td><td>${a ? `<b>${a[2]}</b> <small class="muted">${nome(SITUACOES, a[3])}</small>` : '<span class="muted">—</span>'}</td><td><b>${q.hoje}</b> <small class="muted">${q.sit ? nome(SITUACOES, q.sit) : '—'}</small></td></tr>`; }).join('')}</tbody></table></div>
  </div></div>`;
}
const descLinha = l => `${l.c} · ${nome(LADOS, l.lado).toLowerCase()}`;
function vProntuario(){
  const A = S.ant, C = S.corr;
  return `<div class="notice">${ic('info')}<div><b>Depois de finalizado, o registro não muda sozinho.</b> Para corrigir, use <b>Corrigir</b>: o valor anterior fica guardado e a correção vira um registro novo, com quem, quando e o motivo.</div></div>
  <div class="grid g-side"><div class="card" id="pr-at"><div class="card-h"><h3>2º atendimento<small>${fmt(A.data)} · finalizado</small></h3><span class="pill ok">${ic('check')}no prontuário</span></div>
    <div class="lbl">Prescrição</div>
    <div class="pr-rx">${A.rx.map(l => C && C.id === l.id ? `<form class="rx corr" id="f-corr" data-id="${l.id}"><div class="rx-h"><b class="mono rx-c">${esc(l.c)}</b><div class="grow"><b>Corrigir esta linha</b><small class="muted">antes: ${esc(descLinha(l))} · ${nome(STATUS, l.status).toLowerCase()}</small></div></div>
        <div class="rx-g">${sel('data-corr="1"', 'lado', ehMedia(l.c) ? LADOS.slice(2) : LADOS.slice(0, 2), C.lado, 'Lado')}${sel('data-corr="1"', 'status', STATUS, C.status, 'Situação')}</div>
        <label class="rx-f full"><span class="lbl">Motivo da correção (obrigatório)</span><input data-corr="1" data-k="motivo" value="${esc(C.motivo)}" placeholder="Ex.: esqueci de marcar como realizado" required></label>
        <div class="rx-a"><button class="btn sm pri">${ic('check')}Salvar correção</button><button type="button" class="btn sm" data-a="corr-x">Cancelar</button></div></form>`
      : `<div class="pr-li"><span class="pill ${l.status === 'real' ? 'ok' : l.status === 'nao' ? 'crit' : ''}">${nome(STATUS, l.status)}</span><span class="grow mono-l">${esc(descLinha(l))}</span><button class="btn sm ghost" data-a="corr" data-id="${l.id}">${ic('editar')}Corrigir</button></div>`).join('')}</div>
    <div class="lbl" style="margin-top:14px">Queixas</div>
    <ul class="ev-l">${A.qx.map(([n, a, h, s]) => `<li><b>${esc(n)}</b> ${a} → ${h} · ${nome(SITUACOES, s)}</li>`).join('')}</ul>
    <div class="lbl" style="margin-top:14px">Resposta ao tratamento</div><p class="sm">${esc(A.nota)}</p></div>
  <div class="card" id="pr-ret"><div class="card-h"><h3>${ic('historico')} Retificações</h3><span class="pill">${S.ret.length}</span></div>
    ${S.ret.length ? `<ul class="ret-l">${S.ret.map(r => `<li><b>${esc(r.c)}</b> · ${r.mud.map(([k, a, b]) => `${k}: <s>${esc(a)}</s> → <b>${esc(b)}</b>`).join('; ')}<small class="muted">${esc(r.por)} · ${fmt(r.data)} às ${r.hora} · motivo: ${esc(r.motivo)}</small></li>`).join('')}</ul>` : '<p class="muted sm">Nenhuma correção feita neste atendimento.</p>'}
    <p class="muted sm">As correções aparecem também no histórico do atendimento e nos documentos gerados depois delas.</p></div></div>`;
}

/* ---------- Estrutura da página ---------- */
const TELAS = { plano:['Plano e prescrição', vPlano, 6, 'plano'], evolucao:['Evolução', vEvolucao, 7, 'evolucao'], prontuario:['Prontuário · 2º atendimento', vProntuario, 0, 'historico'] };
const rota = () => { const r = location.hash.replace(/^#\/?/, '').split('/')[0]; return TELAS[r] ? r : 'plano'; };
function cabecalho(r){
  return `<div class="at-top"><div class="at-h"><span class="avatar lg">${initials(P.name)}</span><div class="at-id"><b>${P.name}</b><small>${P.idade} anos · ${fmt(HOJE)} · 3º atendimento · retorno</small></div>
      <div class="at-al"><span class="pill crit">${ic('escudo')}Anticoagulante</span><a class="pill acc" href="#/prontuario">${ic('historico')}Prontuário</a></div>
      <div class="at-m"><span class="autosave ok">${ic('check')}Rascunho · proposta</span></div></div>
    <nav class="steps" aria-label="Etapas do atendimento">${ETAPAS.map(([k, n], j) => TELAS[k] ? `<a href="#/${k}" class="${k === r ? 'on' : ''}" ${k === r ? 'aria-current="step"' : ''}><svg viewBox="0 0 36 36" class="sr" aria-hidden="true"><circle cx="18" cy="18" r="15" class="sr-b"/></svg><span class="sn">${j + 1}</span><span class="sl">${n}</span></a>`
      : `<span class="st-off" data-tip="Fora desta proposta"><svg viewBox="0 0 36 36" class="sr" aria-hidden="true"><circle cx="18" cy="18" r="15" class="sr-b"/></svg><span class="sn">${j + 1}</span><span class="sl">${n}</span></span>`).join('')}</nav></div>`;
}
function menu(r){
  const NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
  document.querySelector('.app').classList.toggle('open', S.aberto);
  document.getElementById('nav').innerHTML = `<div class="brand">${LOGO}<div><b>Musubi</b><small>Gestão clínica integrativa</small></div></div>` +
    NAV.map(([k, l, i]) => `<a href="#/plano" ${k === 'pacientes' ? '' : 'data-a="fora"'} aria-label="${l}" class="${k === 'pacientes' ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  document.getElementById('topbar').innerHTML = `<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button><a class="tb-logo" href="#/plano">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho"><span>Pacientes</span>${ic('dir')}<span>${P.name}</span>${ic('dir')}<span>${TELAS[r][0]}</span></nav><div class="tb-r"><span class="pill acc">Proposta da etapa 5</span></div>`;
}
let ultima = '';
function render(manter){
  const r = rota(), y = scrollY, v = document.getElementById('view'), [t, f, n, i] = TELAS[r]; menu(r);
  v.innerHTML = (n ? cabecalho(r) : '') + `<div class="et-h"><span class="tico acc">${ic(i)}</span><div class="grow"><h2>${t}</h2><small class="muted">${n ? `Etapa ${n} de 8` : P.name + ' · registro finalizado'}</small></div>${r === 'evolucao' ? '<button class="btn pri" data-a="finalizar">' + ic('check') + 'Finalizar atendimento</button>' : ''}</div>` + f();
  if (r !== ultima) { v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra'); ultima = r; }
  if (manter) scrollTo(0, y);
}
function toast(m, k = 'ok'){ const t = document.getElementById('toast'); t.className = 'toast ' + k; t.innerHTML = `${ic(k === 'ok' ? 'okc' : 'info')}<span></span>`; t.lastChild.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
const agora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const itemDe = t => t.dataset.id ? S.rx.find(l => l.id === t.dataset.id) : null;

/* ---------- Eventos ---------- */
const tip = document.getElementById('tip');
document.addEventListener('mouseover', ev => { const t = ev.target.closest('[data-tip]'); if (!t) { tip.hidden = true; return; } tip.textContent = t.dataset.tip; tip.hidden = false; const b = t.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2)) + 'px'; tip.style.top = (b.top - tip.offsetHeight - 8 < 4 ? b.bottom + 8 : b.top - tip.offsetHeight - 8) + 'px'; });
addEventListener('hashchange', () => { S.aberto = false; S.corr = null; render(); scrollTo(0, 0); });
document.addEventListener('click', ev => {
  tip.hidden = true;
  const t = ev.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
  if (a === 'st') { const x = itemDe(t); x.status = t.dataset.s; render(true); }
  else if (a === 'todos-real') { S.rx.forEach(x => { if (x.status === 'plan') x.status = 'real'; }); render(true); toast('Pontos planejados marcados como realizados'); }
  else if (a === 'rx-rm') { S.rx = S.rx.filter(l => l.id !== t.dataset.id); render(true); toast('Ponto retirado da prescrição', 'info'); }
  else if (a === 'lado') { const x = itemDe(t); x.lado = t.dataset.l; render(true); }
  else if (a === 'tec') { const k = t.dataset.t; S.tec = S.tec.includes(k) ? S.tec.filter(x => x !== k) : [...S.tec, k]; render(true); }
  else if (a === 'sit') { const q = S.qx.find(x => x.id === t.dataset.q); q.sit = q.sit === t.dataset.s ? '' : t.dataset.s; render(true); }
  else if (a === 'corr') { const l = S.ant.rx.find(x => x.id === t.dataset.id); S.corr = { id:l.id, lado:l.lado, status:l.status, motivo:'' }; render(true); }
  else if (a === 'corr-x') { S.corr = null; render(true); }
  else if (a === 'imprimir') { if (!S.orient.trim()) { toast('Escreva as orientações antes de imprimir', 'info'); return; }
    // Folha própria para o paciente: só as orientações, sem dados clínicos do atendimento.
    document.getElementById('imp').innerHTML = `<div class="imp-h">${LOGO}<div><b>Orientações para casa</b><small>${esc(P.name)} · ${fmt(HOJE)}</small></div></div><div class="imp-t">${esc(S.orient).replace(/\n/g, '<br>')}</div><div class="imp-a">${PROF}</div>`;
    window.print(); }
  else if (a === 'finalizar') toast('Nesta proposta o atendimento não é finalizado de verdade');
  else if (a === 'menu-abrir') { S.aberto = !S.aberto; render(true); }
  else if (a === 'fora') { ev.preventDefault(); toast('Nesta proposta só o Plano, a Evolução e o Prontuário são navegáveis', 'info'); }
});
document.addEventListener('input', ev => { const t = ev.target;
  if (t.dataset.campo) { S[t.dataset.campo] = t.value; return; }
  if (t.dataset.corr && t.dataset.k) { S.corr[t.dataset.k] = t.value; return; }
  if (t.id === 'rx-c') { S.novo = t.value; return; }
  const x = itemDe(t); if (x && t.dataset.k && t.tagName === 'INPUT') { x[t.dataset.k] = t.type === 'number' ? (t.value === '' ? '' : +t.value) : t.value;
    if (t.dataset.k === 'motivo') { const f = t.closest('.rx')?.querySelector('.rx-falta'); if (f) f.hidden = !!t.value.trim(); } } });
document.addEventListener('change', ev => { const t = ev.target;
  if (t.dataset.corr && t.dataset.k) { S.corr[t.dataset.k] = t.value; return; }
  const x = itemDe(t); if (!x || !t.dataset.k) return;
  // Só as listas redesenham: campos de texto e números já gravam ao digitar, e redesenhar ao sair do
  // campo engoliria o toque seguinte (por exemplo, num botão de situação).
  if (t.tagName === 'SELECT') { x[t.dataset.k] = t.value; render(true); } });
document.addEventListener('submit', ev => { ev.preventDefault(); const f = ev.target;
  if (f.id === 'f-rx') { const c = S.novo.trim().toUpperCase(); if (!c) return; if (S.rx.some(l => l.c === c)) { toast(`${c} já está na prescrição`, 'info'); return; } S.rx.push(linha(c)); S.novo = ''; render(true); toast(`${c} incluído na prescrição`); }
  if (f.id === 'f-corr') { const C = S.corr, l = S.ant.rx.find(x => x.id === C.id); if (!C.motivo.trim()) { toast('Escreva o motivo da correção', 'info'); return; }
    const campos = [['Lado', 'lado', v => nome(LADOS, v)], ['Situação', 'status', v => nome(STATUS, v)]];
    const mud = campos.filter(([, k]) => String(l[k]) !== String(C[k])).map(([n, k, fm]) => [n, fm(l[k]), fm(C[k])]);
    if (!mud.length) { toast('Nada mudou nesta linha', 'info'); return; }
    campos.forEach(([, k]) => { l[k] = C[k]; });
    S.ret.unshift({ c:l.c, mud, motivo:C.motivo.trim(), por:PROF, data:HOJE, hora:agora() }); S.corr = null; render(true); toast('Correção registrada'); }
});
render();
