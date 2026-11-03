// Gera tests/referencia-v1.json a partir do protótipo original em legacy/.
// Rodar só uma vez, antes da modularização: npm run referencia
import { writeFileSync } from 'node:fs';
import { carregarLegado } from './lib/carregar-legado.mjs';
import { casos } from './lib/casos.mjs';

const resultado = Object.fromEntries(casos(carregarLegado()));
writeFileSync(new URL('./referencia-v1.json', import.meta.url), JSON.stringify(resultado, null, 1) + '\n');
console.log(`Referência gravada: ${Object.keys(resultado).length} casos a partir de legacy/prototipo-v1.html`);
