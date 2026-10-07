import { Canvas } from 'skia-canvas';
import { zonasTapadas } from '@motionai/documento';
import { dibujarCuadro, escenaEn, type Entorno, type Escenario, type Registro } from '@motionai/motor';

export interface OpcionesVista {
  /** Dibuja encima las zonas que tapan las plataformas. */
  zonas?: boolean;
  /** Ids (o rutas) de piezas para marcar con un recuadro. */
  resaltar?: string[];
  /** Lado largo de cada miniatura, en pixeles. */
  lado?: number;
}

/**
 * Hoja con uno o varios cuadros reducidos y el segundo de cada uno, para que Claude revise su trabajo.
 * Imágenes chicas: bastan para juzgar composición y legibilidad sin gastar contexto.
 */
export async function hojaDeCuadros(esc: Escenario, entorno: Entorno, tiempos: number[], op: OpcionesVista = {}): Promise<Buffer> {
  const lado = op.lado ?? 560;
  const k = lado / Math.max(esc.ancho, esc.alto);
  const w = Math.round(esc.ancho * k), h = Math.round(esc.alto * k);
  const cols = Math.min(tiempos.length, esc.ancho > esc.alto ? 2 : 3);
  const filas = Math.ceil(tiempos.length / cols);
  const pie = 34, margen = 12;
  const hoja = new Canvas(cols * (w + margen) + margen, filas * (h + pie + margen) + margen);
  const hc = hoja.getContext('2d');
  hc.fillStyle = '#2a2d33';
  hc.fillRect(0, 0, hoja.width, hoja.height);

  const cuadro = new Canvas(esc.ancho, esc.alto);
  cuadro.gpu = false;
  const ctx = cuadro.getContext('2d') as unknown as CanvasRenderingContext2D;

  tiempos.forEach((t, i) => {
    const regs: Registro[] = [];
    dibujarCuadro(ctx, esc, t, entorno, { registrar: (r) => regs.push(r) });
    if (op.zonas) dibujarZonas(ctx, esc);
    for (const id of op.resaltar ?? []) {
      for (const r of regs.filter((x) => x.ruta === id || x.ruta.endsWith(`/${id}`))) {
        ctx.save();
        ctx.strokeStyle = '#ff2fd0';
        ctx.lineWidth = 6;
        ctx.setLineDash([18, 10]);
        ctx.strokeRect(r.caja[0], r.caja[1], r.caja[2] - r.caja[0], r.caja[3] - r.caja[1]);
        ctx.restore();
      }
    }
    const x = margen + (i % cols) * (w + margen);
    const y = margen + Math.floor(i / cols) * (h + pie + margen);
    hc.drawImage(cuadro, x, y, w, h);
    hc.fillStyle = '#e8e8ea';
    hc.font = '600 20px sans-serif';
    hc.textBaseline = 'middle';
    const escena = escenaEn(esc, t)?.escena;
    hc.fillText(`${t.toFixed(2)} s${escena ? ` · ${escena.nombre ?? escena.id}` : ''}`, x + 4, y + h + pie / 2);
  });
  return (await hoja.toBuffer('png')) as Buffer;
}

function dibujarZonas(ctx: CanvasRenderingContext2D, esc: Escenario) {
  const { formato, plataformas } = esc.proyecto.ajustes;
  ctx.save();
  for (const p of plataformas) {
    for (const z of zonasTapadas(p, formato)) {
      ctx.fillStyle = 'rgba(255,40,40,0.18)';
      ctx.fillRect(z.x * esc.ancho, z.y * esc.alto, z.ancho * esc.ancho, z.alto * esc.alto);
      ctx.strokeStyle = 'rgba(255,40,40,0.8)';
      ctx.lineWidth = 4;
      ctx.strokeRect(z.x * esc.ancho, z.y * esc.alto, z.ancho * esc.ancho, z.alto * esc.alto);
    }
  }
  ctx.restore();
}
