// Etapa 6C: relacionamento (aprovado pelo Maicon em 05/11/2026, proposta/etapa-6), na Administração.
//
// Retomar contato: pacientes com o último atendimento há mais de 21 dias e nada agendado (o mesmo
// critério do aviso "sem retorno" do Painel). A lista se monta sozinha; o profissional só registra:
//   p.relacionamento = {contatos:[{em, por}], naoRetomar?:{em, por}} (criado no primeiro registro)
// Interessados: quem procurou e ainda não é paciente.
//   db.interessados = [{id, nome, tel, origem, sit, em, por, pid?}] (criado no primeiro interessado)
// Nada disso vai para a exportação v1. Mensagens pelo WhatsApp ficam para a etapa 7.
import { ativo } from './agenda.js';

export const DIAS_RETOMAR = 21;
export const ORIGENS = ['Instagram', 'Indicação', 'Google', 'Outro'];
export const SITUACOES_INTERESSADO = [['novo', 'Novo'], ['agendou', 'Agendou'], ['paciente', 'Paciente'], ['nao', 'Não seguiu']];
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);

// [{p, ult, dias, contato, oculto}] do mais antigo para o mais recente.
export function paraRetomar(db, hoje){
  return db.patients.map(p => {
    const l = p.sessions.at(-1);
    if (!l || l.date >= hoje || diasEntre(l.date, hoje) <= DIAS_RETOMAR) return null;
    if (db.appts.some(a => a.pid === p.id && a.date >= hoje && ativo(a) && !a.done && a.st !== 'faltou')) return null;
    const r = p.relacionamento || {};
    return { p, ult: l.date, dias: diasEntre(l.date, hoje), contato: r.contatos?.[0] || null, oculto: !!r.naoRetomar };
  }).filter(Boolean).sort((a, b) => b.dias - a.dias);
}
export function registrarContato(p, em, por){
  const r = p.relacionamento ||= {};
  (r.contatos ||= []).unshift({ em, por });
  return r.contatos[0];
}
// Tira (ou devolve) o paciente da lista de retomar contato, sem apagar nada.
export function naoRetomar(p, sim, em, por){
  const r = p.relacionamento ||= {};
  if (sim) r.naoRetomar = { em, por }; else delete r.naoRetomar;
  return !!r.naoRetomar;
}

export function novoInteressado(db, { id, nome, tel, origem, em, por }){
  const n = String(nome || '').trim();
  if (!n) return null;
  const i = { id, nome: n, tel: String(tel || '').trim(), origem: ORIGENS.includes(origem) ? origem : 'Outro', sit: 'novo', em, por };
  (db.interessados ||= []).unshift(i);
  return i;
}
export function situacaoInteressado(i, sit){
  if (!SITUACOES_INTERESSADO.some(s => s[0] === sit) || (sit === 'paciente' && !i.pid)) return null;
  i.sit = sit;
  return sit;
}
// Ao cadastrar o interessado como paciente, os dois ficam ligados.
export function virouPaciente(i, pid){ i.sit = 'paciente'; i.pid = pid; return i; }
