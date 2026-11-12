// Histórico de alterações (LGPD, pedido do Maicon em 08/11/2026). Na hora de salvar no servidor, compara o
// documento de antes com o de agora e diz o que foi criado, alterado ou apagado. O servidor grava cada evento com
// o login de quem salvou e a hora dele (supabase/006_historico.sql). Só os NOMES dos campos vão para o histórico,
// nunca os valores, para ele não duplicar dados de saúde.
// Evento: { tipo, acao:'criou'|'alterou'|'apagou'|'desativou'|'reativou', alvo (id), paciente_id, titulo, campos:[...] }
import { fmt } from '../util.js';

// Vazio e ausente contam como iguais: telas que só preparam a estrutura ([] ou {}) não viram alteração.
const vazioH = x => x == null || x === '' || (Array.isArray(x) ? !x.length : typeof x === 'object' && !Object.keys(x).length);
const igualH = (a, b) => (vazioH(a) && vazioH(b)) || JSON.stringify(a) === JSON.stringify(b);
const porIdH = L => new Map((Array.isArray(L) ? L : []).filter(x => x && x.id != null).map(x => [String(x.id), x]));
// Campos que mudaram entre dois objetos (um nível; `fundo` abre um nível a mais, como o cadastro do paciente).
function camposMudadosH(a = {}, b = {}, ignorar = [], fundo = []){
  const C = [];
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    if (ignorar.includes(k) || igualH(a?.[k], b?.[k])) continue;
    if (fundo.includes(k) && a?.[k] && b?.[k] && typeof a[k] === 'object' && typeof b[k] === 'object') camposMudadosH(a[k], b[k]).forEach(x => C.push(`${k}.${x}`));
    else C.push(k);
  }
  return C;
}
// Lista com id: criou, apagou ou alterou cada item.
function listaH(E, antes, depois, ev){
  const A = porIdH(antes), B = porIdH(depois);
  for (const [id, b] of B) { const a = A.get(id); if (!a) E.push({ ...ev(b), acao:'criou', alvo:id, campos:[] }); else { const c = camposMudadosH(a, b); if (c.length) E.push({ ...ev(b), acao:'alterou', alvo:id, campos:c }); } }
  for (const [id, a] of A) if (!B.has(id)) E.push({ ...ev(a), acao:'apagou', alvo:id, campos:[] });
}
const dataTxtH = d => { try { return d ? fmt(String(d).slice(0, 10)) : ''; } catch (e) { return ''; } };
const SUB_H = ['atendimentos', 'avaliacoes', 'documentos', 'diagnosticos'];

export function eventosEntre(antes, depois){
  const E = [], A = antes || {}, B = depois || {};
  // Pacientes e o que fica dentro do prontuário.
  const PA = porIdH(A.patients), PB = porIdH(B.patients), desatB = porIdH(B.desativados), desatA = porIdH(A.desativados);
  for (const [id, b] of PB) {
    const a = PA.get(id), nome = b.name || '', base = { paciente_id:id };
    if (!a) { E.push({ ...base, tipo:'paciente', acao:desatA.has(id) ? 'reativou' : 'criou', alvo:id, titulo:nome, campos:[] }); }
    else { const c = camposMudadosH(a, b, SUB_H, ['cadastro']); if (c.length) E.push({ ...base, tipo:'paciente', acao:'alterou', alvo:id, titulo:nome, campos:c }); }
    const pa = a || {};
    listaH(E, pa.atendimentos, b.atendimentos, x => ({ ...base, tipo:'atendimento', titulo:`${nome} · atendimento de ${dataTxtH(x.data)}` }));
    listaH(E, pa.avaliacoes, b.avaliacoes, x => ({ ...base, tipo:'avaliacao', titulo:`${nome} · avaliação de ${dataTxtH(x.date || x.data)}` }));
    listaH(E, pa.documentos, b.documentos, x => ({ ...base, tipo:'documento', titulo:`${nome} · ${x.nome || 'documento'}` }));
    listaH(E, pa.diagnosticos, b.diagnosticos, x => ({ ...base, tipo:'diagnostico', titulo:`${nome} · CID ${x.codigo || ''}`.trim() }));
  }
  for (const [id, a] of PA) if (!PB.has(id)) E.push({ paciente_id:id, tipo:'paciente', acao:desatB.has(id) && !desatA.has(id) ? 'desativou' : 'apagou', alvo:id, titulo:a.name || '', campos:[] });
  // Agenda.
  const nomeDe = pid => (PB.get(String(pid)) || PA.get(String(pid)))?.name || '';
  listaH(E, A.appts, B.appts, x => ({ tipo:'horario', paciente_id:x.pid ? String(x.pid) : '', titulo:`${nomeDe(x.pid) || 'Horário'} · ${dataTxtH(x.date)} ${x.time || ''}`.trim() }));
  // Financeiro.
  const FA = A.financeiro || {}, FB = B.financeiro || {};
  const rec = x => ({ tipo:'recebimento', paciente_id:x.pid ? String(x.pid) : '', titulo:`Recebimento ${dataTxtH(x.data)}${x.pid && nomeDe(x.pid) ? ' · ' + nomeDe(x.pid) : ''}` });
  listaH(E, FA.recebimentos, FB.recebimentos, rec);
  listaH(E, FA.pacotes, FB.pacotes, x => ({ tipo:'pacote', paciente_id:x.pid ? String(x.pid) : '', titulo:`Pacote${x.nome ? ' ' + x.nome : ''}${x.pid && nomeDe(x.pid) ? ' · ' + nomeDe(x.pid) : ''}` }));
  listaH(E, FA.despesas, FB.despesas, x => ({ tipo:'despesa', paciente_id:'', titulo:`Despesa${x.descricao ? ' · ' + x.descricao : ''}` }));
  listaH(E, FA.notas, FB.notas, x => ({ tipo:'nota', paciente_id:'', titulo:`Nota fiscal${x.numero ? ' ' + x.numero : ''}${x.tomador ? ' · ' + x.tomador : ''}` }));
  // Configurações, modelos de documento e de mensagens.
  const cfg = camposMudadosH(A.config, B.config);
  if (cfg.length) E.push({ tipo:'configuracao', acao:'alterou', alvo:'config', paciente_id:'', titulo:'Configurações da clínica', campos:cfg });
  listaH(E, A.modelosDoc, B.modelosDoc, x => ({ tipo:'modelo', paciente_id:'', titulo:`Modelo de documento · ${x.nome || ''}`.trim() }));
  if (!igualH(A.mensagensWa, B.mensagensWa)) E.push({ tipo:'mensagens', acao:'alterou', alvo:'mensagensWa', paciente_id:'', titulo:'Modelos de mensagens do WhatsApp', campos:[] });
  return E.slice(0, 500).map(e => ({ ...e, campos:(e.campos || []).slice(0, 60) }));
}

// Textos para a tela.
export const TIPO_HIST = { paciente:'Cadastro', atendimento:'Atendimento', avaliacao:'Avaliação', documento:'Documento', diagnostico:'CID', horario:'Agenda',
  recebimento:'Recebimento', pacote:'Pacote', despesa:'Despesa', nota:'Nota fiscal', configuracao:'Configurações', modelo:'Modelo de documento', mensagens:'Mensagens', dados:'Dados' };
export const ACAO_HIST = { criou:'criou', alterou:'alterou', apagou:'apagou', desativou:'desativou', reativou:'reativou' };
const CAMPO_H = { name:'nome', birth:'nascimento', phone:'telefone', anam:'anamnese', alerts:'alertas', queixas:'queixas', relacionamento:'relacionamento', marcas:'marcações do mapa',
  'cadastro.cpf':'CPF', 'cadastro.email':'e-mail', 'cadastro.endereco':'endereço', 'cadastro.numero':'número do endereço', 'cadastro.complemento':'complemento', 'cadastro.bairro':'bairro', 'cadastro.cep':'CEP', 'cadastro.uf':'estado', 'cadastro.cidade':'cidade', 'cadastro.hemisferio':'hemisfério', 'cadastro.contatoEmergencia':'contato de emergência',
  data:'data', date:'data', time:'horário', status:'situação', done:'atendido', valor:'valor', forma:'forma de pagamento', texto:'texto', assinado:'assinatura', edicoes:'correções', ativo:'ativo' };
export const campoTxt = c => CAMPO_H[c] || String(c).replace(/^cadastro\./, '').replace(/([A-Z])/g, ' $1').toLowerCase();
