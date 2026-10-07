import type { Curva } from '@motionai/documento';

const limitar = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Cubic-bezier como en CSS: devuelve y para un x dado. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton y, si no converge, bisección.
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

const golpe = (x: number) => {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};

const NOMBRADAS: Record<Exclude<Curva, number[]>, (x: number) => number> = {
  lineal: (x) => x,
  entrada: (x) => x * x * x,
  salida: (x) => 1 - (1 - x) ** 3,
  'entrada-salida': (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  // Se pasa un poco y regresa.
  rebote: (x) => {
    const s = 1.8;
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
  },
  elastico: (x) => (x === 0 || x === 1 ? x : 2 ** (-10 * x) * Math.sin(((x * 10 - 0.75) * 2 * Math.PI) / 3) + 1),
  // Cae y rebota contra el piso.
  golpe,
};

const cache = new Map<string, (x: number) => number>();

/** Aplica una curva a un avance entre 0 y 1. */
export function suavizar(curva: Curva | undefined, x: number): number {
  x = limitar(x);
  if (!curva) return NOMBRADAS['entrada-salida'](x);
  if (typeof curva === 'string') return NOMBRADAS[curva](x);
  const k = curva.join(',');
  let f = cache.get(k);
  if (!f) cache.set(k, (f = bezier(...curva)));
  return f(x);
}
