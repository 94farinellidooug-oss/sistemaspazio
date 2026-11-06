// Etapa 10: excluir o cadastro de um paciente (pedidos do Maicon em 06/11/2026), sempre com um motivo.
//
// Sem prontuário (paciente de exemplo, ou sem atendimento, avaliação nem documento): sai de vez, e fica só
// uma linha de registro em db.exclusoes = [{nome, em, por, motivo}].
// Com prontuário: NÃO é apagado. Fica desativado até o fim do prazo de guarda (20 anos depois do último
// registro), fora das listas, da agenda e da busca, em db.desativados = [{...paciente, horarios:[...],
// desativado:{em, por, motivo, guardarAte}}]. Dá para reativar.
// Nos dois casos, o dinheiro que já entrou não some do financeiro: recebimentos e pacotes guardam o nome
// e o serviço (r.nome, r.tipo, k.nome).
export const MOTIVOS_EXCLUSAO = ['Paciente de exemplo', 'Cadastro feito por engano', 'Cadastro duplicado', 'Pedido do paciente', 'Outro motivo'];
export const ANOS_GUARDA = 20;

export const temProntuario = p => !p.exemplo && ((p.atendimentos || []).some(a => a.status === 'finalizado') || (p.avaliacoes || []).length > 0 || (p.documentos || []).length > 0);
// Último registro do prontuário (aaaa-mm-dd) e até quando guardar.
export function guardarAte(p, hoje){
  const D = [...(p.atendimentos || []).map(a => a.data), ...(p.avaliacoes || []).map(a => a.date), ...(p.documentos || []).map(d => d.em)].filter(Boolean).map(d => String(d).slice(0, 10)).sort();
  const ult = D.at(-1) || hoje;
  return (Number(ult.slice(0, 4)) + ANOS_GUARDA) + ult.slice(4);
}

// Devolve {nome, desativado, guardarAte?}, ou null (paciente não encontrado ou sem motivo).
export function excluirPaciente(db, pid, { motivo, em, por, hoje } = {}){
  const p = db.patients.find(x => x.id === pid); if (!p || !String(motivo || '').trim()) return null;
  const meus = db.appts.filter(a => a.pid === pid), F = db.financeiro;
  if (F) {
    (F.recebimentos || []).forEach(r => { const a = meus.find(x => x.id === r.ap); if (a) { r.nome = p.name; r.tipo = a.tipo; } });
    (F.pacotes || []).forEach(k => { if (k.pid === pid) k.nome = p.name; });
  }
  (db.interessados || []).forEach(i => { if (i.pid === pid) delete i.pid; });
  db.appts = db.appts.filter(a => a.pid !== pid);
  db.patients = db.patients.filter(x => x.id !== pid);
  const reg = { em, por, motivo:String(motivo).trim() };
  if (!temProntuario(p)) { (db.exclusoes ||= []).unshift({ nome:p.name, ...reg }); return { nome:p.name, desativado:false }; }
  const ate = guardarAte(p, hoje || String(em || '').slice(0, 10));
  // Horários futuros ainda não atendidos não voltam se reativar: só o histórico fica guardado.
  (db.desativados ||= []).unshift({ ...p, horarios:meus.filter(a => a.done || (hoje && a.date < hoje)), desativado:{ ...reg, guardarAte:ate } });
  return { nome:p.name, desativado:true, guardarAte:ate };
}

// Volta o paciente desativado para as listas, com o histórico da agenda.
export function reativarPaciente(db, pid){
  const L = db.desativados || [], i = L.findIndex(x => x.id === pid); if (i < 0) return null;
  const [{ horarios = [], desativado, ...p }] = L.splice(i, 1);
  db.patients.push(p); db.appts.push(...horarios.filter(a => !db.appts.some(x => x.id === a.id)));
  return p;
}
