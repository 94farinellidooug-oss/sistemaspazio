// Gera dist/spazio.html: um único arquivo, no mesmo formato do protótipo v1,
// para publicar ou abrir sem servidor. Uso: npm run build
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = p => readFileSync(join(RAIZ, p), 'utf8');

// Ordena os módulos para que cada um venha depois das suas dependências.
const ordem = [], visto = new Set();
function visitar(arq) {
  if (visto.has(arq)) return; visto.add(arq);
  const src = ler(arq);
  for (const [, rel] of src.matchAll(/^import \{[^}]*\} from '([^']+)';$/gm)) visitar(normalize(join(dirname(arq), rel)));
  ordem.push(arq);
}
visitar('js/app.js');

const js = ordem.map(arq => ler(arq)
  .replace(/^import \{[^}]*\} from '[^']+';\n/gm, '')
  .replace(/^export (const|let|function) /gm, '$1 ')
  .replace(/^\/\/ .*\n/, '')       // comentário de cabeçalho do módulo
  .replace(/^\n+/, '')).join('');

const css = ['css/tokens.css', 'css/componentes.css', 'css/musubi.css'].map(p => ler(p).replace(/^\/\*[^*]*\*\/\n/, '')).join('');
const index = ler('index.html');
const cabeca = index.slice(index.indexOf('<title>'), index.indexOf('<link rel="stylesheet" href="css/tokens.css">'));
const ultimoCss = '<link rel="stylesheet" href="css/musubi.css">\n';
const corpo = index.slice(index.indexOf(ultimoCss) + ultimoCss.length, index.indexOf('<script type="module"'));

mkdirSync(join(RAIZ, 'dist'), { recursive: true });
// charset e viewport garantem acentos corretos e layout de celular quando o arquivo é aberto direto do disco.
const metas = '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';
writeFileSync(join(RAIZ, 'dist/spazio.html'), `${metas}${cabeca}<style>\n${css}</style>\n${corpo}<script>\n${js}</script>\n`);
console.log(`dist/spazio.html gerado com ${ordem.length} módulos.`);
