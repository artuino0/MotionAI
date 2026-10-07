import { z } from 'zod';

/**
 * Un momento de la línea de tiempo del proyecto.
 *
 * - Número: segundos absolutos desde el inicio del proyecto.
 * - Texto: una marca y un desfase opcional en segundos.
 *   - `f3`, `f3+0.8`, `f3.fin-0.2`: inicio o fin de la frase 3 de la voz (empiezan en 1).
 *   - `escena`, `escena+1.5`, `escena.fin-0.5`: inicio o fin de la escena que contiene la pieza.
 *
 * Usar marcas de la voz hace que la animación siga a la voz si esta cambia.
 */
export type Tiempo = number | string;

const MARCA = /^(?:(f)(\d+)|(escena))(\.fin)?(?:([+-])(\d+(?:\.\d+)?))?$/;

export const TiempoEsquema: z.ZodType<Tiempo> = z.union([
  z.number().nonnegative(),
  z.string().regex(MARCA, 'Usa segundos o una marca como "f3", "f3+0.8", "escena+1" o "escena.fin-0.5"'),
]);

export interface ContextoTiempo {
  /** Frases de la voz en segundos absolutos. */
  frases: ReadonlyArray<{ inicio: number; fin: number }>;
  /** Escena que contiene la pieza. */
  escena?: { inicio: number; fin: number };
}

export class ErrorTiempo extends Error {}

/** Convierte un `Tiempo` a segundos absolutos. */
export function resolverTiempo(t: Tiempo, ctx: ContextoTiempo): number {
  if (typeof t === 'number') return t;
  const m = MARCA.exec(t.trim());
  if (!m) throw new ErrorTiempo(`Tiempo no válido: "${t}"`);
  const [, f, num, escena, fin, signo, desfase] = m;
  let base: number;
  if (f) {
    const n = Number(num);
    const frase = ctx.frases[n - 1];
    if (!frase) throw new ErrorTiempo(`"${t}" usa la frase ${n}, pero el proyecto tiene ${ctx.frases.length}`);
    base = fin ? frase.fin : frase.inicio;
  } else {
    if (!ctx.escena) throw new ErrorTiempo(`"${t}" usa la escena, pero no está dentro de una`);
    void escena;
    base = fin ? ctx.escena.fin : ctx.escena.inicio;
  }
  const d = desfase ? Number(desfase) * (signo === '-' ? -1 : 1) : 0;
  return Math.max(0, base + d);
}
