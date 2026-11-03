// Monta a pasta site/ publicada no ambiente de demonstração (Vercel).
// Contém só os arquivos da aplicação: nada de testes, legacy ou dependências.
// Uso: node tools/preview.mjs
import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(RAIZ, 'site');
rmSync(SITE, { recursive: true, force: true });
mkdirSync(SITE);
cpSync(join(RAIZ, 'index.html'), join(SITE, 'index.html'));
cpSync(join(RAIZ, 'css'), join(SITE, 'css'), { recursive: true });
cpSync(join(RAIZ, 'js'), join(SITE, 'js'), { recursive: true });
cpSync(join(RAIZ, 'dist/spazio.html'), join(SITE, 'arquivo-unico.html'));
// Ambiente de demonstração: não deve aparecer em buscadores.
writeFileSync(join(SITE, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('site/ pronto para o preview.');
