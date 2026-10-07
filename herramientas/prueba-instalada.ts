/**
 * Prueba de la app empaquetada (fase 5): arranca el ejecutable armado por `pnpm --filter @motionai/app empaquetar`,
 * revisa que detecte Claude Code, abre un proyecto y lo exporta con el botón.
 *
 * Uso: pnpm tsx herramientas/prueba-instalada.ts <ejecutable> <proyecto.json> [más proyectos…]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { _electron } from 'playwright-core';

if (!process.env.DISPLAY && process.platform === 'linux') {
  const r = spawnSync('xvfb-run', ['-a', '-s', '-screen 0 1600x1000x24', process.execPath, ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const [ejecutable, ...proyectos] = process.argv.slice(2).map((p) => path.resolve(p));
let fallas = 0;
const check = (nombre: string, ok: boolean, detalle = '') => { if (!ok) fallas++; console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? ` · ${detalle}` : ''}`); };

for (const proyecto of proyectos) {
  const exportados = path.join(path.dirname(proyecto), 'exportados');
  rmSync(exportados, { recursive: true, force: true });
  const app = await _electron.launch({
    executablePath: ejecutable,
    args: ['--no-sandbox', '--lang=es-MX', `--user-data-dir=${path.join(path.dirname(proyecto), '.datos-prueba')}`],
    env: { ...process.env, MOTIONAI_ABRIR: proyecto },
  });
  const w = await app.firstWindow();
  const errores: string[] = [];
  w.on('pageerror', (e) => errores.push(e.message));
  w.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  await w.setViewportSize({ width: 1600, height: 1000 });
  await w.locator('.editor').waitFor({ timeout: 60_000 });
  const motor = (await w.locator('hyperframes-player').count()) ? 'HyperFrames' : 'MotionAI';
  check(`Abre el proyecto (${motor})`, true, path.basename(path.dirname(proyecto)));
  // Claude trabaja desde la app instalada (el servidor MCP corre con el Node de Electron).
  if (proyecto === proyectos[0]) {
    const antes = Number((await w.locator('.barra .version').textContent())?.match(/\d+/)?.[0]);
    await w.locator('.opciones select').first().selectOption('sonnet');
    await w.locator('.opciones select').nth(1).selectOption('low');
    await w.locator('textarea').fill('Cambia el color de fondo de la primera escena a #FFE8D6. Solo eso, sin revisar cuadros.');
    await w.keyboard.press('Enter');
    await w.getByRole('button', { name: 'Detener' }).waitFor({ timeout: 30_000 });
    await w.getByRole('button', { name: 'Detener' }).waitFor({ state: 'hidden', timeout: 10 * 60_000 });
    const despues = Number((await w.locator('.barra .version').textContent())?.match(/\d+/)?.[0]);
    const error = await w.locator('.turno .error').last().textContent({ timeout: 500 }).catch(() => '');
    check('Claude cambia el proyecto desde la app instalada', despues > antes, `versión ${antes} → ${despues}${error ? ` · ${error}` : ''}`);
  }
  const t0 = Date.now();
  await w.getByRole('button', { name: 'Exportar MP4' }).click();
  const aviso = await w.getByText(/Video listo|No se pudo exportar/).first().textContent({ timeout: 15 * 60_000 });
  const mp4 = readdirSync(exportados).find((f) => f.endsWith('.mp4') && !f.startsWith('.'));
  let sano = false;
  if (mp4) { try { execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', path.join(exportados, mp4), '-f', 'null', '-']); sano = true; } catch { /* roto */ } }
  check(`Exporta con el botón (${motor})`, !!mp4 && sano && /listo/.test(aviso ?? ''), `${aviso} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  // La app instalada usa su propio ffmpeg y su whisper.
  const recursos = await app.evaluate(({ app: a }) => ({ path: process.env.PATH ?? '', recursos: process.env.MOTIONAI_RECURSOS ?? '', empaquetada: a.isPackaged }));
  check('Usa el ffmpeg incluido', recursos.path.split(path.delimiter)[0]!.endsWith(path.join('recursos', 'ffmpeg')), recursos.path.split(path.delimiter)[0]);
  check('Corre empaquetada', recursos.empaquetada);
  check('Sin errores en la interfaz', !errores.length, errores.join(' | '));
  await app.close();
}

// Inicio: detecta Claude Code con sesión.
const app = await _electron.launch({ executablePath: ejecutable, args: ['--no-sandbox', '--lang=es-MX', `--user-data-dir=${path.join(path.dirname(proyectos[0]!), '.datos-prueba-inicio')}`] });
const w = await app.firstWindow();
await w.locator('.claude.ok, .claude ol').first().waitFor({ timeout: 60_000 });
check('Inicio detecta Claude Code con sesión', await w.locator('.claude.ok').isVisible());
await app.close();
process.exit(fallas ? 1 : 0);
