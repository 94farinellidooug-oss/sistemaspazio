// Tela Relatórios (etapa 9): período, quatro números com comparação, atendimentos por mês, por serviço,
// recebido por forma, evolução das queixas e, no final, o que dá para fazer agora. Imprimir ou salvar em PDF.
import { PERIODOS_REL, nomeMesRel, relatorio } from '../dados/relatorios.js';
import { CLINICA } from '../dados/documentos.js';
import { db } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { LOGO, ic } from '../componentes/icones.js';
import { PROF } from './menu.js';
import { TODAY, brl, esc, fmt } from '../util.js';

const n0 = v => v.toLocaleString('pt-BR');
function comparaRel(v, ant, P, inverso){
  if (ant == null) return '<small class="muted">sem período anterior para comparar</small>';
  if (!ant) return v ? `<small class="muted">nada ${P.antEm} para comparar</small>` : `<small class="muted">igual ${P.antA}</small>`;
  const d = Math.round((v - ant) / ant * 100), bom = inverso ? d <= 0 : d >= 0;
  return d === 0 ? `<small class="muted">igual ${P.antA}</small>` : `<small class="cmp ${bom ? 'bom' : 'ruim'}">${ic(d > 0 ? 'sobe' : 'desce')}${Math.abs(d)}% em relação ${P.antA}</small>`;
}
const barraRel = (nome, v, max, txt, tip) => `<div class="rel-b" data-tip="${esc(tip)}"><span class="rel-n">${esc(nome)}</span><span class="rel-t"><span style="width:${max ? Math.max(2, Math.round(v / max * 100)) : 0}%"></span></span><b class="rel-v">${txt}</b></div>`;

export function vRelatorios(){
  ui.crumbs = [[null, 'Relatórios']];
  const R = relatorio(db, TODAY, ui.relPer || 'passado'), { P, num, ant, ev } = R, a = ant || {};
  const tile = (k, t, v, cmp) => `<div class="tile" data-t="${k}"><div><small>${t}</small><b class="num">${v}</b>${cmp}</div></div>`;
  const mx = Math.max(1, ...R.meses.map(m => m.at)), ms = Math.max(0, ...R.servicos.map(s => s.q)), mf = Math.max(0, ...R.porForma.map(f => f.v)), totF = R.porForma.reduce((n, f) => n + f.v, 0);
  const mesTxt = m => `${nomeMesRel(m.m)}${m.m === TODAY.slice(0, 7) ? ' (até hoje)' : ''}`;
  const EV = [['melhorou', 'Melhorou', 'sobe', 'ok'], ['igual', 'Sem mudança', 'linha', 'neutro'], ['piorou', 'Piorou', 'desce', 'warn']];
  return `<div class="head"><div><h1>Relatórios</h1><p>Como a clínica está indo, a partir do que você já registra</p></div></div>
  <div class="p9-bar"><div class="chips p9-per" role="group" aria-label="Período">${PERIODOS_REL.map(([k, l]) => `<button class="chip ${P.k === k ? 'on' : ''}" data-act="rel-per" data-k="${k}" aria-pressed="${P.k === k}">${l}</button>`).join('')}</div>
    <button class="btn sm" data-act="rel-imp">${ic('baixar')}Imprimir ou salvar em PDF</button></div>
  <div class="tiles rel-t4">${tile('at', 'Atendimentos', n0(num.at), comparaRel(num.at, ant && a.at, P))}${tile('rec', 'Recebido', brl(num.rec), comparaRel(num.rec, ant && a.rec, P))}${tile('falt', 'Faltas', `${num.falt} <span class="muted sm">· ${num.pf}%</span>`, comparaRel(num.falt, ant && a.falt, P, true))}${tile('novos', 'Pacientes novos', n0(num.novos), comparaRel(num.novos, ant && a.novos, P))}</div>
  <div class="grid g2 rel-g">
    <div class="card" id="r-mes"><div class="card-h"><h2>Atendimentos por mês<small>${P.k === 'ano' ? 'este ano' : 'últimos 6 meses'}; ${P.meses.length > 1 ? 'os meses do período' : 'o mês escolhido'} em destaque</small></h2></div>
      <div class="rel-c" role="img" aria-label="Atendimentos por mês">${R.meses.map(m => `<div class="rel-col ${m.on ? 'on' : ''}" data-tip="${mesTxt(m)}: ${m.at} atendimento${m.at === 1 ? '' : 's'}, ${m.falt} falta${m.falt === 1 ? '' : 's'}"><div class="rel-cb"><b>${m.at}</b><span style="height:calc((100% - 20px) * ${(m.at / mx).toFixed(3)})"></span></div><small>${nomeMesRel(m.m).slice(0, 3)}</small></div>`).join('')}</div>
      <details class="rel-tab"><summary>Ver como tabela</summary><table><thead><tr><th>Mês</th><th>Atendimentos</th><th>Faltas</th><th>Recebido</th></tr></thead><tbody>${R.meses.map(m => `<tr><td>${mesTxt(m)}</td><td>${m.at}</td><td>${m.falt}</td><td>${brl(m.rec)}</td></tr>`).join('')}</tbody></table></details></div>
    <div class="card" id="r-serv"><div class="card-h"><h2>Por serviço<small>atendimentos ${P.em}</small></h2></div>
      <div class="rel-l">${R.servicos.map(s => barraRel(s.s, s.q, ms, n0(s.q), `${s.s}: ${s.q} atendimento${s.q === 1 ? '' : 's'}${s.v ? `, ${brl(s.v)} combinados` : ''}`)).join('') || '<p class="muted sm">Nenhum atendimento no período.</p>'}</div></div>
    <div class="card" id="r-forma"><div class="card-h"><h2>Recebido por forma de pagamento<small>${brl(totF)} ${P.em}</small></h2></div>
      <div class="rel-l">${R.porForma.map(f => barraRel(f.f, f.v, mf, `${brl(f.v)} <span class="muted">${Math.round(f.v / totF * 100)}%</span>`, `${f.f}: ${brl(f.v)}`)).join('') || '<p class="muted sm">Nada recebido no período. Os recebimentos são lançados no Financeiro.</p>'}</div></div>
    <div class="card" id="r-ev"><div class="card-h"><h2>Como as queixas evoluíram<small>${ev.total} paciente${ev.total === 1 ? '' : 's'} atendido${ev.total === 1 ? '' : 's'} ${P.em}, comparando a intensidade da queixa principal na primeira consulta e na última</small></h2></div>
      ${ev.total ? `<div class="rel-ev">${EV.map(([k, l, i, c]) => `<div class="ev-i ${c}" data-ev="${k}"><span class="tico sm">${ic(i)}</span><span class="grow">${l}</span><b>${ev[k]}</b><small class="muted">${Math.round(ev[k] / ev.total * 100)}%</small></div>`).join('')}</div>` : '<p class="muted sm">Ainda não há pacientes com duas consultas registradas no período.</p>'}
      <p class="muted sm" style="margin-top:10px">Só mostra o que foi registrado na evolução; não é avaliação clínica.</p></div>
  </div>
  <div class="card" id="r-dicas"><div class="card-h"><h2>O que dá para fazer agora<small>dicas tiradas dos seus números para aumentar ou recuperar o faturamento</small></h2><span class="pill acc">${R.dicas.length}</span></div>
    ${R.dicas.length ? `<div class="dicas">${R.dicas.map(d => `<div class="dica" data-d="${d.k}"><span class="tico sm acc">${ic(d.ic)}</span><div class="grow"><b>${esc(d.t)}</b><small>${esc(d.d)}</small></div><a class="btn sm" href="#${d.ir}">${d.b}</a></div>`).join('')}</div>` : `<div class="vazio">${ic('okc')}Nada pendente agora.</div>`}</div>`;
}

// Folha para imprimir ou salvar em PDF: cabeçalho da clínica, período e a tela sem botões.
export function folhaRelatorio(){
  const v = document.getElementById('view').cloneNode(true), P = relatorio(db, TODAY, ui.relPer || 'passado').P;
  v.querySelectorAll('.head, .p9-bar, button, a.btn, details').forEach(x => x.remove());
  return `<div class="imp-h">${LOGO}<div><b>${CLINICA} · Relatórios</b><small>${P.rotulo} · impresso em ${fmt(TODAY)} por ${esc(PROF.nome)}</small></div></div><div class="rel-imp">${v.innerHTML}</div>`;
}
