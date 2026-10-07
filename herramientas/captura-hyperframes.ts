/**
 * Abre en la app un proyecto con motor HyperFrames y toma capturas del monitor en varios segundos,
 * para comprobar que el reproductor sigue a la línea de tiempo.
 *
 * Uso: pnpm tsx herramientas/captura-hyperframes.ts <proyecto.json> [segundos separados por coma]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(RAIZ, 'packages/app');
const SALIDA = path.join(RAIZ, 'salida', 'captura-hyperframes');

if (!process.env.DISPLAY && process.platform === 'linux') {
  const r = spawnSync('xvfb-run', ['-a', '-s', '-screen 0 1600x1000x24', process.execPath, ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const proyecto = path.resolve(process.argv[2] ?? '');
const tiempos = (process.argv[3] ?? '1,8,15,27').split(',').map(Number);

await mkdir(SALIDA, { recursive: true });
execFileSync('pnpm', ['-s', 'construir'], { cwd: APP, stdio: 'inherit' });
const app = await _electron.launch({
  executablePath: path.join(APP, 'node_modules/electron/dist/electron'),
  args: [APP, `--user-data-dir=${path.join(SALIDA, 'datos-app')}`, '--no-sandbox', '--lang=es-MX'],
  env: { ...process.env, MOTIONAI_ABRIR: proyecto },
});
const w = await app.firstWindow();
const errores: string[] = [];
w.on('pageerror', (e) => errores.push(e.message));
w.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
await w.setViewportSize({ width: 1600, height: 1000 });
await w.locator('.editor').waitFor({ timeout: 60_000 });
await w.locator('hyperframes-player').waitFor({ timeout: 30_000 });
await w.waitForTimeout(4000);
const regla = w.locator('.regla');
const caja = (await regla.boundingBox())!;
const tc = /\/ (\d+):(\d+\.\d+)/.exec((await w.locator('.tc').textContent()) ?? '');
const duracion = tc ? Number(tc[1]) * 60 + Number(tc[2]) : 30;
const pps = (caja.width - 96 - 24) / duracion;
for (const t of tiempos) {
  await regla.click({ position: { x: 96 + t * pps, y: 10 } });
  await w.waitForTimeout(1500);
  await w.screenshot({ path: path.join(SALIDA, `monitor_${t}s.png`) });
  console.log(`captura a ${t} s · ${await w.locator('.tc').textContent()}`);
}
// Exportar con el botón: con HyperFrames lo renderiza su línea de comandos.
const mp4 = path.join(path.dirname(proyecto), 'exportados');
const t0 = Date.now();
await w.getByRole('button', { name: 'Exportar MP4' }).click();
await w.getByText(/Video listo|No se pudo exportar|falló/).waitFor({ timeout: 10 * 60_000 });
await w.screenshot({ path: path.join(SALIDA, 'exportado.png') });
console.log(`exportado en ${((Date.now() - t0) / 1000).toFixed(0)} s: ${execFileSync('ls', [mp4], { encoding: 'utf8' }).trim()}`);
console.log(`escenas en la barra: ${await w.locator('.barra').textContent()}`.replace(/\s+/g, ' ').slice(0, 160));
console.log(errores.length ? `Errores en la interfaz:\n- ${errores.join('\n- ')}` : 'Sin errores en la interfaz');
await app.close();
