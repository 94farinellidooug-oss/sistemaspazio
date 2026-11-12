// Etapa 7A: WhatsApp pelo caminho simples e sem custo (aprovado pelo Maicon em 05/11/2026, proposta/etapa-7).
//
// O sistema monta a mensagem e abre o WhatsApp (link wa.me) com o número e o texto; quem envia é o
// profissional. Fica anotado quando a mensagem foi aberta e por quem, no próprio paciente:
//   p.relacionamento.mensagens = [{tipo, em, por, ap?}] (mais recente primeiro; ap = horário da agenda)
// Modelos de mensagens editadas pelo profissional ficam em db.mensagensWa = {lembrete:{texto, em, por}, ...}
// (criado no primeiro salvar; salvar igual ao original volta ao original). Nada disso vai para a
// exportação v1.
import { fmt } from '../util.js';

// [chave, nome, texto com os dados entre chaves]
export const MENSAGENS_WA = [
  ['lembrete', 'Lembrete de horário', 'Olá, {primeiro}! Passando para lembrar do seu horário de {servico} {quando}, às {hora}, na {clinica}. Pode confirmar por aqui?'],
  ['retomar', 'Retomar contato', 'Olá, {primeiro}! Tudo bem? Faz um tempinho desde o seu último atendimento. Quer agendar um horário para continuarmos o tratamento?'],
  ['teleconsulta', 'Consulta online', 'Olá, {primeiro}! Sua consulta online de {servico} é {quando}, às {hora}. No horário, entre por este link, pelo celular ou computador (não precisa instalar nada):\n\n{link}\n\nEscolha um lugar reservado e, se puder, use fones de ouvido.'],
  ['area', 'Área do paciente', 'Olá, {primeiro}! Este é o seu acesso à Área do paciente da {clinica}, com as suas próximas consultas, orientações e documentos:\n\n{link}\n\nPara abrir, confirme a sua data de nascimento. O link é pessoal: não compartilhe.'],
  ['orientacoes', 'Orientações para casa', 'Olá, {primeiro}! Seguem as orientações do atendimento:\n\n{orientacoes}'],
  ['livre', 'Mensagem livre', 'Olá, {primeiro}! ']
];
// Dados que o sistema preenche: [campo, rótulo do botão]
export const CAMPOS_WA = [['primeiro','Primeiro nome'], ['servico','Serviço'], ['quando','Dia'], ['hora','Hora'], ['clinica','Clínica'], ['profissional','Profissional'], ['orientacoes','Orientações'], ['link','Link (consulta online ou área do paciente)']];

// [chave, nome, texto, 'original' | 'editada']
export const mensagensWa = (M = {}) => MENSAGENS_WA.map(([k, n, t]) => M[k] ? [k, n, M[k].texto, 'editada'] : [k, n, t, 'original']);
export const mensagemWa = (k, M) => mensagensWa(M).find(m => m[0] === k) || null;
export function salvarMensagemWa(db, k, texto, em, por){
  const o = MENSAGENS_WA.find(m => m[0] === k), t = String(texto || '').trim();
  if (!o || !t) return null;
  const M = db.mensagensWa ||= {};
  if (t === o[2].trim()) delete M[k]; else M[k] = { texto: t, em, por };
  return k;
}
export const voltarMensagemWa = (db, k) => { if (db.mensagensWa?.[k]) { delete db.mensagensWa[k]; return true; } return false; };

// Número para o link: só dígitos; com DDD e sem o 55 (10 ou 11 dígitos), o 55 entra na frente.
export function numeroWa(tel){
  const d = String(tel || '').replace(/\D/g, '');
  if (/^(\d)\1+$/.test(d)) return ''; // número de exemplo (0000…, 1111…): não abre conversa com ninguém
  return d.length === 10 || d.length === 11 ? '55' + d : d.length >= 12 && d.length <= 13 ? d : '';
}
export const linkWa = (tel, texto) => numeroWa(tel) ? `https://wa.me/${numeroWa(tel)}?text=${encodeURIComponent(texto)}` : '';

// Valores para o paciente e, quando houver, o horário da agenda (a) e as orientações já escritas.
export function valoresWa(p, a, { hoje, amanha, clinica, prof, orientacoes = '', link = '' }){
  const quando = !a ? '' : a.date === hoje ? 'hoje' : a.date === amanha ? 'amanhã' : `no dia ${fmt(a.date)}`;
  return { primeiro: (p.name || '').trim().split(/\s+/)[0] || '', servico: a ? String(a.tipo || '').toLowerCase() : '', quando, hora: a ? a.time : '',
    clinica, profissional: prof, orientacoes, link };
}
export const preencherWa = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);

// Anota que a mensagem foi aberta no WhatsApp.
export function registrarMensagem(p, { tipo, em, por, ap }){
  if (!MENSAGENS_WA.some(m => m[0] === tipo)) return null;
  const r = p.relacionamento ||= {}, m = { tipo, em, por, ...(ap ? { ap } : {}) };
  (r.mensagens ||= []).unshift(m);
  return m;
}
// Último lembrete aberto para um horário da agenda.
export const lembreteDe = (p, apId) => p?.relacionamento?.mensagens?.find(m => (m.tipo === 'lembrete' || m.tipo === 'teleconsulta') && m.ap === apId) || null;
