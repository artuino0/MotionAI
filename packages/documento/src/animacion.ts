import { z } from 'zod';
import { TiempoEsquema, type Tiempo } from './tiempo.js';

/** Curvas de suavizado. Una lista de 4 números es una cubic-bezier como en CSS. */
export const CURVAS = ['lineal', 'entrada', 'salida', 'entrada-salida', 'rebote', 'elastico', 'golpe'] as const;
export type CurvaNombre = (typeof CURVAS)[number];
export type Curva = CurvaNombre | [number, number, number, number];

export const CurvaEsquema: z.ZodType<Curva> = z.union([
  z.enum(CURVAS),
  z.tuple([z.number(), z.number(), z.number(), z.number()]),
]);

/**
 * Propiedades que se pueden animar con keyframes.
 *
 * - `x`, `y`: posición en píxeles del lienzo (o del grupo que la contiene).
 * - `escala`, `escalaX`, `escalaY`: 1 es tamaño normal.
 * - `rotacion`: grados.
 * - `opacidad`: de 0 a 1.
 * - `relleno`, `contorno`: color (`#RRGGBB` o `#RRGGBBAA`).
 * - `trazo`: qué parte del contorno se dibuja, de 0 a 1 (para «dibujar» una línea).
 * - `revelar`: qué parte de la pieza se ve, de izquierda a derecha, de 0 a 1.
 * - `caracteres`: qué parte de un texto se ve, de 0 a 1 (efecto de escribir).
 */
export const PROPIEDADES = [
  'x', 'y', 'escala', 'escalaX', 'escalaY', 'rotacion', 'opacidad',
  'relleno', 'contorno', 'trazo', 'revelar', 'caracteres',
] as const;
export type Propiedad = (typeof PROPIEDADES)[number];
export const PROPIEDADES_COLOR: ReadonlySet<Propiedad> = new Set(['relleno', 'contorno']);

export interface Keyframe {
  t: Tiempo;
  v: number | string;
  /** Cómo se llega a este keyframe desde el anterior. Por defecto `entrada-salida`. */
  curva?: Curva;
}

export const KeyframeEsquema: z.ZodType<Keyframe> = z.object({
  t: TiempoEsquema,
  v: z.union([z.number(), z.string()]),
  curva: CurvaEsquema.optional(),
});

/** Atajos de entrada. Se combinan con los keyframes: no los reemplazan. */
export const ENTRADAS = [
  'aparece', 'pop', 'crece', 'cae', 'sube', 'desliza-izq', 'desliza-der', 'dibuja', 'escribe',
] as const;
export type Entrada = (typeof ENTRADAS)[number];

/** Atajos de salida. */
export const SALIDAS = ['desaparece', 'pop', 'encoge', 'cae', 'sube', 'desliza-izq', 'desliza-der', 'corta'] as const;
export type Salida = (typeof SALIDAS)[number];

/** Movimientos que se repiten mientras la pieza está en pantalla. */
export const CICLOS = ['flota', 'late', 'mece', 'gira'] as const;
export type CicloTipo = (typeof CICLOS)[number];

export interface Movimiento<T extends string> {
  tipo: T;
  en: Tiempo;
  /** Duración en segundos. */
  dur?: number;
  curva?: Curva;
}

export interface Ciclo {
  tipo: CicloTipo;
  /** Píxeles para `flota`, fracción de escala para `late`, grados para `mece`. */
  amplitud?: number;
  /** Segundos por vuelta. */
  periodo?: number;
  desde?: Tiempo;
  hasta?: Tiempo;
}

export interface Animacion {
  entra?: Movimiento<Entrada>;
  sale?: Movimiento<Salida>;
  pistas?: Partial<Record<Propiedad, Keyframe[]>>;
  ciclos?: Ciclo[];
}

const movimiento = <T extends readonly [string, ...string[]]>(tipos: T) =>
  z.object({
    tipo: z.enum(tipos),
    en: TiempoEsquema,
    dur: z.number().positive().optional(),
    curva: CurvaEsquema.optional(),
  });

export const AnimacionEsquema: z.ZodType<Animacion> = z.object({
  entra: movimiento(ENTRADAS).optional(),
  sale: movimiento(SALIDAS).optional(),
  pistas: z.partialRecord(z.enum(PROPIEDADES), z.array(KeyframeEsquema).min(1)).optional(),
  ciclos: z
    .array(
      z.object({
        tipo: z.enum(CICLOS),
        amplitud: z.number().optional(),
        periodo: z.number().positive().optional(),
        desde: TiempoEsquema.optional(),
        hasta: TiempoEsquema.optional(),
      }),
    )
    .optional(),
}) as z.ZodType<Animacion>;
