// Modelo de dados v2 do MUSUBI (chave musubi-v2) e conversões com o formato v1 (chave spazio-v1).
// Funções puras, sem acesso ao navegador: podem ser testadas direto no Node.
//
// Formato v2:
// { versao:2, origem:'spazio-v1'|'exemplos'|'importacao', migradoEm, appts:[...mesmo formato do v1],
//   patients:[{ id, name, birth, phone, exemplo, consentimento?, anam, alerts,
//     cadastro:{cpf, email, endereco, cidade, hemisferio:'Sul'|'Norte', contatoEmergencia},
//     queixas:[{id, descricao, ativa}],
//     atendimentos:[{ id, data, status:'finalizado'|'rascunho', origem:'v1'|'sistema',
//       plano:{pontos, tec}, evolucao:{intensidades:{[idQueixa]:0..10}, nota}, avaliacaoId,
//       historico:[{em, acao}] }],
//     avaliacoes:[{ id, date, signs, status, nota, atendimentoId, historico:[{em, acao}] }] }] }
//
// As telas continuam lendo p.sessions, p.assess e p.queixa: são calculados a partir do v2
// (propriedades não gravadas), no mesmo formato e na mesma ordem do v1. Assim o comportamento
// não muda e paraV1() devolve exatamente os dados do v1.

export const VERSAO = 2;
const QP = 'q1'; // identificador da queixa principal
// Campos do paciente no v1. Qualquer outro campo é guardado como está e devolvido por paraV1().
const CONHECIDOS = ['id','name','birth','phone','exemplo','queixa','consentimento','anam','alerts','sessions','assess'];

const lista = x => Array.isArray(x) ? x : [];
const obj = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
const txt = x => typeof x === 'string' ? x : x == null ? '' : String(x);
const evaN = x => { const n = Number(x); return Number.isFinite(n) ? n : 0; };

// Sessão do v1 → atendimento finalizado do v2 (mesmo id).
function atendimentoDeSessao(s, em){
  return { id: txt(s.id), data: txt(s.date), status: 'finalizado', origem: 'v1',
    plano: { pontos: lista(s.pontos).map(txt), tec: lista(s.tec).map(txt) },
    evolucao: { intensidades: { [QP]: evaN(s.eva) }, nota: txt(s.nota) },
    avaliacaoId: null, historico: [{ em, acao: 'migrado da sessão do v1' }] };
}

// Converte os dados do v1 (ou os exemplos) para o v2. Não altera o objeto recebido.
export function migrarV1(v1, em = new Date().toISOString(), origem = 'spazio-v1'){
  const d = obj(v1);
  const patients = lista(d.patients).filter(p => p && typeof p === 'object').map(p0 => {
    const p = JSON.parse(JSON.stringify(p0));
    const atendimentos = lista(p.sessions).filter(s => s && typeof s === 'object').map(s => atendimentoDeSessao(s, em));
    const avaliacoes = lista(p.assess).filter(a => a && typeof a === 'object').map(a => {
      const at = atendimentos.find(x => x.data === a.date && !x.avaliacaoId);
      if (at) at.avaliacaoId = txt(a.id);
      return { id: txt(a.id), date: txt(a.date), signs: lista(a.signs).map(txt), status: obj(a.status), nota: txt(a.nota),
        atendimentoId: at ? at.id : null, historico: [{ em, acao: 'migrada da avaliação do v1' }] };
    });
    const n = { id: txt(p.id), name: txt(p.name), birth: txt(p.birth), phone: txt(p.phone), exemplo: !!p.exemplo };
    if ('consentimento' in p) n.consentimento = p.consentimento;
    n.anam = obj(p.anam); n.alerts = obj(p.alerts);
    n.cadastro = { cpf: '', email: '', endereco: '', cidade: '', hemisferio: 'Sul', contatoEmergencia: '' };
    n.queixas = [{ id: QP, descricao: txt(p.queixa), ativa: true }];
    n.atendimentos = atendimentos; n.avaliacoes = avaliacoes;
    // Guarda a ordem original dos campos do v1, para devolver os dados exatamente como eram.
    n.v1 = { campos: Object.keys(p) };
    const extras = Object.keys(p).filter(k => !CONHECIDOS.includes(k));
    if (extras.length) n.v1.extras = Object.fromEntries(extras.map(k => [k, p[k]]));
    return n;
  });
  return { versao: VERSAO, origem, migradoEm: em, patients, appts: lista(d.appts).filter(a => a && typeof a === 'object') };
}

// Visões no formato v1, calculadas a partir do v2.
const sessaoV1 = a => ({ id: a.id, date: a.data, eva: a.evolucao.intensidades[QP], pontos: a.plano.pontos, tec: a.plano.tec, nota: a.evolucao.nota });
const avaliacaoV1 = a => ({ id: a.id, date: a.date, signs: a.signs, status: a.status, nota: a.nota });
export const sessoesDe = p => p.atendimentos.filter(a => a.status === 'finalizado').map(sessaoV1);
export const avaliacoesDe = p => p.avaliacoes.map(avaliacaoV1);

// Liga as propriedades calculadas (não gravadas) que as telas usam: sessions, assess e queixa.
export function hidratar(db){
  db.patients.forEach(hidratarPaciente);
  return db;
}
export function hidratarPaciente(p){
  Object.defineProperty(p, 'sessions', { get(){ return sessoesDe(p); }, enumerable: false, configurable: true });
  Object.defineProperty(p, 'assess', { get(){ return avaliacoesDe(p); }, enumerable: false, configurable: true });
  Object.defineProperty(p, 'queixa', { get(){ return p.queixas.find(q => q.id === QP)?.descricao ?? ''; }, enumerable: false, configurable: true });
  return p;
}

// Converte o v2 de volta para o v1 (para voltar ao protótipo ou conferir a migração).
export function paraV1(v2){
  return { patients: v2.patients.map(p => {
    const v = { id: p.id, name: p.name, birth: p.birth, phone: p.phone, exemplo: p.exemplo, queixa: p.queixas.find(q => q.id === QP)?.descricao ?? '',
      consentimento: p.consentimento, anam: p.anam, alerts: p.alerts, sessions: sessoesDe(p), assess: avaliacoesDe(p), ...(p.v1?.extras || {}) };
    const campos = p.v1?.campos || ['id','name','birth','phone','exemplo','queixa','anam','alerts','sessions','assess'].concat('consentimento' in p ? ['consentimento'] : []);
    return Object.fromEntries(campos.filter(k => k in v && v[k] !== undefined).map(k => [k, v[k]]));
  }), appts: v2.appts };
}

// Confere se um objeto tem o formato v2 mínimo.
export const ehV2 = d => !!d && d.versao === VERSAO && Array.isArray(d.patients) && Array.isArray(d.appts) &&
  d.patients.every(p => p && Array.isArray(p.atendimentos) && Array.isArray(p.avaliacoes) && Array.isArray(p.queixas));
export const ehV1 = d => !!d && !('versao' in d) && Array.isArray(d.patients);

// Novo paciente já no formato v2. Os campos do v1 seguem a mesma ordem do protótipo.
export function novoPaciente({ id, name, birth, phone, queixa, consentimento, em }){
  return { id, name, birth, phone, exemplo: false, consentimento, anam: { historia:'', sono:'', alimentacao:'', evacuacao:'', emocoes:'', medicamentos:'' },
    alerts: { gestante:false, anticoagulante:false, marcapasso:false }, cadastro: { cpf:'', email:'', endereco:'', cidade:'', hemisferio:'Sul', contatoEmergencia:'' },
    queixas: [{ id: QP, descricao: queixa, ativa: true }], atendimentos: [], avaliacoes: [],
    v1: { campos: ['id','name','birth','phone','queixa','exemplo','consentimento','anam','alerts','sessions','assess'] }, criadoEm: em };
}
// Registra uma sessão como atendimento finalizado, mantendo a ordem por data (como o v1 fazia).
// intensidades: valores das outras queixas ativas (a principal vem em eva, como no v1).
export function registrarSessao(p, { id, date, eva, pontos, tec, nota, intensidades = {} }, em){
  const av = p.avaliacoes.find(a => a.date === date && !a.atendimentoId);
  const at = { id, data: date, status: 'finalizado', origem: 'sistema', plano: { pontos, tec }, evolucao: { intensidades: { [QP]: eva, ...intensidades }, nota },
    avaliacaoId: av ? av.id : null, historico: [{ em, acao: 'sessão registrada' }] };
  if (av) av.atendimentoId = id;
  p.atendimentos.push(at);
  p.atendimentos.sort((a, b) => a.data.localeCompare(b.data));
  return at;
}
// Registra uma avaliação energética, ligada ao atendimento do mesmo dia quando houver.
export function registrarAvaliacao(p, { id, date, signs, status, nota }, em){
  const at = p.atendimentos.find(a => a.data === date && !a.avaliacaoId);
  if (at) { at.avaliacaoId = id; at.historico.push({ em, acao: 'avaliação energética ligada ao atendimento' }); }
  const av = { id, date, signs, status, nota, atendimentoId: at ? at.id : null, historico: [{ em, acao: 'avaliação registrada' }] };
  p.avaliacoes.push(av);
  return av;
}

// Queixas: a principal (q1) é a do v1; as outras são acompanhadas pelas intensidades de cada atendimento.
export const QUEIXA_PRINCIPAL = QP;
export function adicionarQueixa(p, { id, descricao }, em){
  const q = { id, descricao, ativa: true, criadaEm: em };
  p.queixas.push(q);
  return q;
}
// Marca uma queixa secundária como resolvida (ativa=false) ou reativa. A principal fica sempre ativa.
export function alternarQueixa(p, id, em){
  const q = p.queixas.find(x => x.id === id);
  if (!q || q.id === QP) return null;
  q.ativa = !q.ativa;
  (q.historico ||= []).push({ em, acao: q.ativa ? 'queixa reativada' : 'queixa marcada como resolvida' });
  return q;
}
// Evolução de uma queixa: intensidade em cada atendimento finalizado em que ela foi medida.
export const serieQueixa = (p, id) => p.atendimentos.filter(a => a.status === 'finalizado' && a.evolucao.intensidades[id] != null)
  .map(a => ({ data: a.data, valor: a.evolucao.intensidades[id] }));
