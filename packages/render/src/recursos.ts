import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Canvas, FontLibrary, loadImage, type Image } from 'skia-canvas';
import { leerProyecto, recursosDe, type Proyecto } from '@motionai/documento';
import type { Entorno } from '@motionai/motor';

export interface ProyectoCargado {
  proyecto: Proyecto;
  /** Carpeta del archivo del proyecto; las rutas de `recursos/` son relativas a ella. */
  base: string;
}

/** Lee y valida un archivo de proyecto. */
export async function cargarProyecto(ruta: string): Promise<ProyectoCargado> {
  const texto = await readFile(ruta, 'utf8');
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    throw new Error(`${ruta} no es JSON válido: ${(e as Error).message}`);
  }
  return { proyecto: leerProyecto(datos), base: path.dirname(path.resolve(ruta)) };
}

export interface RecursosNode {
  entorno: Entorno;
  /** Archivos que el proyecto pide y no existen. */
  faltantes: string[];
}

const familiasRegistradas = new Map<string, string>();

/** Registra las fuentes en skia-canvas y carga las imágenes del proyecto. */
export async function cargarRecursos({ proyecto, base }: ProyectoCargado): Promise<RecursosNode> {
  const { imagenes, fuentes, audio } = recursosDe(proyecto);
  const faltantes: string[] = [];
  const existe = (rel: string) => {
    const abs = path.resolve(base, rel);
    if (!existsSync(abs)) faltantes.push(rel);
    return existsSync(abs) ? abs : null;
  };

  const porFamilia = new Map<string, string[]>();
  for (const f of fuentes) {
    const abs = existe(f.archivo);
    if (abs) porFamilia.set(f.familia, [...(porFamilia.get(f.familia) ?? []), abs]);
  }
  for (const [familia, archivos] of porFamilia) {
    const clave = archivos.sort().join('|');
    if (familiasRegistradas.get(familia) === clave) continue;
    FontLibrary.use(familia, archivos);
    familiasRegistradas.set(familia, clave);
  }

  const cargadas = new Map<string, Image>();
  await Promise.all(
    imagenes.map(async (rel) => {
      const abs = existe(rel);
      if (abs) cargadas.set(rel, await loadImage(abs));
    }),
  );
  for (const a of audio) existe(a);

  return {
    entorno: {
      imagen: (archivo) => cargadas.get(archivo) as unknown as CanvasImageSource | undefined,
      lienzo: (ancho, alto) => new Canvas(ancho, alto) as unknown as ReturnType<NonNullable<Entorno['lienzo']>>,
    },
    faltantes,
  };
}
