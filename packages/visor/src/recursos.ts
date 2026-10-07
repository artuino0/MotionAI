import { recursosDe, type Proyecto } from '@motionai/documento';
import type { Entorno } from '@motionai/motor';

export interface RecursosNavegador {
  entorno: Entorno;
  faltantes: string[];
}

/** Registra las fuentes del proyecto y carga sus imágenes. `base` es la URL de la carpeta del proyecto. */
export async function cargarRecursosNavegador(proyecto: Proyecto, base: string): Promise<RecursosNavegador> {
  const { imagenes, fuentes } = recursosDe(proyecto);
  const url = (rel: string) => new URL(rel, base.endsWith('/') ? base : `${base}/`).href;
  const faltantes: string[] = [];

  await Promise.all(
    fuentes.map(async (f) => {
      const cara = new FontFace(f.familia, `url(${url(f.archivo)})`, {
        weight: String(f.peso ?? 400),
        style: f.estilo ?? 'normal',
      });
      try {
        document.fonts.add(await cara.load());
      } catch {
        faltantes.push(f.archivo);
      }
    }),
  );

  const cargadas = new Map<string, HTMLImageElement>();
  await Promise.all(
    imagenes.map(
      (rel) =>
        new Promise<void>((listo) => {
          const img = new Image();
          img.onload = () => { cargadas.set(rel, img); listo(); };
          img.onerror = () => { faltantes.push(rel); listo(); };
          img.src = url(rel);
        }),
    ),
  );

  const lienzo = (ancho: number, alto: number) => {
    const c = document.createElement('canvas');
    c.width = ancho;
    c.height = alto;
    return c;
  };
  return { entorno: { imagen: (a) => cargadas.get(a), lienzo }, faltantes };
}
