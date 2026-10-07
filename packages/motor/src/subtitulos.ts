import { colorCss, leerColor } from './color.js';
import type { Escenario } from './preparar.js';
import { bajadaDesdeCentro, fuenteCss, renglones } from './texto.js';

type Ctx = CanvasRenderingContext2D;

/** Frase que lleva subtítulo en el segundo `t`, si hay una. */
export function fraseEn(esc: Escenario, t: number) {
  if (!esc.proyecto.ajustes.subtitulos.activados) return undefined;
  return esc.frases.find((f) => f.subtitulo !== false && f.texto.trim() && t >= f.inicio && t < f.fin);
}

export interface Maqueta {
  lineas: string[];
  fuente: string;
  /** Alto de renglón. */
  lh: number;
  /** Centro del primer renglón. */
  y0: number;
  /** Caja que ocupa el texto en el lienzo. */
  caja: [number, number, number, number];
}

/**
 * Acomoda el texto de un subtítulo. El tamaño se da para un lienzo de 1080 de lado corto y se ajusta al formato.
 * En formatos verticales el ancho se limita para no entrar en la columna de botones de las apps.
 * Si la frase no cabe en el máximo de renglones, se achica la letra hasta la mitad.
 */
export function maquetarSubtitulo(ctx: Ctx, esc: Escenario, texto: string): Maqueta {
  const a = esc.proyecto.ajustes.subtitulos;
  const k = Math.min(esc.ancho, esc.alto) / 1080;
  const familia = a.fuente ?? esc.proyecto.fuentes[0]?.familia ?? 'sans-serif';
  const anchoMax = esc.ancho * (esc.alto > esc.ancho ? 0.72 : 0.84);
  let tamano = a.tamano * k;
  let lineas: string[] = [];
  let fuente = '';
  ctx.save();
  for (let i = 0; i < 12; i++) {
    fuente = fuenteCss({ fuente: familia, tamano, peso: a.peso });
    ctx.font = fuente;
    lineas = renglones(ctx, texto, anchoMax);
    if (lineas.length <= a.maxRenglones || tamano <= a.tamano * k * 0.5) break;
    tamano *= 0.94;
  }
  lineas = lineas.slice(0, a.maxRenglones);
  const ancho = Math.max(...lineas.map((l) => ctx.measureText(l).width)) + a.contorno.ancho * k;
  ctx.restore();
  const lh = tamano * 1.15;
  const alto = lineas.length * lh;
  const yc = esc.alto * a.posicion;
  return {
    lineas,
    fuente,
    lh,
    y0: yc - alto / 2 + lh / 2,
    caja: [esc.ancho / 2 - ancho / 2, yc - alto / 2, esc.ancho / 2 + ancho / 2, yc + alto / 2],
  };
}

/** Subtítulos de la voz. */
export function dibujarSubtitulos(ctx: Ctx, esc: Escenario, t: number): void {
  const frase = fraseEn(esc, t);
  if (!frase) return;
  const a = esc.proyecto.ajustes.subtitulos;
  const k = Math.min(esc.ancho, esc.alto) / 1080;
  const m = maquetarSubtitulo(ctx, esc, frase.texto);
  const x = esc.ancho / 2;
  ctx.save();
  ctx.font = m.fuente;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const bajada = bajadaDesdeCentro(ctx);
  if (a.contorno.ancho > 0) {
    ctx.lineWidth = a.contorno.ancho * k;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colorCss(leerColor(a.contorno.color));
    m.lineas.forEach((l, i) => ctx.strokeText(l, x, m.y0 + i * m.lh + bajada));
  }
  ctx.fillStyle = colorCss(leerColor(a.color));
  m.lineas.forEach((l, i) => ctx.fillText(l, x, m.y0 + i * m.lh + bajada));
  ctx.restore();
}
