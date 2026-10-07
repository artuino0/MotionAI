import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);

export interface Tramo {
  inicio: number;
  fin: number;
}

/** Duración de un archivo de audio en segundos. */
export async function duracionAudio(archivo: string): Promise<number> {
  const { stdout } = await ejecutar('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo]);
  const d = Number(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`No se pudo leer la duración de ${archivo}`);
  return d;
}

/**
 * Tramos con voz, separados por las pausas del audio (ffmpeg silencedetect).
 * Sin transcripción: el texto de cada frase lo pone Claude (o whisper.cpp en la fase 4).
 */
export async function tramosDeVoz(archivo: string, { umbralDb = -35, pausaMin = 0.3 } = {}): Promise<Tramo[]> {
  const total = await duracionAudio(archivo);
  const { stderr } = await ejecutar('ffmpeg', ['-hide_banner', '-nostats', '-i', archivo, '-af', `silencedetect=noise=${umbralDb}dB:d=${pausaMin}`, '-f', 'null', '-'], { maxBuffer: 1 << 24 });
  const silencios: Tramo[] = [];
  let abierto: number | null = null;
  for (const linea of stderr.split('\n')) {
    const a = /silence_start: (-?[\d.]+)/.exec(linea);
    const b = /silence_end: ([\d.]+)/.exec(linea);
    if (a) abierto = Math.max(0, Number(a[1]));
    if (b) { silencios.push({ inicio: abierto ?? 0, fin: Number(b[1]) }); abierto = null; }
  }
  if (abierto !== null) silencios.push({ inicio: abierto, fin: total });
  const tramos: Tramo[] = [];
  let cursor = 0;
  for (const s of silencios) {
    if (s.inicio - cursor > 0.15) tramos.push({ inicio: r2(cursor), fin: r2(s.inicio) });
    cursor = s.fin;
  }
  if (total - cursor > 0.15) tramos.push({ inicio: r2(cursor), fin: r2(total) });
  return tramos;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
