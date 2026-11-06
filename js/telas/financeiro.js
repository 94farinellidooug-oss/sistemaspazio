// Tela Financeiro (etapa 8): resumo do mês, A receber, Recebidos, Pacotes, Despesas e os dados para a nota.
import { CATEGORIAS_DESP, FORMAS, aReceber, coberturaPacotes, despesasDoMes, faltaDe, recebidoDe, recebimentosDoMes, resumoMes, usosPacote } from '../dados/financeiro.js';
import { SERVICOS } from '../dados/agenda.js';
import { db, patient } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { ic } from '../componentes/icones.js';
import { TODAY, brl, esc, fmt } from '../util.js';
import { podeVer } from './conta.js';

const MESES_FIN = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const nomeMes = m => MESES_FIN[Number(m.slice(5, 7)) - 1];
// Serviço do pacote: o do último atendido do paciente (ou do último horário, ou o primeiro serviço da clínica).
export const servicoPacote = pid => { const L = db.appts.filter(a => a.pid === pid && a.st !== 'desmarcado').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return (L.find(a => a.done) || L[0])?.tipo || SERVICOS[0][0]; };

export function vFinanceiro(){
  ui.crumbs = [[null, 'Financeiro']]; const vd = podeVer('despesas');
  const mes = TODAY.slice(0, 7), nm = nomeMes(mes), R = resumoMes(db, mes, TODAY), pend = aReceber(db, TODAY), recs = recebimentosDoMes(db, mes);
  const cob = coberturaPacotes(db), desp = despesasDoMes(db, mes), P = db.financeiro?.pacotes || [], Rx = ui.finRec, NP = ui.finPac;
  const tile = (k, t, v, sub, cls = '') => `<div class="tile ${cls}" data-t="${k}"><div><small>${t}</small><b class="num">${brl(v)}</b><small>${sub}</small></div></div>`;
  const pacs = [...db.patients].sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="head"><div><h1>Financeiro · ${nm} de ${mes.slice(0, 4)}</h1><p>O combinado em cada atendimento e o que entrou de fato</p></div></div>
  <div class="tiles fin-t">${tile('rec', `Recebido em ${nm}`, R.rec, 'o que entrou de fato', 't-ok')}${tile('arec', 'A receber', R.aRec, `${R.pend} atendimento${R.pend === 1 ? '' : 's'} em aberto`, R.aRec ? 't-warn' : '')}${vd ? tile('desp', 'Despesas do mês', R.desp, `${R.nDesp} lançamento${R.nDesp === 1 ? '' : 's'}`) + tile('saldo', 'Saldo do mês', R.saldo, 'recebido menos despesas', R.saldo < 0 ? 't-crit' : '') : ''}</div>
  <div class="grid g-side ag-cols"><div class="grid" style="align-content:start">
    <div class="card" id="f-arec"><div class="card-h"><h2>A receber<small>atendimentos feitos que ainda não foram pagos (ou só em parte)</small></h2><span class="pill ${pend.length ? 'warn' : 'ok'}">${pend.length}</span></div>
      <div class="hor-l">${pend.map(a => { const p = patient(a.pid), pg = recebidoDe(db, a.id), aberto = Rx?.ap === a.id; return `<div class="fin-l" data-ap="${a.id}"><div class="hor-h"><b>${fmt(a.date).slice(0, 5)}</b><small>${a.date === TODAY ? 'hoje' : ''}</small></div>
        <div class="hor-p"><button class="lk" data-act="open" data-pid="${a.pid}">${esc(p?.name || '')}</button><small>${esc(a.tipo)} · ${brl(a.valor || 0)}${pg ? ` · já pagou ${brl(pg)}` : ''}</small></div><b class="fin-v">${brl(faltaDe(db, a, cob))}</b>
        ${aberto ? `<form class="fin-rec" data-ap="${a.id}"><div class="chips" role="group" aria-label="Forma de pagamento">${FORMAS.map(f => `<button type="button" class="chip ${Rx.forma === f ? 'on' : ''}" data-act="fin-forma" data-f="${f}" aria-pressed="${Rx.forma === f}">${f}</button>`).join('')}</div>
          <label class="rx-f fin-val"><span class="lbl">Valor recebido</span><input id="rec-v" inputmode="decimal" value="${esc(Rx.valor)}" autocomplete="off"></label><div class="chips"><button class="btn sm pri">${ic('check')}Confirmar</button><button type="button" class="btn sm ghost" data-act="fin-rec-x">Cancelar</button></div></form>`
          : `<div class="hor-a"><button class="btn sm pri" data-act="fin-receber" data-ap="${a.id}">${ic('check')}Receber</button></div>`}</div>`; }).join('') || `<div class="vazio">${ic('okc')}Tudo recebido.</div>`}</div></div>
    <div class="card" id="f-recs"><div class="card-h"><h2>Recebidos em ${nm}<small>com a forma de pagamento</small></h2></div>
      <div class="hor-l">${recs.map(r => { const a = db.appts.find(x => x.id === r.ap), p = a && patient(a.pid); return `<div class="fin-l rec" data-rec="${r.id}"><div class="hor-h"><b>${fmt(r.data).slice(0, 5)}</b></div><div class="hor-p"><b>${esc(p?.name || r.nome || '')}</b><small>${esc(a?.tipo || r.tipo || '')} · <span class="pill sm">${r.forma}</span>${a && r.valor < (a.valor || 0) ? ' · parcial' : ''}</small></div><b class="fin-v">${brl(r.valor)}</b>
        <div class="hor-a">${ui.finDesf === r.id ? `<button class="btn sm" data-act="fin-desf-ok" data-r="${r.id}">Desfazer mesmo</button><button class="btn sm ghost" data-act="fin-desf-x">Manter</button>` : `<button class="btn sm ghost" data-act="fin-nota" data-r="${r.id}" aria-label="Copiar dados da nota" data-tip="Dados da nota">${ic('doc')}</button><button class="btn sm ghost" data-act="fin-desf" data-r="${r.id}" aria-label="Desfazer recebimento" data-tip="Desfazer">${ic('retorno')}</button>`}</div></div>`; }).join('') || '<p class="muted sm">Nada recebido ainda neste mês.</p>'}</div></div>
  </div><div class="grid" style="align-content:start">
    <div class="card" id="f-pac"><div class="card-h"><h2>Pacotes<small>sessões pagas antes; cada atendimento desconta uma</small></h2></div>
      <div class="hor-l">${P.map(k => { const u = usosPacote(db, k, cob); return `<div class="pac ${u >= k.total ? 'fim' : ''}" data-pac="${k.id}"><div class="grow"><b>${esc(patient(k.pid)?.name || k.nome || '')}</b><small>${esc(k.serv)} · ${k.total} sessões · ${brl(k.valor)} · pago em ${fmt(k.em)}</small>
        <div class="pac-b" role="img" aria-label="${u} de ${k.total} sessões usadas"><span style="width:${Math.round(u / k.total * 100)}%"></span></div></div><b class="pac-n">${u}/${k.total}</b></div>`; }).join('') || '<p class="muted sm">Nenhum pacote ainda.</p>'}</div>
      ${NP ? `<form id="f-novo-pac" class="ag-f" style="margin-top:12px"><label class="rx-f full"><span class="lbl">Paciente</span><select id="np-p">${pacs.map(p => `<option value="${p.id}" ${NP.pid === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label class="rx-f"><span class="lbl">Sessões</span><input id="np-s" type="number" min="1" value="${esc(NP.total)}"></label><label class="rx-f"><span class="lbl">Valor total</span><input id="np-v" inputmode="decimal" value="${esc(NP.valor)}" autocomplete="off"></label>
        <small class="muted full" id="np-serv">Serviço: ${esc(servicoPacote(NP.pid))}</small>
        <div class="full chips"><button class="btn sm pri">${ic('check')}Criar pacote</button><button type="button" class="btn sm ghost" data-act="fin-pac-x">Cancelar</button></div></form>`
      : `<button class="btn sm" data-act="fin-novo-pac" style="margin-top:10px">${ic('mais')}Novo pacote</button>`}</div>
    ${vd ? `<div class="card" id="f-desp"><div class="card-h"><h2>Despesas de ${nm}<small>o que saiu</small></h2></div>
      <div class="hor-l">${desp.map(d => `<div class="fin-l desp" data-d="${d.id}"><div class="hor-h"><b>${fmt(d.data).slice(0, 5)}</b></div><div class="hor-p"><b>${esc(d.desc)}</b><small>${d.cat}${d.repete ? ' · todo mês' : ''}</small></div><b class="fin-v neg">${brl(d.valor)}</b>
        <div class="hor-a">${ui.finDespX === d.id ? `<button class="btn sm" data-act="fin-desp-ok" data-d="${d.id}">${d.repetida ? 'Parar de repetir' : 'Tirar mesmo'}</button><button class="btn sm ghost" data-act="fin-desp-n">Manter</button>` : `<button class="btn sm ghost" data-act="fin-desp-x" data-d="${d.id}" aria-label="Tirar despesa" data-tip="Tirar">${ic('x')}</button>`}</div></div>`).join('') || '<p class="muted sm">Nenhuma despesa lançada neste mês.</p>'}</div>
      <form id="f-nova-desp" class="ag-f" style="margin-top:12px"><label class="rx-f full"><span class="lbl">Despesa</span><input id="nd-d" placeholder="Ex.: conta de luz" autocomplete="off"></label>
        <label class="rx-f"><span class="lbl">Valor</span><input id="nd-v" inputmode="decimal" placeholder="0,00" autocomplete="off"></label><label class="rx-f"><span class="lbl">Tipo</span><select id="nd-c">${CATEGORIAS_DESP.map(c => `<option>${c}</option>`).join('')}</select></label>
        <label class="ck full"><input type="checkbox" id="nd-r"> Repete todo mês</label><div class="full"><button class="btn sm pri">${ic('mais')}Lançar despesa</button></div></form></div>` : ''}
    <div class="card" id="f-nota"><h2>Nota fiscal</h2><p class="muted sm">A emissão automática da nota de serviço (NFS-e) entra na etapa 10, junto com o servidor e o login. Por enquanto, em cada recebimento o botão <b>Dados da nota</b> copia paciente, CPF, serviço, valor e data, prontos para colar no emissor.</p></div>
  </div></div>`;
}
