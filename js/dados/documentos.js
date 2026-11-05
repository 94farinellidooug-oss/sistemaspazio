// Etapa 6B: documentos (aprovados pelo Maicon em 05/11/2026, proposta/etapa-6).
//
// O profissional escolhe o paciente e o modelo; o texto vem preenchido com os dados já registrados
// conforme o modelo. Os modelos são editados na própria página (pedido do Maicon em 05/11, proposta/modelos),
// com os dados do sistema entre chaves ({paciente}, {data}...). Ao guardar, o texto vai para o prontuário:
//   p.documentos = [{id, modelo, nome, assina, texto, em, por, assinado?, assinadoEm?, assinadoPor?}] (mais recente
//   primeiro), criado só quando o primeiro documento é guardado. Não entra na exportação v1.
// Nada é concluído pelo sistema: o registro do atendimento só repete o que foi marcado.
import { fimHorario, horariosDoDia } from './agenda.js';
import { finalizados } from './atendimento.js';
import { LADOS_RX, SITUACOES_QUEIXA, linhasRx, nomeRx } from './prescricao.js';
import { fmt } from '../util.js';

export const CLINICA = 'Spazio Stabilità';
// Modelos que vêm com o sistema: [chave, nome, ícone, pede assinatura do paciente, texto com os dados entre chaves]
export const MODELOS_DOC = [
  ['termo', 'Termo de consentimento', 'assinatura', true, 'Eu, {paciente}, declaro que fui informado(a) por {profissional} sobre o tratamento com acupuntura e técnicas associadas, seus objetivos e possíveis reações, e que tive minhas dúvidas esclarecidas.\n\nInformei corretamente minhas condições de saúde e os medicamentos em uso, e sei que posso interromper o tratamento quando quiser.'],
  ['declaracao', 'Declaração de comparecimento', 'doc_id', false, 'Declaro, para os devidos fins, que {paciente} esteve em atendimento na {clinica} no dia {data}, {horario}.'],
  ['orientacoes', 'Orientações para casa', 'folha', false, '{orientacoes}'],
  ['registro', 'Registro do atendimento', 'doc', false, '{registro}']
];
// Dados que o sistema preenche no texto: [campo, rótulo do botão]
export const CAMPOS_DOC = [['paciente','Paciente'], ['cpf','CPF do paciente'], ['data','Data de hoje'], ['horario','Horário de hoje'], ['profissional','Profissional'], ['clinica','Clínica'], ['orientacoes','Orientações do atendimento'], ['registro','Registro do atendimento']];

// Modelos editados ou criados pelo profissional ficam em db.modelosDoc (criado só no primeiro salvar):
//   { termo:{nome, texto, assina, em, por}, m1:{nome, texto, assina, proprio:true, em, por}, ... }
// Um modelo do sistema editado guarda só a sua versão; "voltar ao original" apaga essa versão.
// Lista de modelos: [chave, nome, ícone, assina, texto, situação] com situação 'original' | 'editado' | 'proprio'.
export function modelosDoc(M = {}){
  const base = MODELOS_DOC.map(([k, n, i, a, t]) => M[k] ? [k, M[k].nome, i, M[k].assina, M[k].texto, 'editado'] : [k, n, i, a, t, 'original']);
  return base.concat(Object.entries(M).filter(([, m]) => m.proprio).map(([k, m]) => [k, m.nome, 'doc', m.assina, m.texto, 'proprio']));
}
export const modeloDoc = (k, M) => modelosDoc(M).find(m => m[0] === k) || null;

// Salva o modelo como do profissional. Sem chave, cria um novo. Salvar o texto igual ao original volta ao original.
export function salvarModelo(db, k, { nome, texto, assina }, em, por, novoId){
  nome = String(nome || '').trim(); texto = String(texto || '').trim();
  if (!nome || !texto) return null;
  const orig = MODELOS_DOC.find(m => m[0] === k), M = db.modelosDoc ||= {};
  if (orig && orig[1] === nome && orig[3] === !!assina && orig[4] === texto) { delete M[k]; return k; }
  if (!k) { k = novoId; M[k] = { nome, texto, assina: !!assina, proprio: true, em, por }; return k; }
  if (!orig && !M[k]?.proprio) return null;
  M[k] = { ...M[k], nome, texto, assina: !!assina, em, por };
  return k;
}
// Volta um modelo do sistema ao texto original.
export const voltarOriginal = (db, k) => { if (db.modelosDoc?.[k] && !db.modelosDoc[k].proprio) { delete db.modelosDoc[k]; return true; } return false; };
// Apaga um modelo criado pelo profissional. Documentos já guardados continuam no prontuário.
export const apagarModelo = (db, k) => { if (db.modelosDoc?.[k]?.proprio) { delete db.modelosDoc[k]; return true; } return false; };

// Último atendimento (rascunho ou finalizado) com orientações escritas.
const comOrientacao = p => [...p.atendimentos].reverse().find(a => (a.plano?.orient || '').trim());

function registroDoc(p){
  const a = finalizados(p).at(-1); if (!a) return '';
  // Sem situação marcada em nenhum ponto (atendimentos antigos), lista os pontos registrados sem dizer se foram feitos.
  const marcado = !!a.plano.rx && Object.keys(a.plano.rx).length > 0, desc = ([c, l]) => `${c} (${nomeRx(LADOS_RX, l.lado).toLowerCase()})`;
  const feitos = linhasRx(a).filter(([, l]) => !marcado || l.status === 'real').map(desc);
  const sit = Object.entries(a.evolucao?.situacoes || {}).map(([q, s]) => [p.queixas.find(x => x.id === q)?.descricao, s]).filter(([q]) => q).map(([q, s]) => `${q} (${nomeRx(SITUACOES_QUEIXA, s).toLowerCase()})`);
  return [`Atendimento de ${fmt(a.data)}${a.plano.tec.length ? ` · ${a.plano.tec.join(', ')}` : ''}.`,
    feitos.length ? `${marcado ? 'Pontos realizados' : 'Pontos registrados'}: ${feitos.join('; ')}.` : marcado ? 'Nenhum ponto marcado como realizado.' : '',
    sit.length ? `Queixas: ${sit.join('; ')}.` : ''].filter(Boolean).join('\n\n');
}
// Valores dos dados para o paciente.
export function valoresDoc(p, { appts = [], hoje, prof }){
  const h = horariosDoDia(appts, hoje).find(a => a.pid === p.id && a.st !== 'faltou');
  return { paciente: p.name, cpf: p.cadastro?.cpf || '', data: fmt(hoje), horario: h ? `das ${h.time} às ${fimHorario(h)}` : '', profissional: prof, clinica: CLINICA,
    orientacoes: comOrientacao(p)?.plano.orient.trim() || '', registro: registroDoc(p) };
}
// Preenche o texto. Um dado sem valor some junto com a vírgula ou o espaço antes dele; chaves desconhecidas ficam como estão.
export function preencherDoc(texto, v){
  return texto.replace(/(,? ?)\{(\w+)\}/g, (m, pre, k) => !(k in v) ? m : v[k] ? pre + v[k] : '').trim();
}
// Texto do modelo para o paciente, em parágrafos separados por linha em branco.
export function textoModelo(k, p, ctx, M){
  const m = modeloDoc(k, M);
  return m ? preencherDoc(m[4], valoresDoc(p, ctx)) : '';
}
// Por que o modelo veio vazio (para dizer na tela).
export const faltaModelo = k => ({ orientacoes:'Nenhum atendimento com orientações para casa ainda.', registro:'Nenhum atendimento finalizado ainda.' })[k] || '';

// Guarda o texto como ficou, com o nome do modelo e se pede assinatura (o modelo pode mudar ou ser apagado depois).
export function guardarDocumento(p, { id, modelo, texto, em, por }, M){
  const t = String(texto || '').trim(), m = modeloDoc(modelo, M);
  if (!m || !t) return null;
  const d = { id, modelo, nome: m[1], assina: m[3], texto: t, em, por };
  (p.documentos ||= []).unshift(d);
  return d;
}
// Termo assinado no papel: fica registrado quem marcou e quando.
export function marcarAssinado(p, id, em, por){
  const d = (p.documentos || []).find(x => x.id === id);
  if (!d || d.assinado || !(d.assina ?? modeloDoc(d.modelo)?.[3])) return null;
  Object.assign(d, { assinado: true, assinadoEm: em, assinadoPor: por });
  return d;
}
