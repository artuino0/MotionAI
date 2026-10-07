import { existsSync, readFileSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recorrer, type Fuente, type Nodo, type ProyectoEntrada } from '@motionai/documento';

/** Carpeta con las fuentes libres que trae la app. La app empaquetada la indica con MOTIONAI_FUENTES. */
export function carpetaFuentes(): string {
  return process.env.MOTIONAI_FUENTES ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fuentes');
}

export interface FamiliaCatalogo {
  familia: string;
  estilo: string;
  pesos: Record<string, string>;
}

let catalogo: FamiliaCatalogo[] | undefined;
export function catalogoFuentes(): FamiliaCatalogo[] {
  catalogo ??= JSON.parse(readFileSync(path.join(carpetaFuentes(), 'catalogo.json'), 'utf8')) as FamiliaCatalogo[];
  return catalogo;
}

/** Familias que usan los textos y los subtítulos del documento. */
export function familiasUsadas(doc: ProyectoEntrada): Set<string> {
  const usadas = new Set<string>();
  const raices: Nodo[] = [...doc.escenas.flatMap((e) => e.hijos ?? []), ...(doc.biblioteca ?? []).map((c) => c.raiz)];
  for (const r of raices) for (const n of recorrer(r)) if (n.tipo === 'texto') usadas.add(n.fuente);
  const sub = doc.ajustes?.subtitulos?.fuente;
  if (sub) usadas.add(sub);
  return usadas;
}

/**
 * Si el documento usa una familia del catálogo que no ha declarado, copia sus archivos a
 * `recursos/fuentes/` y la declara. Así Claude solo escribe el nombre de la fuente.
 * Devuelve las familias agregadas.
 */
export async function asegurarFuentes(doc: ProyectoEntrada, base: string): Promise<string[]> {
  const declaradas = new Set((doc.fuentes ?? []).map((f) => f.familia));
  const agregadas: string[] = [];
  for (const familia of familiasUsadas(doc)) {
    if (declaradas.has(familia)) continue;
    const fam = catalogoFuentes().find((f) => f.familia.toLowerCase() === familia.toLowerCase());
    if (!fam) continue; // el validador avisa que la fuente no existe
    const destino = path.join(base, 'recursos', 'fuentes');
    await mkdir(destino, { recursive: true });
    const nuevas: Fuente[] = [];
    for (const [peso, archivo] of Object.entries(fam.pesos)) {
      const abs = path.join(destino, archivo);
      if (!existsSync(abs)) await copyFile(path.join(carpetaFuentes(), archivo), abs);
      nuevas.push({ familia, archivo: `recursos/fuentes/${archivo}`, peso: Number(peso) });
    }
    doc.fuentes = [...(doc.fuentes ?? []), ...nuevas];
    agregadas.push(familia);
  }
  return agregadas;
}
