import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Sirve /ejemplos/… desde la raíz del repositorio para abrir proyectos de ejemplo. */
function ejemplos(): Plugin {
  const tipos: Record<string, string> = {
    '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  };
  return {
    name: 'motionai-ejemplos',
    configureServer(server) {
      server.middlewares.use('/ejemplos', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '/').split('?')[0]!);
        const archivo = path.join(raiz, 'ejemplos', path.normalize(rel));
        if (!archivo.startsWith(path.join(raiz, 'ejemplos')) || !existsSync(archivo) || !statSync(archivo).isFile()) return next();
        res.setHeader('Content-Type', tipos[path.extname(archivo)] ?? 'application/octet-stream');
        createReadStream(archivo).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [ejemplos()],
  server: { port: 5173 },
});
