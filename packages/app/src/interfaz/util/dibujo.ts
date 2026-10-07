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

/**
 * Recuadro con etiqueta sobre una pieza. `k` es la escala del lienzo en pantalla, para que el trazo
 * y la letra midan lo mismo sin importar el tamaño del video.
 */
export function dibujarMarca(ctx: CanvasRenderingContext2D, r: Registro, k: number, etiqueta: string, color: string, tinta: string) {
  const [x0, y0, x1, y1] = r.caja;
  ctx.save();
  ctx.fillStyle = `${color}1a`;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 / k;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.font = `600 ${12 / k}px system-ui, sans-serif`;
  const w = ctx.measureText(etiqueta).width + 14 / k;
  const h = 22 / k;
  const ey = y0 - h - 4 / k > 0 ? y0 - h - 4 / k : y1 + 4 / k;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x0, ey, w, h, 4 / k);
  ctx.fill();
  ctx.fillStyle = tinta;
  ctx.textBaseline = 'middle';
  ctx.fillText(etiqueta, x0 + 7 / k, ey + h / 2);
  ctx.restore();
}

/** Simulación de la interfaz de cada app sobre el video, con las zonas que tapa rayadas. */
export function dibujarVista(ctx: CanvasRenderingContext2D, esc: Escenario, vista: Vista, textos: { zona: string; soloVertical: string; cabecera: string }) {
  if (vista === 'limpia') return;
  const W = esc.ancho, H = esc.alto;
  ctx.save();
  if (esc.proyecto.ajustes.formato !== '9:16') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H - 90, W, 90);
    ctx.fillStyle = '#fff';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(textos.soloVertical, 28, H - 45);
    ctx.restore();
    return;
  }
  // Zonas tapadas: velo oscuro con rayas, para que se vean sobre cualquier fondo.
  for (const z of zonasTapadas(vista, esc.proyecto.ajustes.formato)) {
    const x = z.x * W, y = z.y * H, w = z.ancho * W, h = z.alto * H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(10, 12, 16, 0.32)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 110, 110, 0.55)';
    ctx.lineWidth = 6;
    for (let d = -h; d < w + h; d += 34) {
      ctx.beginPath();
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d - h, y + h);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 110, 110, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }
  const blanco = 'rgba(255,255,255,0.95)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = blanco;
  ctx.textBaseline = 'middle';
  ctx.font = '600 38px system-ui, sans-serif';
  ctx.textAlign = 'center';
  if (vista === 'tiktok') ctx.fillText(textos.cabecera, W / 2, 90);
  else { ctx.textAlign = 'left'; ctx.fillText(vista === 'reels' ? 'Reels' : 'Reels · Facebook', 40, 90); }
  const x = vista === 'tiktok' ? W - 80 : W - 70;
  const ys = vista === 'tiktok' ? [0.47, 0.56, 0.63, 0.7, 0.77] : [0.6, 0.67, 0.74, 0.8];
  ctx.textAlign = 'center';
  ctx.font = '600 28px system-ui, sans-serif';
  ys.forEach((fy, i) => {
    ctx.beginPath();
    ctx.arc(x, fy * H, i === 0 && vista === 'tiktok' ? 46 : 34, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = blanco;
    if (i === 0 && vista === 'tiktok') { ctx.fillStyle = 'rgba(210,210,210,0.95)'; ctx.fill(); ctx.stroke(); ctx.fillStyle = blanco; }
    else { ctx.stroke(); ctx.fillText(['', '12.3k', '842', '1.2k', '310'][vista === 'tiktok' ? i : i + 1] ?? '', x, fy * H + 58); }
  });
  ctx.textAlign = 'left';
  const y0 = vista === 'tiktok' ? 0.845 : 0.83;
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText('@tu_cuenta', 36, y0 * H);
  ctx.font = '400 32px system-ui, sans-serif';
  ctx.fillText('…', 36, y0 * H + 54);
  ctx.fillText('♫', 36, y0 * H + 104);
  // Etiqueta de la primera zona, para que se entienda qué significa lo rayado.
  ctx.shadowBlur = 0;
  ctx.font = '700 26px system-ui, sans-serif';
  const etiqueta = textos.zona;
  const ew = ctx.measureText(etiqueta).width + 28;
  ctx.fillStyle = 'rgba(255, 110, 110, 0.95)';
  ctx.beginPath();
  ctx.roundRect(W - ew - 20, 0.35 * H - 54, ew, 42, 8);
  ctx.fill();
  ctx.fillStyle = '#2b0606';
  ctx.fillText(etiqueta, W - ew - 6, 0.35 * H - 33);
  ctx.restore();
}
