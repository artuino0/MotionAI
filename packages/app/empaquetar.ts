/**
 * Arma la app para instalar (fase 5).
 *
 * 1. Construye dist/ (construir.ts).
 * 2. Copia dist/ a paquete/ con un package.json que solo pide lo que no va empaquetado por esbuild
 *    (skia-canvas, HyperFrames y puppeteer-core) y lo instala con npm: node_modules plano, con los binarios
 *    de la plataforma donde corre (por eso el instalador de Windows se arma en Windows).
 * 3. Agrega ffmpeg y whisper.cpp (con su modelo) en dist/recursos, de donde la app los toma.
 * 4. electron-builder arma el instalador en instalador/.
 *
 * Variables:
 *   MOTIONAI_FFMPEG_DIR    carpeta con ffmpeg(.exe) y ffprobe(.exe)
 *   MOTIONAI_WHISPER       binario whisper-cli(.exe)
 *   MOTIONAI_WHISPER_MODELO modelo ggml-*.bin
 * Uso: pnpm empaquetar [--dir]   (--dir deja la app sin instalador, para probarla)
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// paquete/ va fuera del repositorio: dentro, electron-builder ve el workspace de pnpm y toma sus dependencias
// en lugar de las que se instalan aquí con npm.
const PAQUETE = process.env.MOTIONAI_PAQUETE ?? path.join(os.tmpdir(), 'motionai-paquete');
const win = process.platform === 'win32';
const exe = (n: string) => (win ? `${n}.exe` : n);
const correr = (cmd: string, args: string[], cwd = AQUI) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: win });

const app = JSON.parse(readFileSync(path.join(AQUI, 'package.json'), 'utf8')) as { version: string; dependencies: Record<string, string> };
const version = (nombre: string) => {
  const v = JSON.parse(readFileSync(path.join(AQUI, 'node_modules', nombre, 'package.json'), 'utf8')).version as string;
  return v;
};

console.log('1/4 Construyendo…');
correr('pnpm', ['-s', 'construir']);

console.log('2/4 Preparando paquete/…');
rmSync(PAQUETE, { recursive: true, force: true });
mkdirSync(PAQUETE, { recursive: true });
cpSync(path.join(AQUI, 'dist'), path.join(PAQUETE, 'dist'), { recursive: true, filter: (f) => !f.endsWith('.map') });
const externos = ['skia-canvas', 'hyperframes', 'puppeteer-core'];
writeFileSync(path.join(PAQUETE, 'package.json'), JSON.stringify({
  name: 'motionai',
  productName: 'MotionAI',
  version: app.version,
  description: 'Motion graphics hechos por Claude',
  author: 'MotionAI',
  type: 'module',
  main: 'dist/principal.mjs',
  dependencies: Object.fromEntries(externos.map((n) => [n, version(n)])),
}, null, 2));
correr('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts=false'], PAQUETE);

console.log('3/4 Agregando ffmpeg y whisper…');
const recursos = path.join(PAQUETE, 'dist', 'recursos');
const dirFfmpeg = process.env.MOTIONAI_FFMPEG_DIR;
if (dirFfmpeg) {
  mkdirSync(path.join(recursos, 'ffmpeg'), { recursive: true });
  for (const b of ['ffmpeg', 'ffprobe']) cpSync(path.join(dirFfmpeg, exe(b)), path.join(recursos, 'ffmpeg', exe(b)));
} else console.warn('  ⚠ Sin MOTIONAI_FFMPEG_DIR: la app usará el ffmpeg del sistema.');
const { MOTIONAI_WHISPER: whisper, MOTIONAI_WHISPER_MODELO: modelo } = process.env;
if (whisper && modelo) {
  mkdirSync(path.join(recursos, 'whisper'), { recursive: true });
  // Con el binario van las librerías que tenga a su lado (en una compilación estática no hay).
  const dir = path.dirname(whisper);
  for (const f of readdirSync(dir).filter((f) => f === path.basename(whisper) || /\.(dll|dylib)$/i.test(f))) cpSync(path.join(dir, f), path.join(recursos, 'whisper', f));
  cpSync(modelo, path.join(recursos, 'whisper', path.basename(modelo)));
} else if (!existsSync(path.join(recursos, 'whisper'))) console.warn('  ⚠ Sin whisper.cpp: la voz se cargará sin transcribir.');

console.log('4/4 Armando con electron-builder…');
correr('npx', [
  'electron-builder', '--projectDir', PAQUETE, '--config', path.join(AQUI, 'electron-builder.yml'),
  `--config.directories.output=${path.join(AQUI, 'instalador')}`, `--config.directories.buildResources=${path.join(AQUI, 'recursos-instalador')}`,
  ...(process.argv.includes('--dir') ? ['--dir'] : []),
]);
console.log('✓ Listo en', path.join(AQUI, 'instalador'));
