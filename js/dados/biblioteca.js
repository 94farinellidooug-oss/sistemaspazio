// Biblioteca clínica (etapa 4B): área Particular da clínica, guardada no mesmo arquivo de dados (musubi-v2).
// db.biblioteca = { particular:[{ id, titulo, ponto, texto, em }], notas:{ [codigo]:texto } }
// O campo só é criado quando a clínica grava algo: quem não usa a Particular continua com os dados iguais.
// Nada aqui altera as fichas Central nem a exportação no formato v1.
const vazia = () => ({ particular:[], notas:{} });
export const bibliotecaDe = d => d?.biblioteca && typeof d.biblioteca === 'object' ? { ...vazia(), ...d.biblioteca } : vazia();
function garantir(d){
  if (!d.biblioteca || typeof d.biblioteca !== 'object') d.biblioteca = vazia();
  if (!Array.isArray(d.biblioteca.particular)) d.biblioteca.particular = [];
  if (!d.biblioteca.notas || typeof d.biblioteca.notas !== 'object') d.biblioteca.notas = {};
  return d.biblioteca;
}
export function adicionarFichaParticular(d, { titulo, ponto, texto }, em, id){
  const t = String(titulo || '').trim(), x = String(texto || '').trim();
  if (!t || !x) return null;
  const f = { id, titulo:t, ponto:String(ponto || '').trim().toUpperCase(), texto:x, em };
  garantir(d).particular.unshift(f); return f;
}
export function removerFichaParticular(d, id){
  const B = garantir(d), i = B.particular.findIndex(f => f.id === id);
  if (i < 0) return false; B.particular.splice(i, 1); return true;
}
// Anotação particular num ponto. Texto vazio apaga a anotação.
export function definirNotaPonto(d, codigo, texto){
  const B = garantir(d), t = String(texto || '');
  if (t.trim()) B.notas[codigo] = t; else delete B.notas[codigo];
}
