/**
 * Trazados SVG normalizados a cinco comandos absolutos (M, L, C, Q, Z).
 * Se dibujan con la API de Canvas en vez de Path2D para que el navegador y Node
 * reciban exactamente las mismas instrucciones, y para poder medir y recortar el trazo.
 */

export type Comando =
  | { c: 'M'; x: number; y: number }
  | { c: 'L'; x: number; y: number }
  | { c: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { c: 'Q'; x1: number; y1: number; x: number; y: number }
  | { c: 'Z' };

export class ErrorTrazado extends Error {}

/** Lee el atributo `d` de un path SVG. */
export function leerTrazado(d: string): Comando[] {
  const s = d;
  let i = 0;
  const espacio = () => {
    while (i < s.length && /[\s,]/.test(s[i]!)) i++;
  };
  const hayNumero = () => {
    espacio();
    return i < s.length && /[0-9+\-.]/.test(s[i]!);
  };
  const numero = (): number => {
    espacio();
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
    if (!m) throw new ErrorTrazado(`Se esperaba un número en la posición ${i} de "${d.slice(0, 40)}…"`);
    i += m[0].length;
    return Number(m[0]);
  };
  const bandera = (): number => {
    espacio();
    const ch = s[i];
    if (ch !== '0' && ch !== '1') throw new ErrorTrazado(`Bandera de arco no válida en la posición ${i}`);
    i++;
    return ch === '1' ? 1 : 0;
  };

  const out: Comando[] = [];
  let cx = 0, cy = 0; // punto actual
  let sx = 0, sy = 0; // inicio del subtrazo
  let px = 0, py = 0; // último punto de control (para S y T)
  let prev = '';
  let cmd = '';

  while (true) {
    espacio();
    if (i >= s.length) break;
    const ch = s[i]!;
    if (/[A-Za-z]/.test(ch)) {
      cmd = ch;
      i++;
    } else if (!cmd) {
      throw new ErrorTrazado(`El trazado debe empezar con un comando: "${d.slice(0, 40)}…"`);
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;

    switch (C) {
      case 'M': {
        cx = ox + numero(); cy = oy + numero();
        sx = cx; sy = cy;
        out.push({ c: 'M', x: cx, y: cy });
        cmd = rel ? 'l' : 'L'; // los pares que siguen a M son líneas
        break;
      }
      case 'L': {
        cx = ox + numero(); cy = oy + numero();
        out.push({ c: 'L', x: cx, y: cy });
        break;
      }
      case 'H': {
        cx = (rel ? cx : 0) + numero();
        out.push({ c: 'L', x: cx, y: cy });
        break;
      }
      case 'V': {
        cy = (rel ? cy : 0) + numero();
        out.push({ c: 'L', x: cx, y: cy });
        break;
      }
      case 'C': {
        const x1 = ox + numero(), y1 = oy + numero(), x2 = ox + numero(), y2 = oy + numero();
        cx = ox + numero(); cy = oy + numero();
        out.push({ c: 'C', x1, y1, x2, y2, x: cx, y: cy });
        px = x2; py = y2;
        break;
      }
      case 'S': {
        const [x1, y1] = /[CS]/.test(prev) ? [2 * cx - px, 2 * cy - py] : [cx, cy];
        const x2 = ox + numero(), y2 = oy + numero();
        cx = ox + numero(); cy = oy + numero();
        out.push({ c: 'C', x1, y1, x2, y2, x: cx, y: cy });
        px = x2; py = y2;
        break;
      }
      case 'Q': {
        const x1 = ox + numero(), y1 = oy + numero();
        cx = ox + numero(); cy = oy + numero();
        out.push({ c: 'Q', x1, y1, x: cx, y: cy });
        px = x1; py = y1;
        break;
      }
      case 'T': {
        const [x1, y1] = /[QT]/.test(prev) ? [2 * cx - px, 2 * cy - py] : [cx, cy];
        cx = ox + numero(); cy = oy + numero();
        out.push({ c: 'Q', x1, y1, x: cx, y: cy });
        px = x1; py = y1;
        break;
      }
      case 'A': {
        const rx = numero(), ry = numero(), rot = numero();
        const grande = bandera(), barrido = bandera();
        const x = ox + numero(), y = oy + numero();
        out.push(...arcoABezier(cx, cy, rx, ry, rot, grande, barrido, x, y));
        cx = x; cy = y;
        break;
      }
      case 'Z': {
        out.push({ c: 'Z' });
        cx = sx; cy = sy;
        break;
      }
      default:
        throw new ErrorTrazado(`Comando de trazado no soportado: "${cmd}"`);
    }
    prev = C;
    // Si siguen números sin letra, se repite el mismo comando (regla de SVG).
    if (C === 'Z' && hayNumero()) throw new ErrorTrazado('Hay números después de Z sin un comando');
  }
  return out;
}

/** Convierte un arco elíptico SVG en curvas de Bézier (algoritmo de la especificación SVG, F.6). */
function arcoABezier(
  x1: number, y1: number, rx: number, ry: number, rotGrados: number,
  grande: number, barrido: number, x2: number, y2: number,
): Comando[] {
  if (rx === 0 || ry === 0) return [{ c: 'L', x: x2, y: y2 }];
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (rotGrados * Math.PI) / 180;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (grande === barrido) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!barrido && dt > 0) dt -= 2 * Math.PI;
  if (barrido && dt < 0) dt += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9);
  const seg = dt / n;
  const k = (4 / 3) * Math.tan(seg / 4);
  const out: Comando[] = [];
  let a = t1;
  const punto = (t: number) => {
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy] as const;
  };
  const derivada = (t: number) => {
    const ex = -rx * Math.sin(t), ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey] as const;
  };
  for (let j = 0; j < n; j++) {
    const b = a + seg;
    const [p0x, p0y] = punto(a), [p3x, p3y] = punto(b);
    const [d0x, d0y] = derivada(a), [d3x, d3y] = derivada(b);
    out.push({
      c: 'C',
      x1: p0x + k * d0x, y1: p0y + k * d0y,
      x2: p3x - k * d3x, y2: p3y - k * d3y,
      x: j === n - 1 ? x2 : p3x, y: j === n - 1 ? y2 : p3y,
    });
    a = b;
  }
  return out;
}

/** Rectángulo con esquinas redondeadas como trazado. */
export function trazadoRect(w: number, h: number, r = 0): Comando[] {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r === 0) {
    return [
      { c: 'M', x: 0, y: 0 }, { c: 'L', x: w, y: 0 }, { c: 'L', x: w, y: h }, { c: 'L', x: 0, y: h }, { c: 'Z' },
    ];
  }
  const k = r * 0.5522847498; // distancia de control para un cuarto de círculo
  return [
    { c: 'M', x: r, y: 0 },
    { c: 'L', x: w - r, y: 0 },
    { c: 'C', x1: w - r + k, y1: 0, x2: w, y2: r - k, x: w, y: r },
    { c: 'L', x: w, y: h - r },
    { c: 'C', x1: w, y1: h - r + k, x2: w - r + k, y2: h, x: w - r, y: h },
    { c: 'L', x: r, y: h },
    { c: 'C', x1: r - k, y1: h, x2: 0, y2: h - r + k, x: 0, y: h - r },
    { c: 'L', x: 0, y: r },
    { c: 'C', x1: 0, y1: r - k, x2: r - k, y2: 0, x: r, y: 0 },
    { c: 'Z' },
  ];
}

/** Elipse inscrita en el rectángulo (0, 0, w, h), empezando arriba y en el sentido del reloj. */
export function trazadoElipse(w: number, h: number): Comando[] {
  const rx = w / 2, ry = h / 2, kx = rx * 0.5522847498, ky = ry * 0.5522847498;
  return [
    { c: 'M', x: rx, y: 0 },
    { c: 'C', x1: rx + kx, y1: 0, x2: w, y2: ry - ky, x: w, y: ry },
    { c: 'C', x1: w, y1: ry + ky, x2: rx + kx, y2: h, x: rx, y: h },
    { c: 'C', x1: rx - kx, y1: h, x2: 0, y2: ry + ky, x: 0, y: ry },
    { c: 'C', x1: 0, y1: ry - ky, x2: rx - kx, y2: 0, x: rx, y: 0 },
    { c: 'Z' },
  ];
}

/** Manda los comandos al contexto. */
export function trazar(ctx: CanvasRenderingContext2D, cmds: readonly Comando[]): void {
  ctx.beginPath();
  for (const k of cmds) {
    switch (k.c) {
      case 'M': ctx.moveTo(k.x, k.y); break;
      case 'L': ctx.lineTo(k.x, k.y); break;
      case 'C': ctx.bezierCurveTo(k.x1, k.y1, k.x2, k.y2, k.x, k.y); break;
      case 'Q': ctx.quadraticCurveTo(k.x1, k.y1, k.x, k.y); break;
      case 'Z': ctx.closePath(); break;
    }
  }
}

/** Polilíneas que aproximan el trazado, con su largo acumulado. */
export interface Aplanado {
  subtrazos: { puntos: number[]; cerrado: boolean }[]; // puntos: x0, y0, x1, y1…
  largo: number;
}

export function aplanar(cmds: readonly Comando[]): Aplanado {
  const subtrazos: Aplanado['subtrazos'] = [];
  let actual: number[] | null = null;
  let cx = 0, cy = 0, sx = 0, sy = 0;
  const pasos = (largoAprox: number) => Math.max(4, Math.min(64, Math.ceil(largoAprox / 6)));
  const asegurar = () => {
    if (!actual) { actual = [cx, cy]; subtrazos.push({ puntos: actual, cerrado: false }); }
    return actual;
  };
  for (const k of cmds) {
    if (k.c === 'M') {
      actual = [k.x, k.y];
      subtrazos.push({ puntos: actual, cerrado: false });
      cx = sx = k.x; cy = sy = k.y;
    } else if (k.c === 'L') {
      asegurar().push(k.x, k.y);
      cx = k.x; cy = k.y;
    } else if (k.c === 'C') {
      const p = asegurar();
      const n = pasos(Math.hypot(k.x1 - cx, k.y1 - cy) + Math.hypot(k.x2 - k.x1, k.y2 - k.y1) + Math.hypot(k.x - k.x2, k.y - k.y2));
      for (let j = 1; j <= n; j++) {
        const u = j / n, v = 1 - u;
        p.push(
          v * v * v * cx + 3 * v * v * u * k.x1 + 3 * v * u * u * k.x2 + u * u * u * k.x,
          v * v * v * cy + 3 * v * v * u * k.y1 + 3 * v * u * u * k.y2 + u * u * u * k.y,
        );
      }
      cx = k.x; cy = k.y;
    } else if (k.c === 'Q') {
      const p = asegurar();
      const n = pasos(Math.hypot(k.x1 - cx, k.y1 - cy) + Math.hypot(k.x - k.x1, k.y - k.y1));
      for (let j = 1; j <= n; j++) {
        const u = j / n, v = 1 - u;
        p.push(v * v * cx + 2 * v * u * k.x1 + u * u * k.x, v * v * cy + 2 * v * u * k.y1 + u * u * k.y);
      }
      cx = k.x; cy = k.y;
    } else {
      if (actual) {
        (actual as number[]).push(sx, sy);
        subtrazos[subtrazos.length - 1]!.cerrado = true;
      }
      actual = null;
      cx = sx; cy = sy;
    }
  }
  let largo = 0;
  for (const s of subtrazos) {
    for (let j = 2; j < s.puntos.length; j += 2) {
      largo += Math.hypot(s.puntos[j]! - s.puntos[j - 2]!, s.puntos[j + 1]! - s.puntos[j - 1]!);
    }
  }
  return { subtrazos, largo };
}

/** Caja que contiene el trazado: [x0, y0, x1, y1]. */
export function limitesTrazado(a: Aplanado): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of a.subtrazos) {
    for (let j = 0; j < s.puntos.length; j += 2) {
      const x = s.puntos[j]!, y = s.puntos[j + 1]!;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return Number.isFinite(x0) ? [x0, y0, x1, y1] : [0, 0, 0, 0];
}

/** Traza solo la fracción `f` del largo total, en el orden del trazado. */
export function trazarParcial(ctx: CanvasRenderingContext2D, a: Aplanado, f: number): void {
  ctx.beginPath();
  let resta = a.largo * Math.max(0, Math.min(1, f));
  for (const s of a.subtrazos) {
    if (resta <= 0) break;
    const p = s.puntos;
    ctx.moveTo(p[0]!, p[1]!);
    for (let j = 2; j < p.length; j += 2) {
      const seg = Math.hypot(p[j]! - p[j - 2]!, p[j + 1]! - p[j - 1]!);
      if (seg >= resta) {
        const u = seg === 0 ? 0 : resta / seg;
        ctx.lineTo(p[j - 2]! + (p[j]! - p[j - 2]!) * u, p[j - 1]! + (p[j + 1]! - p[j - 1]!) * u);
        resta = 0;
        break;
      }
      ctx.lineTo(p[j]!, p[j + 1]!);
      resta -= seg;
    }
  }
}
