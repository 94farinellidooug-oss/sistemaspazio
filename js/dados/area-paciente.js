// Área do paciente (pedido do Maicon em 12/11/2026): uma página só, aberta por link secreto + data de nascimento,
// com o que a clínica liberou. Aqui fica o conteúdo publicado, montado a partir do prontuário. Funções puras.
// p.areaPaciente = { id (código do link, vem do servidor), ativo, mostrar:{consultas, orientacoes, documentos,
//   dor, resumo}, docs:[ids dos documentos liberados], resumo (texto para o paciente), resumoEm, criadoEm, criadoPor }
// A avaliação completa, o pentagrama e as anotações clínicas nunca entram aqui (decisão do Maicon).
import { ativo } from './agenda.js';

export const SECOES_AREA = [['consultas', 'Próximas consultas'], ['orientacoes', 'Orientações para casa'], ['documentos', 'Documentos'], ['dor', 'Evolução das queixas'], ['resumo', 'Resumo da avaliação']];
export const linkArea = (id, base) => id ? `${String(base || '').replace(/\/$/, '')}/paciente/?c=${id}` : '';

// Configuração com os padrões: tudo ligado; nenhum documento liberado até o profissional escolher.
export const configArea = p => {
  const a = p?.areaPaciente || {};
  return { ...a, mostrar:{ consultas:true, orientacoes:true, documentos:true, dor:true, resumo:true, ...(a.mostrar || {}) }, docs:a.docs || [], resumo:a.resumo ?? '' };
};

// Texto sugerido para o resumo: a síntese clínica do último atendimento finalizado que tem síntese.
export const resumoSugerido = p => [...(p?.atendimentos || [])].reverse().find(a => a.status === 'finalizado' && String(a.sintese || '').trim())?.sintese.trim() || '';

// Profissional que atendeu: quem registrou a última avaliação; sem isso, quem está publicando.
export const profissionalArea = (p, prof) => [...(p?.avaliacoes || [])].reverse().find(v => v.prof)?.prof || prof || '';

export function conteudoArea(p, { appts = [], hoje, clinica = '', prof = '', base = '' }){
  const c = configArea(p), M = c.mostrar, out = { v:1, paciente:p.name || '', clinica, profissional:profissionalArea(p, prof) };
  if (M.consultas) out.consultas = appts.filter(a => a.pid === p.id && ativo(a) && !a.done && a.date >= hoje)
    .sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time)).slice(0, 6)
    .map(a => ({ data:a.date, hora:a.time, tipo:a.tipo || '', ...(a.online ? { online:true, link:a.video ? `${String(base).replace(/\/$/, '')}/consulta/?c=${a.video}` : '' } : {}) }));
  if (M.orientacoes) out.orientacoes = [...p.atendimentos].reverse().filter(a => a.status === 'finalizado' && String(a.plano?.orient || '').trim()).slice(0, 3)
    .map(a => ({ data:a.data, texto:a.plano.orient.trim() }));
  if (M.documentos) out.documentos = (p.documentos || []).filter(d => c.docs.includes(d.id))
    .map(d => ({ nome:d.nome || 'Documento', data:String(d.em || '').slice(0, 10), texto:d.texto || '', ...(d.assinado ? { assinado:true } : {}) }));
  if (M.dor) out.dor = (p.queixas || []).map(q => ({ nome:q.descricao, ativa:q.ativa !== false,
    pontos:p.atendimentos.filter(a => a.status === 'finalizado' && a.evolucao?.intensidades?.[q.id] != null).map(a => ({ data:a.data, valor:a.evolucao.intensidades[q.id] })).slice(-12) }))
    .filter(q => q.pontos.length);
  if (M.resumo && String(c.resumo).trim()) out.resumo = { texto:String(c.resumo).trim(), data:c.resumoEm || '' };
  return out;
}

// Impressão digital do conteúdo, para só publicar de novo quando algo mudou.
export const marcaConteudo = (conteudo, nascimento) => {
  const s = JSON.stringify([conteudo, nascimento || '']); let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return `${s.length}.${h.toString(36)}`;
};
