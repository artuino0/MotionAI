/**
 * Estilo «papel recortado». No cambia el documento, solo cómo se dibuja:
 * - cada figura rellena se corta con un filo irregular que «hierve» (cambia cada `HERVOR` cuadros del estilo),
 * - debajo lleva un filo blanco de papel rasgado y una sombra suave en tres capas,
 * - cada pieza tiene un tono un poco distinto (fijo) y grano de papel encima,
 * - la animación avanza a `fpsEstilo` cuadros por segundo, como stop motion.
 *
 * Todo sale de un generador con semilla (id de la pieza y número de hervor): el previo y el MP4 son iguales.
 */
import type { Nodo } from '@motionai/documento';
import { colorCss, type RGBA } from './color.js';
import type { Aplanado } from './svg.js';

type Ctx = CanvasRenderingContext2D;

/** Cuadros del estilo que dura cada forma del filo antes de cambiar. */
export const HERVOR = 3;
const CORTE = { amp: 2.2, tramo: 46 };
const FILO = { amp: 2.6, tramo: 7, color: 'rgba(255,255,250,0.92)' };
const SOMBRA: [number, number, number][] = [[7.5, 10.5, 0.06], [5, 7, 0.08], [2.5, 3.5, 0.06]];
const GRANO = { pieza: 0.6, fondo: 0.45, lado: 512 };

/** Lo que se puede apagar por pieza con `papel`. */
export interface OpcionesPapel {
  sombra: boolean;
  filo: boolean;
  grano: boolean;
  /** Multiplica la amplitud del corte (0 = bordes rectos). */
  temblor: number;
}

export function opcionesPapel(n: Nodo): OpcionesPapel | null {
  const p = (n as { papel?: boolean | Partial<OpcionesPapel> }).papel;
  if (p === false) return null;
  const o = typeof p === 'object' ? p : {};
  return { sombra: o.sombra ?? true, filo: o.filo ?? true, grano: o.grano ?? true, temblor: o.temblor ?? 1 };
}

// ------------------------------------------------------------------ azar con semilla

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32: rápido, determinista y igual en cualquier motor de JavaScript. */
export function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ corte

/**
 * Corta los bordes: parte cada lado en tramos de ~`tramo` px y mueve cada punto hacia afuera o adentro
 * (perpendicular al lado) hasta `amp` px.
 */
export function cortar(a: Aplanado, amp: number, tramo: number, r: () => number): Aplanado {
  if (amp <= 0) return a;
  const subtrazos = a.subtrazos.map(({ puntos: p, cerrado }) => {
    const n = p.length / 2;
    const out: number[] = [];
    const lados = n - 1; // en un cerrado, el último punto repite el primero
    for (let i = 0; i < lados; i++) {
      const x0 = p[2 * i]!, y0 = p[2 * i + 1]!, x1 = p[2 * i + 2]!, y1 = p[2 * i + 3]!;
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 1e-6) continue;
      const k = Math.max(1, Math.floor(L / tramo));
      const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let j = 0; j < k; j++) {
        const u = j / k;
        // En la esquina el movimiento es menor, para que no se abra.
        const o = (r() * 2 - 1) * amp * (j === 0 ? 0.6 : 1);
        out.push(x0 + (x1 - x0) * u + nx * o, y0 + (y1 - y0) * u + ny * o);
      }
    }
    if (cerrado && out.length) out.push(out[0]!, out[1]!);
    else if (!cerrado) out.push(p[p.length - 2]!, p[p.length - 1]!);
    return { puntos: out, cerrado };
  });
  return { subtrazos, largo: a.largo };
}

export function trazarAplanado(ctx: Ctx, a: Aplanado): void {
  ctx.beginPath();
  for (const s of a.subtrazos) {
    const p = s.puntos;
    if (p.length < 2) continue;
    ctx.moveTo(p[0]!, p[1]!);
    for (let j = 2; j < p.length; j += 2) ctx.lineTo(p[j]!, p[j + 1]!);
    if (s.cerrado) ctx.closePath();
  }
}

/** Tono fijo por pieza: entre 95.5 % y 104 % del color. */
export function tono(c: RGBA, ruta: string): RGBA {
  const k = 0.955 + azar(hash(ruta) ^ 0x5bd1e995)() * 0.085;
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k), c[3]];
}

// ------------------------------------------------------------------ dibujo de una figura

export interface FiguraPapel {
  ruta: string;
  hervor: number;
  opciones: OpcionesPapel;
  /** Trazado plano de la figura (ya aplanado). */
  aplanado: Aplanado;
  relleno?: RGBA | CanvasGradient;
  regla?: CanvasFillRule;
  grano?: CanvasPattern | null;
  /** La pieza ya trae su propia sombra (`sombra`): no se agrega la del papel. */
  conSombraPropia: boolean;
}

/** Bordes cortados de la figura para este hervor (los usan el relleno y el contorno). */
export function bordes(f: Pick<FiguraPapel, 'ruta' | 'hervor' | 'opciones' | 'aplanado'>): Aplanado {
  const r = azar(hash(f.ruta) * 31 + f.hervor * 104729);
  return cortar(f.aplanado, CORTE.amp * f.opciones.temblor, CORTE.tramo, r);
}

/** Sombra, filo, relleno y grano de una figura rellena. */
export function rellenarPapel(ctx: Ctx, f: FiguraPapel, cortado: Aplanado): void {
  if (f.relleno === undefined) return;
  const regla = f.regla ?? 'nonzero';
  const alfa = ctx.globalAlpha;
  // Un color transparente (vidrio, brillos) no es papel: sombra tenue y sin filo, tono ni grano.
  const alfaColor = Array.isArray(f.relleno) ? f.relleno[3] : 1;
  if (f.opciones.sombra && !f.conSombraPropia) {
    for (const [dx, dy, a] of SOMBRA) {
      ctx.save();
      ctx.translate(dx, dy);
      trazarAplanado(ctx, cortado);
      ctx.fillStyle = `rgba(0,0,0,${a * alfaColor})`;
      ctx.fill(regla);
      ctx.restore();
    }
  }
  // El filo, el tono y el grano solo en piezas que se ven casi enteras (como en papel de verdad).
  const entera = alfa * alfaColor > 0.5;
  if (f.opciones.filo && entera) {
    const r = azar(hash(f.ruta) * 17 + f.hervor * 7919 + 1);
    trazarAplanado(ctx, cortar(cortado, FILO.amp * Math.max(0.3, f.opciones.temblor), FILO.tramo, r));
    ctx.fillStyle = FILO.color;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.fill(regla);
    ctx.restore();
  }
  trazarAplanado(ctx, cortado);
  ctx.fillStyle = Array.isArray(f.relleno) ? colorCss(entera ? tono(f.relleno, f.ruta) : f.relleno) : f.relleno;
  ctx.fill(regla);
  if (f.opciones.grano && entera && f.grano) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = alfa * GRANO.pieza;
    ctx.fillStyle = f.grano;
    ctx.fill(regla);
    ctx.restore();
  }
}

/** Grano sobre todo el fondo de la escena. */
export function granoFondo(ctx: Ctx, grano: CanvasPattern | null | undefined, ancho: number, alto: number): void {
  if (!grano) return;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = GRANO.fondo;
  ctx.fillStyle = grano;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.restore();
}

// ------------------------------------------------------------------ grano

type Lienzo = { getContext(t: '2d'): Ctx | null; width: number; height: number };

/**
 * Textura de papel: ruido fino con fibras horizontales y verticales y manchas grandes, en gris
 * (128 es neutro con luz suave). Siempre la misma (semilla fija).
 */
export function pixelesGrano(lado = GRANO.lado, semilla = 3): Uint8ClampedArray {
  const r = azar(semilla);
  const normal = () => {
    const u = Math.max(1e-12, r()), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const malla = (w: number, h: number) => Float64Array.from({ length: w * h }, normal);
  // Interpolación bilineal de una malla chica, repetida en los bordes (la textura se repite sin costuras).
  const ampliar = (m: Float64Array, w: number, h: number) => (x: number, y: number) => {
    const fx = (x / lado) * w, fy = (y / lado) * h;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), ux = fx - x0, uy = fy - y0;
    const v = (i: number, j: number) => m[((j % h) + h) % h * w + ((i % w) + w) % w]!;
    return (v(x0, y0) * (1 - ux) + v(x0 + 1, y0) * ux) * (1 - uy) + (v(x0, y0 + 1) * (1 - ux) + v(x0 + 1, y0 + 1) * ux) * uy;
  };
  const fino = malla(lado, lado);
  const f1 = ampliar(malla(lado / 16, lado), lado / 16, lado); // fibras horizontales
  const f2 = ampliar(malla(lado, lado / 16), lado, lado / 16); // fibras verticales
  const mancha = ampliar(malla(lado / 64, lado / 64), lado / 64, lado / 64);
  const v = new Float64Array(lado * lado);
  let suma = 0, suma2 = 0;
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const k = y * lado + x;
      const s = fino[k]! * 0.6 + f1(x, y) * 0.22 + f2(x, y) * 0.18 + mancha(x, y) * 0.3;
      v[k] = s; suma += s; suma2 += s * s;
    }
  }
  const media = suma / v.length, desv = Math.sqrt(suma2 / v.length - media * media) || 1;
  const px = new Uint8ClampedArray(lado * lado * 4);
  for (let k = 0; k < v.length; k++) {
    const g = Math.round(128 + ((v[k]! - media) / desv) * 34);
    px[4 * k] = px[4 * k + 1] = px[4 * k + 2] = g;
    px[4 * k + 3] = 255;
  }
  return px;
}

const granos = new WeakMap<object, CanvasPattern | null>();

/** Patrón de grano para este contexto (se hace una vez por lienzo auxiliar). */
export function patronGrano(ctx: Ctx, crearLienzo: ((ancho: number, alto: number) => Lienzo) | undefined): CanvasPattern | null {
  if (!crearLienzo) return null;
  if (granos.has(ctx)) return granos.get(ctx)!;
  let patron: CanvasPattern | null = null;
  try {
    const lado = GRANO.lado;
    const l = crearLienzo(lado, lado);
    const c = l.getContext('2d')!;
    const img = c.createImageData(lado, lado);
    img.data.set(pixelesGrano(lado));
    c.putImageData(img, 0, 0);
    patron = ctx.createPattern(l as unknown as CanvasImageSource, 'repeat');
  } catch {
    patron = null;
  }
  granos.set(ctx, patron);
  return patron;
}
