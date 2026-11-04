// Biblioteca clínica: Central (fichas dos pontos), Particular (fichas e anotações da clínica) e Atlas
// (silhueta com os trajetos aproximados dos 12 meridianos e dos 8 vasos). Etapa 4B.
// O conteúdo clínico é só o das fichas que já existem; os demais pontos aparecem como "ficha pendente".
import { elTag } from '../componentes/campos.js';
import { FACES, LARGURA, MERIDIANOS, PONTOS_NO_MAPA, SIGLA_VASO, TAM, VASOS_ATLAS, VISTAS, corTrajeto, desenho, pontosSvg, temTrajetoNaVista, trajetoDoPonto, trajetoSvg, vistaNome, vistasDoPonto, vistasDoTrajeto } from '../componentes/corpo.js';
import { CAUT, CODIGOS, MER, NPT, POINTS, PT, meridianoDe } from '../conhecimento/pontos.js';
import { FONTE_INDICACOES, regioesDoPonto } from '../conhecimento/indicacoes-regiao.js';
import { PARES_VASOS } from '../dados/atendimento.js';
import { bibliotecaDe } from '../dados/biblioteca.js';
import { db } from '../dados/repositorio.js';
import { ui } from '../estado.js';
import { ic } from '../componentes/icones.js';
import { esc, fmt } from '../util.js';

const AREAS_BIB = [['central','Central','lista'],['particular','Particular','escudo'],['atlas','Atlas','corpo']];

export function vPontos(){
  const area = AREAS_BIB.some(x => x[0] === ui.bib) ? ui.bib : 'central';
  return `<div class="head"><div><h1>Biblioteca clínica</h1><p>Central, Particular e Atlas · ${POINTS.length} pontos com ficha, ${CODIGOS.length} pontos nos 14 meridianos</p></div></div>
  <div class="tabs bib-t" role="tablist" aria-label="Áreas da Biblioteca">${AREAS_BIB.map(([k, n, i]) => `<button role="tab" class="${area === k ? 'on' : ''}" aria-selected="${area === k}" data-act="bib-area" data-a="${k}">${ic(i)}${n}</button>`).join('')}</div>
  ${({ central:vCentral, particular:vParticular, atlas:vAtlas })[area]()}`;
}

/* ---------- Central ---------- */
function vCentral(){
  return `<div class="grid g-side bib-g"><div class="grid" style="align-content:start">
  <div class="card" style="display:grid;gap:10px">
    <div class="field"><label class="lbl" for="pt-q">Buscar por código, nome ou ação</label><label class="busca">${ic('busca')}<input id="pt-q" value="${esc(ui.ptQ)}" placeholder="Ex.: Shen, umidade, BP6"></label></div>
    <div class="chips"><button class="chip ${!ui.ptMer?'on':''}" data-act="mer" data-m="">Todos</button>${Object.entries(MER).filter(([k])=>POINTS.some(p=>p.mer===k)).map(([k,[n]])=>`<button class="chip ${ui.ptMer===k?'on':''}" data-act="mer" data-m="${k}">${k} · ${n}</button>`).join('')}</div>
  </div>
  <div class="pcards" id="ptlist">${pointCards()}</div>
  <div class="card" id="c-todos-card"><div class="card-h"><h3>Todos os pontos dos meridianos<small>${CODIGOS.length} pontos · ${POINTS.length} com ficha · os demais com ficha pendente</small></h3></div>
    <div class="notice">${ic('info')}<div><b>Fichas pendentes.</b> Nome, localização, ações, indicações e cautelas dos demais pontos entram pela importação da fonte que você aprovar, com obra e página. O sistema não escreve esse conteúdo.</div></div>
    <div id="c-todos">${listaTodos()}</div></div>
  </div>
  ${painelFicha(ui.bibSel, 'bib-fx-x', 'Escolha um ponto', 'A ficha abre aqui, ao lado da lista.')}</div>`;
}
export function pointCards(){
  const q=ui.ptQ.toLowerCase();
  const l=POINTS.filter(p=>(!ui.ptMer||p.mer===ui.ptMer)&&(!q||(p.code+p.pinyin+p.acoes+p.loc).toLowerCase().includes(q)));
  return l.map(p=>`<div class="pcard"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span class="code">${p.code}</span><span class="muted">${p.pinyin}</span></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="muted" style="font-size:.8rem">${MER[p.mer][0]}</span>${elTag(MER[p.mer][1])}</div>
    <div><span class="lbl">Localização</span><br>${p.loc}</div><div><span class="lbl">Ações</span><br>${p.acoes}</div>${p.cautela?`<span class="pill warn" style="justify-self:start">${CAUT[p.cautela]}</span>`:''}</div>`).join('')||'<p class="muted">Nenhum ponto encontrado.</p>';
}
const botaoPonto = (c, act, sel) => `<button class="pc${PT[c] ? ' tem' : ''}${sel === c ? ' on' : ''}" data-act="${act}" data-c="${c}"><b>${c}</b><small>${PT[c] ? esc(PT[c].pinyin) : 'pendente'}</small></button>`;
export function listaTodos(){
  const q = ui.ptQ.trim().toLowerCase();
  const L = CODIGOS.filter(c => (!ui.ptMer || meridianoDe(c) === ui.ptMer) && (!q || c.toLowerCase().includes(q) || (PT[c] ? (PT[c].pinyin + PT[c].acoes + PT[c].loc).toLowerCase().includes(q) : false)));
  const grupos = Object.keys(NPT).map(m => [m, L.filter(c => meridianoDe(c) === m)]).filter(([, l]) => l.length);
  return `<p class="muted sm" id="c-total">${L.length} de ${CODIGOS.length} pontos · ${L.filter(c => PT[c]).length} com ficha</p>`
    + (grupos.map(([m, l]) => `<div class="cg"><h4>${MER[m][0]} <span class="muted">· ${m} · ${NPT[m]} pontos</span></h4><div class="pc-g">${l.map(c => botaoPonto(c, 'bib-pt', ui.bibSel)).join('')}</div></div>`).join('') || '<p class="muted">Nenhum ponto encontrado.</p>');
}

/* ---------- Ficha do ponto (Central e Atlas) ---------- */
// Regiões do corpo em que o livro indica o ponto, com a página. Só as linhas aprovadas por Mauren.
const indRegioes = c => { const L = regioesDoPonto(c), F = FONTE_INDICACOES;
  return L.length ? `<span class="ind-r">${L.map(([r, pg]) => `<span class="pill">${esc(r)} · p. ${pg}</span>`).join('')}</span><small class="muted ind-f">${esc(F.autora)}, ${esc(F.obra)} (${esc(F.editora)}) · conferido por ${esc(F.aprovadoPor)} em ${fmt(F.aprovadoEm)}</small>` : '<span class="muted">Nenhuma região aprovada na tabela.</span>'; };
function fichaPonto(c, fechar){
  const p = PT[c], m = meridianoDe(c), mer = MER[m], nota = bibliotecaDe(db).notas[c] || '', vistas = vistasDoPonto(c);
  const conteudo = p ? `<dl class="fx-dl"><dt>Meridiano</dt><dd>${esc(mer[0])} (${m})</dd><dt>Número</dt><dd>${esc(c.slice(m.length))}</dd>
      <dt>Localização</dt><dd>${esc(p.loc)}</dd><dt>Ações</dt><dd>${esc(p.acoes)}</dd>
      <dt>Indicações por região</dt><dd>${indRegioes(c)}</dd>
      <dt>Cautela</dt><dd>${p.cautela ? `<span class="pill warn">${esc(CAUT[p.cautela])}</span>` : '<span class="muted">Nenhuma cadastrada.</span>'}</dd></dl>
    <div class="fx-fonte"><span class="lbl">Fonte</span><span>Ficha existente do sistema · obra e página não informadas</span></div>`
    : `<dl class="fx-dl"><dt>Meridiano</dt><dd>${esc(mer[0])} (${m})</dd><dt>Número</dt><dd>${esc(c.slice(m.length))}</dd></dl>
    <dl class="fx-dl"><dt>Indicações por região</dt><dd>${indRegioes(c)}</dd></dl>
    <div class="notice fx-pend">${ic('info')}<div><b>Ficha pendente.</b> Nome, localização, ações, indicações e cautelas entram pela importação da fonte aprovada, com obra e página.</div></div>`;
  return `<div class="ficha" data-ficha="${c}"><div class="fx-h"><span class="fx-c">${c}</span><div class="grow"><b>${p ? esc(p.pinyin) : 'Nome pendente'}</b><small>${esc(mer[0])}${mer[1] ? ' · ' + elTag(mer[1]) : ''}</small></div>${p ? '<span class="pill ok">ficha</span>' : '<span class="pill warn fx-pend-t">ficha pendente</span>'}<button class="btn ghost sm fx-x" data-act="${fechar}" aria-label="Fechar a ficha">${ic('x')}</button></div>
    ${conteudo}
    <div class="fx-pos"><span class="lbl">Posição no mapa</span>${vistas.length ? `<span>Aproximada · ${vistas.join(', ')}</span>` : '<span class="muted">Sem posição no mapa</span>'}</div>
    <div class="fx-part"><label class="lbl" for="nota-${c}">Anotação particular da clínica</label><textarea id="nota-${c}" data-bibnota="${c}" placeholder="Fica na Particular e não altera a Central.">${esc(nota)}</textarea><small class="muted">${ic('escudo')}Particular · não altera a ficha Central</small></div></div>`;
}
function painelFicha(c, fechar, vazioT, vazioS){
  return `<aside class="fx-panel${c ? ' aberta' : ''}" aria-label="Ficha do ponto"><div class="card">${c && CODIGOS.includes(c) ? fichaPonto(c, fechar) : `<div class="fx-vazio">${ic('lista')}<b>${vazioT}</b><p class="muted sm">${vazioS}</p></div>`}</div></aside>`;
}

/* ---------- Particular ---------- */
function vParticular(){
  const B = bibliotecaDe(db), notas = Object.entries(B.notas).filter(([, t]) => String(t).trim());
  return `<div class="notice" style="margin-bottom:16px">${ic('escudo')}<div><b>Particular da clínica.</b> Fichas e anotações próprias ficam só aqui e não alteram a Central. Vão junto na cópia de segurança.</div></div>
  <div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card" id="pa-fichas"><div class="card-h"><h3>Fichas particulares</h3><span class="pill">${B.particular.length}</span></div>
      <div class="pa-l">${B.particular.map(x => `<div class="pa" data-id="${esc(x.id)}"><div class="grow"><b>${esc(x.titulo)}</b>${x.ponto ? `<button class="pill acc" data-act="bib-pa-pt" data-c="${esc(x.ponto)}">${esc(x.ponto)}</button>` : ''}<p>${esc(x.texto)}</p><small class="muted">Particular · ${fmt(String(x.em).slice(0, 10))}</small></div><button class="btn ghost sm" data-act="bib-pa-rm" data-id="${esc(x.id)}" aria-label="Apagar a ficha ${esc(x.titulo)}">${ic('x')}</button></div>`).join('') || '<p class="muted sm">Nenhuma ficha particular ainda.</p>'}</div></div>
    <div class="card" id="pa-notas"><div class="card-h"><h3>Anotações em pontos</h3><span class="pill">${notas.length}</span></div>
      <div class="pa-l">${notas.map(([c, t]) => `<div class="pa"><div class="grow"><button class="pill acc" data-act="bib-pa-pt" data-c="${esc(c)}">${esc(c)}</button><p>${esc(t)}</p><small class="muted">Feita na ficha do ponto · a ficha Central continua igual</small></div></div>`).join('') || '<p class="muted sm">Nenhuma anotação. Escreva na ficha de um ponto, na Central ou no Atlas.</p>'}</div></div>
  </div>
  <aside><form class="card pa-f" id="f-part"><div class="card-h"><h3>Nova ficha particular</h3></div>
    <div class="field"><label class="lbl" for="pa-t">Título</label><input id="pa-t" name="titulo" required placeholder="Ex.: protocolo da clínica"></div>
    <div class="field"><label class="lbl" for="pa-p">Ponto relacionado (opcional)</label><input id="pa-p" name="ponto" class="mono" placeholder="Ex.: E36"></div>
    <div class="field"><label class="lbl" for="pa-x">Texto</label><textarea id="pa-x" name="texto" required></textarea></div>
    <button class="btn pri">${ic('novo')}Adicionar à Particular</button></form></aside></div>`;
}

/* ---------- Atlas ---------- */
const ZOOMS_ATLAS = [1, 1.5, 2, 3];
const larguraAtlas = (v, z) => z === 1 ? `min(100%,${LARGURA[v]}px)` : LARGURA[v] * z + 'px';
function painelTrajeto(k){
  const vaso = VASOS_ATLAS.includes(k);
  const cab = `<div class="fx-h"><span class="fx-c tj-c" style="--c:${corTrajeto(k)}">${esc(vaso ? SIGLA_VASO[k] : k)}</span><div class="grow"><b>${esc(vaso ? k : MER[k][0])}</b><small>${vaso ? 'Vaso extraordinário' : 'Meridiano principal · ' + elTag(MER[k][1])}</small></div><button class="btn ghost sm fx-x" data-act="atl-fx-x" aria-label="Fechar">${ic('x')}</button></div>
    <p class="muted sm">Trajeto aproximado · vistas ${vistasDoTrajeto(k).join(', ')}.</p>`;
  if (vaso) {
    const [, ab, ac] = PARES_VASOS.find(p => p[0] === k), par = PARES_VASOS.find(p => p[1] === ac)?.[0];
    return `${cab}<div class="vs-p"><div><span class="lbl">Ponto de abertura</span>${botaoPonto(ab, 'atl-pt')}</div><div><span class="lbl">Ponto acoplado</span>${botaoPonto(ac, 'atl-pt')}</div></div>
      ${par ? `<p class="sm">Par: <b>${esc(par)}</b>. Os mesmos pares do Plano terapêutico.</p>` : ''}
      <p class="muted sm">A indicação de vasos no tratamento continua como dica no Plano e aguarda os seus critérios.</p>`;
  }
  const L = CODIGOS.filter(c => meridianoDe(c) === k), n = L.filter(c => PT[c]).length;
  return `${cab}<p class="sm">${L.length} pontos · <b>${n}</b> com ficha · ${L.length - n} pendentes</p><div class="pc-g">${L.map(c => botaoPonto(c, 'atl-pt')).join('')}</div>`;
}
function vAtlas(){
  const A = ui.atlas, v = A.vista, f = FACES[v] ? A.face[v] : '', [w, h] = TAM[v], ativos = A.ativos.filter(k => MERIDIANOS.includes(k) || VASOS_ATLAS.includes(k));
  const abre = new Set(PARES_VASOS.filter(p => ativos.includes(p[0])).flatMap(p => [p[1], p[2]]));
  const pts = PONTOS_NO_MAPA.filter(c => A.todos || ativos.includes(trajetoDoPonto(c)) || abre.has(c));
  const semTrajeto = ['maos','pes'].includes(v) ? [] : ativos.filter(k => !temTrajetoNaVista(k, v));
  const chip = k => `<button class="chip tjc${ativos.includes(k) ? ' on' : ''}" data-act="atl-tj" data-k="${esc(k)}" aria-pressed="${ativos.includes(k)}" style="--c:${corTrajeto(k)}"><i></i>${esc(VASOS_ATLAS.includes(k) ? k : k + ' · ' + MER[k][0])}</button>`;
  const zi = ZOOMS_ATLAS.indexOf(A.zoom);
  const painel = A.sel && CODIGOS.includes(A.sel) ? fichaPonto(A.sel, 'atl-fx-x') : A.traj && (MERIDIANOS.includes(A.traj) || VASOS_ATLAS.includes(A.traj)) ? painelTrajeto(A.traj)
    : `<div class="fx-vazio">${ic('corpo')}<b>Toque num ponto ou num trajeto</b><p class="muted sm">A ficha abre aqui, sem sair do Atlas.</p></div>`;
  return `<div class="grid g-side at-g">
    <div class="card"><div class="card-h"><h3>Atlas<small>12 meridianos e 8 vasos extraordinários</small></h3><span class="pill warn">trajetos aproximados</span></div>
      <div class="at-cols"><div class="at-ctl">
        <div class="tj-gr"><div class="tj-gh"><span class="lbl">Meridianos principais</span><button class="btn ghost sm" data-act="atl-todos" data-g="m">Todos</button><button class="btn ghost sm" data-act="atl-nenhum" data-g="m">Nenhum</button></div><div class="chips">${MERIDIANOS.map(chip).join('')}</div></div>
        <div class="tj-gr"><div class="tj-gh"><span class="lbl">Vasos extraordinários</span><button class="btn ghost sm" data-act="atl-todos" data-g="v">Todos</button><button class="btn ghost sm" data-act="atl-nenhum" data-g="v">Nenhum</button></div><div class="chips">${VASOS_ATLAS.map(chip).join('')}</div></div>
        <label class="tp-l"><input type="checkbox" data-atltodos ${A.todos ? 'checked' : ''}> Mostrar todos os pontos com posição (${PONTOS_NO_MAPA.length})</label>
        <p class="muted sm">Nos vasos, os pontos de abertura e acoplado ficam em roxo.</p></div>
      <div class="at-map">
        <div class="vbar" role="tablist" aria-label="Vistas do corpo">${VISTAS.map(([k, n]) => `<button class="vb${k === v ? ' on' : ''}" role="tab" aria-selected="${k === v}" data-act="atl-vista" data-v="${k}">${n}</button>`).join('')}</div>
        ${FACES[v] ? `<div class="seg-c vface" role="group" aria-label="Face">${FACES[v].map(([k, n]) => `<button class="${k === f ? 'on' : ''}" data-act="atl-face" data-f="${k}">${n}</button>`).join('')}</div>` : ''}
        <div class="zoom" role="group" aria-label="Ampliação"><button class="btn sm" data-act="atl-zoom" data-d="-1" aria-label="Diminuir" ${zi === 0 ? 'disabled' : ''}>−</button><span class="zoom-v">${Math.round(A.zoom * 100)}%</span><button class="btn sm" data-act="atl-zoom" data-d="1" aria-label="Ampliar" ${zi === ZOOMS_ATLAS.length - 1 ? 'disabled' : ''}>${ic('mais')}</button></div>
        <div class="mp-zoom"><svg class="mapa4 atlas${A.zoom > 1 ? ' ampliado' : ''}" data-mapa="atlas" data-vista="${v}" data-face="${f}" viewBox="0 0 ${w} ${h}" style="width:${larguraAtlas(v, A.zoom)}" role="img" aria-label="Atlas, vista ${vistaNome(v, f)}">${desenho(v, f)}${ativos.map(k => trajetoSvg(k, v, A.traj === k)).join('')}${pontosSvg(pts, v, f, c => [abre.has(c) ? 'abre' : '', A.sel === c ? 'pt-on' : ''].join(' '))}</svg></div>
        ${['maos','pes'].includes(v) ? '<p class="muted sm">Mãos e pés mostram os pontos; os trajetos aparecem nas vistas do corpo.</p>' : semTrajeto.length ? `<p class="muted sm" id="sem-trajeto">Sem trajeto nesta vista: ${semTrajeto.map(k => `${esc(k)} (${vistasDoTrajeto(k).join(', ')})`).join(' · ')}</p>` : ''}
        <div class="legenda"><span><svg viewBox="0 0 24 10" class="lg-i lg-w" aria-hidden="true"><path d="M1 5h22" class="lg-m"/></svg>Meridiano</span><span><svg viewBox="0 0 24 10" class="lg-i lg-w" aria-hidden="true"><path d="M1 5h22" class="lg-v"/></svg>Vaso extraordinário</span><span><svg viewBox="0 0 20 20" class="lg-i" aria-hidden="true"><g class="ptp"><circle cx="10" cy="10" r="4.5"/></g></svg>Ponto com posição</span><span><svg viewBox="0 0 20 20" class="lg-i" aria-hidden="true"><g class="ptp abre"><circle cx="10" cy="10" r="4.5"/></g></svg>Abertura ou acoplado</span></div>
      </div></div></div>
    <aside class="fx-panel${A.sel || A.traj ? ' aberta' : ''}" aria-label="Ficha"><div class="card">${painel}</div></aside>
  </div>`;
}
