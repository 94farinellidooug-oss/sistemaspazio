// Proposta navegável da etapa 8 (financeiro, sem serviço externo): receber por atendimento (com forma
// de pagamento e pagamento parcial), pacotes de sessões, despesas do mês (com as que se repetem) e o
// resumo do mês separando o combinado do que entrou de fato. A nota fiscal entra depois, quando o
// caminho for escolhido com o Maicon. Dados fictícios, só na memória da página.
import { LOGO, ic } from '../../js/componentes/icones.js';
import { esc, fmt } from '../../js/util.js';

const HOJE = '2026-11-05', MES = '2026-11';
const brl = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const FORMAS = ['Pix', 'Dinheiro', 'Débito', 'Crédito'];
const CATEG = ['Aluguel', 'Material', 'Contas', 'Outros'];
const PAC = [['p1','Marina Costa'],['p2','João Pereira'],['p3','Helena Souza'],['p4','Carlos Lima'],['p5','Ana Ribeiro']];
const nomeP = id => PAC.find(p => p[0] === id)?.[1] || '';
let seq = 0; const id = () => 'x' + (++seq);
// Atendimentos feitos: valor combinado (do serviço); pago = soma dos recebimentos; pacote = coberto pelo pacote.
const at = (pid, data, serv, valor, pac) => ({ id:id(), pid, data, serv, valor, pac:pac || null });
const S = {
  aberto:false,
  ats:[ at('p1','2026-11-03','Acupuntura',180), at('p2','2026-11-03','Acupuntura e moxabustão',200), at('p3','2026-11-04','Acupuntura',180,'k1'),
        at('p4','2026-11-04','Auriculoterapia',90), at('p5','2026-11-05','Ventosaterapia',150), at('p1','2026-11-05','Acupuntura',180), at('p3','2026-10-28','Acupuntura',180,'k1') ],
  rec:[], pacotes:[ { id:'k1', pid:'p3', serv:'Acupuntura', total:10, valor:1500, pago:1500, em:'2026-10-20' } ],
  desp:[ { id:'d1', desc:'Aluguel da sala', cat:'Aluguel', valor:1200, data:'2026-11-01', repete:true }, { id:'d2', desc:'Agulhas e moxa', cat:'Material', valor:230, data:'2026-11-03', repete:false } ],
  receber:null, novoPac:null, desfazer:null
};
// Recebimento já feito no começo do mês
S.rec.push({ id:id(), at:S.ats[0].id, valor:180, forma:'Pix', data:'2026-11-03' }, { id:id(), at:S.ats[1].id, valor:100, forma:'Dinheiro', data:'2026-11-03' });

const pagoDe = a => S.rec.filter(r => r.at === a.id).reduce((n, r) => n + r.valor, 0);
const falta = a => a.pac ? 0 : Math.max(0, a.valor - pagoDe(a));
const doMes = d => d.slice(0, 7) === MES;
const usadas = k => S.ats.filter(a => a.pac === k.id).length;
function resumo(){
  const rec = S.rec.filter(r => doMes(r.data)).reduce((n, r) => n + r.valor, 0) + S.pacotes.filter(k => doMes(k.em)).reduce((n, k) => n + k.pago, 0);
  const aRec = S.ats.reduce((n, a) => n + falta(a), 0), desp = S.desp.filter(d => doMes(d.data)).reduce((n, d) => n + d.valor, 0);
  const comb = S.ats.filter(a => doMes(a.data) && !a.pac).reduce((n, a) => n + a.valor, 0);
  return { rec, aRec, desp, saldo:rec - desp, comb };
}

function vFinanceiro(){
  const R = resumo(), pend = S.ats.filter(a => falta(a) > 0).sort((a, b) => a.data.localeCompare(b.data)), recs = S.rec.filter(r => doMes(r.data)).slice().reverse();
  const tile = (k, t, v, sub, cls = '') => `<div class="tile ${cls}" data-t="${k}"><div><small>${t}</small><b class="num">${brl(v)}</b><small>${sub}</small></div></div>`;
  return `<div class="tiles fin-t">${tile('rec', 'Recebido em novembro', R.rec, 'o que entrou de fato', 't-ok')}${tile('arec', 'A receber', R.aRec, `${pend.length} atendimento${pend.length === 1 ? '' : 's'} em aberto`, R.aRec ? 't-warn' : '')}${tile('desp', 'Despesas do mês', R.desp, `${S.desp.filter(d => doMes(d.data)).length} lançamentos`)}${tile('saldo', 'Saldo do mês', R.saldo, 'recebido menos despesas', R.saldo < 0 ? 't-crit' : '')}</div>
  <div class="grid g-side ag-cols"><div class="grid" style="align-content:start">
    <div class="card" id="f-arec"><div class="card-h"><h3>A receber<small>atendimentos feitos que ainda não foram pagos (ou só em parte)</small></h3><span class="pill ${pend.length ? 'warn' : 'ok'}">${pend.length}</span></div>
      <div class="hor-l">${pend.map(a => { const pg = pagoDe(a), R2 = S.receber?.at === a.id ? S.receber : null; return `<div class="fin-l" data-at="${a.id}"><div class="hor-h"><b>${fmt(a.data).slice(0, 5)}</b><small>${a.data === HOJE ? 'hoje' : ''}</small></div>
        <div class="hor-p"><b>${esc(nomeP(a.pid))}</b><small>${esc(a.serv)} · ${brl(a.valor)}${pg ? ` · já pagou ${brl(pg)}` : ''}</small></div><b class="fin-v">${brl(falta(a))}</b>
        ${R2 ? `<form class="fin-rec" data-at="${a.id}"><div class="chips" role="group" aria-label="Forma de pagamento">${FORMAS.map(f => `<button type="button" class="chip ${R2.forma === f ? 'on' : ''}" data-a="forma" data-f="${f}" aria-pressed="${R2.forma === f}">${f}</button>`).join('')}</div>
          <label class="rx-f fin-val"><span class="lbl">Valor recebido</span><input id="rec-v" inputmode="decimal" value="${R2.valor}"></label><div class="chips"><button class="btn sm pri">${ic('check')}Confirmar</button><button type="button" class="btn sm ghost" data-a="rec-x">Cancelar</button></div></form>`
          : `<div class="hor-a"><button class="btn sm pri" data-a="receber" data-at="${a.id}">${ic('check')}Receber</button></div>`}</div>`; }).join('') || `<div class="vazio">${ic('okc')}Tudo recebido.</div>`}</div></div>
    <div class="card" id="f-recs"><div class="card-h"><h3>Recebidos em novembro<small>com a forma de pagamento</small></h3></div>
      <div class="hor-l">${recs.map(r => { const a = S.ats.find(x => x.id === r.at); return `<div class="fin-l rec" data-rec="${r.id}"><div class="hor-h"><b>${fmt(r.data).slice(0, 5)}</b></div><div class="hor-p"><b>${esc(nomeP(a.pid))}</b><small>${esc(a.serv)} · <span class="pill sm">${r.forma}</span>${r.valor < a.valor ? ' · parcial' : ''}</small></div><b class="fin-v">${brl(r.valor)}</b>
        <div class="hor-a">${S.desfazer === r.id ? `<button class="btn sm" data-a="desf-ok" data-r="${r.id}">Desfazer mesmo</button><button class="btn sm ghost" data-a="desf-x">Manter</button>` : `<button class="btn sm ghost" data-a="desf" data-r="${r.id}" aria-label="Desfazer recebimento" data-tip="Desfazer">${ic('retorno')}</button>`}</div></div>`; }).join('') || '<p class="muted sm">Nada recebido ainda neste mês.</p>'}</div></div>
  </div><div class="grid" style="align-content:start">
    <div class="card" id="f-pac"><div class="card-h"><h3>Pacotes<small>sessões pagas antes; cada atendimento desconta uma</small></h3></div>
      <div class="hor-l">${S.pacotes.map(k => { const u = usadas(k); return `<div class="pac" data-pac="${k.id}"><div class="grow"><b>${esc(nomeP(k.pid))}</b><small>${esc(k.serv)} · ${k.total} sessões · ${brl(k.valor)}${k.pago < k.valor ? ` · falta ${brl(k.valor - k.pago)}` : ' · pago'}</small>
        <div class="pac-b" role="img" aria-label="${u} de ${k.total} sessões usadas"><span style="width:${Math.round(u / k.total * 100)}%"></span></div></div><b class="pac-n">${u}/${k.total}</b></div>`; }).join('')}</div>
      ${S.novoPac ? `<form id="f-novo-pac" class="ag-f" style="margin-top:12px"><label class="rx-f full"><span class="lbl">Paciente</span><select id="np-p">${PAC.map(([i, n]) => `<option value="${i}" ${S.novoPac.pid === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="rx-f"><span class="lbl">Sessões</span><input id="np-s" type="number" min="1" value="${S.novoPac.total}"></label><label class="rx-f"><span class="lbl">Valor total</span><input id="np-v" inputmode="decimal" value="${S.novoPac.valor}"></label>
        <div class="full chips"><button class="btn sm pri">${ic('check')}Criar pacote</button><button type="button" class="btn sm ghost" data-a="pac-x">Cancelar</button></div></form>`
      : `<button class="btn sm" data-a="novo-pac" style="margin-top:10px">${ic('mais')}Novo pacote</button>`}</div>
    <div class="card" id="f-desp"><div class="card-h"><h3>Despesas de novembro<small>o que saiu</small></h3></div>
      <div class="hor-l">${S.desp.filter(d => doMes(d.data)).map(d => `<div class="fin-l desp" data-d="${d.id}"><div class="hor-h"><b>${fmt(d.data).slice(0, 5)}</b></div><div class="hor-p"><b>${esc(d.desc)}</b><small>${d.cat}${d.repete ? ' · todo mês' : ''}</small></div><b class="fin-v neg">${brl(d.valor)}</b></div>`).join('')}</div>
      <form id="f-nova-desp" class="ag-f" style="margin-top:12px"><label class="rx-f full"><span class="lbl">Despesa</span><input id="nd-d" placeholder="Ex.: conta de luz" autocomplete="off"></label>
        <label class="rx-f"><span class="lbl">Valor</span><input id="nd-v" inputmode="decimal" placeholder="0,00"></label><label class="rx-f"><span class="lbl">Tipo</span><select id="nd-c">${CATEG.map(c => `<option>${c}</option>`).join('')}</select></label>
        <label class="ck full"><input type="checkbox" id="nd-r"> Repete todo mês</label><div class="full"><button class="btn sm pri">${ic('mais')}Lançar despesa</button></div></form></div>
    <div class="card"><h3>Nota fiscal</h3><p class="muted sm">A emissão da nota de serviço (NFS-e) entra quando escolhermos juntos o caminho, conforme a cidade da clínica. Cada recebimento já guarda o que a nota vai precisar: paciente, serviço, valor e data.</p></div>
  </div></div>`;
}

/* ---------- Estrutura ---------- */
function render(manter){
  const y = scrollY, NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
  document.querySelector('.app').classList.toggle('open', S.aberto);
  document.getElementById('nav').innerHTML = `<div class="brand">${LOGO}<div><b>Musubi</b><small>Gestão clínica integrativa</small></div></div>` +
    NAV.map(([k, l, i]) => `<a href="#/financeiro" ${k === 'financeiro' ? '' : 'data-a="fora"'} aria-label="${l}" class="${k === 'financeiro' ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  document.getElementById('topbar').innerHTML = `<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button><a class="tb-logo" href="#/financeiro">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho"><span>Financeiro</span></nav><div class="tb-r"><span class="pill acc">Proposta · etapa 8</span></div>`;
  document.getElementById('view').innerHTML = `<div class="et-h"><span class="tico acc">${ic('financeiro')}</span><div class="grow"><h2>Financeiro · novembro de 2026</h2><small class="muted">O combinado em cada atendimento e o que entrou de fato</small></div></div>` + vFinanceiro();
  if (manter) scrollTo(0, y);
}
function toast(m, k = 'ok'){ const t = document.getElementById('toast'); t.className = 'toast ' + k; t.innerHTML = `${ic(k === 'ok' ? 'okc' : 'info')}<span></span>`; t.lastChild.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
const num = s => Number(String(s).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
  if (a === 'receber') { const x = S.ats.find(z => z.id === t.dataset.at); S.receber = { at:x.id, forma:'Pix', valor:String(falta(x)).replace('.', ',') }; render(true); document.getElementById('rec-v')?.focus(); }
  else if (a === 'forma') { S.receber.valor = document.getElementById('rec-v').value; S.receber.forma = t.dataset.f; render(true); }
  else if (a === 'rec-x') { S.receber = null; render(true); }
  else if (a === 'desf') { S.desfazer = t.dataset.r; render(true); }
  else if (a === 'desf-x') { S.desfazer = null; render(true); }
  else if (a === 'desf-ok') { S.rec = S.rec.filter(r => r.id !== t.dataset.r); S.desfazer = null; render(true); toast('Recebimento desfeito; voltou para A receber', 'info'); }
  else if (a === 'novo-pac') { S.novoPac = { pid:'p1', total:10, valor:'1500' }; render(true); }
  else if (a === 'pac-x') { S.novoPac = null; render(true); }
  else if (a === 'menu-abrir') { S.aberto = !S.aberto; render(true); }
  else if (a === 'fora') { ev.preventDefault(); toast('Nesta proposta só o Financeiro é navegável', 'info'); }
});
document.addEventListener('submit', ev => { ev.preventDefault(); const f = ev.target;
  if (f.matches('.fin-rec')) { const x = S.ats.find(z => z.id === f.dataset.at), v = num(document.getElementById('rec-v').value);
    if (!(v > 0)) { toast('Informe o valor recebido', 'info'); return; } if (v > falta(x) + 0.001) { toast(`O valor passa do que falta (${brl(falta(x))})`, 'info'); return; }
    S.rec.push({ id:id(), at:x.id, valor:v, forma:S.receber.forma, data:HOJE }); S.receber = null; render(true); toast(falta(x) > 0 ? `${brl(v)} recebido; ficou faltando ${brl(falta(x))}` : `${brl(v)} recebido de ${nomeP(x.pid).split(' ')[0]}`); }
  else if (f.id === 'f-novo-pac') { const tot = Number(document.getElementById('np-s').value), v = num(document.getElementById('np-v').value);
    if (!(tot > 0) || !(v > 0)) { toast('Informe as sessões e o valor', 'info'); return; }
    S.pacotes.push({ id:id(), pid:document.getElementById('np-p').value, serv:'Acupuntura', total:tot, valor:v, pago:v, em:HOJE }); S.novoPac = null; render(true); toast('Pacote criado'); }
  else if (f.id === 'f-nova-desp') { const d = document.getElementById('nd-d').value.trim(), v = num(document.getElementById('nd-v').value);
    if (!d || !(v > 0)) { toast('Informe a despesa e o valor', 'info'); return; }
    S.desp.push({ id:id(), desc:d, cat:document.getElementById('nd-c').value, valor:v, data:HOJE, repete:document.getElementById('nd-r').checked }); render(true); toast('Despesa lançada'); }
});
addEventListener('hashchange', () => { S.aberto = false; render(); });
render();
