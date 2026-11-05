// Etapa 6B: documentos (aprovados pelo Maicon em 05/11/2026, proposta/etapa-6).
//
// O profissional escolhe o paciente e o modelo; o texto vem preenchido com os dados já registrados
// e pode ser ajustado antes de imprimir. Ao guardar, o texto como ficou vai para o prontuário:
//   p.documentos = [{id, modelo, texto, em, por, assinado?, assinadoEm?, assinadoPor?}] (mais recente
//   primeiro), criado só quando o primeiro documento é guardado. Não entra na exportação v1.
// Os textos dos modelos são exemplos (o Maicon troca pelos seus em Configurações, etapa 10). Nada é
// concluído pelo sistema: o registro do atendimento só repete o que foi marcado.
import { fimHorario, horariosDoDia } from './agenda.js';
import { finalizados } from './atendimento.js';
import { LADOS_RX, SITUACOES_QUEIXA, linhasRx, nomeRx } from './prescricao.js';
import { fmt } from '../util.js';

export const CLINICA = 'Spazio Stabilità';
// [chave, nome, ícone, pede assinatura do paciente]
export const MODELOS_DOC = [
  ['termo', 'Termo de consentimento', 'assinatura', true],
  ['declaracao', 'Declaração de comparecimento', 'doc_id', false],
  ['orientacoes', 'Orientações para casa', 'folha', false],
  ['registro', 'Registro do atendimento', 'doc', false]
];
export const modeloDoc = k => MODELOS_DOC.find(m => m[0] === k) || null;

// Último atendimento (rascunho ou finalizado) com orientações escritas.
const comOrientacao = p => [...p.atendimentos].reverse().find(a => (a.plano?.orient || '').trim());

// Texto do modelo para o paciente, em parágrafos separados por linha em branco.
export function textoModelo(k, p, { appts = [], hoje, prof }){
  if (k === 'termo') return `Eu, ${p.name}, declaro que fui informado(a) por ${prof} sobre o tratamento com acupuntura e técnicas associadas, seus objetivos e possíveis reações, e que tive minhas dúvidas esclarecidas.\n\nInformei corretamente minhas condições de saúde e os medicamentos em uso, e sei que posso interromper o tratamento quando quiser.`;
  if (k === 'declaracao') {
    const h = horariosDoDia(appts, hoje).find(a => a.pid === p.id && a.st !== 'faltou');
    return `Declaro, para os devidos fins, que ${p.name} esteve em atendimento na ${CLINICA} no dia ${fmt(hoje)}${h ? `, das ${h.time} às ${fimHorario(h)}` : ''}.`;
  }
  if (k === 'orientacoes') { const a = comOrientacao(p); return a ? a.plano.orient.trim() : ''; }
  if (k === 'registro') {
    const a = finalizados(p).at(-1); if (!a) return '';
    // Sem situação marcada em nenhum ponto (atendimentos antigos), lista os pontos registrados sem dizer se foram feitos.
    const marcado = !!a.plano.rx && Object.keys(a.plano.rx).length > 0, desc = ([c, l]) => `${c} (${nomeRx(LADOS_RX, l.lado).toLowerCase()})`;
    const feitos = linhasRx(a).filter(([, l]) => !marcado || l.status === 'real').map(desc);
    const sit = Object.entries(a.evolucao?.situacoes || {}).map(([q, s]) => [p.queixas.find(x => x.id === q)?.descricao, s]).filter(([q]) => q).map(([q, s]) => `${q} (${nomeRx(SITUACOES_QUEIXA, s).toLowerCase()})`);
    return [`Atendimento de ${fmt(a.data)}${a.plano.tec.length ? ` · ${a.plano.tec.join(', ')}` : ''}.`,
      feitos.length ? `${marcado ? 'Pontos realizados' : 'Pontos registrados'}: ${feitos.join('; ')}.` : marcado ? 'Nenhum ponto marcado como realizado.' : '',
      sit.length ? `Queixas: ${sit.join('; ')}.` : ''].filter(Boolean).join('\n\n');
  }
  return '';
}
// Por que o modelo veio vazio (para dizer na tela).
export const faltaModelo = k => ({ orientacoes:'Nenhum atendimento com orientações para casa ainda.', registro:'Nenhum atendimento finalizado ainda.' })[k] || '';

export function guardarDocumento(p, { id, modelo, texto, em, por }){
  const t = String(texto || '').trim();
  if (!modeloDoc(modelo) || !t) return null;
  const d = { id, modelo, texto: t, em, por };
  (p.documentos ||= []).unshift(d);
  return d;
}
// Termo assinado no papel: fica registrado quem marcou e quando.
export function marcarAssinado(p, id, em, por){
  const d = (p.documentos || []).find(x => x.id === id);
  if (!d || d.assinado || !modeloDoc(d.modelo)[3]) return null;
  Object.assign(d, { assinado: true, assinadoEm: em, assinadoPor: por });
  return d;
}
