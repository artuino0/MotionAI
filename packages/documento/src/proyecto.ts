import { z } from 'zod';
import { AjustesEsquema, type Ajustes, type AjustesEntrada, type Formato } from './ajustes.js';
import { NodoEsquema, RellenoEsquema, recorrer, type Nodo, type Relleno } from './nodos.js';

export const VERSION_FORMATO = 1;

export interface Fuente {
  familia: string;
  /** Ruta relativa al proyecto, por ejemplo `recursos/fuentes/Nunito-Black.ttf`. */
  archivo: string;
  peso?: number;
  estilo?: 'normal' | 'italic';
}

export interface Frase {
  /** Segundos del proyecto. */
  inicio: number;
  fin: number;
  texto: string;
  /** `false` si la frase no lleva subtítulo (por ejemplo, porque ya va en un letrero). */
  subtitulo?: boolean;
}

export interface Componente {
  id: string;
  nombre: string;
  /** Para buscar en la biblioteca: `personaje`, `icono`, `etiqueta`, `fondo`… */
  tipo?: string;
  /** Cómo se mueve o para qué sirve. */
  nota?: string;
  raiz: Nodo;
}

export interface Escena {
  id: string;
  nombre?: string;
  /** Segundos del proyecto. */
  inicio: number;
  fin: number;
  fondo?: Relleno;
  hijos: Nodo[];
}

export interface ProyectoEntrada {
  formato: 'motionai';
  version: number;
  nombre: string;
  ajustes?: AjustesEntrada;
  fuentes?: Fuente[];
  frases?: Frase[];
  biblioteca?: Componente[];
  escenas: Escena[];
}

export interface Proyecto extends Omit<ProyectoEntrada, 'ajustes'> {
  ajustes: Ajustes;
  fuentes: Fuente[];
  frases: Frase[];
  biblioteca: Componente[];
}

const FuenteEsquema = z.strictObject({
  familia: z.string().min(1),
  archivo: z.string().min(1),
  peso: z.number().int().min(100).max(1000).optional(),
  estilo: z.enum(['normal', 'italic']).optional(),
});

const FraseEsquema = z
  .strictObject({
    inicio: z.number().nonnegative(),
    fin: z.number().nonnegative(),
    texto: z.string(),
    subtitulo: z.boolean().optional(),
  })
  .refine((f) => f.fin > f.inicio, 'La frase debe terminar después de empezar');

const ComponenteEsquema = z.strictObject({
  id: z.string().min(1),
  nombre: z.string().min(1),
  tipo: z.string().optional(),
  nota: z.string().optional(),
  raiz: NodoEsquema,
});

const EscenaEsquema = z
  .strictObject({
    id: z.string().min(1),
    nombre: z.string().optional(),
    inicio: z.number().nonnegative(),
    fin: z.number().positive(),
    fondo: RellenoEsquema.optional(),
    hijos: z.array(NodoEsquema),
  })
  .refine((e) => e.fin > e.inicio, 'La escena debe terminar después de empezar');

export const ProyectoEsquema = z
  .strictObject({
    formato: z.literal('motionai'),
    version: z.literal(VERSION_FORMATO),
    nombre: z.string().min(1),
    ajustes: AjustesEsquema.prefault({}),
    fuentes: z.array(FuenteEsquema).default([]),
    frases: z.array(FraseEsquema).default([]),
    biblioteca: z.array(ComponenteEsquema).default([]),
    escenas: z.array(EscenaEsquema).min(1),
  })
  .superRefine((p, ctx) => {
    // Ids únicos en todo el documento (escenas y biblioteca): Claude y la interfaz se refieren a las piezas por id.
    const vistos = new Set<string>();
    const unico = (id: string, path: (string | number)[]) => {
      if (vistos.has(id)) ctx.addIssue({ code: 'custom', path, message: `El id "${id}" está repetido` });
      vistos.add(id);
    };
    p.escenas.forEach((e, i) => {
      unico(e.id, ['escenas', i, 'id']);
      for (const h of e.hijos) for (const n of recorrer(h)) unico(n.id, ['escenas', i]);
    });
    p.biblioteca.forEach((c, i) => {
      for (const n of recorrer(c.raiz)) unico(n.id, ['biblioteca', i]);
    });
    const componentes = new Set<string>();
    p.biblioteca.forEach((c, i) => {
      if (componentes.has(c.id)) ctx.addIssue({ code: 'custom', path: ['biblioteca', i, 'id'], message: `El componente "${c.id}" está repetido` });
      componentes.add(c.id);
    });
    const revisarInstancias = (n: Nodo, path: (string | number)[]) => {
      for (const m of recorrer(n)) {
        if (m.tipo === 'instancia' && !componentes.has(m.componente)) {
          ctx.addIssue({ code: 'custom', path, message: `La pieza "${m.id}" usa el componente "${m.componente}", que no está en la biblioteca` });
        }
      }
    };
    p.escenas.forEach((e, i) => e.hijos.forEach((h) => revisarInstancias(h, ['escenas', i])));
    p.biblioteca.forEach((c, i) => revisarInstancias(c.raiz, ['biblioteca', i]));
    const familias = new Set(p.fuentes.map((f) => f.familia));
    const revisarFuentes = (n: Nodo, path: (string | number)[]) => {
      for (const m of recorrer(n)) {
        if (m.tipo === 'texto' && !familias.has(m.fuente)) {
          ctx.addIssue({ code: 'custom', path, message: `El texto "${m.id}" usa la fuente "${m.fuente}", que no está en fuentes` });
        }
      }
    };
    p.escenas.forEach((e, i) => e.hijos.forEach((h) => revisarFuentes(h, ['escenas', i])));
    p.biblioteca.forEach((c, i) => revisarFuentes(c.raiz, ['biblioteca', i]));
  });

export type ResultadoValidacion =
  | { ok: true; proyecto: Proyecto }
  | { ok: false; errores: string[] };

/** Valida un documento y llena los ajustes que falten con sus valores por defecto. */
export function validarProyecto(datos: unknown): ResultadoValidacion {
  const r = ProyectoEsquema.safeParse(datos);
  if (r.success) return { ok: true, proyecto: r.data as Proyecto };
  return {
    ok: false,
    errores: r.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)),
  };
}

export class ErrorProyecto extends Error {
  constructor(public errores: string[]) {
    super(`El proyecto no es válido:\n- ${errores.join('\n- ')}`);
  }
}

/** Como `validarProyecto`, pero lanza un error si el documento no es válido. */
export function leerProyecto(datos: unknown): Proyecto {
  const r = validarProyecto(datos);
  if (!r.ok) throw new ErrorProyecto(r.errores);
  return r.proyecto;
}

/** Copia del proyecto con otro formato, para previsualizar o exportar en otro tamaño. */
export function conFormato(p: Proyecto, formato: Formato, tam?: { ancho: number; alto: number }): Proyecto {
  return { ...p, ajustes: { ...p.ajustes, formato, ...(tam ?? {}) } };
}

/** Duración del proyecto en segundos. */
export function duracionDe(p: Proyecto): number {
  return p.ajustes.duracion ?? Math.max(...p.escenas.map((e) => e.fin));
}

/** Archivos que el proyecto necesita de `recursos/`. */
export function recursosDe(p: Proyecto): { imagenes: string[]; fuentes: Fuente[]; audio: string[] } {
  const imagenes = new Set<string>();
  const todos = [...p.escenas.flatMap((e) => e.hijos), ...p.biblioteca.map((c) => c.raiz)];
  for (const raiz of todos) for (const n of recorrer(raiz)) if (n.tipo === 'imagen') imagenes.add(n.archivo);
  const audio = [p.ajustes.audio.voz?.archivo, p.ajustes.audio.musica?.archivo].filter((a): a is string => !!a);
  return { imagenes: [...imagenes], fuentes: p.fuentes, audio };
}
