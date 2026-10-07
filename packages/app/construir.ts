/**
 * Construye la app en dist/:
 * - principal.mjs (proceso principal de Electron), preload.cjs y mcp.mjs (servidor MCP que lanza Claude Code,
 *   corre con el Node de Electron) con esbuild;
 * - interfaz/ (Vue) con Vite;
 * - recursos/ con las fuentes del catálogo y las guías para Claude.
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(AQUI, 'dist');
const RAIZ = path.resolve(AQUI, '../..');

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

const comun = {
  bundle: true,
  platform: 'node' as const,
  target: 'node22',
  external: ['electron', 'skia-canvas'],
  logLevel: 'warning' as const,
  sourcemap: 'linked' as const,
};
// Los módulos ESM empaquetados necesitan require para las dependencias CommonJS.
const banner = { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" };

await esbuild({ ...comun, entryPoints: [path.join(AQUI, 'src/principal/main.ts')], format: 'esm', outfile: path.join(DIST, 'principal.mjs'), banner });
await esbuild({ ...comun, entryPoints: [path.join(AQUI, 'src/principal/preload.ts')], format: 'cjs', outfile: path.join(DIST, 'preload.cjs') });
await esbuild({ ...comun, entryPoints: [path.join(RAIZ, 'packages/mcp/src/servidor.ts')], format: 'esm', outfile: path.join(DIST, 'mcp.mjs'), banner });

await vite({ configFile: path.join(AQUI, 'vite.config.ts'), logLevel: 'warn' });

await cp(path.join(RAIZ, 'packages/estudio/fuentes'), path.join(DIST, 'recursos/fuentes'), { recursive: true });
await mkdir(path.join(DIST, 'recursos/guias'), { recursive: true });
await cp(path.join(RAIZ, 'packages/mcp/skill/inicio.md'), path.join(DIST, 'recursos/guias/inicio.md'));
await cp(path.join(RAIZ, 'packages/mcp/skill/diseno.md'), path.join(DIST, 'recursos/guias/diseno.md'));
await cp(path.join(RAIZ, 'docs/documento.md'), path.join(DIST, 'recursos/guias/documento.md'));
console.log('✓ App construida en', path.relative(process.cwd(), DIST) || DIST);
