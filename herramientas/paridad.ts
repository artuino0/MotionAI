/**
 * Prueba de cierre de la fase 1: el mismo proyecto se ve igual en el navegador y en el MP4, en 9:16 y en 16:9.
 *
 * 1. Dibuja cuadros con el motor en Chromium (Canvas del navegador).
 * 2. Dibuja los mismos cuadros en Node (skia-canvas).
 * 3. Exporta el MP4 y saca esos cuadros del video con ffmpeg.
 * 4. Compara navegador contra Node y MP4 contra Node (SSIM y PSNR), y escribe un reporte.
 *
 * Uso: pnpm paridad [proyecto.json]
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { Canvas, loadImage } from 'skia-canvas';
import { conFormato, type Formato } from '@motionai/documento';
import { preparar } from '@motionai/motor';
import {
  cargarProyecto, cargarRecursos, compararCuadros, exportarMP4, mapaDiferencias, pixelesCuadro, type Comparacion,
} from '@motionai/render';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'salida', 'paridad');
const FORMATOS: Formato[] = ['9:16', '16:9'];
const UMBRAL_NAVEGADOR = 0.99;
const UMBRAL_MP4 = 0.97;
// En la nube de Claude Chromium ya está en /opt/pw-browsers; en CI se usa el que instala Playwright.
const CHROMIUM = process.env.CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const rutaProyecto = path.resolve(process.argv[2] ?? path.join(RAIZ, 'ejemplos/demo/proyecto.json'));

function servidor(): Promise<{ url: string; cerrar: () => void }> {
  const tipos: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png' };
  const s = http.createServer((req, res) => {
    const archivo = path.join(RAIZ, path.normalize(decodeURIComponent(req.url!.split('?')[0]!)));
    if (!archivo.startsWith(RAIZ) || !existsSync(archivo) || !statSync(archivo).isFile()) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', tipos[path.extname(archivo)] ?? 'application/octet-stream');
    createReadStream(archivo).pipe(res);
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => {
    const { port } = s.address() as { port: number };
    ok({ url: `http://127.0.0.1:${port}`, cerrar: () => s.close() });
  }));
}

async function pixelesDePng(png: Buffer, ancho: number, alto: number): Promise<Buffer> {
  const img = await loadImage(png);
  const c = new Canvas(ancho, alto);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return Buffer.from(ctx.getImageData(0, 0, ancho, alto).data.buffer);
}

function cuadroDeVideo(mp4: string, n: number, ancho: number, alto: number): Buffer {
  return execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', `select=eq(n\\,${n})`, '-vsync', '0', '-frames:v', '1',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: ancho * alto * 4 + 1024 });
}

async function guardarPng(archivo: string, px: Uint8Array | Uint8ClampedArray, ancho: number, alto: number) {
  const c = new Canvas(ancho, alto);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(ancho, alto);
  img.data.set(px);
  ctx.putImageData(img, 0, 0);
  await writeFile(archivo, await c.toBuffer('png'));
}

const fmt = (c: Comparacion) => `${c.ssim.toFixed(4)} | ${Number.isFinite(c.psnr) ? c.psnr.toFixed(1) : '∞'} dB | ${(c.distintos * 100).toFixed(3)} %`;

async function principal() {
  await mkdir(SALIDA, { recursive: true });
  await build({
    entryPoints: [path.join(RAIZ, 'packages/visor/src/paridad.ts')],
    bundle: true, format: 'esm', outfile: path.join(SALIDA, 'paridad.js'), logLevel: 'error',
  });
  await writeFile(path.join(SALIDA, 'index.html'), '<!doctype html><meta charset="utf-8"><script type="module" src="paridad.js"></script>');

  const srv = await servidor();
  const navegador = await chromium.launch({ executablePath: CHROMIUM, args: ['--font-render-hinting=none'] });
  const pagina = await navegador.newPage();
  await pagina.goto(`${srv.url}/salida/paridad/index.html`);
  await pagina.waitForFunction(() => typeof window.renderizar === 'function');

  const cargado = await cargarProyecto(rutaProyecto);
  const urlProyecto = `${srv.url}/${path.relative(RAIZ, rutaProyecto).split(path.sep).join('/')}`;
  const filas: string[] = [];
  let falla = false;

  for (const formato of FORMATOS) {
    const proyecto = conFormato(cargado.proyecto, formato);
    const { entorno } = await cargarRecursos({ ...cargado, proyecto });
    const esc = preparar(proyecto);
    const { ancho, alto, fps } = esc;
    // Cuadros repartidos en toda la duración, más algunos a media animación.
    const total = Math.round(esc.duracion * fps);
    const indices = [...new Set([0, 6, 15, 33, 60, 95, 120, 150, 171, 200, 216, 245, total - 10].filter((i) => i < total))];
    const tiempos = indices.map((i) => i / fps);

    const pngs: string[] = await pagina.evaluate(
      ([u, f, ts]) => window.renderizar(u as string, f as Formato, ts as number[]),
      [urlProyecto, formato, tiempos] as const,
    );

    const etiqueta = formato.replace(':', 'x');
    const mp4 = path.join(SALIDA, `demo_${etiqueta}.mp4`);
    const t0 = Date.now();
    await exportarMP4(esc, entorno, cargado.base, mp4);
    const segRender = (Date.now() - t0) / 1000;
    filas.push(`\n### ${formato} · ${ancho}×${alto} · ${fps} fps · MP4 en ${segRender.toFixed(1)} s\n`);
    filas.push('| Cuadro | Segundo | Navegador vs Node (SSIM \\| PSNR \\| pixeles distintos) | MP4 vs Node (SSIM \\| PSNR \\| pixeles distintos) |');
    filas.push('| --- | --- | --- | --- |');

    for (let k = 0; k < indices.length; k++) {
      const t = tiempos[k]!;
      const node = pixelesCuadro(esc, t, entorno);
      const nav = await pixelesDePng(Buffer.from(pngs[k]!.split(',')[1]!, 'base64'), ancho, alto);
      const vid = cuadroDeVideo(mp4, indices[k]!, ancho, alto);
      const cn = compararCuadros(nav, node, ancho, alto);
      const cv = compararCuadros(vid, node, ancho, alto);
      const malN = cn.ssim < UMBRAL_NAVEGADOR, malV = cv.ssim < UMBRAL_MP4;
      if (malN || malV) falla = true;
      filas.push(`| ${indices[k]} | ${t.toFixed(2)} | ${malN ? '✗ ' : ''}${fmt(cn)} | ${malV ? '✗ ' : ''}${fmt(cv)} |`);
      if (malN || cn.distintos > 0.001) {
        await guardarPng(path.join(SALIDA, `dif_navegador_${etiqueta}_${indices[k]}.png`), mapaDiferencias(nav, node), ancho, alto);
        await guardarPng(path.join(SALIDA, `navegador_${etiqueta}_${indices[k]}.png`), nav, ancho, alto);
        await guardarPng(path.join(SALIDA, `node_${etiqueta}_${indices[k]}.png`), node, ancho, alto);
      }
    }
  }

  await navegador.close();
  srv.cerrar();

  const reporte = [
    '# Paridad del motor · fase 1',
    '',
    `Proyecto: \`${path.relative(RAIZ, rutaProyecto)}\``,
    '',
    `Umbrales de SSIM: navegador ≥ ${UMBRAL_NAVEGADOR}, MP4 ≥ ${UMBRAL_MP4} (el MP4 pierde algo por la compresión H.264 y el paso a YUV 4:2:0).`,
    ...filas,
    '',
    falla ? '**Resultado: falla.**' : '**Resultado: pasa.**',
  ].join('\n');
  await writeFile(path.join(SALIDA, 'reporte.md'), reporte + '\n');
  console.log(reporte);
  process.exit(falla ? 1 : 0);
}

principal().catch((e) => { console.error(e); process.exit(1); });
