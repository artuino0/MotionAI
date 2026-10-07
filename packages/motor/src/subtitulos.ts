import { colorCss, leerColor } from './color.js';
import { bordes, opcionesPapel, rellenarPapel } from './papel.js';
import { aplanar, trazadoRect, trazar } from './svg.js';
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
  const borde = a.fondo ? 2 * a.fondo.margen * k : a.contorno.ancho * k;
  const ancho = Math.max(...lineas.map((l) => ctx.measureText(l).width)) + borde;
  ctx.restore();
  const lh = tamano * 1.15;
  const alto = lineas.length * lh + (a.fondo ? 2 * a.fondo.margen * k * 0.75 : 0);
  const yc = esc.alto * a.posicion;
  return {
    lineas,
    fuente,
    lh,
    y0: yc - (lineas.length * lh) / 2 + lh / 2,
    caja: [esc.ancho / 2 - ancho / 2, yc - alto / 2, esc.ancho / 2 + ancho / 2, yc + alto / 2],
  };
}

/** Subtítulos de la voz. Con papel, la tarjeta de fondo se dibuja como un recorte. */
export function dibujarSubtitulos(ctx: Ctx, esc: Escenario, t: number, papel?: { hervor: number; grano: CanvasPattern | null }): void {
  const frase = fraseEn(esc, t);
  if (!frase) return;
  const a = esc.proyecto.ajustes.subtitulos;
  const k = Math.min(esc.ancho, esc.alto) / 1080;
  const m = maquetarSubtitulo(ctx, esc, frase.texto);
  const x = esc.ancho / 2;
  ctx.save();
  if (a.fondo) {
    const [x0, y0, x1, y1] = m.caja;
    const cmds = trazadoRect(x1 - x0, y1 - y0, a.fondo.radio * k);
    ctx.save();
    ctx.translate(x0, y0);
    const color = leerColor(a.fondo.color);
    if (papel) {
      const opciones = opcionesPapel({ id: 'subtitulo', tipo: 'rect', ancho: 0, alto: 0 })!;
      // Cada frase es otro recorte: la semilla cambia con el texto.
      const ruta = `subtitulo:${frase.inicio}`;
      const aplanado = aplanar(cmds);
      rellenarPapel(ctx, { ruta, hervor: papel.hervor, opciones, aplanado, relleno: color, grano: papel.grano, conSombraPropia: false },
        bordes({ ruta, hervor: papel.hervor, opciones, aplanado }));
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 12 * k;
      ctx.shadowOffsetY = 4 * k;
      trazar(ctx, cmds);
      ctx.fillStyle = colorCss(color);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.font = m.fuente;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const bajada = bajadaDesdeCentro(ctx);
  if (a.contorno.ancho > 0 && !a.fondo) {
    ctx.lineWidth = a.contorno.ancho * k;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colorCss(leerColor(a.contorno.color));
    m.lineas.forEach((l, i) => ctx.strokeText(l, x, m.y0 + i * m.lh + bajada));
  }
  ctx.fillStyle = colorCss(leerColor(a.color));
  m.lineas.forEach((l, i) => ctx.fillText(l, x, m.y0 + i * m.lh + bajada));
  ctx.restore();
}
