// Etapa 10: equipe da clínica (proposta aprovada nos PRs #43/#44). Três perfis prontos; o administrador escolhe
// o que Profissional e Recepção abrem nesta clínica (fica em clinicas.permissoes no servidor). O administrador
// sempre abre tudo, para a clínica nunca ficar sem quem cuide da equipe.
export const PERFIS = [['adm', 'Administrador', 'Tudo, inclusive equipe, configurações e o financeiro completo.'],
  ['prof', 'Profissional', 'Agenda, pacientes, atendimentos, documentos e recebimentos.'],
  ['rec', 'Recepção', 'Agenda, cadastro e recebimentos. Não abre o prontuário.']];
// [chave, o que, prof, rec] no padrão
export const PERMISSOES = [['agenda', 'Agenda', 1, 1], ['cadastro', 'Cadastro de pacientes', 1, 1], ['prontuario', 'Prontuário e atendimentos', 1, 0],
  ['documentos', 'Documentos e assinatura', 1, 0], ['receber', 'Receber pagamentos', 1, 1], ['despesas', 'Despesas e resumo do mês', 0, 0],
  ['relatorios', 'Relatórios', 0, 0], ['equipe', 'Equipe e configurações', 0, 0]];
// Telas e a permissão que cada uma precisa
export const PERM_ROTA = { agenda:'agenda', pacientes:'cadastro', cadastro:'cadastro', prontuario:'prontuario', atendimento:'prontuario', avaliacao:'prontuario',
  pentagrama:'prontuario', documentos:'documentos', financeiro:'receber', relatorios:'relatorios', equipe:'equipe', crm:'cadastro', mensagens:'cadastro' };
export const perfilNome = k => (PERFIS.find(p => p[0] === k) || PERFIS[1])[1];
// Permissões guardadas: { prof:{agenda:true,...}, rec:{...} }; o que não estiver guardado segue o padrão.
export function permite(perm, perfil, chave){
  if (perfil === 'adm' || !chave) return true;
  const linha = PERMISSOES.find(p => p[0] === chave); if (!linha) return true;
  const g = perm?.[perfil]?.[chave];
  return typeof g === 'boolean' ? g : !!linha[perfil === 'rec' ? 3 : 2];
}
export const mudouDoPadrao = perm => ['prof', 'rec'].some(f => PERMISSOES.some(([k, , p, r]) => permite(perm, f, k) !== !!(f === 'rec' ? r : p)));
// Limite por pacote (decisão do Maicon em 06/11/2026): Essencial e Profissional, 1 profissional (quem administra
// conta como profissional) e até 2 na recepção; Clínica sem limite. O servidor confere de novo (004_equipe.sql).
export function cabeNaEquipe(plano, membros, convites, perfil){
  if (plano === 'clinica') return true;
  const grupo = perfil === 'rec' ? ['rec'] : ['adm', 'prof'], limite = perfil === 'rec' ? 2 : 1;
  return membros.filter(m => m.ativo && grupo.includes(m.perfil)).length + convites.filter(c => grupo.includes(c.perfil)).length < limite;
}
