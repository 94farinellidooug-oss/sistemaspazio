// CID-10 no prontuário (pedido do Maicon, 07/11/2026): busca por código ou descrição e os diagnósticos
// do paciente. A tabela é a CID-10 do DATASUS (revisão 2008, dados públicos do Ministério da Saúde),
// em js/conhecimento/cid10.txt (uma linha por código: "F41.1<tab>Ansiedade generalizada"), carregada
// só quando a busca é usada.
//   p.diagnosticos = [{ id, codigo, descricao, em, por, ativo, retiradoEm?, retiradoPor? }]
export const semAcentoCid = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function lerCid(texto){
  return String(texto || '').split('\n').filter(Boolean).map(l => { const i = l.indexOf('\t'), c = l.slice(0, i), d = l.slice(i + 1);
    const n = semAcentoCid(d); return { c, d, k: c.replace('.', '').toLowerCase(), n, w: n.split(/[^a-z0-9]+/).filter(Boolean) }; });
}
// Código (uma letra, ou letra e número: "f", "f41", "F41.1", "f411") busca pelo começo do código; texto busca
// descrições em que cada palavra digitada é o começo de uma palavra ("dor lomb" acha "Dor lombar baixa").
export function buscarCid(L, termo, max = 20){
  const t = semAcentoCid(termo).trim();
  if (!t) return [];
  if (/^[a-z](\d|$)/.test(t)) { const k = t.replace(/[.,\s]/g, ''); return L.filter(x => x.k.startsWith(k)).slice(0, max); }
  const P = t.split(/\s+/).filter(w => w.length > 1 || t.length === 1);
  if (!P.length) return [];
  const R = L.filter(x => P.every(p => x.w.some(w => w.startsWith(p))));
  const peso = x => (x.w[0]?.startsWith(P[0]) ? 0 : 2) + (x.c.includes('.') ? 1 : 0);
  return R.sort((a, b) => peso(a) - peso(b) || a.k.localeCompare(b.k)).slice(0, max);
}
export const diagnosticosAtivos = p => (p.diagnosticos || []).filter(d => d.ativo !== false);
export function adicionarDiagnostico(p, { id, codigo, descricao }, por, em){
  const c = String(codigo || '').trim().toUpperCase();
  if (!c || !descricao) return 'Escolha um CID da lista.';
  if (diagnosticosAtivos(p).some(d => d.codigo === c)) return 'Este CID já está no prontuário.';
  const d = { id, codigo: c, descricao: String(descricao).trim(), em, por: por || '', ativo: true };
  (p.diagnosticos ||= []).push(d);
  return d;
}
// Retirar não apaga: fica no histórico do prontuário como retirado, com quem e quando.
export function retirarDiagnostico(p, id, por, em){
  const d = (p.diagnosticos || []).find(x => x.id === id && x.ativo !== false);
  if (!d) return null;
  Object.assign(d, { ativo: false, retiradoEm: em, retiradoPor: por || '' });
  return d;
}
