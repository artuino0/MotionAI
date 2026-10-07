import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { leerProyecto } from '@motionai/documento';
import { preparar } from '@motionai/motor';
import { argumentosFfmpeg, cargarProyecto, cargarRecursos, compararCuadros, exportarMP4, pixelesCuadro } from '../src/index.js';

const DEMO = path.resolve(import.meta.dirname, '../../../ejemplos/demo/proyecto.json');

const sondear = (archivo: string) =>
  JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', archivo], { encoding: 'utf8' }));

describe('render en Node', () => {
  it('dibuja el ejemplo y el fondo de la escena', async () => {
    const cargado = await cargarProyecto(DEMO);
    const { entorno, faltantes } = await cargarRecursos(cargado);
    expect(faltantes).toEqual([]);
    const esc = preparar(cargado.proyecto);
    const px = pixelesCuadro(esc, 0, entorno);
    expect(px.length).toBe(1080 * 1920 * 4);
    expect([...px.subarray(0, 4)]).toEqual([0xff, 0xf4, 0xe6, 255]); // #FFF4E6
  });

  it('el mismo cuadro sale idéntico dos veces', async () => {
    const cargado = await cargarProyecto(DEMO);
    const { entorno } = await cargarRecursos(cargado);
    const esc = preparar(cargado.proyecto);
    const a = pixelesCuadro(esc, 4.2, entorno), b = pixelesCuadro(esc, 4.2, entorno);
    expect(compararCuadros(a, b, 1080, 1920).psnr).toBe(Infinity);
  });

  it('exporta un MP4 con voz y música, con la duración pedida', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'motionai-'));
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', path.join(dir, 'voz.wav')]);
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', path.join(dir, 'musica.wav')]);
    const p = leerProyecto({
      formato: 'motionai', version: 1, nombre: 'Corto',
      ajustes: {
        formato: 'libre', ancho: 320, alto: 240, fps: 24,
        audio: { voz: { archivo: 'voz.wav', inicio: 0.5 }, musica: { archivo: 'musica.wav', volumen: 0.3 } },
      },
      escenas: [{ id: 'e', inicio: 0, fin: 2, fondo: '#FF7A66', hijos: [{ id: 'c', tipo: 'elipse', x: '50%', y: '50%', ancla: 'centro', ancho: 100, alto: 100, relleno: '#FFFFFF' }] }],
    });
    await writeFile(path.join(dir, 'p.json'), JSON.stringify(p));
    const esc = preparar(p);
    const salida = path.join(dir, 'corto.mp4');
    let hechos = 0;
    const r = await exportarMP4(esc, { imagen: () => undefined }, dir, salida, { progreso: (h) => (hechos = h) });
    expect(r.cuadros).toBe(48);
    expect(hechos).toBe(48);
    const info = sondear(salida);
    const video = info.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
    const audio = info.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
    expect(video.codec_name).toBe('h264');
    expect([video.width, video.height]).toEqual([320, 240]);
    expect(Number(video.nb_frames)).toBe(48);
    expect(audio.codec_name).toBe('aac');
    expect(Number(info.format.duration)).toBeCloseTo(2, 1);
  });

  it('exporta un tramo y en H.265', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'motionai-'));
    const p = leerProyecto({
      formato: 'motionai', version: 1, nombre: 'Tramo',
      ajustes: { formato: 'libre', ancho: 320, alto: 240, fps: 30, exportar: { codec: 'h265' } },
      escenas: [{ id: 'e', inicio: 0, fin: 3, hijos: [] }],
    });
    const salida = path.join(dir, 'tramo.mp4');
    const r = await exportarMP4(preparar(p), { imagen: () => undefined }, dir, salida, { desde: 1, hasta: 2 });
    expect(r.cuadros).toBe(30);
    const video = sondear(salida).streams[0];
    expect(video.codec_name).toBe('hevc');
  });

  it('el fundido de salida solo va cuando se exporta hasta el final', () => {
    const p = leerProyecto({
      formato: 'motionai', version: 1, nombre: 'A',
      ajustes: { audio: { voz: { archivo: 'v.mp3' }, fundidoFinal: 1 } },
      escenas: [{ id: 'e', inicio: 0, fin: 10, hijos: [] }],
    });
    const esc = preparar(p);
    expect(argumentosFfmpeg(esc, '/x', '/x/o.mp4', 0, 10).join(' ')).toMatch(/afade=t=out:st=9:d=1/);
    expect(argumentosFfmpeg(esc, '/x', '/x/o.mp4', 0, 5).join(' ')).not.toMatch(/afade/);
  });
});
