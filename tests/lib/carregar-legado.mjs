// Carrega as funções de cálculo diretamente do protótipo v1 original (legacy/),
// sem modificá-lo, para gerar os resultados de referência.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function carregarLegado(caminho = new URL('../../legacy/prototipo-v1.html', import.meta.url)) {
  const html = readFileSync(caminho, 'utf8');
  const ini = html.indexOf('<script>') + '<script>'.length;
  const fim = html.indexOf('/* ===================== Telas', ini);
  if (ini < 8 || fim < 0) throw new Error('Não encontrei o script do protótipo v1.');
  const codigo = html.slice(ini, fim) +
    ';({evaluate, bagang, elemState, pentagram, pointWarnings, spark, PATTERNS, POINTS, SIGNS, EL})';
  return vm.runInNewContext(codigo, {}, { filename: 'prototipo-v1.html' });
}
