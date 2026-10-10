// Tiny static server for local development and the e2e tests (no dependencies).
// Usage: node scripts/serve.mjs [port]   → http://localhost:8765/
// The site uses ES modules and a .wasm file, so file:// does not work.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const port = Number(process.argv[2] || process.env.PORT || 8765);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    const size = statSync(file).size;
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control': 'no-store',
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('não encontrado');
  }
}).listen(port, () => console.log(`servindo site/ em http://localhost:${port}/`));
