import { colorCss, leerColor } from './color.js';
import type { Escenario } from './preparar.js';
import { bajadaDesdeCentro, fuenteCss, renglones } from './texto.js';

type Ctx = CanvasRenderingContext2D;

/** Frase que lleva subtítulo en el segundo `t`, si hay una. */
export function fraseEn(esc: Escenario, t: number) {
  return esc.frases.find((f) => f.subtitulo !== false && t >= f.inicio && t < f.fin);
}

/**
 * Subtítulos de la voz. El tamaño se da para un lienzo de 1080 de lado corto y se ajusta al formato.
 * Si la frase no cabe en el máximo de renglones, se achica la letra hasta la mitad.
 */
export function dibujarSubtitulos(ctx: Ctx, esc: Escenario, t: number): void {
  const a = esc.proyecto.ajustes.subtitulos;
  if (!a.activados) return;
  const frase = fraseEn(esc, t);
  if (!frase || !frase.texto.trim()) return;

  const k = Math.min(esc.ancho, esc.alto) / 1080;
  const fuente = a.fuente ?? esc.proyecto.fuentes[0]?.familia ?? 'sans-serif';
  const anchoMax = esc.ancho * 0.84;
  let tamano = a.tamano * k;
  let lineas: string[] = [];
  ctx.save();
  for (let i = 0; i < 12; i++) {
    ctx.font = fuenteCss({ fuente, tamano, peso: a.peso });
    lineas = renglones(ctx, frase.texto, anchoMax);
    if (lineas.length <= a.maxRenglones || tamano <= a.tamano * k * 0.5) break;
    tamano *= 0.94;
  }
  lineas = lineas.slice(0, a.maxRenglones);
  const lh = tamano * 1.15;
  const y0 = esc.alto * a.posicion - (lineas.length * lh) / 2 + lh / 2;
  const x = esc.ancho / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const bajada = bajadaDesdeCentro(ctx);
  if (a.contorno.ancho > 0) {
    ctx.lineWidth = a.contorno.ancho * k;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colorCss(leerColor(a.contorno.color));
    lineas.forEach((l, i) => ctx.strokeText(l, x, y0 + i * lh + bajada));
  }
  ctx.fillStyle = colorCss(leerColor(a.color));
  lineas.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh + bajada));
  ctx.restore();
}
