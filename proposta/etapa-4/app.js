// Proposta navegável da etapa 4: mapa corporal em seis vistas com marcações no corpo, comparação entre
// atendimentos, passagem ao prontuário e Atlas na Biblioteca clínica (Central, Particular e Atlas).
// Silhuetas próprias e trajetos aproximados. O conteúdo clínico das fichas é só o que já existe no sistema
// (28 pontos); os demais pontos aparecem como "ficha pendente". Nada é calculado. Dados fictícios, só na
// memória da página.
import { LOGO, ic } from '../../js/componentes/icones.js';
import { EL } from '../../js/conhecimento/elementos.js';
import { CAUT, MER, PT } from '../../js/conhecimento/pontos.js';
import { esc, fmt, initials } from '../../js/util.js';

/* ---------- Paciente, profissional e atendimentos fictícios ---------- */
const PROF = 'Mauren Turcatti';
const P = { name:'Marina Costa', idade:35 };
const HOJE = '2026-11-03';
const ATS = [
  { id:'a1', n:1, data:'2026-09-22', rot:'1º atendimento (basal)' },
  { id:'a2', n:2, data:'2026-10-14', rot:'2º atendimento' },
  { id:'a3', n:3, data:HOJE, rot:'3º atendimento (em andamento)' }
];
const ATUAL = 'a3', ANTERIOR = 'a2';
const atDe = id => ATS.find(a => a.id === id);
const ETAPAS = [['anamnese','Anamnese','folha'],['avaliacao','Avaliação energética','yin'],['pentagrama','Pentagrama','estrela'],['sintese','Síntese clínica','camadas'],['mapa','Mapa corporal','corpo'],['plano','Plano terapêutico','plano'],['evolucao','Evolução','evolucao'],['documentos','Documentos','doc']];

/* ---------- Marcações ---------- */
const TIPOS = [['dor','Dor'],['sintoma','Outro sintoma'],['irradiacao','Irradiação'],['limitacao','Limitação funcional'],['procedimento','Procedimento']];
const tipoNome = k => TIPOS.find(t => t[0] === k)[1];
const comIntensidade = t => t !== 'procedimento';
const LADOS = [['dir','Direito'],['esq','Esquerdo'],['bil','Bilateral'],['na','Não se aplica']];
const ladoNome = k => (LADOS.find(l => l[0] === k) || LADOS[3])[1];
const COR = { dor:'var(--crit)', sintoma:'var(--warn)', irradiacao:'var(--water)', limitacao:'var(--earth)', procedimento:'var(--brand)' };

/* ---------- Vistas ----------
   Cada vista tem um tamanho fixo de desenho. As marcações guardam x e y como fração desse desenho (0 a 1),
   por isso não dependem do tamanho da tela nem da ampliação. */
const VISTAS = [['anterior','Anterior'],['posterior','Posterior'],['lat_d','Lateral direita'],['lat_e','Lateral esquerda'],['maos','Mãos'],['pes','Pés']];
const FACES = { maos:[['palmar','Palmar'],['dorsal','Dorsal']], pes:[['dorsal','Dorsal'],['plantar','Plantar']] };
const TAM = { anterior:[200,430], posterior:[200,430], lat_d:[200,430], lat_e:[200,430], maos:[280,256], pes:[280,276] };
const LARGURA = { anterior:240, posterior:240, lat_d:240, lat_e:240, maos:460, pes:440 };
const vistaNome = (v, f) => VISTAS.find(x => x[0] === v)[1] + (FACES[v] && f ? ' · ' + FACES[v].find(x => x[0] === f)[1].toLowerCase() : '');
// Mãos palmares e pés dorsais: o lado direito do paciente fica à esquerda de quem olha, como na vista anterior.
const direitaAEsquerda = (v, f) => v === 'anterior' || (v === 'maos' && f === 'palmar') || (v === 'pes' && f === 'dorsal');
const eixo = v => v === 'anterior' || v === 'posterior' ? 100 : v === 'maos' || v === 'pes' ? 140 : null;
// Lado anatômico do paciente sugerido pela posição tocada. O profissional pode trocar.
function ladoDe(v, f, x){
  if (v === 'lat_d') return 'dir';
  if (v === 'lat_e') return 'esq';
  if (eixo(v) === 100 && Math.abs(x - 100) < 5) return 'na';
  return (x < eixo(v)) === direitaAEsquerda(v, f) ? 'dir' : 'esq';
}

/* ---------- Silhuetas próprias (aproximadas) ---------- */
const FRENTE = `<circle cx="100" cy="30" r="20"/><rect x="91" y="48" width="18" height="16" rx="5"/><path d="M62 66h76q10 0 12 12l3 120q0 8-8 10H55q-8-2-8-10l3-120q2-12 12-12z"/><path d="M50 74q-12 4-14 20l-10 140q0 8 7 9t8-7l11-118z"/><path d="M150 74q12 4 14 20l10 140q0 8-7 9t-8-7l-11-118z"/><path d="M58 206h40l-2 200q0 14-12 14t-12-14z"/><path d="M102 206h40l-14 200q0 14-12 14t-12-14z"/>`;
const DET_ANT = `<path class="det" d="M92 27h3M105 27h3M95 38q5 3 10 0M66 72q16 6 32 3M134 72q-16 6-32 3"/><circle class="det" cx="100" cy="172" r="2"/>`;
const DET_POST = `<path class="det" d="M82 17q18-13 36 0M100 68v136M68 94q8 20 22 12M132 94q-8 20-22 12M100 206v16"/>`;
const PERFIL = `<ellipse cx="98" cy="32" rx="19" ry="21"/><path d="M114 25l8 10-7 3z"/><rect x="88" y="50" width="18" height="18" rx="5"/><path d="M76 66h38q16 4 18 30l2 56q0 34-8 56H74q-8-26-6-62V96q2-26 8-30z"/><path d="M74 206h52l-6 196q0 12-12 12H88q-12 0-14-12z"/><path d="M84 402h36q16 2 18 10t-12 8H86q-6 0-4-10z"/><path class="b2" d="M88 74q-10 0-11 12l-4 122q0 9 8 9t9-9l7-122q0-12-9-12z"/>`;
const DET_PERFIL = `<path class="det" d="M106 27h3M90 26q-5 5 0 12"/>`;
const MAO = `<rect x="25" y="110" width="80" height="88" rx="22"/><rect x="40" y="186" width="50" height="44" rx="10"/><rect x="27" y="42" width="18" height="78" rx="9"/><rect x="48" y="28" width="18" height="90" rx="9"/><rect x="69" y="36" width="18" height="84" rx="9"/><rect x="89" y="58" width="16" height="64" rx="8"/><rect x="4" y="112" width="20" height="62" rx="10" transform="rotate(-28 14 172)"/>`;
const DET_PALMA = `<path class="det" d="M36 142q30 10 62-2M40 162q24 6 50-6M52 182q10-30 40-48"/>`;
const DET_DORSO_MAO = `<rect class="det" x="31" y="46" width="10" height="11" rx="4"/><rect class="det" x="52" y="32" width="10" height="11" rx="4"/><rect class="det" x="73" y="40" width="10" height="11" rx="4"/><rect class="det" x="92" y="62" width="10" height="10" rx="4"/>`;
const PE = `<path d="M22 72q-8 70 4 132q8 42 32 42t32-42q12-64 6-132q-6-18-38-18t-36 18z"/><ellipse cx="86" cy="40" rx="14" ry="19"/><ellipse cx="64" cy="30" rx="9" ry="13"/><ellipse cx="46" cy="32" rx="8" ry="12"/><ellipse cx="31" cy="39" rx="7" ry="11"/><ellipse cx="19" cy="50" rx="6" ry="9"/>`;
const DET_PLANTA = `<path class="det" d="M34 122q24 10 50 0M40 202q18 8 36 0"/>`;
const DET_DORSO_PE = `<ellipse class="det" cx="86" cy="30" rx="6" ry="6"/><ellipse class="det" cx="64" cy="22" rx="4" ry="4"/><ellipse class="det" cx="46" cy="25" rx="3.5" ry="3.5"/><ellipse class="det" cx="31" cy="32" rx="3" ry="3"/>`;

const rot = (x, y, t, a = 'middle') => `<text x="${x}" y="${y}" class="lado-t" text-anchor="${a}">${t}</text>`;
function desenho(v, f){
  const [, h] = TAM[v];
  if (v === 'anterior') return `<g class="corpo">${FRENTE}</g>${DET_ANT}${rot(12,18,'D')}${rot(188,18,'E')}`;
  if (v === 'posterior') return `<g class="corpo">${FRENTE}</g>${DET_POST}${rot(12,18,'E')}${rot(188,18,'D')}`;
  if (v === 'lat_d' || v === 'lat_e') {
    const m = v === 'lat_e' ? ' transform="translate(200,0) scale(-1,1)"' : '';
    return `<g${m}><g class="corpo">${PERFIL}</g>${DET_PERFIL}</g>${v === 'lat_d' ? rot(196,18,'frente →','end') + rot(4,18,'Lado direito','start') : rot(4,18,'← frente','start') + rot(196,18,'Lado esquerdo','end')}`;
  }
  const mao = v === 'maos', forma = mao ? MAO : PE, det = mao ? (f === 'palmar' ? DET_PALMA : DET_DORSO_MAO) : (f === 'plantar' ? DET_PLANTA : DET_DORSO_PE);
  const ty = mao ? 5 : 10, tx = mao ? 15 : 20, nome = mao ? ['Mão direita','Mão esquerda'] : ['Pé direito','Pé esquerdo'], d = direitaAEsquerda(v, f);
  return `<g transform="translate(${tx},${ty})"><g class="corpo">${forma}</g>${det}</g><g transform="translate(${280 - tx},${ty}) scale(-1,1)"><g class="corpo">${forma}</g>${det}</g>${rot(72,h-4,d ? nome[0] : nome[1])}${rot(208,h-4,d ? nome[1] : nome[0])}`;
}

/* ---------- Posições aproximadas dos pontos (só os 28 com ficha têm posição nesta proposta) ----------
   Unidades do desenho de cada vista. Pontos bilaterais são espelhados; VC e VG ficam na linha média. */
const POS = {
  anterior:{VC17:[100,118],VC12:[100,158],VC4:[100,200],IG11:[40,168],CS6:[44,214],CS7:[44,224],P9:[50,222],C7:[54,226],C8:[40,240],IG4:[30,236],BP10:[88,292],BP9:[90,322],VB34:[78,320],E36:[86,334],E40:[80,352],BP6:[92,370],R7:[94,384],R3:[94,396],R6:[97,401],BP3:[90,409],F3:[82,414]},
  posterior:{VG20:[100,16],VB20:[86,60],B13:[88,104],B15:[88,116],B17:[88,132],B23:[88,180],VG4:[100,182]},
  lat:{VG20:[98,11],VB20:[82,46],IG11:[84,148],VB34:[100,318],E36:[114,336],E40:[110,354]},
  'maos:palmar':{P9:[52,198],CS7:[80,200],C7:[108,198],C8:[104,148]},
  'maos:dorsal':{IG4:[46,140]},
  'pes:dorsal':{F3:[96,92],BP3:[114,112]},
  'pes:plantar':{}
};
const meio = c => /^V[CG]\d/.test(c);
function posicoes(c, v, f){
  if (v === 'anterior' || v === 'posterior') { const p = POS[v][c]; return !p ? [] : meio(c) ? [p] : [p, [200 - p[0], p[1]]]; }
  if (v === 'lat_d' || v === 'lat_e') { const p = POS.lat[c]; return p ? [[v === 'lat_e' ? 200 - p[0] : p[0], p[1]]] : []; }
  const p = POS[v + ':' + f]?.[c]; return p ? [p, [280 - p[0], p[1]]] : [];
}
const NOME_POS = { anterior:'Anterior', posterior:'Posterior', lat:'Laterais', 'maos:palmar':'Mãos (palmar)', 'maos:dorsal':'Mãos (dorsal)', 'pes:dorsal':'Pés (dorsal)', 'pes:plantar':'Pés (plantar)' };
const vistasDoPonto = c => Object.keys(POS).filter(k => POS[k][c]).map(k => NOME_POS[k]);
const temPosicao = c => vistasDoPonto(c).length > 0;

/* ---------- Pontos de cada meridiano (códigos) ---------- */
const NPT = { P:11, IG:20, E:45, BP:21, C:9, ID:19, B:67, R:27, CS:9, TA:23, VB:44, F:14, VC:24, VG:28 };
const CODIGOS = Object.entries(NPT).flatMap(([m, n]) => Array.from({ length:n }, (_, i) => m + (i + 1)));
const merDe = c => c.replace(/\d+$/, '');

/* ---------- Trajetos aproximados ---------- */
const PARES = [['Du Mai','ID3','B62'],['Ren Mai','P7','R6'],['Chong Mai','BP4','CS6'],['Dai Mai','VB41','TA5'],['Yin Qiao Mai','R6','P7'],['Yang Qiao Mai','B62','ID3'],['Yin Wei Mai','CS6','BP4'],['Yang Wei Mai','TA5','VB41']];
const MERIDIANOS = ['P','IG','E','BP','C','ID','B','R','CS','TA','VB','F'];
const VASOS = PARES.map(p => p[0]);
const TRAJ = {
  P:{ant:[[66,82],[54,90],[46,130],[42,180],[36,224],[28,240]]},
  IG:{ant:[[30,238],[34,200],[38,160],[46,110],[52,78],[80,62],[92,50],[94,40]]},
  E:{ant:[[93,34],[90,46],[88,62],[80,84],[80,140],[86,186],[82,230],[80,290],[84,330],[86,380],[86,416]]},
  BP:{ant:[[92,416],[94,396],[94,350],[92,300],[94,250],[80,200],[72,150],[64,96]]},
  C:{ant:[[56,88],[48,120],[44,170],[42,226],[40,244]]},
  ID:{post:[[40,242],[44,200],[48,150],[50,104],[70,98],[78,72],[90,56],[84,32]]},
  B:{post:[[94,16],[94,50],[92,70],[92,200],[86,222],[82,270],[80,320],[82,370],[78,410],[74,418]]},
  R:{ant:[[90,418],[94,402],[94,340],[96,260],[96,206],[94,180],[92,120],[90,84]]},
  CS:{ant:[[64,90],[52,104],[46,150],[40,200],[36,228],[34,246]]},
  TA:{post:[[34,244],[38,200],[42,150],[46,108],[60,76],[80,60],[86,40],[82,22]]},
  VB:{lat:[[100,22],[92,30],[94,44],[88,52],[96,90],[102,150],[100,206],[102,270],[102,330],[106,398],[124,414]]},
  F:{ant:[[86,418],[86,402],[92,360],[96,300],[96,240],[90,210],[76,160],[72,124]]},
  'Du Mai':{meio:1,post:[[100,210],[100,120],[100,66],[100,30],[100,10]]},
  'Ren Mai':{meio:1,ant:[[100,208],[100,120],[100,60],[100,46]]},
  'Chong Mai':{ant:[[96,208],[94,180],[92,140],[92,100],[96,60]]},
  'Dai Mai':{meio:1,ant:[[54,186],[100,192],[146,186]],post:[[54,186],[100,192],[146,186]],lat:[[70,186],[128,190]]},
  'Yin Qiao Mai':{ant:[[94,404],[94,360],[96,260],[92,206],[84,140],[86,70],[96,30]]},
  'Yang Qiao Mai':{lat:[[104,410],[104,330],[98,206],[92,150],[90,80],[104,30]]},
  'Yin Wei Mai':{ant:[[94,368],[96,300],[94,240],[80,190],[76,120],[98,54]]},
  'Yang Wei Mai':{lat:[[100,404],[100,300],[96,206],[88,140],[86,70],[88,40],[96,12]]}
};
const SIGLA_VASO = { 'Du Mai':'Du', 'Ren Mai':'Ren', 'Chong Mai':'Chong', 'Dai Mai':'Dai', 'Yin Qiao Mai':'Yin Q', 'Yang Qiao Mai':'Yang Q', 'Yin Wei Mai':'Yin W', 'Yang Wei Mai':'Yang W' };
const corTraj = k => VASOS.includes(k) ? 'var(--vaso)' : EL[MER[k][1]].cor;
const chaveVista = v => v === 'anterior' ? 'ant' : v === 'posterior' ? 'post' : v === 'lat_d' || v === 'lat_e' ? 'lat' : null;
const NOME_CH = { ant:'anterior', post:'posterior', lat:'laterais' };
const vistasDoTrajeto = k => ['ant','post','lat'].filter(c => TRAJ[k][c]).map(c => NOME_CH[c]);
// Trajeto do meridiano a que um ponto pertence (VC e VG seguem Ren Mai e Du Mai).
const trajDoPonto = c => ({ VC:'Ren Mai', VG:'Du Mai' })[merDe(c)] || merDe(c);

/* ---------- Estado da proposta ---------- */
const mk = (id, at, data, hora, tipo, vista, face, x, y, lado, intensidade, regiao, nota, extra = {}) => {
  const [w, h] = TAM[vista];
  return { id, at, data, hora, tipo, vista, face, x:+(x / w).toFixed(4), y:+(y / h).toFixed(4), lado, intensidade, regiao, nota, procedimento:'', ...extra,
    ...(extra.x2 != null ? { x2:+(extra.x2 / w).toFixed(4), y2:+(extra.y2 / h).toFixed(4) } : {}) };
};
const S = {
  rotaBib:'atlas', aberto:false,
  vista:'anterior', face:{ maos:'palmar', pes:'dorsal' }, zoom:1, ferr:'sel', sel:null, rmConf:false, redesenhar:null,
  ant:true, hist:'', plano:true, final:false, seq:10,
  pontosPlano:['VG4','B23','VB34','IG4','TA5'],
  marcas:[
    mk('m1','a1','2026-09-22','09:20','dor','posterior','',114,194,'bil',8,'Lombar','Piora ao ficar sentada.'),
    mk('m2','a1','2026-09-22','09:22','irradiacao','posterior','',118,204,'dir',7,'Lombar até coxa posterior','',{x2:124,y2:300}),
    mk('m3','a1','2026-09-22','09:24','limitacao','anterior','',56,78,'dir',6,'Ombro','Não eleva o braço acima da cabeça.'),
    mk('m4','a1','2026-09-22','09:51','procedimento','posterior','',100,212,'bil',null,'Lombar','',{procedimento:'Ventosa fixa'}),
    mk('m5','a2','2026-10-14','16:05','dor','posterior','',114,194,'bil',6,'Lombar',''),
    mk('m6','a2','2026-10-14','16:06','irradiacao','posterior','',118,204,'dir',5,'Lombar até coxa posterior','',{x2:122,y2:262}),
    mk('m7','a2','2026-10-14','16:08','limitacao','anterior','',56,78,'dir',4,'Ombro',''),
    mk('m8','a2','2026-10-14','16:10','dor','lat_d','',108,24,'dir',5,'Têmpora','Cefaleia após viagem.'),
    mk('m9','a3',HOJE,'14:12','dor','posterior','',114,194,'bil',3,'Lombar','Melhora pela manhã.'),
    mk('m10','a3',HOJE,'14:14','limitacao','anterior','',60,84,'dir',2,'Ombro',''),
    mk('m11','a3',HOJE,'14:16','sintoma','maos','palmar',72,48,'dir',4,'Dedos indicador e médio','Formigamento ao acordar.')
  ],
  // Biblioteca
  ativos:new Set(['E','F']), azoom:1, todosPts:false, avista:'anterior', aface:{ maos:'palmar', pes:'dorsal' }, atSel:null, atTraj:null, fx:false,
  busca:'', fMer:'', fSit:'', cSel:null, rev:{}, notas:{ B23:'Anotação fictícia da clínica: usar com o protocolo particular de lombalgia.' },
  part:[{ id:'pa1', titulo:'Protocolo particular de lombalgia (rascunho)', ponto:'B23', texto:'Texto fictício da clínica para a proposta. Fica só na Particular.', por:PROF, em:'2026-10-20' }]
};
const marca = id => S.marcas.find(m => m.id === id);
const agora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };

/* ---------- Desenho das marcações ---------- */
function forma(t, x, y, r){
  if (t === 'dor') return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  if (t === 'sintoma') return `<path d="M${x} ${y - r - 1}L${x + r + 1} ${y}L${x} ${y + r + 1}L${x - r - 1} ${y}Z"/>`;
  if (t === 'limitacao') return `<rect x="${x - r + 1}" y="${y - r + 1}" width="${2 * r - 2}" height="${2 * r - 2}" rx="1.5"/>`;
  if (t === 'procedimento') return `<path d="M${x} ${y - r}L${x + r} ${y + r * .8}L${x - r} ${y + r * .8}Z"/>`;
  return `<circle cx="${x}" cy="${y}" r="${r - 2}"/>`;
}
const iconeTipo = (t, est = 'at') => `<svg viewBox="0 0 20 20" class="lg-i mk e-${est}" ${est === 'at' ? `style="--c:${COR[t]}"` : ''} aria-hidden="true">${t === 'irradiacao' ? '<path class="rad" d="M4 15L15 5"/><path class="seta" d="M17 3L10.5 5.5L14.5 9.5Z"/>' : ''}${forma(t, t === 'irradiacao' ? 5 : 10, t === 'irradiacao' ? 14 : 10, 6)}</svg>`;
function marcaSvg(m, est){
  const [w, h] = TAM[m.vista], x = +(m.x * w).toFixed(1), y = +(m.y * h).toFixed(1), r = 7;
  let s = '';
  if (m.tipo === 'irradiacao' && m.x2 != null) {
    const x2 = +(m.x2 * w).toFixed(1), y2 = +(m.y2 * h).toFixed(1), a = Math.atan2(y2 - y, x2 - x), L = 9;
    const p = d => `${(x2 - L * Math.cos(a + d)).toFixed(1)} ${(y2 - L * Math.sin(a + d)).toFixed(1)}`;
    s += `<path class="rad" d="M${x} ${y}L${x2} ${y2}"/><path class="seta" d="M${x2} ${y2}L${p(.45)}L${p(-.45)}Z"/>`;
  }
  if (m.lado === 'bil' && eixo(m.vista)) s += `<g class="esp">${forma(m.tipo, +(2 * eixo(m.vista) - x).toFixed(1), y, r)}</g>`;
  if (S.sel === m.id) s += `<circle class="anel" cx="${x}" cy="${y}" r="${r + 5}"/>`;
  s += forma(m.tipo, x, y, r);
  if (comIntensidade(m.tipo) && m.intensidade != null) s += `<text class="mk-n" x="${x + 9}" y="${y - 6}">${m.intensidade}</text>`;
  return `<g class="mk t-${m.tipo} e-${est}${S.sel === m.id ? ' sel' : ''}" data-id="${m.id}" data-at="${m.at}" data-x="${m.x}" data-y="${m.y}" data-lado="${m.lado}"${m.x2 != null ? ` data-x2="${m.x2}" data-y2="${m.y2}"` : ''} ${est === 'at' ? `style="--c:${COR[m.tipo]}"` : ''}><title>${esc(tipoNome(m.tipo))} · ${esc(m.regiao || 'sem região')} · ${fmt(m.data)}</title>${s}</g>`;
}
function pontosSvg(codes, v, f, extra = () => ''){
  const [w] = TAM[v];
  return codes.flatMap(c => posicoes(c, v, f).map(([x, y]) => {
    const esq = x < w / 2 - 2; // rótulo para fora do corpo
    return `<g class="ptp ${extra(c)}" data-pt="${c}" tabindex="0"><circle class="pt-h" cx="${x}" cy="${y}" r="9"/><circle cx="${x}" cy="${y}" r="4.5"/><text x="${esq ? x - 7 : x + 7}" y="${y + 3.5}" text-anchor="${esq ? 'end' : 'start'}">${c}</text></g>`;
  })).join('');
}
function trajSvg(k, v){
  const ch = chaveVista(v), T = TRAJ[k];
  if (!ch || !T[ch]) return '';
  const base = T[ch].map(([x, y]) => [v === 'lat_e' ? 200 - x : x, y]);
  const linhas = [base]; if (!T.meio && ch !== 'lat') linhas.push(base.map(([x, y]) => [200 - x, y]));
  const fim = base[base.length - 1], vaso = VASOS.includes(k);
  return `<g class="tj${vaso ? ' vaso' : ''}${S.atTraj === k ? ' on' : ''}" data-tj="${k}" style="--c:${corTraj(k)}">${linhas.map(l => { const d = 'M' + l.map(p => p.join(' ')).join('L'); return `<path class="tj-h" d="${d}"/><path class="tj-l" d="${d}"/>`; }).join('')}<text class="tj-t" x="${fim[0]}" y="${fim[1] - 5}" text-anchor="middle">${vaso ? SIGLA_VASO[k] : k}</text></g>`;
}

/* ---------- Mapa do atendimento ---------- */
const ZOOMS = [1, 1.5, 2, 3];
const larguraZoom = (v, z) => z === 1 ? `min(100%,${LARGURA[v]}px)` : LARGURA[v] * z + 'px';
const controleZoom = (z, a) => { const i = ZOOMS.indexOf(z); return `<div class="zoom" role="group" aria-label="Ampliação"><button class="btn sm" data-a="${a}" data-d="-1" aria-label="Diminuir" ${i === 0 ? 'disabled' : ''}>−</button><span class="zoom-v">${Math.round(z * 100)}%</span><button class="btn sm" data-a="${a}" data-d="1" aria-label="Ampliar" ${i === ZOOMS.length - 1 ? 'disabled' : ''}>${ic('mais')}</button></div>`; };
const faceDe = v => FACES[v] ? S.face[v] : '';
const naVista = (m, v, f) => m.vista === v && (m.face || '') === (f || '');
function svgMapa(){
  const v = S.vista, f = faceDe(v), [w, h] = TAM[v];
  const visiveis = S.marcas.filter(m => naVista(m, v, f));
  const camadas = [
    S.hist ? visiveis.filter(m => m.at === S.hist).map(m => marcaSvg(m, 'hist')).join('') : '',
    S.ant ? visiveis.filter(m => m.at === ANTERIOR).map(m => marcaSvg(m, 'ant')).join('') : '',
    S.plano ? pontosSvg(S.pontosPlano, v, f, () => 'plano') : '',
    visiveis.filter(m => m.at === ATUAL).map(m => marcaSvg(m, 'at')).join('')
  ].join('');
  return `<div class="mp-zoom" data-zoom="${S.zoom}"><svg class="mapa4${S.ferr !== 'sel' || S.redesenhar ? ' marcando' : ''}" data-mapa="atendimento" data-vista="${v}" data-face="${f}" viewBox="0 0 ${w} ${h}" style="width:${larguraZoom(v, S.zoom)}" role="img" aria-label="Mapa corporal, vista ${vistaNome(v, f)}">${desenho(v, f)}${camadas}</svg></div>`;
}
function barraVistas(vAtual, fAtual, acao){
  return `<div class="vbar" role="tablist" aria-label="Vistas do corpo">${VISTAS.map(([k, n]) => `<button class="vb${k === vAtual ? ' on' : ''}" role="tab" aria-selected="${k === vAtual}" data-a="${acao}" data-v="${k}">${n}</button>`).join('')}</div>
    ${FACES[vAtual] ? `<div class="seg-c vface" role="group" aria-label="Face">${FACES[vAtual].map(([k, n]) => `<button class="${k === fAtual ? 'on' : ''}" data-a="${acao}-face" data-f="${k}">${n}</button>`).join('')}</div>` : ''}`;
}
function legenda(){
  return `<div class="legenda" aria-label="Legenda">
    ${TIPOS.map(([k, n]) => `<span>${iconeTipo(k)}${n}</span>`).join('')}
    <span class="lg-sep"></span>
    <span>${iconeTipo('dor','ant')}Atendimento anterior</span><span>${iconeTipo('dor','hist')}Histórico</span>
    <span><svg viewBox="0 0 20 20" class="lg-i" aria-hidden="true"><g class="ptp plano"><circle cx="10" cy="10" r="4.5"/></g></svg>Ponto do plano</span>
    <span><svg viewBox="0 0 20 20" class="lg-i mk" style="--c:var(--crit)" aria-hidden="true"><g class="esp"><circle cx="10" cy="10" r="6"/></g></svg>Lado espelhado (bilateral)</span></div>`;
}
function dicaFerramenta(){
  if (S.final) return `${ic('check')}Atendimento finalizado nesta simulação: as marcações estão no prontuário e não podem mais ser alteradas aqui.`;
  if (S.redesenhar) return `${ic('dir')}<b>Irradiação:</b> agora toque no ponto de destino, na mesma vista. <button class="btn ghost sm" data-a="cancelar-rad">Cancelar</button>`;
  if (S.ferr === 'sel') return `${ic('info')}Toque numa marcação para editar. Para marcar, escolha um tipo acima.`;
  return S.ferr === 'irradiacao' ? `${ic('dir')}<b>Irradiação:</b> toque primeiro na origem e depois no destino.` : `${ic('corpo')}Toque no corpo para marcar <b>${tipoNome(S.ferr).toLowerCase()}</b>. Pode haver várias marcações na mesma região.`;
}
function editor(){
  const m = marca(S.sel);
  if (!m) return `<div class="card" id="ed"><div class="card-h"><h3>Marcação</h3></div><p class="muted sm">Escolha um tipo em "Marcar" e toque no corpo. Para editar, toque numa marcação no mapa ou escolha na lista abaixo.</p></div>`;
  const at = atDe(m.at), ro = m.at !== ATUAL || S.final;
  const meta = `<div class="ed-meta">${ic('agenda')}<span>${fmt(m.data)}${m.hora ? ' às ' + m.hora : ''} · ${at.rot}</span></div><div class="ed-meta">${ic('corpo')}<span>Vista ${vistaNome(m.vista, m.face)} · posição aproximada</span></div>`;
  const cab = `<div class="card-h"><h3><span class="ed-t">${iconeTipo(m.tipo)}${tipoNome(m.tipo)}</span></h3>${ro ? `<span class="pill">${m.at === ATUAL ? 'no prontuário' : 'somente leitura'}</span>` : '<span class="pill acc">editando</span>'}</div>`;
  if (ro) return `<div class="card" id="ed">${cab}${meta}
    <dl class="ed-dl"><dt>Lado</dt><dd>${ladoNome(m.lado)}</dd>${comIntensidade(m.tipo) ? `<dt>Intensidade</dt><dd>${m.intensidade ?? 'não informada'}${m.intensidade != null ? ' de 10' : ''}</dd>` : `<dt>Procedimento</dt><dd>${esc(m.procedimento) || '—'}</dd>`}<dt>Região</dt><dd>${esc(m.regiao) || '—'}</dd><dt>Anotação</dt><dd>${esc(m.nota) || '—'}</dd></dl>
    <p class="muted sm">${m.at === ATUAL ? 'Registrada no prontuário ao finalizar.' : 'Marcação de outro atendimento, mostrada só para comparar. Ela não é alterada nem copiada.'}</p></div>`;
  return `<div class="card" id="ed">${cab}${meta}
    <div class="form ed-f">
      <div class="field"><label class="lbl" for="mk-tipo">Tipo</label><select id="mk-tipo" data-mk="tipo">${TIPOS.map(([k, n]) => `<option value="${k}" ${k === m.tipo ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label class="lbl" for="mk-lado">Lado do paciente</label><select id="mk-lado" data-mk="lado">${LADOS.map(([k, n]) => `<option value="${k}" ${k === m.lado ? 'selected' : ''}>${n}</option>`).join('')}</select><small class="muted">Sugerido pela posição tocada.</small></div>
      ${comIntensidade(m.tipo) ? `<div class="field full"><span class="lbl" id="mk-int-l">Intensidade (0 a 10)</span><div class="int-r" role="group" aria-labelledby="mk-int-l">${Array.from({ length:11 }, (_, n) => `<button class="int-b${m.intensidade === n ? ' on' : ''}" data-a="int" data-n="${n}" aria-pressed="${m.intensidade === n}">${n}</button>`).join('')}</div><small class="muted" id="mk-int-v">${m.intensidade == null ? 'Não informada' : `Registrada: ${m.intensidade} de 10`}</small></div>`
        : `<div class="field full"><label class="lbl" for="mk-proc">Procedimento realizado</label><input id="mk-proc" data-mk="procedimento" value="${esc(m.procedimento)}" placeholder="Ex.: ventosa, moxabustão, acupuntura..."></div>`}
      ${m.tipo === 'irradiacao' ? `<div class="field full"><span class="lbl">Trajeto</span><div class="rad-s">${m.x2 != null ? `${ic('check')}Origem e destino marcados` : `${ic('alerta')}Falta o destino`}<button class="btn sm" data-a="redesenhar">${m.x2 != null ? 'Redesenhar destino' : 'Marcar destino'}</button></div></div>` : ''}
      <div class="field full"><label class="lbl" for="mk-reg">Região</label><input id="mk-reg" data-mk="regiao" value="${esc(m.regiao)}" list="regioes" placeholder="Ex.: lombar, ombro, joelho"></div>
      <div class="field full"><label class="lbl" for="mk-nota">Anotação</label><textarea id="mk-nota" data-mk="nota" placeholder="Como é, quando piora, o que melhora...">${esc(m.nota)}</textarea></div>
    </div>
    <datalist id="regioes">${[...new Set(S.marcas.map(x => x.regiao).filter(Boolean))].map(r => `<option value="${esc(r)}">`).join('')}</datalist>
    <div class="ed-a">${S.rmConf ? `<div class="rm-c" role="alert"><span>Remover esta marcação?</span><button class="btn sm crit" data-a="rm-sim">Sim, remover</button><button class="btn sm" data-a="rm-nao">Cancelar</button></div>` : `<button class="btn sm" data-a="rm">${ic('x')}Remover</button><button class="btn sm ghost" data-a="desmarcar">Concluir</button>`}</div></div>`;
}
const linhaMarca = m => `<button class="mk-li${S.sel === m.id ? ' on' : ''}" data-a="sel-mk" data-id="${m.id}">${iconeTipo(m.tipo)}<span class="grow"><b>${tipoNome(m.tipo)}${m.regiao ? ' · ' + esc(m.regiao) : ''}</b><small>${ladoNome(m.lado)} · ${vistaNome(m.vista, m.face)}${comIntensidade(m.tipo) ? ` · ${m.intensidade ?? '—'}/10` : m.procedimento ? ' · ' + esc(m.procedimento) : ''}</small></span></button>`;
function listaAtual(){
  const L = S.marcas.filter(m => m.at === ATUAL);
  return `<div class="card"><div class="card-h"><h3>Marcações deste atendimento<small>${fmt(HOJE)} · 3º atendimento</small></h3><span class="pill">${L.length}</span></div>
    <div class="mk-l">${L.map(linhaMarca).join('') || '<p class="muted sm">Nenhuma marcação ainda.</p>'}</div></div>`;
}
function cardPlano(){
  const com = S.pontosPlano.filter(temPosicao), sem = S.pontosPlano.filter(c => !temPosicao(c));
  return `<div class="card" id="plano-mapa"><div class="card-h"><h3>Pontos do plano<small>do Plano terapêutico deste atendimento</small></h3></div>
    <div class="pp"><span class="lbl">No mapa</span><div class="chips">${com.map(c => `<span class="pill pp-c" data-c="${c}">${c}<small>${vistasDoPonto(c).join(', ')}</small></span>`).join('')}</div></div>
    <div class="pp" id="sem-posicao"><span class="lbl">Sem posição no mapa</span><div class="chips">${sem.map(c => `<span class="pill warn pp-c" data-c="${c}">${c}</span>`).join('') || '<span class="muted sm">nenhum</span>'}</div>
    <small class="muted">Ficam nesta lista até terem posição revisada (etapa 4C).</small></div></div>`;
}
// Comparação: valores registrados lado a lado, por tipo e região. Nada é calculado.
function evolucao(){
  const ats = ATS.filter(a => a.id !== ATUAL || S.marcas.some(m => m.at === ATUAL));
  const grupos = new Map();
  S.marcas.forEach(m => { const k = m.tipo + '|' + (m.regiao || '').trim().toLowerCase(); if (!grupos.has(k)) grupos.set(k, { tipo:m.tipo, regiao:m.regiao || 'sem região', por:{} }); (grupos.get(k).por[m.at] ||= []).push(m); });
  const val = L => !L ? '<span class="muted">—</span>' : L.map(m => comIntensidade(m.tipo) ? `<b>${m.intensidade ?? '?'}</b>` : esc(m.procedimento || '✓')).join(' · ');
  return `<div class="card" id="evolucao"><div class="card-h"><h3>Comparação entre atendimentos<small>valores registrados, lado a lado, sem cálculo</small></h3></div>
    <div class="tbl-w"><table class="ev-t"><thead><tr><th>Marcação</th>${ats.map(a => `<th>${fmt(a.data).slice(0,5)}<small>${a.n}º</small></th>`).join('')}</tr></thead>
    <tbody>${[...grupos.values()].map(g => `<tr><td><span class="ev-n">${iconeTipo(g.tipo)}<span>${tipoNome(g.tipo)}<small>${esc(g.regiao)}</small></span></span></td>${ats.map(a => `<td class="${a.id === ATUAL ? 'at' : ''}">${val(g.por[a.id])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <small class="muted">Intensidade de 0 a 10 nos sintomas e limitações; nome do procedimento quando houver.</small></div>`;
}
function vMapa(){
  return `<div class="notice">${ic('info')}<div><b>Posições aproximadas.</b> Silhuetas próprias desta proposta. D e E são sempre o lado direito e o lado esquerdo <b>do paciente</b>, em todas as vistas.</div></div>
  <div class="grid g-side mp-g">
    <div class="card mp-card"><div class="card-h"><h3>Mapa corporal<small>${vistaNome(S.vista, faceDe(S.vista))}</small></h3><span class="pill warn">aproximado</span></div>
      ${barraVistas(S.vista, faceDe(S.vista), 'vista')}
      <div class="ferr" role="group" aria-label="Marcar"><span class="lbl">Marcar</span>${TIPOS.map(([k, n]) => `<button class="chip fr${S.ferr === k ? ' on' : ''}" data-a="ferr" data-t="${k}" aria-pressed="${S.ferr === k}" ${S.final ? 'disabled' : ''}>${iconeTipo(k)}${n}</button>`).join('')}<button class="chip fr${S.ferr === 'sel' ? ' on' : ''}" data-a="ferr" data-t="sel" aria-pressed="${S.ferr === 'sel'}">${ic('editar')}Selecionar</button></div>
      <p class="mp-dica" id="dica">${dicaFerramenta()}</p>
      <div class="mp-ctl">
        ${controleZoom(S.zoom, 'zoom')}
        <div class="cmp" role="group" aria-label="Comparar">
          <span class="chip on cmp-at">${iconeTipo('dor')}Atual · ${fmt(HOJE).slice(0,5)}</span>
          <button class="chip${S.ant ? ' on' : ''}" data-a="cmp-ant" aria-pressed="${S.ant}">${iconeTipo('dor','ant')}Anterior · ${fmt(atDe(ANTERIOR).data).slice(0,5)}</button>
          <label class="hist-l">${iconeTipo('dor','hist')}<select class="mini-sel" data-cmp-hist aria-label="Atendimento mais antigo">${[['','Histórico: nenhum'], ...ATS.filter(a => a.id !== ATUAL && a.id !== ANTERIOR).map(a => [a.id, `Histórico: ${fmt(a.data).slice(0,5)} (${a.n}º)`])].map(([k, n]) => `<option value="${k}" ${S.hist === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <button class="chip${S.plano ? ' on' : ''}" data-a="cmp-plano" aria-pressed="${S.plano}">Pontos do plano</button>
        </div>
      </div>
      ${svgMapa()}
      ${legenda()}
      <div class="mp-f">${S.final ? `<a class="btn" href="#/prontuario">${ic('doc')}Ver no prontuário</a><button class="btn ghost" data-a="reabrir">Desfazer a simulação</button>` : `<button class="btn pri" data-a="finalizar">${ic('check')}Finalizar atendimento (simulação)</button><a class="btn ghost" href="#/prontuario">${ic('historico')}Prontuário</a>`}</div>
    </div>
    <aside class="grid" style="align-content:start">${editor()}${listaAtual()}${cardPlano()}${evolucao()}</aside>
  </div>`;
}

/* ---------- Prontuário: marcações por atendimento ---------- */
function vProntuario(){
  const ats = ATS.filter(a => a.id !== ATUAL || S.final).slice().reverse();
  const rascunho = S.marcas.filter(m => m.at === ATUAL).length;
  return `<div class="notice">${ic('escudo')}<div><b>Cada marcação fica vinculada ao atendimento em que foi feita</b> e passa para o prontuário ao finalizar. Nada é sobrescrito: o atendimento seguinte só mostra as anteriores em cinza, para comparar.</div></div>
  <div class="grid g-side"><div class="grid" style="align-content:start">
    ${S.final ? '' : `<div class="card pr-ras"><div class="card-h"><h3>3º atendimento · ${fmt(HOJE)}<small>em andamento</small></h3><span class="pill warn">rascunho</span></div><p class="muted sm">${rascunho} marcações no rascunho. Entram aqui quando o atendimento for finalizado.</p><a class="btn sm" href="#/mapa">${ic('corpo')}Abrir o mapa</a></div>`}
    ${ats.map(a => { const L = S.marcas.filter(m => m.at === a.id); return `<div class="card pr-at" data-at="${a.id}"><div class="card-h"><h3>${a.rot.replace(' (em andamento)', '')} · ${fmt(a.data)}<small>${L.length} marcações · finalizado</small></h3><span class="pill ok">${ic('check')}no prontuário</span></div>
      <div class="pr-l">${L.map(m => `<div class="pr-m" data-id="${m.id}">${iconeTipo(m.tipo)}<div class="grow"><b>${tipoNome(m.tipo)}${m.regiao ? ' · ' + esc(m.regiao) : ''}</b><small>${ladoNome(m.lado)} · ${vistaNome(m.vista, m.face)}${comIntensidade(m.tipo) ? ` · intensidade ${m.intensidade ?? '—'}/10` : ' · ' + esc(m.procedimento || 'procedimento')}${m.hora ? ' · ' + m.hora : ''}</small>${m.nota ? `<p>${esc(m.nota)}</p>` : ''}</div></div>`).join('')}</div></div>`; }).join('')}
  </div><aside class="grid" style="align-content:start">${evolucao()}</aside></div>`;
}

/* ---------- Biblioteca clínica ---------- */
const elTag = e => e ? `<span class="el-tag"><i style="background:${EL[e].cor}"></i>${EL[e].nome}</span>` : '';
const agoraIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function fichaHtml(c){
  const p = PT[c], m = merDe(c), rv = S.rev[c], pos = temPosicao(c), nota = S.notas[c] || '';
  const conteudo = p ? `<dl class="fx-dl">
      <dt>Localização</dt><dd>${esc(p.loc)}</dd><dt>Ações</dt><dd>${esc(p.acoes)}</dd>
      <dt>Indicações</dt><dd class="muted">Não constam na ficha atual. Entram pela fonte aprovada.</dd>
      <dt>Cautelas</dt><dd>${p.cautela ? `<span class="pill crit">${ic('alerta')}${esc(CAUT[p.cautela])}</span>` : '<span class="muted">Nenhuma cautela cadastrada na ficha atual.</span>'}</dd></dl>
    <div class="fx-fonte"><span class="lbl">Fonte</span><span>Ficha existente do sistema</span><div class="fx-f3"><span>Obra <b>não informada</b></span><span>Edição <b>não informada</b></span><span>Página <b>não informada</b></span></div></div>`
    : `<div class="notice fx-pend">${ic('info')}<div><b>Ficha pendente.</b> Nome, localização, ações, indicações e cautelas deste ponto entram pela importação da fonte que você aprovar, com obra, edição e página. O sistema não escreve esse conteúdo.</div></div>`;
  const posicao = pos ? `<div class="fx-pos"><span class="lbl">Posição no mapa</span><span>Aproximada · ${vistasDoPonto(c).join(', ')}</span>
      ${rv?.ok ? `<span class="pill ok" id="rev-ok">${ic('check')}revisado</span><small class="muted">Revisado por ${esc(rv.por)} em ${fmt(rv.data)} às ${rv.hora}</small><button class="btn sm ghost" data-a="desrevisar" data-c="${c}">Retirar revisão</button>`
        : `<span class="pill warn">não revisada</span><button class="btn sm" data-a="revisar" data-c="${c}">${ic('check')}Marcar posição como revisada</button>`}
      ${rv?.hist?.length ? `<details class="mais"><summary>${ic('historico')}Histórico da revisão (${rv.hist.length})</summary><ul class="fx-h-l">${rv.hist.map(h => `<li>${esc(h.acao)} · ${esc(h.por)} · ${fmt(h.data)} às ${h.hora}</li>`).join('')}</ul></details>` : ''}</div>`
    : `<div class="fx-pos"><span class="lbl">Posição no mapa</span><span class="muted">Sem posição no mapa</span></div>`;
  return `<div class="ficha" data-ficha="${c}"><div class="fx-h"><span class="fx-c">${c}</span><div class="grow"><b>${p ? esc(p.pinyin) : 'Nome pendente'}</b><small>${MER[m][0]}${MER[m][1] ? ' · ' : ''}${elTag(MER[m][1])}</small></div>${p ? '<span class="pill ok">ficha</span>' : '<span class="pill warn fx-pend-t">ficha pendente</span>'}<button class="btn ghost sm fx-x" data-a="fx-fechar" aria-label="Fechar ficha">${ic('x')}</button></div>
    ${conteudo}${posicao}
    <div class="fx-part"><label class="lbl" for="nota-${c}">Anotação particular da clínica</label><textarea id="nota-${c}" data-nota="${c}" placeholder="Fica na Particular e não altera a Central.">${esc(nota)}</textarea><small class="muted">${ic('escudo')} Particular · não altera a ficha Central</small></div></div>`;
}
function painelTrajeto(k){
  const vaso = VASOS.includes(k);
  const cab = `<div class="fx-h"><span class="fx-c tj-c" style="--c:${corTraj(k)}">${vaso ? SIGLA_VASO[k] : k}</span><div class="grow"><b>${vaso ? k : MER[k][0]}</b><small>${vaso ? 'Vaso extraordinário' : 'Meridiano principal · ' + elTag(MER[k][1])}</small></div><button class="btn ghost sm fx-x" data-a="fx-fechar" aria-label="Fechar">${ic('x')}</button></div>
    <p class="muted sm">Trajeto aproximado · aparece nas vistas ${vistasDoTrajeto(k).join(', ')}.</p>`;
  if (vaso) {
    const [, ab, ac] = PARES.find(p => p[0] === k), par = PARES.find(p => p[1] === ac)[0];
    const bt = c => `<button class="pc${PT[c] ? ' tem' : ''}" data-a="abrir-pt" data-c="${c}"><b>${c}</b><small>${PT[c] ? esc(PT[c].pinyin) : 'ficha pendente'}</small></button>`;
    return `${cab}<div class="vs-p"><div><span class="lbl">Ponto de abertura</span>${bt(ab)}</div><div><span class="lbl">Ponto acoplado</span>${bt(ac)}</div></div>
      <p class="sm">Par: <b>${par}</b>. Os mesmos pares aprovados na etapa 3.</p>
      <p class="muted sm">A indicação de vasos no tratamento continua como dica no Plano e aguarda os seus critérios.</p>`;
  }
  const L = CODIGOS.filter(c => merDe(c) === k), n = L.filter(c => PT[c]).length;
  return `${cab}<p class="sm">${L.length} pontos · <b>${n}</b> com ficha · ${L.length - n} pendentes</p><div class="pc-g">${L.map(c => `<button class="pc${PT[c] ? ' tem' : ''}" data-a="abrir-pt" data-c="${c}"><b>${c}</b><small>${PT[c] ? esc(PT[c].pinyin) : 'pendente'}</small></button>`).join('')}</div>`;
}
function vAtlas(){
  const v = S.avista, f = FACES[v] ? S.aface[v] : '', [w, h] = TAM[v];
  const ativos = [...S.ativos];
  const abre = new Set(PARES.filter(p => S.ativos.has(p[0])).flatMap(p => [p[1], p[2]]));
  const pts = Object.keys(PT).filter(c => S.todosPts || S.ativos.has(trajDoPonto(c)) || abre.has(c));
  const semTrajeto = ativos.filter(k => !TRAJ[k][chaveVista(v)]);
  const chip = k => `<button class="chip tjc${S.ativos.has(k) ? ' on' : ''}" data-a="tj" data-k="${k}" aria-pressed="${S.ativos.has(k)}" style="--c:${corTraj(k)}"><i></i>${VASOS.includes(k) ? k : k + ' · ' + MER[k][0]}</button>`;
  const painel = S.atSel ? fichaHtml(S.atSel) : S.atTraj ? painelTrajeto(S.atTraj)
    : `<div class="fx-vazio">${ic('corpo')}<b>Toque num ponto ou num trajeto</b><p class="muted sm">A ficha abre aqui, sem sair do Atlas.</p></div>`;
  return `<div class="grid g-side at-g">
    <div class="card"><div class="card-h"><h3>Atlas<small>12 meridianos e 8 vasos extraordinários</small></h3><span class="pill warn">trajetos aproximados</span></div>
      <div class="at-cols"><div class="at-ctl"><div class="tj-gr"><div class="tj-gh"><span class="lbl">Meridianos principais</span><button class="btn ghost sm" data-a="tj-todos" data-g="m">Todos</button><button class="btn ghost sm" data-a="tj-nenhum" data-g="m">Nenhum</button></div><div class="chips">${MERIDIANOS.map(chip).join('')}</div></div>
      <div class="tj-gr"><div class="tj-gh"><span class="lbl">Vasos extraordinários</span><button class="btn ghost sm" data-a="tj-todos" data-g="v">Todos</button><button class="btn ghost sm" data-a="tj-nenhum" data-g="v">Nenhum</button></div><div class="chips">${VASOS.map(chip).join('')}</div></div>
      <label class="tp-l"><input type="checkbox" data-todos-pts ${S.todosPts ? 'checked' : ''}> Mostrar todos os pontos com posição (${Object.keys(PT).length})</label></div>
      <div class="at-map">${barraVistas(v, f, 'avista')}
      ${controleZoom(S.azoom, 'azoom')}<div class="mp-zoom"><svg class="mapa4 atlas" data-mapa="atlas" data-vista="${v}" viewBox="0 0 ${w} ${h}" style="width:${larguraZoom(v, S.azoom)}" role="img" aria-label="Atlas, vista ${vistaNome(v, f)}">${desenho(v, f)}${ativos.map(k => trajSvg(k, v)).join('')}${pontosSvg(pts, v, f, c => [abre.has(c) ? 'abre' : '', S.rev[c]?.ok ? 'rev' : '', S.atSel === c ? 'on' : ''].join(' '))}</svg></div>
      ${!chaveVista(v) ? `<p class="muted sm">Mãos e pés mostram os pontos; os trajetos aparecem nas vistas do corpo.</p>` : semTrajeto.length ? `<p class="muted sm" id="sem-trajeto">Sem trajeto nesta vista: ${semTrajeto.map(k => `${VASOS.includes(k) ? k : k} (${vistasDoTrajeto(k).join(', ')})`).join(' · ')}</p>` : ''}
      <div class="legenda"><span><svg viewBox="0 0 24 10" class="lg-i lg-w" aria-hidden="true"><path d="M1 5h22" class="lg-m"/></svg>Meridiano</span><span><svg viewBox="0 0 24 10" class="lg-i lg-w" aria-hidden="true"><path d="M1 5h22" class="lg-v"/></svg>Vaso extraordinário</span><span><svg viewBox="0 0 20 20" class="lg-i" aria-hidden="true"><g class="ptp"><circle cx="10" cy="10" r="4.5"/></g></svg>Ponto com posição</span><span><svg viewBox="0 0 20 20" class="lg-i" aria-hidden="true"><g class="ptp abre"><circle cx="10" cy="10" r="4.5"/></g></svg>Abertura ou acoplado</span><span><svg viewBox="0 0 20 20" class="lg-i" aria-hidden="true"><g class="ptp rev"><circle cx="10" cy="10" r="4.5"/></g></svg>Posição revisada</span></div>
    </div></div></div>
    <aside class="fx-panel${S.fx && (S.atSel || S.atTraj) ? ' aberta' : ''}" aria-label="Ficha"><div class="card">${painel}</div></aside>
  </div>`;
}
function listaCentral(){
  const q = S.busca.trim().toLowerCase();
  const L = CODIGOS.filter(c => (!S.fMer || merDe(c) === S.fMer) && (!S.fSit || (S.fSit === 'ficha') === !!PT[c]) && (!q || c.toLowerCase().includes(q) || (PT[c]?.pinyin || '').toLowerCase().includes(q)));
  const grupos = Object.keys(NPT).map(m => [m, L.filter(c => merDe(c) === m)]).filter(([, l]) => l.length);
  return `<p class="muted sm" id="c-total">${L.length} de ${CODIGOS.length} pontos · ${L.filter(c => PT[c]).length} com ficha</p>` + (grupos.map(([m, l]) => `<div class="cg"><h4>${MER[m][0]} <span class="muted">· ${m} · ${NPT[m]} pontos</span></h4><div class="pc-g">${l.map(c => `<button class="pc${PT[c] ? ' tem' : ''}${S.cSel === c ? ' on' : ''}" data-a="c-abrir" data-c="${c}"><b>${c}</b><small>${PT[c] ? esc(PT[c].pinyin) : 'pendente'}</small></button>`).join('')}</div></div>`).join('') || '<p class="muted">Nenhum ponto encontrado.</p>');
}
function vCentral(){
  return `<div class="grid g-side"><div class="card"><div class="card-h"><h3>Central<small>fichas de pontos, iguais para todas as clínicas</small></h3></div>
      <div class="notice">${ic('info')}<div><b>Nenhuma fonte cadastrada.</b> Os 28 pontos que já têm ficha continuam iguais. Os demais aparecem como ficha pendente até a importação da fonte aprovada, que guarda obra, edição e página.</div></div>
      <div class="c-filt"><input type="search" data-busca placeholder="Buscar por código ou nome" value="${esc(S.busca)}" aria-label="Buscar ponto">
        <select class="mini-sel" data-fmer aria-label="Meridiano"><option value="">Todos os meridianos</option>${Object.keys(NPT).map(m => `<option value="${m}" ${S.fMer === m ? 'selected' : ''}>${m} · ${MER[m][0]}</option>`).join('')}</select>
        <select class="mini-sel" data-fsit aria-label="Situação da ficha"><option value="">Todas as fichas</option><option value="ficha" ${S.fSit === 'ficha' ? 'selected' : ''}>Com ficha</option><option value="pend" ${S.fSit === 'pend' ? 'selected' : ''}>Pendentes</option></select></div>
      <div id="c-lista">${listaCentral()}</div></div>
    <aside class="fx-panel${S.fx && S.cSel ? ' aberta' : ''}"><div class="card">${S.cSel ? fichaHtml(S.cSel) : `<div class="fx-vazio">${ic('lista')}<b>Escolha um ponto</b><p class="muted sm">A ficha abre ao lado da lista.</p></div>`}</div></aside></div>`;
}
function vParticular(){
  const notas = Object.entries(S.notas).filter(([, t]) => t.trim());
  return `<div class="notice">${ic('escudo')}<div><b>Particular da clínica.</b> Fichas e anotações próprias ficam só aqui e não alteram a Central.</div></div>
  <div class="grid g-side"><div class="grid" style="align-content:start">
    <div class="card"><div class="card-h"><h3>Fichas particulares</h3><span class="pill">${S.part.length}</span></div>
      <div class="pa-l">${S.part.map(x => `<div class="pa" data-id="${x.id}"><div class="grow"><b>${esc(x.titulo)}</b>${x.ponto ? `<button class="pill acc" data-a="part-pt" data-c="${esc(x.ponto)}">${esc(x.ponto)}</button>` : ''}<p>${esc(x.texto)}</p><small class="muted">Particular · ${esc(x.por)} · ${fmt(x.em)}</small></div></div>`).join('')}</div></div>
    <div class="card"><div class="card-h"><h3>Anotações em pontos</h3><span class="pill">${notas.length}</span></div>
      <div class="pa-l">${notas.map(([c, t]) => `<div class="pa"><div class="grow"><b>${c}</b><p>${esc(t)}</p><small class="muted">Feita na ficha do ponto · a ficha Central continua igual</small></div></div>`).join('') || '<p class="muted sm">Nenhuma anotação.</p>'}</div></div>
  </div>
  <aside><form class="card pa-f" id="f-part"><div class="card-h"><h3>Nova ficha particular</h3></div>
    <div class="field"><label class="lbl" for="pa-t">Título</label><input id="pa-t" name="titulo" required placeholder="Ex.: protocolo da clínica"></div>
    <div class="field"><label class="lbl" for="pa-p">Ponto relacionado (opcional)</label><input id="pa-p" name="ponto" placeholder="Ex.: E36"></div>
    <div class="field"><label class="lbl" for="pa-x">Texto</label><textarea id="pa-x" name="texto" required></textarea></div>
    <button class="btn pri">${ic('novo')}Adicionar à Particular</button></form></aside></div>`;
}
const BIB = [['central','Central','lista'],['particular','Particular','escudo'],['atlas','Atlas','corpo']];
function vBiblioteca(){
  return `<div class="tabs bib-t" role="tablist">${BIB.map(([k, n, i]) => `<button role="tab" class="${S.rotaBib === k ? 'on' : ''}" aria-selected="${S.rotaBib === k}" data-a="bib" data-t="${k}">${ic(i)}${n}</button>`).join('')}</div>`
    + ({ central:vCentral, particular:vParticular, atlas:vAtlas })[S.rotaBib]();
}

/* ---------- Estrutura da página ---------- */
const TELAS = { mapa:['Mapa corporal',vMapa], prontuario:['Prontuário · mapa corporal',vProntuario], biblioteca:['Biblioteca clínica',vBiblioteca] };
const rota = () => { const [r, s] = location.hash.replace(/^#\/?/, '').split('/'); if (r === 'biblioteca' && BIB.some(b => b[0] === s)) S.rotaBib = s; return TELAS[r] ? r : 'mapa'; };
function cabecalho(){
  return `<div class="at-top"><div class="at-h"><span class="avatar lg">${initials(P.name)}</span><div class="at-id"><b>${P.name}</b><small>${P.idade} anos · ${fmt(HOJE)} · 3º atendimento · retorno</small></div>
      <div class="at-al"><span class="pill ok">${ic('okc')}Sem alertas de segurança</span><a class="pill acc" href="#/prontuario">${ic('historico')}Prontuário</a></div>
      <div class="at-m"><span class="autosave ok">${ic('check')}Rascunho · proposta</span></div></div>
    <nav class="steps" aria-label="Etapas do atendimento">${ETAPAS.map(([k, n], j) => k === 'mapa' ? `<a href="#/mapa" class="on" aria-current="step"><svg viewBox="0 0 36 36" class="sr" aria-hidden="true"><circle cx="18" cy="18" r="15" class="sr-b"/></svg><span class="sn">${j + 1}</span><span class="sl">${n}</span></a>`
      : `<span class="st-off" data-tip="Fora desta proposta"><svg viewBox="0 0 36 36" class="sr" aria-hidden="true"><circle cx="18" cy="18" r="15" class="sr-b"/></svg><span class="sn">${j + 1}</span><span class="sl">${n}</span></span>`).join('')}</nav></div>`;
}
function menu(r){
  const NAV = [['painel','Painel','painel'],['agenda','Agenda','agenda'],['pacientes','Pacientes','pacientes'],['biblioteca','Biblioteca clínica','biblioteca'],['financeiro','Financeiro','financeiro'],['documentos','Documentos','doc'],['relatorios','Relatórios','relatorios'],['administracao','Administração','admin']];
  const destino = { pacientes:'#/mapa', biblioteca:'#/biblioteca/atlas' };
  document.querySelector('.app').classList.toggle('open', S.aberto);
  document.getElementById('nav').innerHTML = `<div class="brand">${LOGO}<div><b>Musubi</b><small>Gestão clínica integrativa</small></div></div>` +
    NAV.map(([k, l, i]) => `<a href="${destino[k] || '#/mapa'}" ${destino[k] ? '' : 'data-a="fora"'} aria-label="${l}" class="${(k === 'biblioteca') === (r === 'biblioteca') && (k === 'biblioteca' || k === 'pacientes') ? 'on' : ''}">${ic(i)}<span>${l}</span></a>`).join('');
  const mig = r === 'biblioteca' ? `<span>Biblioteca clínica</span>${ic('dir')}<span>${BIB.find(b => b[0] === S.rotaBib)[1]}</span>` : `<span>Pacientes</span>${ic('dir')}<span>${P.name}</span>${ic('dir')}<span>${TELAS[r][0]}</span>`;
  document.getElementById('topbar').innerHTML = `<button class="menu-btn" data-a="menu-abrir" aria-label="Abrir menu">${ic('menu')}</button><a class="tb-logo" href="#/mapa">${LOGO}<b>Musubi</b></a>
    <nav class="migalha" aria-label="Caminho">${mig}</nav><div class="tb-r"><span class="pill acc">Proposta da etapa 4</span></div>`;
}
let ultima = '';
function render(manter){
  const r = rota(), y = scrollY, v = document.getElementById('view'); menu(r);
  const titulo = r === 'mapa' ? cabecalho() + `<div class="et-h"><span class="tico acc">${ic('corpo')}</span><div class="grow"><h2>Mapa corporal</h2><small class="muted">Etapa 5 de 8</small></div></div>`
    : `<div class="et-h"><span class="tico acc">${ic(r === 'biblioteca' ? 'biblioteca' : 'historico')}</span><div class="grow"><h2>${TELAS[r][0]}</h2><small class="muted">${r === 'biblioteca' ? 'Central, Particular e Atlas' : P.name + ' · marcações por atendimento'}</small></div></div>`;
  v.innerHTML = titulo + TELAS[r][1]();
  const chave = r + S.rotaBib;
  if (chave !== ultima) { v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra'); ultima = chave; }
  if (manter) scrollTo(0, y);
}
function toast(m){ const t = document.getElementById('toast'); t.className = 'toast ok'; t.innerHTML = `${ic('okc')}<span></span>`; t.lastChild.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }

/* ---------- Toque no mapa ---------- */
function pontoNoDesenho(svg, ev){ const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; }
function toqueMapa(ev, svg){
  if (svg.dataset.mapa === 'atlas') {
    const pt = ev.target.closest('.ptp'), tj = ev.target.closest('.tj');
    if (pt) { S.atSel = pt.dataset.pt; S.atTraj = null; S.fx = true; render(true); }
    else if (tj) { S.atTraj = tj.dataset.tj; S.atSel = null; S.fx = true; render(true); }
    return;
  }
  const v = S.vista, f = faceDe(v), [w, h] = TAM[v], [x, y] = pontoNoDesenho(svg, ev);
  const mkEl = ev.target.closest('.mk'), sobreCorpo = ev.target.closest('.corpo, .mk, .ptp');
  const nx = +(x / w).toFixed(4), ny = +(y / h).toFixed(4);
  if (S.redesenhar) {
    if (!sobreCorpo) return toast('Toque sobre o corpo para marcar o destino');
    const m = marca(S.redesenhar); m.x2 = nx; m.y2 = ny; S.redesenhar = null; S.sel = m.id; render(true); toast('Trajeto da irradiação marcado'); return;
  }
  if (S.ferr === 'sel' || S.final) {
    if (mkEl) { S.sel = mkEl.dataset.id; S.rmConf = false; render(true); }
    else { const pt = ev.target.closest('.ptp'); if (pt) toast(`Ponto do plano ${pt.dataset.pt} · posição aproximada`); }
    return;
  }
  if (!sobreCorpo) return toast('Toque sobre o corpo para marcar');
  const t = S.ferr, m = { id:'m' + (++S.seq), at:ATUAL, data:HOJE, hora:agora(), tipo:t, vista:v, face:f, x:nx, y:ny, lado:ladoDe(v, f, x), intensidade:null, procedimento:'', regiao:'', nota:'' };
  S.marcas.push(m); S.sel = m.id; S.rmConf = false; S.ferr = 'sel';
  if (t === 'irradiacao') { S.redesenhar = m.id; toast('Origem marcada. Agora toque no destino'); } else toast(`${tipoNome(t)} marcada · ${ladoNome(m.lado).toLowerCase()}`);
  render(true);
}

/* ---------- Eventos ---------- */
const tip = document.getElementById('tip');
document.addEventListener('mouseover', ev => { const t = ev.target.closest('[data-tip]'); if (!t) { tip.hidden = true; return; } tip.textContent = t.dataset.tip; tip.hidden = false; const b = t.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2)) + 'px'; tip.style.top = (b.top - tip.offsetHeight - 8 < 4 ? b.bottom + 8 : b.top - tip.offsetHeight - 8) + 'px'; });
addEventListener('hashchange', () => { S.aberto = false; S.fx = false; render(); scrollTo(0, 0); });
document.addEventListener('click', ev => {
  tip.hidden = true;
  const svg = ev.target.closest('svg.mapa4'); if (svg) { toqueMapa(ev, svg); return; }
  const t = ev.target.closest('[data-a]'); if (!t || t.disabled) return; const a = t.dataset.a;
  const m = marca(S.sel);
  if (a === 'vista') { S.vista = t.dataset.v; S.redesenhar = null; render(true); }
  else if (a === 'vista-face') { S.face[S.vista] = t.dataset.f; render(true); }
  else if (a === 'avista') { S.avista = t.dataset.v; render(true); }
  else if (a === 'avista-face') { S.aface[S.avista] = t.dataset.f; render(true); }
  else if (a === 'ferr') { S.ferr = t.dataset.t; S.redesenhar = null; render(true); }
  else if (a === 'zoom' || a === 'azoom') { const k = a === 'zoom' ? 'zoom' : 'azoom'; S[k] = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(S[k]) + Number(t.dataset.d)))]; render(true); }
  else if (a === 'cmp-ant') { S.ant = !S.ant; render(true); }
  else if (a === 'cmp-plano') { S.plano = !S.plano; render(true); }
  else if (a === 'sel-mk') { const x = marca(t.dataset.id); S.sel = x.id; S.rmConf = false; S.vista = x.vista; if (FACES[x.vista]) S.face[x.vista] = x.face; render(true); }
  else if (a === 'int' && m) { const n = Number(t.dataset.n); m.intensidade = m.intensidade === n ? null : n; render(true); }
  else if (a === 'redesenhar' && m) { S.redesenhar = m.id; S.vista = m.vista; render(true); }
  else if (a === 'cancelar-rad') { S.redesenhar = null; render(true); }
  else if (a === 'rm') { S.rmConf = true; render(true); }
  else if (a === 'rm-nao') { S.rmConf = false; render(true); }
  else if (a === 'rm-sim' && m) { S.marcas = S.marcas.filter(x => x.id !== m.id); S.sel = null; S.rmConf = false; render(true); toast('Marcação removida'); }
  else if (a === 'desmarcar') { S.sel = null; render(true); }
  else if (a === 'finalizar') { S.final = true; S.sel = null; S.ferr = 'sel'; S.redesenhar = null; render(true); toast('Atendimento finalizado: as marcações passaram ao prontuário'); }
  else if (a === 'reabrir') { S.final = false; render(true); toast('Simulação desfeita'); }
  else if (a === 'bib') { location.hash = '#/biblioteca/' + t.dataset.t; }
  else if (a === 'tj') { const k = t.dataset.k; S.ativos.has(k) ? S.ativos.delete(k) : S.ativos.add(k); render(true); }
  else if (a === 'tj-todos' || a === 'tj-nenhum') { (t.dataset.g === 'm' ? MERIDIANOS : VASOS).forEach(k => a === 'tj-todos' ? S.ativos.add(k) : S.ativos.delete(k)); render(true); }
  else if (a === 'abrir-pt') { S.atSel = t.dataset.c; S.fx = true; render(true); }
  else if (a === 'c-abrir') { S.cSel = t.dataset.c; S.fx = true; render(true); }
  else if (a === 'part-pt') { S.cSel = t.dataset.c; S.fx = true; location.hash = '#/biblioteca/central'; }
  else if (a === 'fx-fechar') { if (S.rotaBib === 'central') S.cSel = null; else { S.atSel = null; S.atTraj = null; } S.fx = false; render(true); }
  else if (a === 'revisar' || a === 'desrevisar') {
    const c = t.dataset.c, d = agoraIso(), h = agora(), r = S.rev[c] ||= { hist:[] };
    Object.assign(r, { ok:a === 'revisar', por:PROF, data:d, hora:h }); r.hist.unshift({ acao:a === 'revisar' ? 'Posição marcada como revisada' : 'Revisão retirada', por:PROF, data:d, hora:h });
    render(true); toast(a === 'revisar' ? `Posição de ${c} revisada` : 'Revisão retirada');
  }
  else if (a === 'menu-abrir') { S.aberto = !S.aberto; render(true); }
  else if (a === 'menu-fechar') { S.aberto = false; render(true); }
  else if (a === 'fora') { ev.preventDefault(); toast('Nesta proposta só o mapa corporal, o prontuário e a Biblioteca clínica são navegáveis'); }
});
document.addEventListener('input', ev => { const t = ev.target, m = marca(S.sel);
  if (t.dataset.mk && m && t.tagName !== 'SELECT') m[t.dataset.mk] = t.value;
  else if (t.dataset.nota) S.notas[t.dataset.nota] = t.value;
  else if (t.hasAttribute('data-busca')) { S.busca = t.value; document.getElementById('c-lista').innerHTML = listaCentral(); }
});
document.addEventListener('change', ev => { const t = ev.target, m = marca(S.sel);
  if (t.dataset.mk && m && t.tagName === 'SELECT') {
    m[t.dataset.mk] = t.value;
    if (t.dataset.mk === 'tipo') { if (!comIntensidade(t.value)) m.intensidade = null; if (t.value !== 'irradiacao') { delete m.x2; delete m.y2; } else if (m.x2 == null) S.redesenhar = m.id; }
    render(true);
  }
  else if (t.hasAttribute('data-cmp-hist')) { S.hist = t.value; render(true); }
  else if (t.hasAttribute('data-fmer')) { S.fMer = t.value; document.getElementById('c-lista').innerHTML = listaCentral(); }
  else if (t.hasAttribute('data-fsit')) { S.fSit = t.value; document.getElementById('c-lista').innerHTML = listaCentral(); }
  else if (t.hasAttribute('data-todos-pts')) { S.todosPts = t.checked; render(true); }
  else if (t.dataset.nota && rota() === 'biblioteca' && S.rotaBib === 'particular') render(true);
});
document.addEventListener('submit', ev => { ev.preventDefault(); const f = ev.target;
  if (f.id === 'f-part') { const d = new FormData(f); S.part.push({ id:'pa' + (++S.seq), titulo:d.get('titulo'), ponto:String(d.get('ponto') || '').trim().toUpperCase(), texto:d.get('texto'), por:PROF, em:agoraIso() }); render(true); toast('Ficha particular adicionada. A Central não muda.'); }
});
render();
