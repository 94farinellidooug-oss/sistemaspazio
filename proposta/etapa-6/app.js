// Proposta navegável da etapa 6: Agenda (dia a dia, com a semana em cima, situação de cada horário
// ao lado e agendar em poucos campos), Documentos (modelo + paciente, já preenchido, imprimir e
// guardar no prontuário) e Relacionamento (quem retomar contato e interessados). Nenhuma regra
// clínica nova. Dados fictícios, só na memória da página.
import { LOGO, ic } from '../../js/componentes/icones.js';
import { addDays, esc, fmt, initials } from '../../js/util.js';

/* ---------- Dados fictícios ---------- */
const PROF = 'Maicon Farinelli', CLINICA = 'Spazio Stabilità';
const HOJE = '2026-11-05';
const INICIO_DIA = 8 * 60, FIM_DIA = 19 * 60;
// [serviço, minutos, valor]
const SERVICOS = [['Acupuntura', 60, 180], ['Acupuntura e moxabustão', 60, 200], ['Auriculoterapia', 30, 90], ['Ventosaterapia', 45, 150], ['Avaliação inicial', 90, 220]];
const servico = n => SERVICOS.find(s => s[0] === n) || SERVICOS[0];
const PAC = [
  { id:'p1', nome:'Marina Costa', tel:'(54) 99981-1201', ult:'2026-10-22' },
  { id:'p2', nome:'João Pereira', tel:'(54) 99812-3302', ult:'2026-10-29' },
  { id:'p3', nome:'Helena Souza', tel:'(54) 99633-4410', ult:'2026-09-30' },
  { id:'p4', nome:'Carlos Lima', tel:'(54) 99140-5521', ult:'2026-09-10' },
  { id:'p5', nome:'Ana Ribeiro', tel:'(54) 99257-6618', ult:'2026-10-01' },
  { id:'p6', nome:'Pedro Alves', tel:'(54) 99370-7724', ult:'2026-11-02' }
];
const pac = id => PAC.find(p => p.id === id);
// Situação de cada horário: agendado, confirmado, atendido, faltou ou desmarcado.
const ST = [['agendado', 'Agendado', 'relogio'], ['confirmado', 'Confirmado', 'okc'], ['faltou', 'Faltou', 'x']];
const ST_NOME = { agendado:'Agendado', confirmado:'Confirmado', atendido:'Atendido', faltou:'Faltou', desmarcado:'Desmarcado' };
let seq = 0;
const ag = (pid, data, hora, serv, st = 'agendado') => ({ id:'a' + (++seq), pid, data, hora, serv, st, hist:[] });
const MODELOS = [
  ['termo', 'Termo de consentimento', 'assinatura', true],
  ['declaracao', 'Declaração de comparecimento', 'doc_id', false],
  ['orientacoes', 'Orientações para casa', 'folha', false],
  ['registro', 'Registro do atendimento', 'doc', false]
];
const modelo = k => MODELOS.find(m => m[0] === k);
const ORIGENS = ['Instagram', 'Indicação', 'Google', 'Outro'];
const SIT_INT = [['novo', 'Novo'], ['agendou', 'Agendou'], ['paciente', 'Paciente'], ['nao', 'Não seguiu']];

const S = {
  aberto:false, dia:HOJE, sel:null, remarcar:null,
  form:{ pid:'p3', data:HOJE, hora:'', serv:'Acupuntura' },
  appts:[
    ag('p1', HOJE, '09:00', 'Acupuntura', 'confirmado'), ag('p2', HOJE, '10:30', 'Acupuntura e moxabustão'), ag('p6', HOJE, '14:00', 'Auriculoterapia'),
    ag('p5', HOJE, '16:00', 'Ventosaterapia'), ag('p1', '2026-11-03', '09:00', 'Acupuntura', 'atendido'), ag('p2', '2026-11-04', '11:00', 'Acupuntura', 'faltou'),
    ag('p6', '2026-11-06', '08:00', 'Acupuntura'), ag('p2', '2026-11-06', '17:00', 'Avaliação inicial'), ag('p1', '2026-11-09', '09:00', 'Acupuntura')
  ],
  doc:{ pid:'p1', mod:'termo' },
  docs:[ { id:'d1', pid:'p1', mod:'declaracao', em:'2026-10-22', por:PROF, assinado:false } ],
  contato:{}, ocultos:[], mostrarOcultos:false,
  ints:[ { id:'i1', nome:'Luciana Ferraz', tel:'(54) 99602-1188', origem:'Instagram', sit:'novo', em:'2026-11-04' }, { id:'i2', nome:'Roberto Dias', tel:'(54) 99733-2290', origem:'Indicação', sit:'agendou', em:'2026-11-01' } ],
  novoInt:{ nome:'', tel:'', origem:'Instagram' }
};

/* ---------- Apoio ---------- */
const min = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const hh = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fimDe = a => hh(min(a.hora) + servico(a.serv)[1]);
const brl = v => 'R$ ' + v.toLocaleString('pt-BR');
const ativos = d => S.appts.filter(a => a.data === d && a.st !== 'desmarcado').sort((a, b) => a.hora.localeCompare(b.hora));
const diaSem = (d, o = { weekday:'short' }) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', o).replace('.', '');
const inicioSemana = d => { const w = (new Date(d + 'T12:00:00').getDay() + 6) % 7; return addDays(-w, d); };
const diasAte = d => Math.round((new Date(HOJE + 'T12:00:00') - new Date(d + 'T12:00:00')) / 864e5);
// Horários livres do dia, de hora em hora, onde cabe o serviço escolhido sem encostar em outro.
function livres(d, serv, ignorar){
  const dur = servico(serv)[1], oc = ativos(d).filter(a => a.id !== ignorar).map(a => [min(a.hora), min(a.hora) + servico(a.serv)[1]]), L = [];
  for (let m = INICIO_DIA; m + dur <= FIM_DIA; m += 60) if (!oc.some(([i, f]) => m < f && m + dur > i)) L.push(hh(m));
  return L;
}
const proximo = pid => S.appts.find(a => a.pid === pid && a.data >= HOJE && a.st !== 'desmarcado' && a.st !== 'faltou');
const opcoes = (L, v) => L.map(([k, n]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('');

/* ---------- Agenda ---------- */
function linhaAg(a){
  const p = pac(a.pid), [, dur] = servico(a.serv), fora = a.st === 'desmarcado', feito = a.st === 'atendido';
  return `<div class="hor ${a.st}" data-ag="${a.id}">
    <div class="hor-h"><b class="mono">${a.hora}</b><small>${fimDe(a)}</small></div>
    <div class="hor-p"><b>${esc(p.nome)}</b><small>${esc(a.serv)} · ${dur} min${a.hist.length ? ` · <span class="ag-hi">${esc(a.hist[0])}</span>` : ''}</small></div>
    ${fora || feito ? `<span class="pill ${feito ? 'ok' : ''}">${ST_NOME[a.st]}</span>` : `<div class="rx-seg st" role="group" aria-label="Situação">${ST.map(([k, n, i]) => `<button class="${k}${a.st === k ? ' on' : ''}" data-a="ag-st" data-id="${a.id}" data-s="${k}" aria-pressed="${a.st === k}" aria-label="${n}" data-tip="${n}">${ic(i)}</button>`).join('')}</div>`}
    <div class="hor-a">${fora ? `<button class="btn sm" data-a="ag-rem" data-id="${a.id}">${ic('agenda')}Reagendar</button>`
      : feito ? `<a class="btn sm ghost" href="#/documentos" data-a="ag-doc" data-pid="${a.pid}">${ic('doc')}Documentos</a>`
      : `${a.data === HOJE && a.st !== 'faltou' ? `<button class="btn sm pri" data-a="ag-atender" data-id="${a.id}">${ic('play')}Atender</button>` : ''}<button class="btn sm ghost" data-a="ag-rem" data-id="${a.id}" aria-label="Remarcar" data-tip="Remarcar">${ic('agenda')}</button><button class="btn sm ghost" data-a="ag-desm" data-id="${a.id}" aria-label="Desmarcar" data-tip="Desmarcar">${ic('x')}</button>`}</div></div>`;
}
function vAgenda(){
  const ws = inicioSemana(S.dia), dias = [...Array(7)].map((_, i) => addDays(i, ws)), L = ativos(S.dia);
  const fora = S.appts.filter(a => a.data === S.dia && a.st === 'desmarcado');
  const conta = k => L.filter(a => a.st === k).length, F = S.form, R = S.remarcar && S.appts.find(a => a.id === S.remarcar);
  const lv = livres(F.data, F.serv, R?.id), sv = servico(F.serv);
  return `<div class="ag-top"><div class="quick"><button class="btn" data-a="sem" data-d="-7" aria-label="Semana anterior">${ic('esq')}</button><button class="btn" data-a="hoje">Hoje</button><button class="btn" data-a="sem" data-d="7" aria-label="Próxima semana">${ic('dir')}</button></div>
    <small class="muted">${fmt(dias[0])} a ${fmt(dias[6])}</small></div>
  <div class="ag-sem" role="tablist" aria-label="Dias da semana">${dias.map(d => { const n = ativos(d).length; return `<button role="tab" class="${d === S.dia ? 'on' : ''} ${d === HOJE ? 'hoje' : ''}" data-a="dia" data-d="${d}" aria-selected="${d === S.dia}"><span>${diaSem(d)}</span><b>${d.slice(8)}</b><small>${n ? n + ' hor.' : 'livre'}</small></button>`; }).join('')}</div>
  <div class="grid g-side ag-cols"><div class="card" id="ag-dia"><div class="card-h"><h3>${diaSem(S.dia, { weekday:'long', day:'2-digit', month:'2-digit' })}${S.dia === HOJE ? ' · hoje' : ''}<small>${L.length} horário${L.length === 1 ? '' : 's'} · ${brl(L.reduce((n, a) => n + servico(a.serv)[2], 0))}</small></h3>
      <div class="rx-res"><span class="pill ok" data-cont="confirmado">Confirmados ${conta('confirmado')}</span><span class="pill" data-cont="agendado">A confirmar ${conta('agendado')}</span>${conta('faltou') ? `<span class="pill crit" data-cont="faltou">Faltas ${conta('faltou')}</span>` : ''}</div></div>
    <div class="rx-leg" aria-hidden="true">${ST.map(([, n, i]) => `<span>${ic(i)}${n}</span>`).join('')}</div>
    <div class="hor-l" id="ag-l">${L.map(linhaAg).join('') || `<div class="vazio">${ic('agenda')}Nenhum horário neste dia.</div>`}</div>
    ${fora.length ? `<details class="ag-fora"><summary>${fora.length} desmarcado${fora.length > 1 ? 's' : ''}</summary><div class="hor-l">${fora.map(linhaAg).join('')}</div></details>` : ''}
    <div class="lbl" style="margin:14px 0 8px">Horários livres para ${esc(F.serv.toLowerCase())}</div>
    <div class="chips" id="ag-livres">${S.dia === F.data ? (lv.map(h => `<button class="chip ${F.hora === h ? 'on' : ''}" data-a="livre" data-h="${h}">${h}</button>`).join('') || '<span class="muted sm">Dia cheio.</span>') : `<button class="chip" data-a="ir-form-dia">Ver horários deste dia</button>`}</div></div>
  <div class="grid" style="align-content:start"><form class="card" id="f-ag"><div class="card-h"><h3>${R ? 'Remarcar' : 'Agendar'}${R ? `<small>${esc(pac(R.pid).nome)} · era ${fmt(R.data)} às ${R.hora}</small>` : '<small>três escolhas e pronto</small>'}</h3>${R ? `<button type="button" class="btn sm ghost" data-a="rem-x">Cancelar</button>` : ''}</div>
      <div class="ag-f">
        <label class="rx-f full"><span class="lbl">Paciente</span><select data-f="pid" ${R ? 'disabled' : ''}>${opcoes(PAC.map(p => [p.id, p.nome]), R ? R.pid : F.pid)}</select></label>
        <label class="rx-f full"><span class="lbl">Serviço</span><select data-f="serv">${opcoes(SERVICOS.map(s => [s[0], `${s[0]} · ${s[1]} min`]), F.serv)}</select></label>
        <label class="rx-f"><span class="lbl">Dia</span><input type="date" data-f="data" value="${F.data}"></label>
        <label class="rx-f"><span class="lbl">Horário</span><select data-f="hora"><option value="">Escolha</option>${lv.map(h => `<option ${F.hora === h ? 'selected' : ''}>${h}</option>`).join('')}</select></label>
      </div>
      <p class="muted sm" style="margin:10px 0">${sv[1]} min · ${brl(sv[2])} (valor do serviço, ajustável no financeiro).${proximo(R ? R.pid : F.pid) && !R ? ` Próximo horário: ${fmt(proximo(F.pid).data)} às ${proximo(F.pid).hora}.` : ''}</p>
      <button class="btn pri">${ic('check')}${R ? 'Salvar novo horário' : 'Agendar'}</button></form>
    <div class="card"><h3>Como funciona</h3><p class="muted sm">Toque num dia da semana para ver os horários. Ao lado de cada horário, marque <b>confirmado</b> ou <b>faltou</b>. <b>Atender</b> abre o atendimento do paciente e, ao finalizar, o horário fica como atendido. Remarcar guarda de onde veio.</p>
      <p class="muted sm">Confirmação e lembrete pelo WhatsApp entram na etapa 7.</p></div></div></div>`;
}

/* ---------- Documentos ---------- */
const ULTIMO = { data:'2026-10-22', hora:'09:00', fim:'10:00', tec:['Acupuntura', 'Moxabustão'], pontos:['VB20 · bilateral', 'F3 · bilateral', 'VG20 · linha média'],
  queixas:[['Cefaleia temporal', 'Melhora'], ['Insônia', 'Estável']], orient:'Compressa morna na nuca à noite.\nEvitar telas uma hora antes de dormir.' };
function textoDoc(k, p){
  const assina = `<div class="dp-as"><span></span><small>${esc(p.nome)}</small></div>`;
  if (k === 'termo') return `<p>Eu, <b>${esc(p.nome)}</b>, declaro que fui informado(a) por ${PROF} sobre o tratamento com acupuntura e técnicas associadas, seus objetivos e possíveis reações, e que tive minhas dúvidas esclarecidas.</p>
    <p>Informei corretamente minhas condições de saúde e os medicamentos em uso, e sei que posso interromper o tratamento quando quiser.</p>${assina}`;
  if (k === 'declaracao') return `<p>Declaro, para os devidos fins, que <b>${esc(p.nome)}</b> esteve em atendimento na ${CLINICA} no dia ${fmt(ULTIMO.data)}, das ${ULTIMO.hora} às ${ULTIMO.fim}.</p>`;
  if (k === 'orientacoes') return `<p>${esc(ULTIMO.orient).replace(/\n/g, '<br>')}</p>`;
  return `<p><b>Atendimento de ${fmt(ULTIMO.data)}</b> · ${ULTIMO.tec.join(', ')}</p><p>Pontos realizados: ${ULTIMO.pontos.join('; ')}.</p><p>Queixas: ${ULTIMO.queixas.map(([q, s]) => `${q} (${s.toLowerCase()})`).join('; ')}.</p>`;
}
function folha(k, p){
  return `<div class="imp-h">${LOGO}<div><b>${modelo(k)[1]}</b><small>${CLINICA} · ${fmt(HOJE)}</small></div></div><div class="imp-t">${textoDoc(k, p)}</div><div class="imp-a">${PROF}</div>`;
}
function vDocumentos(){
  const D = S.doc, p = pac(D.pid), m = modelo(D.mod), meus = S.docs.filter(d => d.pid === D.pid);
  return `<div class="grid g-side ag-cols"><div class="card" id="doc-novo"><div class="card-h"><h3>Novo documento<small>escolha o paciente e o modelo; o resto vem preenchido</small></h3></div>
      <label class="rx-f" style="max-width:340px"><span class="lbl">Paciente</span><select data-docf="pid">${opcoes(PAC.map(x => [x.id, x.nome]), D.pid)}</select></label>
      <div class="doc-m" role="group" aria-label="Modelo">${MODELOS.map(([k, n, i]) => `<button class="${k === D.mod ? 'on' : ''}" data-a="doc-mod" data-m="${k}" aria-pressed="${k === D.mod}">${ic(i)}<span>${n}</span></button>`).join('')}</div>
      <div class="doc-pv" id="doc-pv"><div class="dp-h">${LOGO}<div><b>${m[1]}</b><small>${CLINICA} · ${fmt(HOJE)}</small></div></div>
        <div class="dp-t" contenteditable="true" spellcheck="true" aria-label="Texto do documento">${textoDoc(D.mod, p)}</div><div class="dp-p">${PROF}</div></div>
      <small class="muted">Dá para ajustar o texto direto na folha antes de imprimir. Os textos dos modelos são exemplos: você troca pelos seus em Configurações.</small>
      <div class="rx-a"><button class="btn pri" data-a="doc-imp">${ic('doc')}Imprimir</button><button class="btn" data-a="doc-guardar">${ic('check')}Guardar no prontuário</button></div></div>
    <div class="grid" style="align-content:start"><div class="card" id="doc-lista"><div class="card-h"><h3>Documentos de ${esc(p.nome.split(' ')[0])}<small>ficam no prontuário</small></h3><span class="pill">${meus.length}</span></div>
      ${meus.length ? `<div class="doc-l">${meus.map(d => { const md = modelo(d.mod); return `<div class="doc-li" data-doc="${d.id}"><span class="tico sm">${ic(md[2])}</span><div class="grow"><b>${md[1]}</b><small>${fmt(d.em)} · ${esc(d.por)}</small></div>
        ${md[3] ? (d.assinado ? `<span class="pill ok">${ic('check')}assinado</span>` : `<button class="btn sm" data-a="doc-ass" data-id="${d.id}">${ic('assinatura')}Marcar assinado</button>`) : ''}</div>`; }).join('')}</div>` : '<p class="muted sm">Nenhum documento guardado ainda.</p>'}</div>
      <div class="card"><h3>Assinatura</h3><p class="muted sm">Por enquanto o termo é impresso, assinado no papel e marcado aqui como assinado. A assinatura pelo celular, por um serviço externo, vamos escolher juntos na etapa 7.</p></div></div></div>`;
}

/* ---------- Relacionamento ---------- */
function vRelacionamento(){
  const ret = PAC.filter(p => diasAte(p.ult) > 21 && !proximo(p.id)), vis = ret.filter(p => !S.ocultos.includes(p.id)), oc = ret.length - vis.length, N = S.novoInt;
  const lista = S.mostrarOcultos ? ret : vis;
  return `<div class="grid g-side ag-cols"><div class="card" id="rel-ret"><div class="card-h"><h3>Retomar contato<small>último atendimento há mais de 21 dias e nada agendado</small></h3><span class="pill warn">${vis.length}</span></div>
      <div class="ctt-l">${lista.map(p => { const c = S.contato[p.id], o = S.ocultos.includes(p.id); return `<div class="ctt ${o ? 'oc' : ''}" data-rel="${p.id}"><span class="avatar">${initials(p.nome)}</span><div class="grow"><b>${esc(p.nome)}</b><small>há ${diasAte(p.ult)} dias · ${fmt(p.ult)} · <span class="tel">${p.tel}</span></small>${c ? `<small class="ctt-c">${ic('check')}contato em ${fmt(c.em)} · ${esc(c.por)}</small>` : ''}</div>
        <div class="hor-a">${o ? `<button class="btn sm ghost" data-a="rel-volta" data-pid="${p.id}">Mostrar de novo</button>` : `<button class="btn sm pri" data-a="rel-agendar" data-pid="${p.id}">${ic('agenda')}Agendar</button><button class="btn sm ${c ? 'ghost' : ''}" data-a="rel-contato" data-pid="${p.id}" ${c ? 'disabled' : ''}>${ic('tel')}Contato feito</button><button class="btn sm ghost" data-a="rel-ocultar" data-pid="${p.id}" aria-label="Não retomar" data-tip="Não retomar">${ic('x')}</button>`}</div></div>`; }).join('') || `<div class="vazio">${ic('okc')}Ninguém para retomar agora.</div>`}</div>
      ${oc ? `<button class="btn sm ghost" data-a="rel-ver-oc" style="margin-top:10px">${S.mostrarOcultos ? 'Esconder' : 'Mostrar'} ${oc} que você preferiu não retomar</button>` : ''}</div>
    <div class="grid" style="align-content:start"><div class="card" id="rel-int"><div class="card-h"><h3>Interessados<small>quem procurou e ainda não é paciente</small></h3><span class="pill">${S.ints.filter(i => i.sit === 'novo' || i.sit === 'agendou').length}</span></div>
      <div class="ctt-l">${S.ints.map(i => `<div class="ctt int ${i.sit}" data-int="${i.id}"><div class="grow"><b>${esc(i.nome)}</b><small><span class="tel">${esc(i.tel)}</span> · ${esc(i.origem)} · ${fmt(i.em)}</small></div>
        <div class="int-s" role="group" aria-label="Situação de ${esc(i.nome)}">${SIT_INT.map(([k, n]) => `<button class="chip ${i.sit === k ? 'on' : ''}" data-a="int-sit" data-id="${i.id}" data-s="${k}" aria-pressed="${i.sit === k}">${n}</button>`).join('')}</div></div>`).join('')}</div>
      <form id="f-int" class="ag-f" style="margin-top:12px"><label class="rx-f full"><span class="lbl">Nome</span><input data-int="nome" value="${esc(N.nome)}" required></label>
        <label class="rx-f"><span class="lbl">Telefone</span><input data-int="tel" value="${esc(N.tel)}" inputmode="tel"></label>
        <label class="rx-f"><span class="lbl">Como chegou</span><select data-int="origem">${opcoes(ORIGENS.map(o => [o, o]), N.origem)}</select></label>
        <div class="full"><button class="btn sm pri">${ic('mais')}Incluir interessado</button></div></form></div>
      <div class="card"><h3>Como funciona</h3><p class="muted sm">A lista de retomar contato se monta sozinha pela agenda e pelos atendimentos. <b>Contato feito</b> registra o dia e quem falou. Mensagens pelo WhatsApp entram na etapa 7.</p></div></div></div>`;
}

/* ---------- Estrutura da página ---------- */
const TELAS = { agenda:['Agenda', vAgenda, 'agenda', 'agenda'], documentos:['Documentos', vDocumentos, 'doc', 'documentos'], relacionamento:['Relacionamento', vRelacionamento, 'tel', 'administracao'] };
const SUB = { agenda:'Dia a dia, com a semana em cima', documentos:'Gerados com os dados do paciente', relacionamento:'Administração · retomar contato e interessados' };
const rota = () => { const r = location.hash.replace(/^#\/?/, '').split('/')[0]; return TELAS[r] ? r : 'agenda'; };
function menu(r){
  const NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
  const ir = { agenda:'agenda', documentos:'documentos', administracao:'relacionamento' };
  document.querySelector('.app').classList.toggle('open', S.aberto);
  document.getElementById('nav').innerHTML = `<div class="brand">${LOGO}<div><b>Musubi</b><small>Gestão clínica integrativa</small></div></div>` +
    NAV.map(([k, l, i]) => `<a href="#/${ir[k] || r}" ${ir[k] ? '' : 'data-a="fora"'} aria-label="${l}" class="${TELAS[r][3] === k ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  document.getElementById('topbar').innerHTML = `<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button><a class="tb-logo" href="#/agenda">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho">${r === 'relacionamento' ? `<span>Administração</span>${ic('dir')}` : ''}<span>${TELAS[r][0]}</span></nav><div class="tb-r"><span class="pill acc">Proposta da etapa 6</span></div>`;
}
let ultima = '';
function render(manter){
  const r = rota(), y = scrollY, v = document.getElementById('view'), [t, f, i] = TELAS[r]; menu(r);
  v.innerHTML = `<div class="et-h"><span class="tico acc">${ic(i)}</span><div class="grow"><h2>${t}</h2><small class="muted">${SUB[r]}</small></div></div>` + f();
  if (r !== ultima) { v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra'); ultima = r; }
  if (manter) scrollTo(0, y);
}
function toast(m, k = 'ok'){ const t = document.getElementById('toast'); t.className = 'toast ' + k; t.innerHTML = `${ic(k === 'ok' ? 'okc' : 'info')}<span></span>`; t.lastChild.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
const apt = t => S.appts.find(a => a.id === t.dataset.id);
const primeiroNome = pid => pac(pid).nome.split(' ')[0];

/* ---------- Eventos ---------- */
const tip = document.getElementById('tip');
document.addEventListener('mouseover', ev => { const t = ev.target.closest('[data-tip]'); if (!t) { tip.hidden = true; return; } tip.textContent = t.dataset.tip; tip.hidden = false; const b = t.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2)) + 'px'; tip.style.top = (b.top - tip.offsetHeight - 8 < 4 ? b.bottom + 8 : b.top - tip.offsetHeight - 8) + 'px'; });
addEventListener('hashchange', () => { S.aberto = false; render(); scrollTo(0, 0); });
document.addEventListener('click', ev => {
  tip.hidden = true;
  const t = ev.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
  if (a === 'dia') { S.dia = t.dataset.d; if (!S.remarcar) S.form.data = S.dia; S.form.hora = ''; render(true); }
  else if (a === 'sem') { S.dia = addDays(+t.dataset.d, S.dia); if (!S.remarcar) S.form.data = S.dia; S.form.hora = ''; render(true); }
  else if (a === 'hoje') { S.dia = HOJE; if (!S.remarcar) S.form.data = HOJE; S.form.hora = ''; render(true); }
  else if (a === 'ir-form-dia') { S.form.data = S.dia; S.form.hora = ''; render(true); }
  else if (a === 'livre') { S.form.hora = t.dataset.h; render(true); document.querySelector('#f-ag select[data-f="hora"]')?.focus(); }
  else if (a === 'ag-st') { const x = apt(t); x.st = t.dataset.s; render(true); }
  else if (a === 'ag-atender') { const x = apt(t); x.st = 'atendido'; render(true); toast(`Abre o atendimento de ${primeiroNome(x.pid)}; ao finalizar, o horário fica como atendido`); }
  else if (a === 'ag-desm') { const x = apt(t); x.st = 'desmarcado'; x.hist.unshift(`desmarcado em ${fmt(HOJE)}`); render(true); toast(`Horário de ${primeiroNome(x.pid)} desmarcado; ele continua na lista de desmarcados`, 'info'); }
  else if (a === 'ag-rem') { const x = apt(t); S.remarcar = x.id; S.form = { pid:x.pid, data:x.data, hora:'', serv:x.serv }; S.dia = x.data; render(true); document.getElementById('f-ag').scrollIntoView({ block:'nearest' }); }
  else if (a === 'rem-x') { S.remarcar = null; S.form.hora = ''; render(true); }
  else if (a === 'ag-doc') { S.doc.pid = t.dataset.pid; }
  else if (a === 'doc-mod') { S.doc.mod = t.dataset.m; render(true); }
  else if (a === 'doc-imp') { const pv = document.querySelector('#doc-pv .dp-t'), k = S.doc.mod;
    document.getElementById('imp').innerHTML = folha(k, pac(S.doc.pid)); document.querySelector('#imp .imp-t').innerHTML = pv.innerHTML; window.print(); }
  else if (a === 'doc-guardar') { const k = S.doc.mod; S.docs.unshift({ id:'d' + (++seq), pid:S.doc.pid, mod:k, em:HOJE, por:PROF, assinado:false }); render(true); toast(`${modelo(k)[1]} guardado no prontuário de ${primeiroNome(S.doc.pid)}`); }
  else if (a === 'doc-ass') { const d = S.docs.find(x => x.id === t.dataset.id); d.assinado = true; render(true); toast('Termo marcado como assinado'); }
  else if (a === 'rel-agendar') { S.form = { pid:t.dataset.pid, data:HOJE, hora:'', serv:'Acupuntura' }; S.remarcar = null; S.dia = HOJE; location.hash = '#/agenda'; }
  else if (a === 'rel-contato') { S.contato[t.dataset.pid] = { em:HOJE, por:PROF }; render(true); toast('Contato registrado'); }
  else if (a === 'rel-ocultar') { S.ocultos.push(t.dataset.pid); render(true); toast('Tirado da lista de retomar contato', 'info'); }
  else if (a === 'rel-volta') { S.ocultos = S.ocultos.filter(x => x !== t.dataset.pid); render(true); }
  else if (a === 'rel-ver-oc') { S.mostrarOcultos = !S.mostrarOcultos; render(true); }
  else if (a === 'int-sit') { const i = S.ints.find(x => x.id === t.dataset.id); i.sit = t.dataset.s; render(true); if (i.sit === 'paciente') toast(`Abre o cadastro de paciente já com o nome e o telefone de ${i.nome.split(' ')[0]}`); }
  else if (a === 'menu-abrir') { S.aberto = !S.aberto; render(true); }
  else if (a === 'fora') { ev.preventDefault(); toast('Nesta proposta só a Agenda, os Documentos e o Relacionamento são navegáveis', 'info'); }
});
document.addEventListener('input', ev => { const t = ev.target;
  if (t.dataset.int && t.tagName === 'INPUT') S.novoInt[t.dataset.int] = t.value; });
document.addEventListener('change', ev => { const t = ev.target;
  if (t.dataset.f) { S.form[t.dataset.f] = t.value; if (t.dataset.f === 'data') { S.dia = t.value; S.form.hora = ''; } if (t.dataset.f === 'serv' && !livres(S.form.data, S.form.serv, S.remarcar).includes(S.form.hora)) S.form.hora = ''; render(true); }
  else if (t.dataset.docf) { S.doc.pid = t.value; render(true); }
  else if (t.dataset.int) S.novoInt[t.dataset.int] = t.value; });
document.addEventListener('submit', ev => { ev.preventDefault(); const f = ev.target;
  if (f.id === 'f-ag') { const F = S.form; if (!F.hora) { toast('Escolha um horário livre', 'info'); return; }
    if (S.remarcar) { const x = S.appts.find(a => a.id === S.remarcar); x.hist.unshift(`remarcado de ${fmt(x.data)} ${x.hora}`); Object.assign(x, { data:F.data, hora:F.hora, serv:F.serv, st:'agendado' }); S.remarcar = null; toast(`${primeiroNome(x.pid)} remarcado para ${fmt(F.data)} às ${F.hora}`); }
    else { S.appts.push(ag(F.pid, F.data, F.hora, F.serv)); toast(`${primeiroNome(F.pid)} agendado para ${fmt(F.data)} às ${F.hora}`); }
    S.dia = F.data; F.hora = ''; render(true); }
  if (f.id === 'f-int') { const N = S.novoInt; if (!N.nome.trim()) return; S.ints.unshift({ id:'i' + (++seq), nome:N.nome.trim(), tel:N.tel.trim(), origem:N.origem, sit:'novo', em:HOJE }); S.novoInt = { nome:'', tel:'', origem:'Instagram' }; render(true); toast('Interessado incluído'); }
});
render();
