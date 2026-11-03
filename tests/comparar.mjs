// Roda os mesmos casos da referência nos módulos novos e exige resultado idêntico.
// Uso: npm test
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { casos } from './lib/casos.mjs';
import { evaluate, bagang, elemState } from '../js/raciocinio/avaliacao.js';
import { pointWarnings } from '../js/raciocinio/seguranca.js';
import { pentagram } from '../js/componentes/pentagrama.js';
import { spark } from '../js/componentes/grafico-eva.js';
import { PATTERNS } from '../js/conhecimento/padroes.js';
import { POINTS } from '../js/conhecimento/pontos.js';
import { SIGNS } from '../js/conhecimento/sinais.js';
import { EL } from '../js/conhecimento/elementos.js';

const ref = JSON.parse(readFileSync(new URL('./referencia-v1.json', import.meta.url), 'utf8'));
const atual = Object.fromEntries(casos({ evaluate, bagang, elemState, pointWarnings, pentagram, spark, PATTERNS, POINTS, SIGNS, EL }));
// Passa o resultado por JSON, como foi gravada a referência.
const norm = JSON.parse(JSON.stringify(atual));

let falhas = 0;
for (const nome of Object.keys(ref)) {
  const ok = isDeepStrictEqual(ref[nome], norm[nome]);
  if (!ok) falhas++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome}`);
}
const extras = Object.keys(norm).filter(k => !(k in ref));
if (extras.length) { console.log('Casos sem referência:', extras.join(', ')); falhas++; }
console.log(`\n${Object.keys(ref).length - falhas} de ${Object.keys(ref).length} casos idênticos à referência do v1.`);
process.exit(falhas ? 1 : 0);
