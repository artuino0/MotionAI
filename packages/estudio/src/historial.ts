import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface Version {
  numero: number;
  fecha: string;
  herramienta: string;
  resumen: string;
}

/**
 * Versiones del documento en SQLite, junto al proyecto (`.motionai/historial.db`).
 * Cada cambio guarda el documento completo: son archivos chicos y volver a una versión es inmediato.
 */
export class Historial {
  private db: DatabaseSync;

  constructor(base: string) {
    const dir = path.join(base, '.motionai');
    mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(path.join(dir, 'historial.db'));
    this.db.exec(`CREATE TABLE IF NOT EXISTS versiones (
      numero INTEGER PRIMARY KEY,
      fecha TEXT NOT NULL,
      herramienta TEXT NOT NULL,
      resumen TEXT NOT NULL,
      documento TEXT NOT NULL
    )`);
  }

  ultima(): number {
    const r = this.db.prepare('SELECT MAX(numero) AS n FROM versiones').get() as { n: number | null };
    return r.n ?? 0;
  }

  guardar(documento: unknown, herramienta: string, resumen: string): number {
    const numero = this.ultima() + 1;
    this.db
      .prepare('INSERT INTO versiones (numero, fecha, herramienta, resumen, documento) VALUES (?, ?, ?, ?, ?)')
      .run(numero, new Date().toISOString(), herramienta, resumen, JSON.stringify(documento));
    return numero;
  }

  listar(limite = 20): Version[] {
    return this.db
      .prepare('SELECT numero, fecha, herramienta, resumen FROM versiones ORDER BY numero DESC LIMIT ?')
      .all(limite) as unknown as Version[];
  }

  leer(numero: number): unknown | undefined {
    const r = this.db.prepare('SELECT documento FROM versiones WHERE numero = ?').get(numero) as { documento: string } | undefined;
    return r ? JSON.parse(r.documento) : undefined;
  }

  cerrar(): void {
    this.db.close();
  }
}
