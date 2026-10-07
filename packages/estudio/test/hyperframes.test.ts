import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Estudio, encontrarChrome } from '../src/index.js';

const hayChrome = !!encontrarChrome();

describe.skipIf(!hayChrome)('motor HyperFrames', () => {
  it('crea la composición, guarda versiones de los archivos, revisa, toma cuadros, exporta y vuelve atrás', async () => {
    const dir = path.join(await mkdtemp(path.join(os.tmpdir(), 'hf-')), 'p');
    const e = await Estudio.crear({ carpeta: dir, nombre: 'Prueba', motor: 'hyperframes', duracion: 2, formato: '9:16' });
    expect(e.motor).toBe('hyperframes');
    const idx = path.join(e.composicion, 'index.html');
    expect(await readFile(idx, 'utf8')).toMatch(/data-width="1080" data-height="1920"/);
    expect(existsSync(path.join(e.composicion, 'assets/fuentes/fuentes.css'))).toBe(true);
    const v1 = e.version;

    const html = (await readFile(idx, 'utf8')).replace('</div>\n    <script>', [
      '  <h1 id="titulo" style="position:absolute;top:700px;width:100%;text-align:center;font:900 100px Nunito">Hola</h1>',
      '      <p id="tapado" style="position:absolute;top:1100px;left:760px;font:700 60px Nunito">Tapado</p>',
      '    </div>',
      '    <script>document.getElementById("titulo").animate([{opacity:0},{opacity:1}],{duration:400,delay:200,fill:"both"});',
    ].join('\n'));
    await writeFile(idx, html);
    expect(await e.sincronizar()).toBe(v1 + 1);
    expect(await e.sincronizar()).toBeUndefined(); // sin cambios no hay versión nueva

    const r = await e.revisar();
    expect(r.errores.join('\n')).toMatch(/zona-tapada.*Tapado/);
    expect(r.errores.join('\n')).not.toMatch(/Hola/);

    const hoja = await e.verCuadro([0.1, 1]);
    expect(hoja.subarray(1, 4).toString()).toBe('PNG');

    const mp4 = await e.exportar();
    expect(mp4.segundos).toBe(2);
    const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4.salida], { encoding: 'utf8' }));
    expect(dur).toBeCloseTo(2, 1);

    expect((await e.agregarPieza({ pieza: { id: 'x', tipo: 'rect', ancho: 1, alto: 1 } })).errores?.[0]).toMatch(/HyperFrames/);
    expect((await e.volverA(v1)).ok).toBe(true);
    expect(await readFile(idx, 'utf8')).not.toMatch(/Hola/);
    e.cerrar();
  }, 180_000);
});
