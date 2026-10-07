/**
 * Transcripción local de la voz con whisper.cpp. Sin API ni costo: el binario y el modelo viven en la
 * computadora del usuario (la app los incluye en el instalador).
 *
 * Los cortes de frase salen de las pausas del audio (más exactos que los tiempos de whisper) y el texto
 * de whisper, palabra por palabra, se reparte entre esos tramos.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Frase } from '@motionai/documento';
import type { Tramo } from './voz.js';

const ejecutar = promisify(execFile);

export interface Palabra {
  texto: string;
  /** Segundos desde el inicio del audio. */
  inicio: number;
  fin: number;
}

export interface Whisper {
  binario: string;
  modelo: string;
}

/**
 * Dónde está whisper.cpp: MOTIONAI_WHISPER (binario) y MOTIONAI_WHISPER_MODELO, o la carpeta
 * MOTIONAI_RECURSOS/whisper con `whisper-cli` y un `ggml-*.bin`. Devuelve undefined si no está instalado.
 */
export function encontrarWhisper(): Whisper | undefined {
  const binario = process.env.MOTIONAI_WHISPER;
  const modelo = process.env.MOTIONAI_WHISPER_MODELO;
  if (binario && modelo && existsSync(binario) && existsSync(modelo)) return { binario, modelo };
  const dir = process.env.MOTIONAI_RECURSOS && path.join(process.env.MOTIONAI_RECURSOS, 'whisper');
  if (dir && existsSync(dir)) {
    const bin = ['whisper-cli', 'whisper-cli.exe'].map((b) => path.join(dir, b)).find(existsSync);
    const mod = ['ggml-small.bin', 'ggml-base.bin'].map((m) => path.join(dir, m)).find(existsSync);
    if (bin && mod) return { binario: bin, modelo: mod };
  }
  return undefined;
}

/** Palabras con tiempos. `idioma` es un código de whisper (`es`, `en`…) o `auto`. */
export async function transcribir(archivo: string, w: Whisper, idioma = 'auto'): Promise<{ palabras: Palabra[]; idioma: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'motionai-whisper-'));
  try {
    const wav = path.join(dir, 'voz.wav');
    await ejecutar('ffmpeg', ['-v', 'error', '-y', '-i', archivo, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    const salida = path.join(dir, 'salida');
    const hilos = String(Math.max(1, Math.min(8, os.cpus().length)));
    // -ml 1 -sow: un segmento por palabra, con sus tiempos.
    await ejecutar(w.binario, ['-m', w.modelo, '-f', wav, '-l', idioma, '-ml', '1', '-sow', '-oj', '-of', salida, '-np', '-t', hilos], {
      maxBuffer: 1 << 26,
    });
    const json = JSON.parse(await readFile(`${salida}.json`, 'utf8')) as {
      result?: { language?: string };
      transcription: { offsets: { from: number; to: number }; text: string }[];
    };
    const palabras: Palabra[] = [];
    for (const s of json.transcription) {
      const texto = s.text;
      if (!texto.trim()) continue;
      const p = { texto: texto.trim(), inicio: s.offsets.from / 1000, fin: s.offsets.to / 1000 };
      // Un pedazo sin espacio al inicio (o solo puntuación) es continuación de la palabra anterior.
      const ultima = palabras[palabras.length - 1];
      if (ultima && (!/^\s/.test(texto) || /^[\s.,;:!?…»”)]+$/.test(texto))) {
        ultima.texto += texto.trim();
        ultima.fin = p.fin;
      } else palabras.push(p);
    }
    return { palabras, idioma: json.result?.language ?? idioma };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const terminaOracion = (s: string) => /[.?!…]["»”)]*$/.test(s);
const terminaPausa = (s: string) => /[,;:]["»”)]*$/.test(s);

/**
 * Arma las frases: un tramo con voz por frase, con el texto de las palabras que caen en él.
 * Un tramo muy corto o que termina en coma se une al siguiente («¿Tienes página web, | pero…»).
 * `desfase` es el segundo del proyecto en que empieza a sonar el audio.
 */
export function armarFrases(palabras: Palabra[], tramos: Tramo[], desfase = 0): Frase[] {
  if (!tramos.length) return [];
  const grupos = tramos.map((t) => ({ ...t, palabras: [] as string[] }));
  for (const p of palabras) {
    const medio = (p.inicio + p.fin) / 2;
    let mejor = 0, distancia = Infinity;
    grupos.forEach((g, i) => {
      const d = medio < g.inicio ? g.inicio - medio : medio > g.fin ? medio - g.fin : 0;
      if (d < distancia) { distancia = d; mejor = i; }
    });
    grupos[mejor]!.palabras.push(p.texto);
  }
  // Si un tramo empieza con la palabra que cierra la oración anterior («…a tu | panel. Cuando…»),
  // esa palabra regresa al tramo anterior: los tiempos de whisper por palabra no son exactos.
  for (let i = 1; i < grupos.length; i++) {
    const prev = grupos[i - 1]!, g = grupos[i]!;
    while (g.palabras.length > 1 && prev.palabras.length && !terminaOracion(prev.palabras.join(' ')) && terminaOracion(g.palabras[0]!)) {
      prev.palabras.push(g.palabras.shift()!);
    }
  }
  const llenos = grupos.filter((g) => g.palabras.length);
  const unidos: typeof llenos = [];
  for (const g of llenos) {
    const prev = unidos[unidos.length - 1];
    const textoPrev = prev?.palabras.join(' ') ?? '';
    if (prev && !terminaOracion(textoPrev) && (terminaPausa(textoPrev) || prev.fin - prev.inicio < 1.5) && g.fin - prev.inicio <= 7) {
      prev.fin = g.fin;
      prev.palabras.push(...g.palabras);
    } else unidos.push({ ...g, palabras: [...g.palabras] });
  }
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return unidos.map((g) => ({ inicio: r2(g.inicio + desfase), fin: r2(g.fin + desfase), texto: g.palabras.join(' ') }));
}
