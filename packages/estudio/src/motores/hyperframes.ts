/**
 * Motor HyperFrames (HeyGen, Apache 2.0): Claude escribe el video como HTML y CSS con animaciones
 * nativas del navegador (WAAPI o CSS) en la carpeta `composicion/`, y la línea de comandos de
 * HyperFrames lo revisa, toma cuadros y lo renderiza en Chrome sin ventana.
 *
 * No se usa GSAP: su licencia no permite usarlo en herramientas para crear animaciones sin código.
 */
import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const requerir = createRequire(import.meta.url);

/** Chrome sin ventana para HyperFrames: el de la app, el de Playwright o, si no hay, el que baje HyperFrames. */
export function encontrarChrome(): string | undefined {
  const propio = process.env.MOTIONAI_CHROME;
  if (propio && existsSync(propio)) return propio;
  const recursos = process.env.MOTIONAI_RECURSOS;
  for (const r of recursos ? [path.join(recursos, 'chrome', 'headless_shell'), path.join(recursos, 'chrome', 'chrome-headless-shell.exe')] : []) {
    if (existsSync(r)) return r;
  }
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pw && existsSync(pw)) {
    const shell = readdirSync(pw).filter((d) => d.startsWith('chromium_headless_shell')).sort().pop();
    const bin = shell && path.join(pw, shell, 'chrome-linux', 'headless_shell');
    if (bin && existsSync(bin)) return bin;
  }
  return undefined;
}

function cli(): string {
  const pkg = requerir.resolve('hyperframes/package.json');
  return path.join(path.dirname(pkg), 'bin', 'hyperframes.mjs');
}

function entorno(): NodeJS.ProcessEnv {
  const chrome = encontrarChrome();
  return {
    ...process.env,
    DO_NOT_TRACK: '1',
    HYPERFRAMES_SKIP_SKILLS: '1',
    NO_COLOR: '1',
    // Dentro de la app, process.execPath es Electron: así corre como Node.
    ...(process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    ...(chrome ? { PRODUCER_HEADLESS_SHELL_PATH: chrome } : {}),
  };
}

/** Corre la línea de comandos de HyperFrames. Devuelve stdout; si falla, el error trae stderr. */
function correr(args: string[], cwd: string, tiempo = 10 * 60_000): Promise<{ stdout: string; stderr: string; codigo: number }> {
  return new Promise((ok) => {
    execFile(process.execPath, [cli(), ...args], { cwd, env: entorno(), maxBuffer: 1 << 26, timeout: tiempo }, (e, stdout, stderr) => {
      ok({ stdout: String(stdout), stderr: String(stderr), codigo: e ? (typeof e.code === 'number' ? e.code : 1) : 0 });
    });
  });
}

const sinColor = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

export interface OpcionesComposicion {
  ancho: number;
  alto: number;
  duracion: number;
  fondo: string;
  nombre: string;
  /** Fuentes que se copian a assets/fuentes con su @font-face (para renderizar sin internet). */
  fuentes?: { familia: string; peso: number; archivo: string }[];
}

/** Composición inicial: lienzo del tamaño del proyecto, sin piezas, lista para que Claude la escriba. */
export async function crearComposicion(dir: string, op: OpcionesComposicion): Promise<void> {
  await mkdir(path.join(dir, 'assets'), { recursive: true });
  await writeFile(path.join(dir, 'hyperframes.json'), JSON.stringify({
    $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json',
    paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' },
    media: { autoProxy: true },
  }, null, 2) + '\n');
  if (op.fuentes?.length) {
    const carpeta = path.join(dir, 'assets', 'fuentes');
    await mkdir(carpeta, { recursive: true });
    const reglas: string[] = [];
    for (const f of op.fuentes) {
      const nombre = path.basename(f.archivo);
      await copyFile(f.archivo, path.join(carpeta, nombre));
      reglas.push(`@font-face { font-family: "${f.familia}"; font-weight: ${f.peso}; font-style: normal; src: url("${nombre}") format("truetype"); }`);
    }
    await writeFile(path.join(carpeta, 'fuentes.css'), reglas.join('\n') + '\n');
  }
  await writeFile(path.join(dir, 'index.html'), plantilla(op));
}

function plantilla(op: OpcionesComposicion): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${op.ancho}, height=${op.alto}" />
    <title>${op.nombre.replace(/</g, '&lt;')}</title>${op.fuentes?.length ? '\n    <link rel="stylesheet" href="assets/fuentes/fuentes.css" />' : ''}
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${op.ancho}px; height: ${op.alto}px; overflow: hidden; background: ${op.fondo}; }
      #root { position: relative; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <!-- Animaciones con WAAPI (element.animate) o CSS: HyperFrames las controla cuadro por cuadro. -->
    <div id="root" data-composition-id="main" data-no-timeline data-start="0" data-duration="${op.duracion}" data-width="${op.ancho}" data-height="${op.alto}">
    </div>
    <script>
    </script>
  </body>
</html>
`;
}

/** Duración declarada en la raíz de la composición. */
export async function duracionComposicion(dir: string): Promise<number | undefined> {
  const html = await readFile(path.join(dir, 'index.html'), 'utf8').catch(() => '');
  const raiz = /<[^>]*data-composition-id="[^"]*"[^>]*>/.exec(html)?.[0] ?? '';
  const d = Number(/data-duration="([\d.]+)"/.exec(raiz)?.[1]);
  return Number.isFinite(d) && d > 0 ? d : undefined;
}

/** Cuadros (PNG) en los segundos pedidos. */
export async function cuadros(dir: string, tiempos: number[]): Promise<Buffer[]> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'motionai-hf-'));
  try {
    const r = await correr(['snapshot', '.', '--at', tiempos.map((t) => t.toFixed(3)).join(','), '--no-end', '-o', tmp], dir, 3 * 60_000);
    const pngs = readdirSync(tmp).filter((f) => /^frame-\d+.*\.png$/.test(f)).sort();
    if (pngs.length < tiempos.length) throw new Error(`HyperFrames no pudo tomar los cuadros:\n${sinColor(r.stderr || r.stdout).trim().slice(-1500)}`);
    return Promise.all(pngs.slice(0, tiempos.length).map((f) => readFile(path.join(tmp, f))));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export interface Revision {
  errores: string[];
  avisos: string[];
}

interface Hallazgo { code?: string; severity?: string; message?: string; selector?: string; time?: number; fixHint?: string }

/** Revisa la composición (`hyperframes check`): errores de estructura, de tiempo, de diseño y de contraste. */
export async function revisar(dir: string): Promise<Revision> {
  const r = await correr(['check', '.', '--json'], dir, 3 * 60_000);
  let datos: unknown;
  try {
    datos = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  } catch {
    return { errores: [`No se pudo revisar la composición:\n${sinColor(r.stderr || r.stdout).trim().slice(-1500)}`], avisos: [] };
  }
  const hallazgos: Hallazgo[] = [];
  const juntar = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(juntar);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.severity === 'string' && typeof o.message === 'string') hallazgos.push(o as Hallazgo);
      else Object.values(o).forEach(juntar);
    }
  };
  juntar(datos);
  const texto = (h: Hallazgo) =>
    `[${h.code ?? 'revision'}] ${h.message}${h.selector ? ` (${h.selector})` : ''}${typeof h.time === 'number' && h.time > 0 ? ` a los ${h.time.toFixed(2)} s` : ''}${h.fixHint ? ` Cómo arreglarlo: ${h.fixHint}` : ''}`;
  const unicos = (xs: string[]) => [...new Set(xs)];
  return {
    errores: unicos(hallazgos.filter((h) => h.severity === 'error').map(texto)),
    avisos: unicos(hallazgos.filter((h) => h.severity === 'warning').map(texto)),
  };
}

/**
 * Renderiza a MP4. HyperFrames hace un máster de alta calidad y ffmpeg lo codifica con los ajustes del proyecto
 * (H.264 o H.265, CRF) y un tope de bitrate para redes: el grano y los degradados disparan el peso sin él.
 * Todo se escribe a archivos aparte y el MP4 se pone en su lugar solo si terminó bien.
 */
export async function renderizar(dir: string, salida: string, op: { fps: number; crf: number; codec?: 'h264' | 'h265' }): Promise<void> {
  await mkdir(path.dirname(salida), { recursive: true });
  const base = path.join(path.dirname(salida), `.${path.basename(salida, '.mp4')}.${process.pid}-${Date.now().toString(36)}`);
  const maestro = `${base}.maestro.mp4`, parcial = `${base}.parcial.mp4`;
  try {
    const r = await correr(['render', '.', '-o', maestro, '--fps', String(op.fps), '--crf', '10', '--quiet'], dir, 60 * 60_000);
    if (r.codigo !== 0 || !existsSync(maestro)) throw new Error(`HyperFrames no pudo renderizar:\n${sinColor(r.stderr || r.stdout).trim().slice(-2000)}`);
    await new Promise<void>((ok, mal) => {
      execFile('ffmpeg', argumentosCodificar(maestro, parcial, op), { maxBuffer: 1 << 24 }, (e, _o, err) =>
        e ? mal(new Error(`ffmpeg no pudo codificar el MP4: ${String(err).trim().slice(-1500)}`)) : ok());
    });
    await rename(parcial, salida);
  } finally {
    await rm(maestro, { force: true });
    await rm(parcial, { force: true });
  }
}

/** Codificación final: la misma que el motor propio, con tope de bitrate de 12 Mb/s (de sobra para redes). */
export function argumentosCodificar(entrada: string, salida: string, op: { crf: number; codec?: 'h264' | 'h265' }): string[] {
  return [
    '-v', 'error', '-y', '-i', entrada,
    ...(op.codec === 'h265' ? ['-c:v', 'libx265', '-tag:v', 'hvc1', '-x265-params', 'log-level=error'] : ['-c:v', 'libx264']),
    '-preset', 'medium', '-crf', String(op.crf), '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', salida,
  ];
}

/** Archivos de texto de la composición (lo que escribe Claude), para guardarlos en el historial. */
export async function leerArchivos(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const recorrer = async (rel: string) => {
    for (const e of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'renders' || e.name === 'snapshots') continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await recorrer(r);
      else if (/\.(html|css|js|mjs|json|svg|txt|md)$/i.test(e.name)) out[r] = await readFile(path.join(dir, r), 'utf8');
    }
  };
  if (existsSync(dir)) await recorrer('');
  return out;
}

/** Deja la composición como en `archivos` (borra los de texto que ya no estaban). */
export async function escribirArchivos(dir: string, archivos: Record<string, string>): Promise<void> {
  for (const rel of Object.keys(await leerArchivos(dir))) if (!(rel in archivos)) await rm(path.join(dir, rel), { force: true });
  for (const [rel, contenido] of Object.entries(archivos)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), contenido);
  }
}

export interface TextoMedido {
  /** id del elemento, o etiqueta y clase si no tiene. */
  id: string;
  texto: string;
  t: number;
  caja: [number, number, number, number];
  /** Tamaño de letra visible, en píxeles del lienzo. */
  tamano: number;
  /** Ni se mueve ni cambia de tamaño en ese momento (está en reposo). */
  quieto: boolean;
}

/**
 * Mide los textos visibles de la composición en cada segundo pedido, para las reglas de plataforma.
 * Lleva la página a cada momento pausando sus animaciones (WAAPI y CSS) y respetando data-start y
 * data-duration. Devuelve null si no hay Chrome con qué medir.
 */
export async function medirTextos(dir: string, tiempos: number[], ancho: number, alto: number): Promise<TextoMedido[] | null> {
  const chrome = encontrarChrome();
  if (!chrome) return null;
  const { default: puppeteer } = await import('puppeteer-core');
  const navegador = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try {
    const pagina = await navegador.newPage();
    await pagina.setViewport({ width: ancho, height: alto });
    await pagina.goto(pathToFileURL(path.join(dir, 'index.html')).href, { waitUntil: 'load', timeout: 30_000 });
    await pagina.evaluate(() => document.fonts?.ready);
    const medir = (t: number) =>
      pagina.evaluate((t: number) => {
        for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
        document.querySelectorAll<HTMLElement>('[data-start]').forEach((el) => {
          if (el.hasAttribute('data-composition-id')) return;
          const s = Number(el.dataset.start) || 0;
          const d = el.dataset.duration !== undefined ? Number(el.dataset.duration) : Infinity;
          el.style.visibility = t >= s && t < s + d ? '' : 'hidden';
        });
        const out: { id: string; texto: string; caja: [number, number, number, number]; tamano: number }[] = [];
        for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
          if (['SCRIPT', 'STYLE', 'TITLE'].includes(el.tagName)) continue;
          const propio = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
          if (!propio) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          let opacidad = 1;
          for (let e: HTMLElement | null = el; e; e = e.parentElement) opacidad *= Number(getComputedStyle(e).opacity);
          if (opacidad < 0.1) continue;
          const rango = document.createRange();
          rango.selectNodeContents(el);
          const r = rango.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          // Escala visible por transformaciones (scale de la pieza o de sus contenedores).
          const caja = el.getBoundingClientRect();
          const escala = el.offsetWidth > 0 ? caja.width / el.offsetWidth : 1;
          const id = el.id || `${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ''}`;
          out.push({ id, texto: propio.slice(0, 60), caja: [r.left, r.top, r.right, r.bottom], tamano: parseFloat(cs.fontSize) * escala });
        }
        return out;
      }, t);
    const medidos: TextoMedido[] = [];
    for (const t of tiempos) {
      const antes = new Map((await medir(Math.max(0, t - 0.15))).map((x) => [`${x.id}|${x.texto}`, x.caja]));
      for (const x of await medir(t)) {
        const a = antes.get(`${x.id}|${x.texto}`);
        const quieto = !!a && a.every((v, i) => Math.abs(v - x.caja[i]!) < 1.5);
        medidos.push({ ...x, t, quieto });
      }
    }
    return medidos;
  } finally {
    await navegador.close();
  }
}
