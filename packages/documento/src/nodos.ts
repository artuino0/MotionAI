import { z } from 'zod';
import { AnimacionEsquema, type Animacion } from './animacion.js';

/** Color en hexadecimal: `#RGB`, `#RRGGBB` o `#RRGGBBAA`. */
export type Color = string;
export const ColorEsquema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Usa un color como "#FF7A66" o "#FF7A6680"');

/**
 * Una medida en píxeles, o un porcentaje del contenedor (`"50%"`).
 * El contenedor de una pieza de escena es el lienzo; el de una pieza dentro de un grupo es el grupo.
 * Los porcentajes hacen que la composición se acomode al cambiar de formato.
 */
export type Medida = number | `${number}%`;
export const MedidaEsquema: z.ZodType<Medida> = z.union([
  z.number(),
  z.string().regex(/^-?\d+(?:\.\d+)?%$/, 'Usa píxeles o un porcentaje como "50%"') as z.ZodType<`${number}%`>,
]);

export type Parada = [posicion: number, color: Color];
export interface Degradado {
  tipo: 'lineal' | 'radial';
  /** Lineal: punto de inicio. Radial: centro. En coordenadas de la pieza. */
  de: [number, number];
  /** Lineal: punto final. */
  a?: [number, number];
  /** Radial: radio. */
  radio?: number;
  paradas: Parada[];
}
export type Relleno = Color | Degradado;

const Punto = z.tuple([z.number(), z.number()]);
export const RellenoEsquema: z.ZodType<Relleno> = z.union([
  ColorEsquema,
  z.object({
    tipo: z.enum(['lineal', 'radial']),
    de: Punto,
    a: Punto.optional(),
    radio: z.number().positive().optional(),
    paradas: z.array(z.tuple([z.number().min(0).max(1), ColorEsquema])).min(2),
  }),
]);

export interface Contorno {
  color: Color;
  ancho: number;
  union?: 'redonda' | 'recta' | 'biselada';
  extremo?: 'redondo' | 'plano' | 'cuadrado';
  guiones?: number[];
}
export const ContornoEsquema: z.ZodType<Contorno> = z.object({
  color: ColorEsquema,
  ancho: z.number().nonnegative(),
  union: z.enum(['redonda', 'recta', 'biselada']).optional(),
  extremo: z.enum(['redondo', 'plano', 'cuadrado']).optional(),
  guiones: z.array(z.number().nonnegative()).optional(),
});

export interface Sombra {
  color: Color;
  desenfoque?: number;
  x?: number;
  y?: number;
}
export const SombraEsquema: z.ZodType<Sombra> = z.object({
  color: ColorEsquema,
  desenfoque: z.number().nonnegative().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const ANCLAS = [
  'arriba-izq', 'arriba', 'arriba-der',
  'izq', 'centro', 'der',
  'abajo-izq', 'abajo', 'abajo-der',
] as const;
export type AnclaNombre = (typeof ANCLAS)[number];
/** Punto de la pieza que se coloca en (x, y) y sobre el que gira y escala. */
export type Ancla = AnclaNombre | [number, number];

/** Lo que tienen todas las piezas. */
export interface NodoBase {
  id: string;
  nombre?: string;
  x?: Medida;
  y?: Medida;
  ancla?: Ancla;
  escala?: number;
  escalaX?: number;
  escalaY?: number;
  /** Grados. */
  rotacion?: number;
  opacidad?: number;
  visible?: boolean;
  sombra?: Sombra;
  animacion?: Animacion;
  /**
   * Solo con el estilo de papel recortado: `false` dibuja la pieza limpia (pantallas, gráficas),
   * o un objeto apaga partes del efecto. `false` en un grupo o instancia vale para todo lo que tiene dentro.
   */
  papel?: boolean | Papel;
}

export interface Papel {
  sombra?: boolean;
  filo?: boolean;
  grano?: boolean;
  /** Multiplica lo irregular del corte: 0 deja los bordes rectos, 2 los hace el doble de irregulares. */
  temblor?: number;
}

export interface Rect extends NodoBase {
  tipo: 'rect';
  ancho: Medida;
  alto: Medida;
  radio?: number;
  relleno?: Relleno;
  contorno?: Contorno;
}

export interface Elipse extends NodoBase {
  tipo: 'elipse';
  ancho: Medida;
  alto: Medida;
  relleno?: Relleno;
  contorno?: Contorno;
}

export interface Trazo extends NodoBase {
  tipo: 'trazo';
  /** Trazado SVG (atributo `d`). */
  d: string;
  relleno?: Relleno;
  contorno?: Contorno;
  reglaRelleno?: 'nonzero' | 'evenodd';
}

export interface Texto extends NodoBase {
  tipo: 'texto';
  texto: string;
  /** Familia declarada en `fuentes` del proyecto. */
  fuente: string;
  tamano: number;
  peso?: number;
  relleno?: Color;
  contorno?: Contorno;
  alineacion?: 'izq' | 'centro' | 'der';
  /** Si se da, el texto se parte en renglones para no pasar de este ancho. */
  anchoMax?: number;
  /** Alto de renglón como múltiplo del tamaño. Por defecto 1.2. */
  interlineado?: number;
}

export interface Imagen extends NodoBase {
  tipo: 'imagen';
  /** Ruta relativa al archivo del proyecto, por ejemplo `recursos/foto.png`. */
  archivo: string;
  ancho: Medida;
  alto: Medida;
}

export interface Grupo extends NodoBase {
  tipo: 'grupo';
  /** Tamaño del grupo; sirve de contenedor para los porcentajes y para recortar. */
  ancho?: Medida;
  alto?: Medida;
  recortar?: boolean;
  hijos: Nodo[];
}

/** Cambios que una instancia hace a las piezas de su componente, por id de la pieza. */
export interface CambioInstancia {
  texto?: string;
  relleno?: Relleno;
  contorno?: Contorno;
  visible?: boolean;
}

export interface Instancia extends NodoBase {
  tipo: 'instancia';
  /** Id del componente en la biblioteca. */
  componente: string;
  cambios?: Record<string, CambioInstancia>;
}

export type Nodo = Rect | Elipse | Trazo | Texto | Imagen | Grupo | Instancia;
export type TipoNodo = Nodo['tipo'];

const base = {
  id: z.string().min(1),
  nombre: z.string().optional(),
  x: MedidaEsquema.optional(),
  y: MedidaEsquema.optional(),
  ancla: z.union([z.enum(ANCLAS), Punto]).optional(),
  escala: z.number().optional(),
  escalaX: z.number().optional(),
  escalaY: z.number().optional(),
  rotacion: z.number().optional(),
  opacidad: z.number().min(0).max(1).optional(),
  visible: z.boolean().optional(),
  sombra: SombraEsquema.optional(),
  papel: z
    .union([
      z.boolean(),
      z.strictObject({ sombra: z.boolean().optional(), filo: z.boolean().optional(), grano: z.boolean().optional(), temblor: z.number().min(0).max(4).optional() }),
    ])
    .optional(),
  animacion: AnimacionEsquema.optional(),
};

export const NodoEsquema: z.ZodType<Nodo> = z.lazy(() =>
  z.discriminatedUnion('tipo', [
    z.strictObject({
      ...base,
      tipo: z.literal('rect'),
      ancho: MedidaEsquema,
      alto: MedidaEsquema,
      radio: z.number().nonnegative().optional(),
      relleno: RellenoEsquema.optional(),
      contorno: ContornoEsquema.optional(),
    }),
    z.strictObject({
      ...base,
      tipo: z.literal('elipse'),
      ancho: MedidaEsquema,
      alto: MedidaEsquema,
      relleno: RellenoEsquema.optional(),
      contorno: ContornoEsquema.optional(),
    }),
    z.strictObject({
      ...base,
      tipo: z.literal('trazo'),
      d: z.string().min(1),
      relleno: RellenoEsquema.optional(),
      contorno: ContornoEsquema.optional(),
      reglaRelleno: z.enum(['nonzero', 'evenodd']).optional(),
    }),
    z.strictObject({
      ...base,
      tipo: z.literal('texto'),
      texto: z.string(),
      fuente: z.string().min(1),
      tamano: z.number().positive(),
      peso: z.number().int().min(100).max(1000).optional(),
      relleno: ColorEsquema.optional(),
      contorno: ContornoEsquema.optional(),
      alineacion: z.enum(['izq', 'centro', 'der']).optional(),
      anchoMax: z.number().positive().optional(),
      interlineado: z.number().positive().optional(),
    }),
    z.strictObject({
      ...base,
      tipo: z.literal('imagen'),
      archivo: z.string().min(1),
      ancho: MedidaEsquema,
      alto: MedidaEsquema,
    }),
    z.strictObject({
      ...base,
      tipo: z.literal('grupo'),
      ancho: MedidaEsquema.optional(),
      alto: MedidaEsquema.optional(),
      recortar: z.boolean().optional(),
      hijos: z.array(NodoEsquema),
    }),
    z.strictObject({
      ...base,
      tipo: z.literal('instancia'),
      componente: z.string().min(1),
      cambios: z
        .record(
          z.string(),
          z.strictObject({
            texto: z.string().optional(),
            relleno: RellenoEsquema.optional(),
            contorno: ContornoEsquema.optional(),
            visible: z.boolean().optional(),
          }),
        )
        .optional(),
    }),
  ]),
) as z.ZodType<Nodo>;

/** Recorre una pieza y todas las que contiene. */
export function* recorrer(nodo: Nodo): Generator<Nodo> {
  yield nodo;
  if (nodo.tipo === 'grupo') for (const h of nodo.hijos) yield* recorrer(h);
}
