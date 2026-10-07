/**
 * Canal local entre el servidor MCP (que lanza Claude Code) y la app abierta: JSON por renglón sobre un
 * socket de Unix o un named pipe de Windows. Solo transporta llamadas a los métodos del PuertoEstudio.
 */
import { existsSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { METODOS_PUERTO, type PuertoEstudio } from './puerto.js';

type Metodo = (typeof METODOS_PUERTO)[number];

/** Ruta del socket para un proceso de la app. */
export function rutaSocket(id: string | number = process.pid): string {
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\motionai-${id}`
    : path.join(os.tmpdir(), `motionai-${id}.sock`);
}

// Los Buffer (imágenes de ver_cuadro) viajan en base64.
const codificar = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (x && x.type === 'Buffer' && Array.isArray(x.data) ? { __buffer: Buffer.from(x.data).toString('base64') } : x));
const decodificar = (s: string) =>
  JSON.parse(s, (_k, x) => (x && typeof x === 'object' && typeof x.__buffer === 'string' ? Buffer.from(x.__buffer, 'base64') : x));

/** Atiende llamadas al puerto desde otros procesos. Devuelve una función para cerrar. */
export function servirPuerto(puerto: PuertoEstudio, ruta = rutaSocket()): Promise<{ ruta: string; cerrar: () => void }> {
  if (process.platform !== 'win32' && existsSync(ruta)) rmSync(ruta);
  const server = net.createServer((sock) => {
    const lector = createInterface({ input: sock });
    lector.on('line', async (linea) => {
      let id: unknown;
      try {
        const msg = decodificar(linea) as { id: unknown; metodo: Metodo; args: unknown[] };
        id = msg.id;
        if (!METODOS_PUERTO.includes(msg.metodo)) throw new Error(`Método desconocido: ${msg.metodo}`);
        const valor = await (puerto[msg.metodo] as (...a: unknown[]) => Promise<unknown>).apply(puerto, msg.args ?? []);
        sock.write(codificar({ id, ok: true, valor }) + '\n');
      } catch (e) {
        sock.write(codificar({ id, ok: false, error: (e as Error).message }) + '\n');
      }
    });
    sock.on('error', () => undefined);
  });
  return new Promise((ok, mal) => {
    server.once('error', mal);
    server.listen(ruta, () => ok({ ruta, cerrar: () => server.close() }));
  });
}

/** PuertoEstudio que manda cada llamada a la app por el socket. */
export function puertoRemoto(ruta: string): PuertoEstudio {
  let sock: net.Socket | undefined;
  let siguiente = 1;
  const pendientes = new Map<number, { ok: (v: unknown) => void; mal: (e: Error) => void }>();
  const conectar = () =>
    new Promise<net.Socket>((ok, mal) => {
      if (sock && !sock.destroyed) return ok(sock);
      const s = net.connect(ruta);
      s.once('connect', () => {
        sock = s;
        createInterface({ input: s }).on('line', (linea) => {
          const r = decodificar(linea) as { id: number; ok: boolean; valor?: unknown; error?: string };
          const p = pendientes.get(r.id);
          if (!p) return;
          pendientes.delete(r.id);
          if (r.ok) p.ok(r.valor);
          else p.mal(new Error(r.error));
        });
        s.on('close', () => {
          for (const p of pendientes.values()) p.mal(new Error('Se cerró la conexión con la app.'));
          pendientes.clear();
        });
        ok(s);
      });
      s.once('error', (e) => mal(new Error(`No se pudo hablar con la app MotionAI (${ruta}): ${e.message}`)));
    });
  const llamar = async (metodo: Metodo, args: unknown[]) => {
    const s = await conectar();
    const id = siguiente++;
    return new Promise((ok, mal) => {
      pendientes.set(id, { ok, mal });
      s.write(codificar({ id, metodo, args }) + '\n');
    });
  };
  return Object.fromEntries(METODOS_PUERTO.map((m) => [m, (...args: unknown[]) => llamar(m, args)])) as unknown as PuertoEstudio;
}
