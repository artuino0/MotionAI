import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Reciente } from '../compartido/api.js';

/** Proyectos abiertos hace poco, en un JSON dentro de la carpeta de datos de la app. */
export class Recientes {
  constructor(private archivo: string) {}

  async listar(): Promise<Reciente[]> {
    if (!existsSync(this.archivo)) return [];
    try {
      const lista = JSON.parse(await readFile(this.archivo, 'utf8')) as Reciente[];
      return lista.filter((r) => existsSync(r.ruta));
    } catch {
      return [];
    }
  }

  async agregar(ruta: string, nombre: string): Promise<void> {
    const lista = (await this.listar()).filter((r) => path.resolve(r.ruta) !== path.resolve(ruta));
    lista.unshift({ ruta, nombre, abierto: new Date().toISOString() });
    await writeFile(this.archivo, JSON.stringify(lista.slice(0, 12), null, 2));
  }
}
