import { Canvas } from 'skia-canvas';
import { dibujarCuadro, type Entorno, type Escenario, type OpcionesCuadro } from '@motionai/motor';

/** Lienzo de skia-canvas con el tamaño del proyecto. */
export function crearLienzo(esc: Escenario): { canvas: Canvas; ctx: CanvasRenderingContext2D } {
  const canvas = new Canvas(esc.ancho, esc.alto);
  canvas.gpu = false; // CPU: mismo resultado en cualquier máquina
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  return { canvas, ctx };
}

/** Pixeles RGBA (sin premultiplicar) del cuadro del segundo `t`. */
export function pixelesCuadro(esc: Escenario, t: number, entorno: Entorno, op?: OpcionesCuadro, lienzo = crearLienzo(esc)): Buffer {
  dibujarCuadro(lienzo.ctx, esc, t, entorno, op);
  return lienzo.canvas.toBufferSync('raw', { colorType: 'rgba' }) as Buffer;
}

/** PNG del cuadro del segundo `t`. */
export async function pngCuadro(esc: Escenario, t: number, entorno: Entorno, op?: OpcionesCuadro): Promise<Buffer> {
  const { canvas, ctx } = crearLienzo(esc);
  dibujarCuadro(ctx, esc, t, entorno, op);
  return (await canvas.toBuffer('png')) as Buffer;
}
