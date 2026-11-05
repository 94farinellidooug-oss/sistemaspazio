// Proposta navegável da etapa 7 (caminho simples e sem custo, escolhido pelo Maicon em 05/11):
// - WhatsApp: o sistema abre o WhatsApp com a mensagem pronta e o profissional toca em Enviar.
//   Lembretes de amanhã na Agenda, retomar contato no Relacionamento e orientações em Documentos.
//   Fica registrado quando a mensagem foi aberta e por quem. Mensagens prontas editáveis.
// - Assinatura: o paciente assina com o dedo na tela; a assinatura vai para a folha e o prontuário
//   com data e hora. O papel continua valendo.
// Dados fictícios, só na memória da página. Nada é enviado de verdade.
import { LOGO, ic } from '../../js/componentes/icones.js';
import { esc, fmt, initials } from '../../js/util.js';

const PROF = 'Maicon Farinelli', CLINICA = 'Spazio Stabilità', HOJE = '2026-11-05', AMANHA = '2026-11-06', AGORA = '20:51';
const icMsg = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
const PAC = [
  { id:'p1', nome:'Marina Costa', tel:'(54) 99981-1201', ult:'2026-10-22' },
  { id:'p2', nome:'João Pereira', tel:'(54) 99812-3302', ult:'2026-10-29' },
  { id:'p3', nome:'Helena Souza', tel:'(54) 99633-4410', ult:'2026-09-30' },
  { id:'p4', nome:'Carlos Lima', tel:'', ult:'2026-09-10' },
  { id:'p6', nome:'Pedro Alves', tel:'(54) 99370-7724', ult:'2026-11-02' }
];
const pac = id => PAC.find(p => p.id === id);
const APPTS = [
  { id:'a1', pid:'p1', data:HOJE, hora:'09:00', fim:'10:00', serv:'Acupuntura' }, { id:'a2', pid:'p2', data:HOJE, hora:'10:30', fim:'11:30', serv:'Acupuntura e moxabustão' },
  { id:'a3', pid:'p6', data:AMANHA, hora:'08:00', fim:'09:00', serv:'Acupuntura' }, { id:'a4', pid:'p2', data:AMANHA, hora:'17:00', fim:'18:30', serv:'Avaliação inicial' },
  { id:'a5', pid:'p4', data:AMANHA, hora:'14:00', fim:'14:30', serv:'Auriculoterapia' }
];
// Mensagens prontas: [chave, nome, texto com os dados entre chaves]
const MSG_ORIG = [
  ['lembrete', 'Lembrete de horário', 'Olá, {primeiro}! Passando para lembrar do seu horário de {servico} {quando}, às {hora}, na {clinica}. Pode confirmar por aqui?'],
  ['retomar', 'Retomar contato', 'Olá, {primeiro}! Tudo bem? Faz um tempinho desde o seu último atendimento. Quer agendar um horário para continuarmos o tratamento?'],
  ['orientacoes', 'Orientações para casa', 'Olá, {primeiro}! Seguem as orientações do atendimento de hoje:\n\n{orientacoes}'],
  ['livre', 'Mensagem livre', 'Olá, {primeiro}! ']
];
const CAMPOS_MSG = [['primeiro','Primeiro nome'], ['servico','Serviço'], ['quando','Dia'], ['hora','Hora'], ['clinica','Clínica'], ['profissional','Profissional'], ['orientacoes','Orientações']];
const ORIENT = 'Compressa morna na nuca à noite.\nEvitar telas uma hora antes de dormir.';
const TERMO = p => `Eu, ${p.nome}, declaro que fui informado(a) por ${PROF} sobre o tratamento com acupuntura e técnicas associadas, seus objetivos e possíveis reações, e que tive minhas dúvidas esclarecidas.\n\nInformei corretamente minhas condições de saúde e os medicamentos em uso, e sei que posso interromper o tratamento quando quiser.`;

const S = { aberto:false, msgs:Object.fromEntries(MSG_ORIG.map(([k, n, t]) => [k, t])), alteradas:new Set(), enviados:{}, contatos:{}, wa:null, docPid:'p1', docMod:'termo', ass:null, pad:null, docs:[], abertos:[] };

/* ---------- Apoio ---------- */
const diasDesde = d => Math.round((new Date(HOJE) - new Date(d)) / 864e5);
// Número para o link do WhatsApp: só dígitos, com 55 na frente quando faltar.
const numeroWa = tel => { const d = String(tel || '').replace(/\D/g, ''); return d.length >= 10 && d.length <= 11 ? '55' + d : d.length >= 12 ? d : ''; };
const linkWa = (tel, texto) => `https://wa.me/${numeroWa(tel)}?text=${encodeURIComponent(texto)}`;
function valoresMsg(p, a){
  return { primeiro:p.nome.split(' ')[0], servico:a ? a.serv.toLowerCase() : '', quando:a ? (a.data === AMANHA ? 'amanhã' : a.data === HOJE ? 'hoje' : `no dia ${fmt(a.data)}`) : '', hora:a ? a.hora : '', clinica:CLINICA, profissional:PROF, orientacoes:ORIENT };
}
const preencher = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);
const paragrafos = t => esc(t).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');
const btnWa = (tipo, pid, extra = '') => `<button class="btn sm wa" data-a="wa" data-t="${tipo}" data-pid="${pid}" ${extra}>${icMsg}WhatsApp</button>`;
const enviadoEm = id => S.enviados[id] ? `<small class="wa-ok">${ic('check')}mensagem aberta às ${S.enviados[id]}</small>` : '';

/* ---------- Agenda: lembretes de amanhã ---------- */
function vAgenda(){
  const hoje = APPTS.filter(a => a.data === HOJE), am = APPTS.filter(a => a.data === AMANHA), falta = am.filter(a => !S.enviados[a.id]).length;
  const linha = a => { const p = pac(a.pid); return `<div class="hor" data-ap="${a.id}"><div class="hor-h"><b>${a.hora}</b><small>até ${a.fim}</small></div><div class="hor-p"><b>${esc(p.nome)}</b><small>${esc(a.serv)}</small>${enviadoEm(a.id)}</div><div class="hor-a">${btnWa('lembrete', p.id, `data-ap="${a.id}"`)}</div></div>`; };
  return `<div class="grid g-side ag-cols"><div class="card"><div class="card-h"><h3>Hoje · ${fmt(HOJE)}<small>${hoje.length} horários</small></h3></div><div class="hor-l" id="ag-hoje">${hoje.map(linha).join('')}</div></div>
    <div class="grid" style="align-content:start"><div class="card" id="lembretes"><div class="card-h"><h3>Lembretes de amanhã<small>um toque abre o WhatsApp com a mensagem pronta</small></h3><span class="pill ${falta ? 'warn' : 'ok'}" id="lem-falta">${falta ? `${falta} a enviar` : 'todos enviados'}</span></div>
      <div class="hor-l">${am.map(linha).join('')}</div></div>
      <div class="card"><h3>Como funciona</h3><p class="muted sm">O WhatsApp abre no celular ou no computador com a mensagem escrita; é só conferir e tocar em <b>Enviar</b>. O sistema anota a hora em que a mensagem foi aberta. Sem custo e sem cadastro em serviço externo.</p></div></div></div>`;
}

/* ---------- Relacionamento: retomar contato ---------- */
function vRelacionamento(){
  const L = PAC.filter(p => diasDesde(p.ult) > 21 && !APPTS.some(a => a.pid === p.id && a.data >= HOJE));
  return `<div class="grid g-side ag-cols"><div class="card" id="rel-ret"><div class="card-h"><h3>Retomar contato<small>último atendimento há mais de 21 dias e nada agendado</small></h3><span class="pill warn">${L.length}</span></div>
    <div class="ctt-l">${L.map(p => `<div class="ctt" data-rel="${p.id}"><span class="avatar">${initials(p.nome)}</span><div class="grow"><b>${esc(p.nome)}</b><small>há ${diasDesde(p.ult)} dias · ${fmt(p.ult)}${p.tel ? ` · ${esc(p.tel)}` : ' · sem telefone'}</small>${S.contatos[p.id] ? `<small class="ctt-c">${ic('check')}contato pelo WhatsApp hoje às ${S.contatos[p.id]} · ${PROF}</small>` : ''}</div>
      <div class="hor-a">${btnWa('retomar', p.id)}<button class="btn sm ghost" data-a="fora">${ic('agenda')}Agendar</button></div></div>`).join('')}</div></div>
    <div class="card"><h3>Retomar pelo WhatsApp</h3><p class="muted sm">Ao abrir a mensagem, o contato já fica registrado com o dia e quem falou, como no botão <b>Contato feito</b>.</p></div></div>`;
}

/* ---------- Documentos: assinatura na tela e orientações pelo WhatsApp ---------- */
function vDocumentos(){
  const p = pac(S.docPid), termo = S.docMod === 'termo', A = S.ass && S.ass.pid === p.id && S.ass.mod === S.docMod ? S.ass : null;
  const nome = termo ? 'Termo de consentimento' : 'Orientações para casa', texto = termo ? TERMO(p) : ORIENT, meus = S.docs.filter(d => d.pid === p.id);
  return `<div class="grid g-side ag-cols"><div class="grid" style="align-content:start"><div class="card" id="doc-novo"><div class="card-h"><h3>Novo documento<small>escolha o paciente e o modelo</small></h3></div>
      <label class="rx-f" style="max-width:340px"><span class="lbl">Paciente</span><select id="d-p">${PAC.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
      <div class="doc-m" role="group" aria-label="Modelo">${[['termo','Termo de consentimento','assinatura'],['orientacoes','Orientações para casa','folha']].map(([k, n, i]) => `<button class="${k === S.docMod ? 'on' : ''}" data-a="mod" data-m="${k}">${ic(i)}<span>${n}</span></button>`).join('')}</div>
      <div class="rx-a"><div class="chips">${termo ? `<button class="btn pri" data-a="assinar" ${A ? 'disabled' : ''}>${ic('assinatura')}Assinar na tela</button>` : btnWa('orientacoes', p.id)}<button class="btn" data-a="imp">${ic('doc')}Imprimir</button><button class="btn" data-a="guardar">${ic('check')}Guardar no prontuário</button></div></div>
      ${termo ? `<p class="muted sm" style="margin-top:8px">O paciente assina com o dedo no celular ou tablet. Se preferir, continue imprimindo e assinando no papel.</p>` : ''}</div>
    <div class="card"><div class="card-h"><h3>Prévia<small>${esc(p.nome)} · só para conferir</small></h3></div>
      <div class="doc-pv" id="doc-pv"><div class="dp-h">${LOGO}<div><b>${nome}</b><small>${CLINICA} · ${fmt(HOJE)}</small></div></div><div class="dp-t">${paragrafos(texto)}</div>
        ${termo ? `<div class="dp-as">${A ? `<img class="ass-img" src="${A.img}" alt="Assinatura de ${esc(p.nome)}">` : ''}<span></span><small>${esc(p.nome)}${A ? ` · assinado na tela em ${fmt(HOJE)} às ${A.hora}` : ''}</small></div>` : ''}<div class="dp-p">${PROF}</div></div></div></div>
    <div class="grid" style="align-content:start"><div class="card" id="doc-lista"><div class="card-h"><h3>Documentos de ${esc(p.nome.split(' ')[0])}<small>ficam no prontuário</small></h3><span class="pill">${meus.length}</span></div>
      ${meus.length ? `<div class="doc-l">${meus.map(d => `<div class="doc-li"><span class="tico sm">${ic(d.mod === 'termo' ? 'assinatura' : 'folha')}</span><div class="grow"><b>${d.nome}</b><small>${fmt(HOJE)} · ${PROF}</small></div>${d.ass ? `<span class="pill ok">${ic('check')}assinado na tela</span>` : ''}</div>`).join('')}</div>` : '<p class="muted sm">Nenhum documento guardado ainda.</p>'}</div>
      <div class="card"><h3>Assinatura na tela</h3><p class="muted sm">A assinatura fica guardada no documento, com a data, a hora e quem conduziu. É uma assinatura eletrônica simples: serve bem para o termo de consentimento do consultório. Se um dia precisar de certificado digital, dá para ligar um serviço externo depois.</p></div></div></div>`;
}

/* ---------- Mensagens prontas ---------- */
const comCampos = t => paragrafos(t).replace(/\{(\w+)\}/g, (m, k) => { const c = CAMPOS_MSG.find(x => x[0] === k); return c ? `<span class="cp">${c[1]}</span>` : m; });
function vMensagens(){
  return `<div class="grid g-side ag-cols"><div class="grid" style="align-content:start">${MSG_ORIG.filter(m => m[0] !== 'livre').map(([k, n]) => `<form class="card f-msg" data-k="${k}"><div class="card-h"><h3>${n}</h3>${S.alteradas.has(k) ? '<span class="pill acc">sua</span>' : '<span class="pill">original</span>'}</div>
      <div class="chips cps">${CAMPOS_MSG.map(([c, r]) => `<button type="button" class="chip" data-a="campo" data-k="${c}">${ic('mais')}${r}</button>`).join('')}</div>
      <label class="rx-f full" style="margin-top:8px"><span class="lbl">Texto</span><textarea rows="4" data-msg="${k}">${esc(S.msgs[k])}</textarea></label>
      <div class="rx-a"><button class="btn sm pri">${ic('check')}Salvar</button>${S.alteradas.has(k) ? `<button type="button" class="btn ghost sm" data-a="msg-orig" data-k="${k}">${ic('retorno')}Voltar ao texto original</button>` : ''}</div></form>`).join('')}</div>
    <div class="card"><h3>Mensagens prontas</h3><p class="muted sm">São os textos que aparecem quando você toca em WhatsApp. Os dados entre chaves são preenchidos sozinhos. Na hora de enviar, ainda dá para ajustar só aquela mensagem.</p></div></div>`;
}

/* ---------- Painel do WhatsApp ---------- */
function painelWa(){
  const W = S.wa; if (!W) return '';
  const p = pac(W.pid), num = numeroWa(p.tel);
  return `<div class="wa-fundo" data-a="wa-x"></div><div class="wa-p card" role="dialog" aria-modal="true" aria-label="Mensagem pelo WhatsApp">
    <div class="card-h"><h3>${icMsg}Mensagem para ${esc(p.nome.split(' ')[0])}<small>${p.tel ? esc(p.tel) : 'sem telefone no cadastro'}</small></h3><button class="btn sm ghost" data-a="wa-x" aria-label="Fechar">${ic('x')}</button></div>
    <div class="chips" role="group" aria-label="Mensagem pronta">${MSG_ORIG.map(([k, n]) => `<button class="chip ${k === W.tipo ? 'on' : ''}" data-a="wa-tipo" data-k="${k}">${n}</button>`).join('')}</div>
    <label class="rx-f full" style="margin-top:10px"><span class="lbl">Mensagem</span><textarea id="wa-t" rows="6">${esc(W.texto)}</textarea></label>
    <small class="muted">Ajuste se quiser; vale só para esta mensagem. Para mudar o texto padrão, use <a href="#/mensagens" data-a="wa-x">Mensagens prontas</a>.</small>
    ${num ? '' : `<div class="notice" style="margin-top:10px">${ic('info')}<div>Cadastre o telefone do paciente para enviar pelo WhatsApp.</div></div>`}
    <div class="rx-a"><button class="btn pri" data-a="wa-abrir" ${num ? '' : 'disabled'}>${icMsg}Abrir no WhatsApp</button><button class="btn" data-a="wa-x">Cancelar</button></div></div>`;
}

/* ---------- Painel de assinatura ---------- */
function painelAss(){
  if (!S.pad) return ''; const p = pac(S.docPid);
  return `<div class="wa-fundo"></div><div class="wa-p card ass-p" role="dialog" aria-modal="true" aria-label="Assinatura na tela">
    <div class="card-h"><h3>${ic('assinatura')}Assinatura de ${esc(p.nome)}<small>Termo de consentimento · ${fmt(HOJE)}</small></h3></div>
    <p class="muted sm">Entregue o aparelho ao paciente. Ele assina com o dedo no quadro abaixo.</p>
    <canvas id="ass-c" width="640" height="220" aria-label="Quadro de assinatura"></canvas>
    <div class="rx-a"><button class="btn pri" data-a="ass-ok" ${S.pad.tracos ? '' : 'disabled'}>${ic('check')}Confirmar assinatura</button><div class="chips"><button class="btn" data-a="ass-limpar">Limpar</button><button class="btn ghost" data-a="ass-x">Cancelar</button></div></div></div>`;
}
function ligarPad(){
  const c = document.getElementById('ass-c'); if (!c) return; const g = c.getContext('2d'); let des = false;
  g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1d1d1b';
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { des = true; c.setPointerCapture?.(e.pointerId); g.beginPath(); g.moveTo(...pt(e)); });
  c.addEventListener('pointermove', e => { if (!des) return; g.lineTo(...pt(e)); g.stroke(); if (!S.pad.tracos) { S.pad.tracos = 1; document.querySelector('[data-a="ass-ok"]').disabled = false; } });
  c.addEventListener('pointerup', () => { des = false; });
}

/* ---------- Estrutura ---------- */
const ROTAS = { agenda:['Agenda','agenda',vAgenda,'Lembretes pelo WhatsApp'], relacionamento:['Relacionamento','admin',vRelacionamento,'Retomar contato pelo WhatsApp'], documentos:['Documentos','doc',vDocumentos,'Assinatura na tela e orientações pelo WhatsApp'], mensagens:['Mensagens prontas','admin',vMensagens,'Textos do WhatsApp, na Administração'] };
const rota = () => { const r = location.hash.replace('#/', ''); return ROTAS[r] ? r : 'agenda'; };
function menu(){
  const r = rota(), NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
  const on = k => k === r || (k === 'administracao' && (r === 'relacionamento' || r === 'mensagens'));
  const href = k => k === 'administracao' ? '#/relacionamento' : `#/${k}`, dentro = k => ['agenda','documentos','administracao'].includes(k);
  document.querySelector('.app').classList.toggle('open', S.aberto);
  document.getElementById('nav').innerHTML = `<div class="brand">${LOGO}<div><b>Musubi</b><small>Gestão clínica integrativa</small></div></div>` +
    NAV.map(([k, l, i]) => `<a href="${dentro(k) ? href(k) : '#/' + r}" ${dentro(k) ? '' : 'data-a="fora"'} aria-label="${l}" class="${on(k) ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  const abas = [['agenda','Agenda'],['relacionamento','Relacionamento'],['documentos','Documentos'],['mensagens','Mensagens prontas']];
  document.getElementById('topbar').innerHTML = `<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button><a class="tb-logo" href="#/agenda">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho">${r === 'relacionamento' || r === 'mensagens' ? `<span>Administração</span>${ic('dir')}` : ''}<span>${ROTAS[r][0]}</span></nav><div class="tb-r"><span class="pill acc">Proposta · etapa 7</span></div>`;
  return abas;
}
function render(manter){
  const y = scrollY, r = rota(), abas = menu(), [n, i, v, sub] = ROTAS[r];
  document.getElementById('view').innerHTML = `<div class="chips p7-abas" role="tablist">${abas.map(([k, l]) => `<a class="chip ${k === r ? 'on' : ''}" href="#/${k}" role="tab" aria-selected="${k === r}">${l}</a>`).join('')}</div>
    <div class="et-h"><span class="tico acc">${ic(i)}</span><div class="grow"><h2>${n}</h2><small class="muted">${sub}</small></div></div>${v()}`;
  let o = document.getElementById('sobre'); if (!o) { o = document.createElement('div'); o.id = 'sobre'; document.body.append(o); }
  o.innerHTML = painelWa() + painelAss(); ligarPad();
  if (manter) scrollTo(0, y);
}
function toast(m, k = 'ok'){ const t = document.getElementById('toast'); t.className = 'toast ' + k; t.innerHTML = `${ic(k === 'ok' ? 'okc' : 'info')}<span></span>`; t.lastChild.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
function abrirWa(tipo, pid, ap){ const p = pac(pid), a = APPTS.find(x => x.id === ap) || null; S.wa = { tipo, pid, ap, texto:preencher(S.msgs[tipo], valoresMsg(p, a)) }; render(true); document.getElementById('wa-t')?.focus(); }

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
  if (a === 'wa') abrirWa(t.dataset.t, t.dataset.pid, t.dataset.ap);
  else if (a === 'wa-tipo') abrirWa(t.dataset.k, S.wa.pid, S.wa.ap);
  else if (a === 'wa-x') { S.wa = null; if (t.tagName !== 'A') { ev.preventDefault(); render(true); } }
  else if (a === 'wa-abrir') { const W = S.wa, p = pac(W.pid), url = linkWa(p.tel, document.getElementById('wa-t').value); S.abertos.push(url); window.open(url, '_blank', 'noopener');
    if (W.ap) S.enviados[W.ap] = AGORA; if (W.tipo === 'retomar') S.contatos[W.pid] = AGORA; S.wa = null; render(true); toast(W.tipo === 'retomar' ? 'WhatsApp aberto; contato registrado' : 'WhatsApp aberto com a mensagem'); }
  else if (a === 'mod') { S.docMod = t.dataset.m; render(true); }
  else if (a === 'assinar') { S.pad = { tracos:0 }; render(true); }
  else if (a === 'ass-limpar') { S.pad = { tracos:0 }; render(true); }
  else if (a === 'ass-x') { S.pad = null; render(true); }
  else if (a === 'ass-ok') { const img = document.getElementById('ass-c').toDataURL('image/png'); S.ass = { pid:S.docPid, mod:'termo', img, hora:AGORA }; S.pad = null; render(true); toast('Assinatura registrada no termo'); }
  else if (a === 'imp') { document.getElementById('imp').innerHTML = document.getElementById('doc-pv').innerHTML; window.print(); }
  else if (a === 'guardar') { const ass = S.docMod === 'termo' && S.ass?.pid === S.docPid; S.docs.unshift({ pid:S.docPid, mod:S.docMod, nome:S.docMod === 'termo' ? 'Termo de consentimento' : 'Orientações para casa', ass }); render(true); toast(`Guardado no prontuário${ass ? ', com a assinatura' : ''}`); }
  else if (a === 'campo') { const ta = t.closest('form').querySelector('textarea'), c = `{${t.dataset.k}}`, i = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, i) + c + ta.value.slice(ta.selectionEnd ?? i); ta.focus(); ta.setSelectionRange(i + c.length, i + c.length); }
  else if (a === 'msg-orig') { const k = t.dataset.k; S.msgs[k] = MSG_ORIG.find(m => m[0] === k)[2]; S.alteradas.delete(k); render(true); toast('Texto original de volta'); }
  else if (a === 'menu-abrir') { S.aberto = !S.aberto; render(true); }
  else if (a === 'fora') { ev.preventDefault(); toast('Nesta proposta só Agenda, Relacionamento, Documentos e Mensagens são navegáveis', 'info'); }
});
document.addEventListener('change', ev => { if (ev.target.id === 'd-p') { S.docPid = ev.target.value; render(true); } });
document.addEventListener('submit', ev => { ev.preventDefault(); const f = ev.target; if (!f.matches('.f-msg')) return; const k = f.dataset.k, v = f.querySelector('textarea').value.trim();
  if (!v) { toast('Escreva o texto da mensagem', 'info'); return; } S.msgs[k] = v; if (v === MSG_ORIG.find(m => m[0] === k)[2]) S.alteradas.delete(k); else S.alteradas.add(k); render(true); toast('Mensagem salva'); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && (S.wa || S.pad)) { S.wa = null; S.pad = null; render(true); } });
addEventListener('hashchange', () => { S.aberto = false; render(); });
render();
