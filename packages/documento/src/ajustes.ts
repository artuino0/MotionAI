import { z } from 'zod';
import { ColorEsquema } from './nodos.js';

/** Presets de formato. `libre` usa `ancho` y `alto` de los ajustes. */
export const FORMATOS = {
  '9:16': { ancho: 1080, alto: 1920, nombre: 'Vertical 9:16 · TikTok, Reels, Shorts' },
  '4:5': { ancho: 1080, alto: 1350, nombre: 'Feed 4:5' },
  '1:1': { ancho: 1080, alto: 1080, nombre: 'Cuadrado 1:1' },
  '16:9': { ancho: 1920, alto: 1080, nombre: 'Horizontal 16:9 · YouTube' },
} as const;
export type FormatoPreset = keyof typeof FORMATOS;
export type Formato = FormatoPreset | 'libre';
export const FORMATO_IDS = [...(Object.keys(FORMATOS) as FormatoPreset[]), 'libre'] as const;

export const FPS = [24, 25, 30, 60] as const;
export const PLATAFORMAS = ['tiktok', 'reels', 'facebook', 'shorts'] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];
export const ESTILOS = ['plano'] as const;

const SubtitulosEsquema = z.object({
  activados: z.boolean().default(true),
  maxRenglones: z.number().int().min(1).max(5).default(3),
  /** Centro del bloque de subtítulos, como fracción del alto del lienzo. */
  posicion: z.number().min(0).max(1).default(0.7),
  /** Tamaño en píxeles para un lienzo de 1080 de lado corto; se ajusta al formato. */
  tamano: z.number().positive().default(64),
  fuente: z.string().optional(),
  peso: z.number().int().min(100).max(1000).default(800),
  color: ColorEsquema.default('#FFFFFF'),
  contorno: z
    .object({ color: ColorEsquema, ancho: z.number().nonnegative() })
    .default({ color: '#1E1E1E', ancho: 10 }),
});

const PistaAudioEsquema = z.object({
  /** Ruta relativa al proyecto, por ejemplo `recursos/voz.mp3`. */
  archivo: z.string().min(1),
  /** De 0 a 2; 1 es el volumen original. */
  volumen: z.number().min(0).max(2).default(1),
  /** Segundo del proyecto en que empieza a sonar. */
  inicio: z.number().nonnegative().default(0),
});

export const AjustesEsquema = z
  .object({
    formato: z.enum(FORMATO_IDS).default('9:16'),
    /** Solo con formato `libre`. */
    ancho: z.number().int().min(16).max(7680).optional(),
    alto: z.number().int().min(16).max(7680).optional(),
    fps: z.union(FPS.map((f) => z.literal(f)) as [z.ZodLiteral<24>, z.ZodLiteral<25>, z.ZodLiteral<30>, z.ZodLiteral<60>]).default(30),
    /** Cuadros por segundo de la animación propia del estilo (por ejemplo, el hervor del papel). */
    fpsEstilo: z.number().int().min(1).max(60).default(12),
    /** Segundos. Si falta, termina con la última escena. */
    duracion: z.number().positive().optional(),
    plataformas: z.array(z.enum(PLATAFORMAS)).default(['tiktok', 'reels']),
    estilo: z.enum(ESTILOS).default('plano'),
    /** Color de fondo cuando una escena no trae el suyo. */
    fondo: ColorEsquema.default('#FFFFFF'),
    /** Id del kit de marca, o ninguno. */
    kit: z.string().nullable().default(null),
    subtitulos: SubtitulosEsquema.prefault({}),
    audio: z
      .object({
        voz: PistaAudioEsquema.optional(),
        musica: PistaAudioEsquema.optional(),
        /** Segundos de fundido de salida al final del video. */
        fundidoFinal: z.number().nonnegative().default(0.5),
      })
      .prefault({}),
    exportar: z
      .object({
        codec: z.enum(['h264', 'h265']).default('h264'),
        /** CRF de x264/x265: menos es mejor calidad. 18 se ve igual al original. */
        calidad: z.number().int().min(0).max(51).default(18),
        carpeta: z.string().default('exportados'),
        nombreArchivo: z.string().optional(),
      })
      .prefault({}),
  })
  .superRefine((a, ctx) => {
    if (a.formato === 'libre' && (!a.ancho || !a.alto)) {
      ctx.addIssue({ code: 'custom', path: ['formato'], message: 'El formato libre necesita ancho y alto' });
    }
  });

export type Ajustes = z.output<typeof AjustesEsquema>;
export type AjustesEntrada = z.input<typeof AjustesEsquema>;

/** Tamaño del lienzo en píxeles según el formato. */
export function dimensiones(a: Pick<Ajustes, 'formato' | 'ancho' | 'alto'>): { ancho: number; alto: number } {
  if (a.formato === 'libre') return { ancho: a.ancho!, alto: a.alto! };
  const { ancho, alto } = FORMATOS[a.formato];
  return { ancho, alto };
}
