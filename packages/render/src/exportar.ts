import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Proyecto } from '@motionai/documento';
import { totalCuadros, type Entorno, type Escenario } from '@motionai/motor';
import { crearLienzo, pixelesCuadro } from './cuadro.js';

export interface OpcionesExportar {
  /** Segundos del proyecto; por defecto todo. */
  desde?: number;
  hasta?: number;
  /** Se llama después de cada cuadro. */
  progreso?: (hechos: number, total: number) => void;
  /** Ruta de ffmpeg; por defecto la del sistema. */
  ffmpeg?: string;
}

export interface ResultadoExportar {
  salida: string;
  cuadros: number;
  segundos: number;
}

/** Nombre de archivo por defecto según los ajustes de exportación. */
export function rutaPorDefecto(p: Proyecto, base: string): string {
  const nombre =
    p.ajustes.exportar.nombreArchivo ??
    p.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').toLowerCase();
  return path.resolve(base, p.ajustes.exportar.carpeta, nombre.endsWith('.mp4') ? nombre : `${nombre}.mp4`);
}

/** Argumentos de ffmpeg para recibir cuadros RGBA por stdin y mezclar el audio del proyecto. */
export function argumentosFfmpeg(esc: Escenario, base: string, salida: string, desde: number, hasta: number): string[] {
  const { ajustes } = esc.proyecto;
  const dur = hasta - desde;
  const args = ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${esc.ancho}x${esc.alto}`, '-r', String(esc.fps), '-i', 'pipe:0'];

  const pistas = [ajustes.audio.voz, ajustes.audio.musica].filter((p): p is NonNullable<typeof p> => !!p);
  const filtros: string[] = [];
  pistas.forEach((p, i) => {
    args.push('-i', path.resolve(base, p.archivo));
    const ms = Math.round(p.inicio * 1000);
    filtros.push(`[${i + 1}:a]aresample=48000,adelay=${ms}:all=1,volume=${p.volumen}[a${i}]`);
  });
  if (pistas.length) {
    const entradas = pistas.map((_, i) => `[a${i}]`).join('');
    let cadena = pistas.length > 1 ? `${entradas}amix=inputs=${pistas.length}:normalize=0:duration=longest` : `${entradas}anull`;
    cadena += `,apad,atrim=start=${desde}:end=${hasta},asetpts=PTS-STARTPTS`;
    const f = ajustes.audio.fundidoFinal;
    if (f > 0 && hasta >= esc.duracion - 1e-6) cadena += `,afade=t=out:st=${Math.max(0, dur - f)}:d=${f}`;
    filtros.push(`${cadena}[aout]`);
    args.push('-filter_complex', filtros.join(';'), '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
  }

  const { codec, calidad } = ajustes.exportar;
  if (codec === 'h265') args.push('-c:v', 'libx265', '-tag:v', 'hvc1', '-x265-params', 'log-level=error');
  else args.push('-c:v', 'libx264');
  args.push('-preset', 'medium', '-crf', String(calidad), '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-t', dur.toFixed(3), salida);
  return args;
}

/** Renderiza el proyecto a MP4 con el mismo motor que el previo. */
export async function exportarMP4(
  esc: Escenario,
  entorno: Entorno,
  base: string,
  salida: string,
  op: OpcionesExportar = {},
): Promise<ResultadoExportar> {
  const desde = Math.max(0, op.desde ?? 0);
  const hasta = Math.min(esc.duracion, op.hasta ?? esc.duracion);
  if (hasta <= desde) throw new Error(`Rango vacío: desde ${desde} hasta ${hasta}`);
  await mkdir(path.dirname(salida), { recursive: true });

  const primero = Math.round(desde * esc.fps);
  const ultimo = Math.min(totalCuadros(esc), Math.round(hasta * esc.fps));
  const total = ultimo - primero;

  const ff = spawn(op.ffmpeg ?? 'ffmpeg', argumentosFfmpeg(esc, base, salida, desde, hasta), {
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  let errores = '';
  ff.stderr.on('data', (d) => (errores += d));
  ff.stdin.on('error', () => {}); // si ffmpeg se cae, el error se reporta al cerrar
  const termino = new Promise<void>((ok, mal) => {
    ff.on('error', (e) => mal(new Error(`No se pudo correr ffmpeg: ${e.message}`)));
    ff.on('close', (code) => (code === 0 ? ok() : mal(new Error(`ffmpeg terminó con código ${code}: ${errores.trim()}`))));
  });

  const lienzo = crearLienzo(esc);
  try {
    for (let i = 0; i < total; i++) {
      const t = (primero + i) / esc.fps;
      const px = pixelesCuadro(esc, t, entorno, undefined, lienzo);
      if (!ff.stdin.write(px)) await new Promise<void>((r) => ff.stdin.once('drain', () => r()));
      op.progreso?.(i + 1, total);
    }
  } finally {
    ff.stdin.end();
  }
  await termino;
  return { salida, cuadros: total, segundos: hasta - desde };
}
