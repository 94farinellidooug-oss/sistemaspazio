// Blocos de tela do conhecimento clínico do Maicon (js/conhecimento/protocolos.js): protocolo de uma síndrome,
// quadro "como diferenciar" e chips de pontos com a técnica.
import { CAUT, PT } from '../conhecimento/pontos.js';
import { DIFERENCIAIS, MOXA_TXT, PADROES_MAIS, PROTOCOLOS, TECNICAS_PROTOCOLO, diferenciaisDe } from '../conhecimento/protocolos.js';
import { PATTERNS } from '../conhecimento/padroes.js';
import { ic } from './icones.js';
import { esc } from '../util.js';

export const nomeSindrome = id => [...PATTERNS, ...PADROES_MAIS].find(x => x.id === id)?.nome || PROTOCOLOS[id]?.nome || id;
const tecTxt = k => TECNICAS_PROTOCOLO[k] || k || '';
// Técnica geral do protocolo (com a moxa), em uma linha.
export const tecnicaProtocolo = P => [tecTxt(P.tecnica), P.moxa ? MOXA_TXT[P.moxa] : '', P.extra || ''].filter(Boolean).join(' · ');

// Fisiopatologia, princípio, técnica e pontos (com a ação de cada um).
export function blocoProtocolo(id, { aberto = false } = {}){
  const P = PROTOCOLOS[id]; if (!P) return '';
  return `<details class="mais proto"${aberto ? ' open' : ''}><summary>${ic('plano')}Protocolo: princípio e pontos ${ic('baixo')}</summary>
    <p class="sm"><b>Fisiopatologia:</b> ${esc(P.fisio)}</p><p class="sm"><b>Princípio:</b> ${esc(P.principio)}</p>
    <p class="sm"><b>Técnica:</b> ${esc(tecnicaProtocolo(P))}</p>
    <ul class="proto-p">${P.pontos.map(([c, a, t]) => `<li><span class="mono">${esc(c)}</span>${PT[c]?.pinyin ? ` <span class="muted">${esc(PT[c].pinyin)}</span>` : ''}${t ? ` <span class="pill">${esc(tecTxt(t))}</span>` : ''}${PT[c]?.cautela ? ` <span class="pill warn">${esc(CAUT[PT[c].cautela])}</span>` : ''}<small class="muted">${esc(a)}</small></li>`).join('')}</ul></details>`;
}

// "Como diferenciar": quando duas ou mais síndromes parecidas aparecem juntas (ids das hipóteses não descartadas).
export function cardDiferencial(ids){
  const D = diferenciaisDe(ids); if (!D.length) return '';
  const tem = new Set(ids);
  return `<div class="card dif"><div class="card-h"><h3>${ic('info')} Como diferenciar</h3><span class="pill">diagnóstico diferencial</span></div>
    ${D.map(d => `<div class="dif-i"><b>${esc(d.titulo)}</b><p class="muted sm">Em comum: ${esc(d.comum)}</p>
      ${d.ids.filter(i => tem.has(i)).map(i => `<div class="dif-c"><span class="lbl">${esc(nomeSindrome(i))}</span><p class="sm">${esc(d.criterio[i])}</p></div>`).join('')}</div>`).join('')}</div>`;
}

// Chips de pontos para incluir no plano (toque inclui; o profissional decide).
export const chipsPontos = (L, P, act = 'at-pt') => `<div class="chips">${L.map(([c, j, t]) => `<button class="chip mono ${P.includes(c) ? 'on' : ''}" data-act="${act}" data-c="${esc(c)}" title="${esc(j || PT[c]?.funcao || '')}${t ? ' · ' + esc(tecTxt(t)) : ''}${PT[c]?.cautela ? ' · ' + esc(CAUT[PT[c].cautela]) : ''}">${esc(c)}${PT[c]?.cautela ? ' ⚠' : ''}</button>`).join('')}</div>`;
