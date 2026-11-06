// Servidor local mínimo para abrir o sistema modular no navegador.
// Uso: npm run dev  e depois abrir http://localhost:5173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

export function iniciar(porta = Number(process.env.PORT) || 5173) {
  const srv = createServer(async (req, res) => {
    const caminho = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    const arq = join(RAIZ, caminho || 'index.html');
    if (!arq.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    try { const dados = await readFile(arq); res.writeHead(200, { 'Content-Type': TIPOS[extname(arq)] || 'application/octet-stream' }).end(dados); }
    catch { res.writeHead(404).end('Não encontrado'); }
  });
  return new Promise(ok => srv.listen(porta, () => ok(srv)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const srv = await iniciar();
  console.log(`Spazio em http://localhost:${srv.address().port}`);
}
