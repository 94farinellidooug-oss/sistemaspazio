// Mapa corporal (etapa 4A): seis vistas com silhuetas próprias, lado anatômico do paciente, posições
// aproximadas dos pontos que já têm ficha e o desenho das marcações. As marcações guardam x e y como
// fração do desenho de cada vista (0 a 1), por isso não dependem do tamanho da tela nem da ampliação.
// Tudo aqui é aproximado e só de apresentação: nenhum cálculo clínico.
import { TIPOS_MARCA, marcaComIntensidade } from '../dados/atendimento.js';
import { esc, fmt } from '../util.js';

/* ---------- Vistas ---------- */
export const VISTAS = [['anterior','Anterior'],['posterior','Posterior'],['lat_d','Lateral direita'],['lat_e','Lateral esquerda'],['maos','Mãos'],['pes','Pés']];
export const FACES = { maos:[['palmar','Palmar'],['dorsal','Dorsal']], pes:[['dorsal','Dorsal'],['plantar','Plantar']] };
export const TAM = { anterior:[200,430], posterior:[200,430], lat_d:[200,430], lat_e:[200,430], maos:[280,256], pes:[280,276] };
export const LARGURA = { anterior:240, posterior:240, lat_d:240, lat_e:240, maos:460, pes:440 };
export const vistaNome = (v, f) => VISTAS.find(x => x[0] === v)[1] + (FACES[v] && f ? ' · ' + FACES[v].find(x => x[0] === f)[1].toLowerCase() : '');
// Mãos palmares e pés dorsais: o lado direito do paciente fica à esquerda de quem olha, como na vista anterior.
export const direitaAEsquerda = (v, f) => v === 'anterior' || (v === 'maos' && f === 'palmar') || (v === 'pes' && f === 'dorsal');
const eixo = v => v === 'anterior' || v === 'posterior' ? 100 : v === 'maos' || v === 'pes' ? 140 : null;
// Lado anatômico do paciente sugerido pela posição tocada. O profissional pode trocar.
export function ladoDe(v, f, x){
  if (v === 'lat_d') return 'dir';
  if (v === 'lat_e') return 'esq';
  if (eixo(v) === 100 && Math.abs(x - 100) < 5) return 'na';
  return (x < eixo(v)) === direitaAEsquerda(v, f) ? 'dir' : 'esq';
}

/* ---------- Silhuetas próprias (aproximadas) ----------
   Contornos desenhados para o projeto, com proporções anatômicas, ligados por curvas suaves. */
const n1 = v => +v.toFixed(1);
function suave(pts){
  const n = pts.length; let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${n1(p1[0] + (p2[0] - p0[0]) / 6)} ${n1(p1[1] + (p2[1] - p0[1]) / 6)} ${n1(p2[0] - (p3[0] - p1[0]) / 6)} ${n1(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
  }
  return d + 'Z';
}
const curva = pts => { let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)]; d += `C${n1(p1[0] + (p2[0] - p0[0]) / 6)} ${n1(p1[1] + (p2[1] - p0[1]) / 6)} ${n1(p2[0] - (p3[0] - p1[0]) / 6)} ${n1(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`; } return d; };
const espelhoX = (pts, c) => pts.map(([x, y]) => [2 * c - x, y]);
// Metade direita do paciente na vista anterior (à esquerda de quem olha), do alto da cabeça ao períneo.
const MEIO_CORPO = [[100,8],[90,10],[83,16],[80,26],[80,36],[83,45],[88,52],[93,56],[93,63],
  [84,67],[72,70],[61,73],[53,78],[48,86],[46,98],[44,112],[42,128],[40,146],[38,160],[36,174],[33,192],[30,210],[28,222],
  [25,230],[22,240],[21,250],[24,258],[29,262],[34,260],[37,252],[39,244],[40,236],[42,228],
  [44,214],[47,196],[50,178],[52,164],[53,148],[55,132],[57,116],[59,104],
  [61,112],[61,126],[62,142],[64,158],[63,172],[60,188],[58,204],
  [58,226],[59,250],[62,276],[66,300],[67,316],[66,334],[68,356],[72,378],[76,396],[75,406],[72,414],[74,421],[82,424],[92,423],[98,418],[98,408],[97,396],
  [95,376],[94,352],[95,330],[95,312],[96,292],[97,268],[98,246],[99,232],[100,226]];
const CONTORNO_CORPO = suave([...MEIO_CORPO, ...espelhoX(MEIO_CORPO.slice(1, -1).reverse(), 100)]);
const dup = (pts, c = 100) => curva(pts) + curva(espelhoX(pts, c));
const DET_ANT = `<path class="det" d="${dup([[94,66],[84,72],[70,73]])}${dup([[64,96],[72,110],[86,112],[96,106]])}${dup([[70,184],[84,204],[96,218]])}${dup([[72,306],[78,300],[86,302],[90,310]])}${dup([[74,394],[78,398]])}${curva([[100,118],[100,166]])}${dup([[88,30],[92,29]])}${curva([[96,42],[100,43],[104,42]])}"/><circle class="det" cx="100" cy="176" r="1.6"/>`;
const DET_POST = `<path class="det" d="${curva([[82,22],[90,14],[100,12],[110,14],[118,22]])}${curva([[100,66],[100,206]])}${dup([[66,90],[74,108],[86,118],[90,104],[84,92]])}${dup([[86,212],[76,222],[64,224]])}${curva([[100,206],[100,224]])}${dup([[70,312],[80,316],[90,312]])}${dup([[80,404],[86,410],[92,406]])}${dup([[92,58],[90,64]])}"/>`;
// Perfil direito: o paciente olha para a direita de quem vê.
const CONTORNO_PERFIL = suave([[98,10],[110,13],[116,20],[118,27],[117,31],[122,37],[118,40],[119,44],[117,47],[117,52],[111,55],[106,57],[106,64],
  [112,70],[121,80],[126,96],[125,114],[120,128],[121,146],[125,164],[126,184],[122,204],
  [124,228],[122,262],[118,292],[118,314],[115,336],[111,364],[107,394],[113,404],[126,412],[139,418],[140,424],[118,426],[96,426],[88,422],[88,410],[90,398],
  [89,378],[85,350],[85,330],[87,312],[85,290],[81,262],[77,234],[72,216],[70,198],[73,180],[77,160],[76,138],[72,112],[70,90],[75,72],[82,64],[84,55],[79,46],[77,34],[81,21],[88,13]]);
const CONTORNO_BRACO = suave([[86,70],[80,80],[79,100],[80,124],[82,146],[85,170],[88,194],[89,208],[90,218],[94,226],[100,224],[101,214],[100,200],[98,176],[97,150],[99,124],[101,98],[98,78]]);
const DET_PERFIL = `<path class="det" d="${curva([[105,26],[109,26]])}${curva([[92,26],[89,32],[92,38]])}${curva([[122,98],[116,108],[120,112]])}${curva([[108,312],[112,320]])}${curva([[96,414],[110,410]])}"/>`;
// Mão direita vista pela palma (polegar à esquerda de quem olha); a esquerda é o espelho.
const CONTORNO_MAO = suave([[44,234],[42,206],[36,190],[26,178],[16,164],[8,148],[5,134],[9,126],[17,128],[25,140],[33,152],[37,146],
  [33,124],[30,92],[29,62],[31,47],[37,42],[43,46],[46,62],[47,98],[49,100],
  [49,86],[48,52],[50,33],[57,28],[64,32],[66,50],[67,94],[69,98],
  [70,88],[70,57],[73,43],[79,40],[85,44],[87,58],[88,98],[90,102],
  [91,86],[93,72],[97,66],[102,67],[105,74],[106,90],[104,114],[103,140],[100,166],[94,186],[90,206],[88,234]]);
const DET_PALMA = `<path class="det" d="${curva([[34,152],[50,146],[74,140],[100,132]])}${curva([[36,168],[56,160],[80,154],[102,152]])}${curva([[38,152],[40,174],[46,190],[56,200]])}${curva([[52,96],[62,99]])}${curva([[72,96],[82,99]])}${curva([[92,100],[100,101]])}${curva([[48,206],[66,210],[86,206]])}"/>`;
const DET_DORSO_MAO = `<path class="det" d="${curva([[32,52],[34,46],[40,45],[43,52]])}${curva([[51,38],[53,32],[61,32],[63,38]])}${curva([[72,48],[74,43],[82,43],[84,48]])}${curva([[93,73],[95,69],[101,69],[103,73]])}${curva([[8,134],[10,129],[15,130]])}${curva([[36,104],[44,108]])}${curva([[56,102],[64,104]])}${curva([[76,104],[84,106]])}${curva([[94,110],[102,110]])}${curva([[40,120],[46,160],[52,190]])}${curva([[62,118],[64,160],[66,196]])}${curva([[82,120],[80,160],[78,196]])}"/>`;
// Pé direito visto de cima (hálux à direita de quem olha); o esquerdo é o espelho.
const CONTORNO_PE = suave([[60,250],[44,246],[34,234],[31,212],[30,186],[27,156],[22,126],[16,104],[10,92],[7,80],[9,70],[15,66],[21,70],[23,80],
  [24,64],[25,54],[30,48],[36,49],[38,58],[38,74],
  [40,56],[41,44],[47,37],[54,38],[56,48],[56,68],
  [58,48],[59,34],[65,26],[72,28],[74,40],[74,62],
  [77,30],[83,17],[94,16],[102,27],[103,50],[100,72],[96,96],[94,124],[91,160],[89,196],[86,226],[78,244]]);
const DET_DORSO_PE = `<path class="det" d="${curva([[83,26],[88,21],[96,22],[99,29]])}${curva([[62,34],[66,30],[71,32]])}${curva([[44,44],[48,41],[53,43]])}${curva([[28,55],[31,52],[35,54]])}${curva([[11,75],[14,72],[18,74]])}${curva([[86,70],[80,124],[70,192]])}${curva([[64,72],[62,120],[58,184]])}${curva([[44,80],[44,124],[48,176]])}"/>`;
const DET_PLANTA = `<path class="det" d="${curva([[14,98],[40,90],[70,84],[99,76]])}${curva([[38,212],[50,204],[70,204],[84,212]])}${curva([[24,74],[30,70],[36,74]])}${curva([[42,62],[48,58],[54,62]])}${curva([[60,56],[66,52],[72,56]])}${curva([[80,50],[90,44],[100,50]])}"/>`;

const rot = (x, y, t, a = 'middle') => `<text x="${x}" y="${y}" class="lado-t" text-anchor="${a}">${t}</text>`;
export function desenho(v, f){
  const [, h] = TAM[v];
  if (v === 'anterior') return `<g class="corpo"><path d="${CONTORNO_CORPO}"/></g>${DET_ANT}${rot(12,18,'D')}${rot(188,18,'E')}`;
  if (v === 'posterior') return `<g class="corpo"><path d="${CONTORNO_CORPO}"/></g>${DET_POST}${rot(12,18,'E')}${rot(188,18,'D')}`;
  if (v === 'lat_d' || v === 'lat_e') {
    const m = v === 'lat_e' ? ' transform="translate(200,0) scale(-1,1)"' : '';
    return `<g${m}><g class="corpo"><path d="${CONTORNO_PERFIL}"/><path class="b2" d="${CONTORNO_BRACO}"/></g>${DET_PERFIL}</g>${v === 'lat_d' ? rot(196,18,'frente →','end') + rot(4,18,'Lado direito','start') : rot(4,18,'← frente','start') + rot(196,18,'Lado esquerdo','end')}`;
  }
  const mao = v === 'maos', forma = `<path d="${mao ? CONTORNO_MAO : CONTORNO_PE}"/>`, det = mao ? (f === 'palmar' ? DET_PALMA : DET_DORSO_MAO) : (f === 'plantar' ? DET_PLANTA : DET_DORSO_PE);
  const ty = mao ? 5 : 10, tx = mao ? 15 : 20, nome = mao ? ['Mão direita','Mão esquerda'] : ['Pé direito','Pé esquerdo'], d = direitaAEsquerda(v, f);
  return `<g transform="translate(${tx},${ty})"><g class="corpo">${forma}</g>${det}</g><g transform="translate(${280 - tx},${ty}) scale(-1,1)"><g class="corpo">${forma}</g>${det}</g>${rot(72,h-4,d ? nome[0] : nome[1])}${rot(208,h-4,d ? nome[1] : nome[0])}`;
}

/* ---------- Posições aproximadas dos pontos (os 28 que já têm ficha) ----------
   Unidades do desenho de cada vista. Pontos bilaterais são espelhados; VC e VG ficam na linha média. */
export const POS = {
  anterior:{VC17:[100,118],VC12:[100,158],VC4:[100,200],IG11:[40,168],CS6:[44,214],CS7:[44,224],P9:[50,222],C7:[54,226],C8:[40,240],IG4:[30,236],BP10:[88,292],BP9:[90,322],VB34:[78,320],E36:[86,334],E40:[80,352],BP6:[92,370],R7:[94,384],R3:[94,396],R6:[97,401],BP3:[90,409],F3:[82,414]},
  posterior:{VG20:[100,16],VB20:[86,60],B13:[88,104],B15:[88,116],B17:[88,132],B23:[88,180],VG4:[100,182]},
  lat:{VG20:[98,11],VB20:[82,46],IG11:[84,148],VB34:[100,318],E36:[114,336],E40:[110,354]},
  'maos:palmar':{P9:[56,198],CS7:[80,200],C7:[108,198],C8:[104,148]},
  'maos:dorsal':{IG4:[46,140]},
  'pes:dorsal':{F3:[96,92],BP3:[114,112]},
  'pes:plantar':{}
};
const meio = c => /^V[CG]\d/.test(c);
export function posicoes(c, v, f){
  if (v === 'anterior' || v === 'posterior') { const p = POS[v][c]; return !p ? [] : meio(c) ? [p] : [p, [200 - p[0], p[1]]]; }
  if (v === 'lat_d' || v === 'lat_e') { const p = POS.lat[c]; return p ? [[v === 'lat_e' ? 200 - p[0] : p[0], p[1]]] : []; }
  const p = POS[v + ':' + f]?.[c]; return p ? [p, [280 - p[0], p[1]]] : [];
}
const NOME_POS = { anterior:'Anterior', posterior:'Posterior', lat:'Laterais', 'maos:palmar':'Mãos (palmar)', 'maos:dorsal':'Mãos (dorsal)', 'pes:dorsal':'Pés (dorsal)', 'pes:plantar':'Pés (plantar)' };
export const vistasDoPonto = c => Object.keys(POS).filter(k => POS[k][c]).map(k => NOME_POS[k]);
export const temPosicao = c => vistasDoPonto(c).length > 0;

/* ---------- Marcações ---------- */
export const COR_MARCA = { dor:'var(--crit)', sintoma:'var(--warn)', irradiacao:'var(--water)', limitacao:'var(--earth)', procedimento:'var(--brand)' };
const nomeTipoMarca = k => TIPOS_MARCA.find(t => t[0] === k)?.[1] || k;
function formaMarca(t, x, y, r){
  if (t === 'dor') return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  if (t === 'sintoma') return `<path d="M${x} ${y - r - 1}L${x + r + 1} ${y}L${x} ${y + r + 1}L${x - r - 1} ${y}Z"/>`;
  if (t === 'limitacao') return `<rect x="${x - r + 1}" y="${y - r + 1}" width="${2 * r - 2}" height="${2 * r - 2}" rx="1.5"/>`;
  if (t === 'procedimento') return `<path d="M${x} ${y - r}L${x + r} ${y + r * .8}L${x - r} ${y + r * .8}Z"/>`;
  return `<circle cx="${x}" cy="${y}" r="${r - 2}"/>`;
}
// Ícone da legenda e das listas. est: 'at' (atual), 'ant' (anterior, cinza) ou 'hist' (histórico, tracejado).
export const iconeMarca = (t, est = 'at') => `<svg viewBox="0 0 20 20" class="lg-i mk e-${est}" ${est === 'at' ? `style="--c:${COR_MARCA[t]}"` : ''} aria-hidden="true">${t === 'irradiacao' ? '<path class="rad" d="M4 15L15 5"/><path class="seta" d="M17 3L10.5 5.5L14.5 9.5Z"/>' : ''}${formaMarca(t, t === 'irradiacao' ? 5 : 10, t === 'irradiacao' ? 14 : 10, 6)}</svg>`;
export function marcaSvg(m, est, sel){
  const [w, h] = TAM[m.vista], x = +(m.x * w).toFixed(1), y = +(m.y * h).toFixed(1), r = 7;
  let s = '';
  if (m.tipo === 'irradiacao' && m.x2 != null) {
    const x2 = +(m.x2 * w).toFixed(1), y2 = +(m.y2 * h).toFixed(1), a = Math.atan2(y2 - y, x2 - x), L = 9;
    const p = d => `${(x2 - L * Math.cos(a + d)).toFixed(1)} ${(y2 - L * Math.sin(a + d)).toFixed(1)}`;
    s += `<path class="rad" d="M${x} ${y}L${x2} ${y2}"/><path class="seta" d="M${x2} ${y2}L${p(.45)}L${p(-.45)}Z"/>`;
  }
  if (m.lado === 'bil' && eixo(m.vista)) s += `<g class="esp">${formaMarca(m.tipo, +(2 * eixo(m.vista) - x).toFixed(1), y, r)}</g>`;
  if (sel) s += `<circle class="mk-sel" cx="${x}" cy="${y}" r="${r + 5}"/>`;
  s += formaMarca(m.tipo, x, y, r);
  if (marcaComIntensidade(m.tipo) && m.intensidade != null) s += `<text class="mk-n" x="${x + 9}" y="${y - 6}">${m.intensidade}</text>`;
  return `<g class="mk t-${m.tipo} e-${est}${sel ? ' sel' : ''}" data-id="${esc(m.id)}" data-x="${m.x}" data-y="${m.y}" data-lado="${m.lado}"${m.x2 != null ? ` data-x2="${m.x2}" data-y2="${m.y2}"` : ''} ${est === 'at' ? `style="--c:${COR_MARCA[m.tipo]}"` : ''}><title>${esc(nomeTipoMarca(m.tipo))} · ${esc(m.regiao || 'sem região')} · ${fmt(m.data)}</title>${s}</g>`;
}
// Pontos sobre o desenho, com o código ao lado (para fora do corpo).
export function pontosSvg(codes, v, f, classe = () => ''){
  const [w] = TAM[v];
  return codes.flatMap(c => posicoes(c, v, f).map(([x, y]) => {
    const fora = x < w / 2 - 2;
    return `<g class="ptp ${classe(c)}" data-pt="${esc(c)}"><circle class="pt-h" cx="${x}" cy="${y}" r="9"/><circle cx="${x}" cy="${y}" r="4.5"/><text x="${fora ? x - 7 : x + 7}" y="${y + 3.5}" text-anchor="${fora ? 'end' : 'start'}">${esc(c)}</text></g>`;
  })).join('');
}
