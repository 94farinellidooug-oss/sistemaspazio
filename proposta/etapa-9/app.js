// Proposta navegável da etapa 9 (relatórios): o período escolhido em um toque, quatro números do
// período com a comparação ao período anterior, atendimentos por mês, por serviço, recebido por forma
// de pagamento e como as queixas evoluíram. Tudo sai do que já é registrado (agenda, financeiro e
// atendimentos); nenhum campo novo para preencher. Dados fictícios, só na memória da página.
import { LOGO, ic } from '../../js/componentes/icones.js';

const brl = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });
const n0 = v => v.toLocaleString('pt-BR');
const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MES_L = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
// Dados fictícios de 2025-12 a 2026-11 (novembro até o dia 5). Índice 0 = dezembro de 2025.
const M = [
  { m:11, a:2025, at:36, falt:3, novos:4, rec:6140 }, { m:0, a:2026, at:38, falt:3, novos:5, rec:6480 }, { m:1, a:2026, at:41, falt:2, novos:4, rec:7020 },
  { m:2, a:2026, at:45, falt:4, novos:6, rec:7790 }, { m:3, a:2026, at:43, falt:3, novos:3, rec:7350 }, { m:4, a:2026, at:50, falt:3, novos:5, rec:8610 },
  { m:5, a:2026, at:47, falt:2, novos:4, rec:8090 }, { m:6, a:2026, at:52, falt:4, novos:6, rec:8930 }, { m:7, a:2026, at:55, falt:3, novos:5, rec:9480 },
  { m:8, a:2026, at:49, falt:2, novos:4, rec:8420 }, { m:9, a:2026, at:58, falt:4, novos:7, rec:10010 }, { m:10, a:2026, at:12, falt:1, novos:2, rec:2050 }
];
const SERV = [['Acupuntura', .5, 180], ['Acupuntura e moxabustão', .2, 200], ['Auriculoterapia', .15, 90], ['Ventosaterapia', .1, 150], ['Massoterapia', .05, 160]];
const FORMA = [['Pix', .55], ['Crédito', .2], ['Débito', .15], ['Dinheiro', .1]];
// [chave, rótulo, índices dos meses, rótulo do anterior, índices do anterior]
const PER = [['mes', 'Este mês', [11], 'outubro', [10]], ['passado', 'Mês passado', [10], 'setembro', [9]], ['tri', 'Últimos 3 meses', [9, 10, 11], 'os 3 meses antes', [6, 7, 8]], ['ano', 'Este ano', [1,2,3,4,5,6,7,8,9,10,11], '', []]];
const S = { aberto:false, per:'passado' };

const soma = (I, k) => I.reduce((n, i) => n + M[i][k], 0);
function compara(v, ant, inverso){
  if (!ant) return '<small class="muted">sem período anterior para comparar</small>';
  const d = Math.round((v - ant) / ant * 100), bom = inverso ? d <= 0 : d >= 0;
  return d === 0 ? '<small class="muted">igual ao período anterior</small>' : `<small class="cmp ${bom ? 'bom' : 'ruim'}">${ic(d > 0 ? 'sobe' : 'desce')}${Math.abs(d)}% em relação a ${PER.find(p => p[0] === S.per)[3]}</small>`;
}
// Barra horizontal com o valor escrito ao lado (texto em tinta, cor só na barra).
const barra = (nome, v, max, txt, tip) => `<div class="rel-b" data-tip="${tip}"><span class="rel-n">${nome}</span><span class="rel-t"><span style="width:${Math.max(2, Math.round(v / max * 100))}%"></span></span><b class="rel-v">${txt}</b></div>`;

function vRelatorios(){
  const P = PER.find(p => p[0] === S.per), I = P[2], A = P[4];
  const at = soma(I, 'at'), falt = soma(I, 'falt'), rec = soma(I, 'rec'), novos = soma(I, 'novos');
  const pf = Math.round(falt / (at + falt) * 100), nome = I.length === 1 ? MES_L[M[I[0]].m] + (I[0] === 11 ? ' (até hoje)' : '') : P[1].toLowerCase();
  const tile = (k, t, v, cmp) => `<div class="tile" data-t="${k}"><div><small>${t}</small><b class="num">${v}</b>${cmp}</div></div>`;
  // Atendimentos por mês: últimos 6 meses, ou o ano todo; os meses do período em destaque.
  const meses = S.per === 'ano' ? I : [6, 7, 8, 9, 10, 11], mx = Math.max(...meses.map(i => M[i].at));
  const serv = SERV.map(([s, f, v]) => [s, Math.round(at * f), Math.round(at * f) * v]), ms = Math.max(...serv.map(x => x[1]));
  const forma = FORMA.map(([f, p]) => [f, Math.round(rec * p)]); forma[0][1] += rec - forma.reduce((n, x) => n + x[1], 0); const mf = Math.max(...forma.map(x => x[1]));
  const cmp = Math.max(2, Math.round(at / 4)), ev = [['melhorou', 'Melhorou', Math.round(cmp * .68), 'sobe', 'ok'], ['igual', 'Sem mudança', Math.round(cmp * .24), 'linha', 'neutro'], ['piorou', 'Piorou', 0, 'desce', 'warn']];
  ev[2][2] = Math.max(0, cmp - ev[0][2] - ev[1][2]);
  return `<div class="chips p9-per" role="group" aria-label="Período">${PER.map(([k, l]) => `<button class="chip ${S.per === k ? 'on' : ''}" data-a="per" data-k="${k}" aria-pressed="${S.per === k}">${l}</button>`).join('')}</div>
  <div class="tiles rel-t4">${tile('at', 'Atendimentos', n0(at), compara(at, soma(A, 'at')))}${tile('rec', 'Recebido', brl(rec), compara(rec, soma(A, 'rec')))}${tile('falt', 'Faltas', `${falt} <span class="muted sm">· ${pf}%</span>`, compara(falt, soma(A, 'falt'), true))}${tile('novos', 'Pacientes novos', n0(novos), compara(novos, soma(A, 'novos')))}</div>
  <div class="grid g2 rel-g">
    <div class="card" id="r-mes"><div class="card-h"><h2>Atendimentos por mês<small>${S.per === 'ano' ? 'este ano' : 'últimos 6 meses'}; ${I.length > 1 ? 'os meses do período' : 'o mês escolhido'} em destaque</small></h2></div>
      <div class="rel-c" role="img" aria-label="Atendimentos por mês">${meses.map(i => `<div class="rel-col ${I.includes(i) ? 'on' : ''}" data-tip="${MES_L[M[i].m]}${i === 11 ? ' (até hoje)' : ''}: ${M[i].at} atendimentos, ${M[i].falt} faltas"><b>${M[i].at}</b><span style="height:${Math.round(M[i].at / mx * 100)}%"></span><small>${MES[M[i].m]}</small></div>`).join('')}</div>
      <details class="rel-tab"><summary>Ver como tabela</summary><table><thead><tr><th>Mês</th><th>Atendimentos</th><th>Faltas</th><th>Recebido</th></tr></thead><tbody>${meses.map(i => `<tr><td>${MES_L[M[i].m]}</td><td>${M[i].at}</td><td>${M[i].falt}</td><td>${brl(M[i].rec)}</td></tr>`).join('')}</tbody></table></details></div>
    <div class="card" id="r-serv"><div class="card-h"><h2>Por serviço<small>atendimentos em ${nome}</small></h2></div>
      <div class="rel-l">${serv.map(([s, q, v]) => barra(s, q, ms, n0(q), `${s}: ${q} atendimentos, ${brl(v)} combinados`)).join('')}</div></div>
    <div class="card" id="r-forma"><div class="card-h"><h2>Recebido por forma de pagamento<small>${brl(rec)} em ${nome}</small></h2></div>
      <div class="rel-l">${forma.map(([f, v]) => barra(f, v, mf, `${brl(v)} <span class="muted">${Math.round(v / rec * 100)}%</span>`, `${f}: ${brl(v)}`)).join('')}</div></div>
    <div class="card" id="r-ev"><div class="card-h"><h2>Como as queixas evoluíram<small>${cmp} pacientes atendidos em ${nome}, comparando a intensidade da queixa principal na primeira consulta e na última</small></h2></div>
      <div class="rel-ev">${ev.map(([k, l, q, i, c]) => `<div class="ev-i ${c}" data-ev="${k}"><span class="tico sm">${ic(i)}</span><span class="grow">${l}</span><b>${q}</b><small class="muted">${Math.round(q / cmp * 100)}%</small></div>`).join('')}</div>
      <p class="muted sm" style="margin-top:10px">Só mostra o que foi registrado na evolução; não é avaliação clínica.</p></div>
  </div>`;
}

/* ---------- Estrutura ---------- */
function render(manter){
  const y = scrollY, NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
  document.querySelector('.app').classList.toggle('open', S.aberto);
  document.getElementById('nav').innerHTML = `<div class="brand">${LOGO}<div><b>Musubi</b><small>Gestão clínica integrativa</small></div></div>` +
    NAV.map(([k, l, i]) => `<a href="#/relatorios" ${k === 'relatorios' ? '' : 'data-a="fora"'} aria-label="${l}" class="${k === 'relatorios' ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  document.getElementById('topbar').innerHTML = `<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button><a class="tb-logo" href="#/relatorios">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho"><span>Relatórios</span></nav><div class="tb-r"><span class="pill acc">Proposta · etapa 9</span></div>`;
  document.getElementById('view').innerHTML = `<div class="et-h"><span class="tico acc">${ic('relatorios')}</span><div class="grow"><h2>Relatórios</h2><small class="muted">Como a clínica está indo, a partir do que você já registra</small></div></div>` + vRelatorios();
  if (manter) scrollTo(0, y);
}
function toast(m, k = 'ok'){ const t = document.getElementById('toast'); t.className = 'toast ' + k; t.innerHTML = `${ic(k === 'ok' ? 'okc' : 'info')}<span></span>`; t.lastChild.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }

const tip = document.getElementById('tip');
document.addEventListener('mouseover', ev => { const t = ev.target.closest('[data-tip]'); if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false; const b = t.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2)) + 'px'; tip.style.top = (b.top - tip.offsetHeight - 8 < 4 ? b.bottom + 8 : b.top - tip.offsetHeight - 8) + 'px'; });
addEventListener('scroll', () => { tip.hidden = true; }, { passive:true });
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
  if (a === 'per') { S.per = t.dataset.k; render(true); }
  else if (a === 'menu-abrir') { S.aberto = !S.aberto; render(true); }
  else if (a === 'fora') { ev.preventDefault(); toast('Nesta proposta só os Relatórios são navegáveis', 'info'); }
});
addEventListener('hashchange', () => { S.aberto = false; render(); });
render();
