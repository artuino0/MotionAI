/**
 * Prueba de cierre de la fase 3: el mismo video de la fase 2 se hace desde el chat de la app y se exporta
 * con el botón. Maneja la app real (Electron) con Playwright, sin pantalla (xvfb), y Claude Code de verdad.
 *
 * Pasos: crear proyecto en Inicio → pedir el video en el chat → señalar una pieza con clic y pedir un cambio
 * sobre ella → cambiar un ajuste de proyecto a mano → revisar el historial → exportar con el botón.
 *
 * Uso: pnpm fase3 ["brief"]   (deja capturas, el MP4 y el reporte en salida/fase3/)
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, type Page } from 'playwright-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(RAIZ, 'packages/app');
const SALIDA = path.join(RAIZ, 'salida', 'fase3');
const BRIEF =
  process.argv[2] ??
  'Haz un video de 15 segundos en 9:16 para TikTok de "Café Luna", una cafetería de barrio que lanza su cold brew de temporada. ' +
  'Tono cálido y alegre. Cierra con "@cafeluna · Ven hoy". No hay voz ni música.';

// Sin pantalla, se vuelve a lanzar dentro de xvfb.
if (!process.env.DISPLAY && process.platform === 'linux') {
  const r = spawnSync('xvfb-run', ['-a', '-s', '-screen 0 1600x1000x24', process.execPath, ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const minutos = (ms: number) => `${(ms / 60000).toFixed(1)} min`;

async function esperarRespuesta(w: Page, nombre: string, limiteMin = 20) {
  const inicio = Date.now();
  await w.getByRole('button', { name: 'Detener' }).waitFor({ timeout: 30_000 });
  let n = 0;
  while (await w.getByRole('button', { name: 'Detener' }).isVisible()) {
    if (Date.now() - inicio > limiteMin * 60_000) throw new Error(`Claude no terminó "${nombre}" en ${limiteMin} min`);
    await w.waitForTimeout(15_000);
    // Capturas mientras Claude trabaja: el monitor cambia en vivo.
    if (n < 3) await w.screenshot({ path: path.join(SALIDA, `${nombre}_en_vivo_${++n}.png`) });
  }
  return Date.now() - inicio;
}

async function principal() {
  await rm(SALIDA, { recursive: true, force: true });
  await mkdir(SALIDA, { recursive: true });
  console.log('Construyendo la app…');
  execFileSync('pnpm', ['-s', 'construir'], { cwd: APP, stdio: 'inherit' });

  const carpeta = path.join(SALIDA, 'proyectos');
  const errores: string[] = [];
  let paso = 'arranque';
  const app = await _electron.launch({
    executablePath: path.join(APP, 'node_modules/electron/dist/electron'),
    // La prueba corre en español: es el idioma de referencia de la interfaz.
    args: [APP, `--user-data-dir=${path.join(SALIDA, 'datos-app')}`, '--no-sandbox', '--lang=es-MX'],
    env: { ...process.env, MOTIONAI_CARPETA: carpeta } as Record<string, string>,
  });
  const w = await app.firstWindow();
  w.on('pageerror', (e) => errores.push(`[${paso}] ${e.message}`));
  w.on('console', (m) => m.type() === 'error' && errores.push(`[${paso}] ${m.text()}`));
  const checks: [string, boolean, string?][] = [];
  const check = (nombre: string, ok: boolean, detalle?: string) => { paso = `después de: ${nombre}`; checks.push([nombre, ok, detalle]); console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? ` · ${detalle}` : ''}`); };

  // 1. Inicio: Claude listo y proyecto nuevo.
  await w.locator('.claude.ok, .claude ol').first().waitFor({ timeout: 30_000 });
  check('Inicio detecta Claude Code con sesión', await w.locator('.claude.ok').isVisible());
  await w.screenshot({ path: path.join(SALIDA, '1_inicio.png') });
  await w.getByPlaceholder('Promo de temporada').fill('Café Luna');
  await w.getByRole('button', { name: 'Crear proyecto' }).click();
  await w.locator('.editor').waitFor();
  check('Proyecto creado desde Inicio', true);

  // 2. El brief por el chat.
  await w.locator('textarea').fill(BRIEF);
  await w.keyboard.press('Enter');
  const t1 = await esperarRespuesta(w, '2_brief');
  const version1 = Number((await w.locator('.barra .version').textContent())?.match(/\d+/)?.[0]);
  check('Claude hizo el video desde el chat', version1 > 3, `versión ${version1} en ${minutos(t1)}`);
  await w.getByRole('button', { name: /Hizo \d+ paso/ }).last().click();
  await w.screenshot({ path: path.join(SALIDA, '2_video_hecho.png') });

  // 3. Señalar una pieza con clic en el monitor y pedir un cambio sobre ella.
  const tc = /\/ (\d+):(\d+\.\d+)/.exec((await w.locator('.tc').textContent()) ?? '');
  const duracion = tc ? Number(tc[1]) * 60 + Number(tc[2]) : 15;
  // Un segundo antes del final: el cierre ya entró completo.
  const regla = w.locator('.regla');
  const caja = (await regla.boundingBox())!;
  const pps = (caja.width - 96 - 24) / duracion;
  await regla.click({ position: { x: 96 + (duracion - 1) * pps, y: 10 } });
  await w.waitForTimeout(500);
  const pantalla = (await w.locator('.capa').boundingBox())!;
  // Busca una pieza haciendo clic de arriba hacia abajo por el centro.
  let referida = '';
  for (const fy of [0.55, 0.6, 0.5, 0.65, 0.45, 0.7, 0.4]) {
    await w.locator('.capa').click({ position: { x: pantalla.width / 2, y: pantalla.height * fy } });
    await w.waitForTimeout(200);
    const chips = await w.locator('.redactar .chip.ref').allTextContents();
    if (chips.length) { referida = chips[0]!.trim(); break; }
  }
  check('Clic en el monitor agrega la pieza al mensaje', !!referida, referida);
  await w.screenshot({ path: path.join(SALIDA, '3_pieza_referida.png') });
  // El cambio lo hace otro modelo, elegido en el chat.
  await w.locator('.opciones select').first().selectOption('sonnet');
  await w.locator('.opciones select').nth(1).selectOption('medium');
  await w.locator('textarea').fill('Haz esta pieza un poco más grande y dale un ciclo suave para que no se quede quieta.');
  await w.keyboard.press('Enter');
  const t2 = await esperarRespuesta(w, '3_cambio');
  const version2 = Number((await w.locator('.barra .version').textContent())?.match(/\d+/)?.[0]);
  const modelo = ((await w.locator('.turno .modelo').last().textContent()) ?? '').trim();
  check('Claude cambió la pieza señalada', version2 > version1, `versión ${version1} → ${version2} en ${minutos(t2)}`);
  check('Responde el modelo y esfuerzo elegidos en el chat', /^Sonnet/.test(modelo) && /medio/.test(modelo), modelo);
  await w.screenshot({ path: path.join(SALIDA, '3_cambio_hecho.png') });

  // 4. Ajuste de proyecto a mano.
  await w.locator('.barra button', { hasText: 'Ajustes' }).last().click();
  await w.locator('.dialogo').waitFor();
  await w.screenshot({ path: path.join(SALIDA, '4_ajustes.png') });
  await w.locator('label.casilla', { hasText: 'YouTube Shorts' }).locator('input').check();
  await w.getByRole('button', { name: 'Guardar' }).click();
  const guardado = await w.getByText(/Ajustes guardados/).waitFor({ timeout: 20_000 }).then(() => true, () => false);
  const errAjustes = guardado ? '' : (await w.locator('.errores').textContent().catch(() => '')) ?? '';
  check('Ajuste de proyecto guardado a mano', guardado, errAjustes || 'plataformas + YouTube Shorts');

  // 5. Historial.
  await w.getByRole('tab', { name: 'Historial' }).click();
  await w.waitForTimeout(500);
  const versiones = await w.locator('.historial li').count();
  check('Historial muestra las versiones', versiones >= version2, `${versiones} versiones`);
  await w.screenshot({ path: path.join(SALIDA, '5_historial.png') });
  await w.getByRole('tab', { name: 'Chat' }).click();

  // 6. Vista de TikTok y exportar con el botón.
  await w.locator('.vista select').selectOption('tiktok');
  await regla.click({ position: { x: 96 + duracion * 0.55 * pps, y: 10 } });
  await w.waitForTimeout(400);
  await w.screenshot({ path: path.join(SALIDA, '6_vista_tiktok.png') });
  await w.locator('.vista select').selectOption('limpia');
  const t0 = Date.now();
  await w.getByRole('button', { name: 'Exportar MP4' }).click();
  await w.getByText(/Video listo/).waitFor({ timeout: 5 * 60_000 });
  await w.screenshot({ path: path.join(SALIDA, '7_exportado.png') });
  const proyecto = (await readdir(carpeta))[0]!;
  const dirExport = path.join(carpeta, proyecto, 'exportados');
  const mp4 = existsSync(dirExport) ? (await readdir(dirExport)).find((f) => f.endsWith('.mp4')) : undefined;
  const dur = mp4 ? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(dirExport, mp4)], { encoding: 'utf8' })) : 0;
  check('MP4 exportado con el botón', Math.abs(dur - 15) < 0.2, mp4 ? `${mp4} · ${dur.toFixed(2)} s · ${minutos(Date.now() - t0)}` : 'no se encontró');
  check('Sin errores en la interfaz', errores.length === 0, errores.slice(0, 5).join(' | '));
  if (errores.length) await writeFile(path.join(SALIDA, 'errores.txt'), errores.join('\n\n'));

  await app.close();
  const reporte = [
    '# Prueba de la fase 3',
    '',
    `Brief: ${BRIEF}`,
    '',
    ...checks.map(([c, ok, d]) => `- ${ok ? '✓' : '✗'} ${c}${d ? ` · ${d}` : ''}`),
    '',
    `Proyecto: ${path.relative(RAIZ, path.join(carpeta, proyecto))}`,
  ].join('\n');
  await writeFile(path.join(SALIDA, 'reporte.md'), reporte + '\n');
  console.log(`\n${reporte}`);
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

principal().catch((e) => { console.error(e); process.exit(1); });
