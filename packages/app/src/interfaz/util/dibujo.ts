import { zonasTapadas } from '@motionai/documento';
import { dibujarCuadro, type Entorno, type Escenario, type Registro } from '@motionai/motor';
import type { Vista } from '../tiendas/estudio.js';

let lienzoGrande: HTMLCanvasElement | undefined;

/** Miniatura de un cuadro como data URL. */
export function miniatura(esc: Escenario, entorno: Entorno, t: number, ancho = 220): string {
  lienzoGrande ??= document.createElement('canvas');
  lienzoGrande.width = esc.ancho;
  lienzoGrande.height = esc.alto;
  dibujarCuadro(lienzoGrande.getContext('2d')!, esc, t, entorno, { subtitulos: false });
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = Math.round((ancho * esc.alto) / esc.ancho);
  c.getContext('2d')!.drawImage(lienzoGrande, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

/** Pieza de más arriba que contiene el punto (en pixeles del lienzo). */
export function piezaEn(registros: Registro[], x: number, y: number): Registro | undefined {
  for (let i = registros.length - 1; i >= 0; i--) {
    const [x0, y0, x1, y1] = registros[i]!.caja;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return registros[i];
  }
  return undefined;
}

export function dibujarSeleccion(ctx: CanvasRenderingContext2D, r: Registro, k: number) {
  const [x0, y0, x1, y1] = r.caja;
  ctx.save();
  ctx.strokeStyle = '#2ec4d6';
  ctx.lineWidth = 3 / k;
  ctx.setLineDash([10 / k, 6 / k]);
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([]);
  const etiqueta = r.ruta;
  ctx.font = `600 ${13 / k}px system-ui, sans-serif`;
  const w = ctx.measureText(etiqueta).width + 14 / k;
  const h = 22 / k;
  const ey = y0 - h - 4 / k > 0 ? y0 - h - 4 / k : y1 + 4 / k;
  ctx.fillStyle = '#2ec4d6';
  ctx.fillRect(x0, ey, w, h);
  ctx.fillStyle = '#06272c';
  ctx.textBaseline = 'middle';
  ctx.fillText(etiqueta, x0 + 7 / k, ey + h / 2);
  ctx.restore();
}

/** Simulación de la interfaz de cada app sobre el video, con las zonas que tapa. */
export function dibujarVista(ctx: CanvasRenderingContext2D, esc: Escenario, vista: Vista) {
  if (vista === 'limpia') return;
  const W = esc.ancho, H = esc.alto;
  ctx.save();
  for (const z of zonasTapadas(vista, esc.proyecto.ajustes.formato)) {
    ctx.fillStyle = 'rgba(255, 70, 70, 0.10)';
    ctx.fillRect(z.x * W, z.y * H, z.ancho * W, z.alto * H);
  }
  if (esc.proyecto.ajustes.formato !== '9:16') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, H - 90, W, 90);
    ctx.fillStyle = '#fff';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText('La vista de app solo está para 9:16', 24, H - 35);
    ctx.restore();
    return;
  }
  const blanco = 'rgba(255,255,255,0.92)';
  const sombra = (b = 8) => { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = b; };
  sombra();
  ctx.fillStyle = blanco;
  ctx.textBaseline = 'middle';
  // Encabezado
  ctx.font = '600 38px system-ui, sans-serif';
  ctx.textAlign = 'center';
  if (vista === 'tiktok') ctx.fillText('Siguiendo     Para ti', W / 2, 90);
  else ctx.fillText(vista === 'reels' ? 'Reels' : 'Reels de Facebook', vista === 'reels' ? 110 : 200, 90);
  // Columna de botones
  const x = vista === 'tiktok' ? W - 80 : W - 70;
  const ys = vista === 'tiktok' ? [0.47, 0.56, 0.63, 0.7, 0.77] : [0.6, 0.67, 0.74, 0.8];
  ys.forEach((fy, i) => {
    ctx.beginPath();
    ctx.arc(x, fy * H, i === 0 && vista === 'tiktok' ? 46 : 34, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = blanco;
    if (i === 0 && vista === 'tiktok') { ctx.fillStyle = 'rgba(200,200,200,0.9)'; ctx.fill(); ctx.stroke(); ctx.fillStyle = blanco; }
    else ctx.stroke();
    if (i > 0 || vista !== 'tiktok') ctx.fillText(['', '12.3k', '842', '1.2k', '310'][i] ?? '', x, fy * H + 58);
  });
  // Descripción
  ctx.textAlign = 'left';
  const y0 = vista === 'tiktok' ? 0.845 : 0.83;
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText('@tu_cuenta', 36, y0 * H);
  ctx.font = '400 32px system-ui, sans-serif';
  ctx.fillText('Así se ve la descripción de tu video…', 36, y0 * H + 54);
  ctx.fillText('♫ sonido original', 36, y0 * H + 104);
  ctx.restore();
}
