import type { Medida, Propiedad } from '@motionai/documento';
import { mezclarColor, type RGBA } from './color.js';
import { suavizar } from './curvas.js';
import type { KeyResuelto, NodoPreparado } from './preparar.js';

/** Propiedades de una pieza en un instante, ya con keyframes, entrada, salida y ciclos. */
export interface Estado {
  visible: boolean;
  x: number;
  y: number;
  escalaX: number;
  escalaY: number;
  rotacion: number;
  opacidad: number;
  relleno?: RGBA;
  contorno?: RGBA;
  trazo: number;
  revelar: number;
  caracteres: number;
}

export interface Medio {
  /** Tamaño del contenedor, para resolver porcentajes. */
  contenedor: { ancho: number; alto: number };
  /** Tamaño del lienzo, para las distancias de las entradas y salidas. */
  lienzo: { ancho: number; alto: number };
}

export function medir(m: Medida | string | undefined, ref: number): number {
  if (m === undefined) return 0;
  if (typeof m === 'number') return m;
  return (parseFloat(m) / 100) * ref;
}

function valorEn(keys: KeyResuelto[], t: number, ref: number): number | RGBA {
  const conv = (v: KeyResuelto['v']) => (typeof v === 'string' ? medir(v, ref) : v);
  if (t <= keys[0]!.t) return conv(keys[0]!.v);
  const ultimo = keys[keys.length - 1]!;
  if (t >= ultimo.t) return conv(ultimo.v);
  let i = 1;
  while (keys[i]!.t < t) i++;
  const a = keys[i - 1]!, b = keys[i]!;
  const u = b.t === a.t ? 1 : suavizar(b.curva, (t - a.t) / (b.t - a.t));
  const va = conv(a.v), vb = conv(b.v);
  if (typeof va === 'number' && typeof vb === 'number') return va + (vb - va) * u;
  return mezclarColor(va as RGBA, vb as RGBA, u);
}

const num = (np: NodoPreparado, p: Propiedad, t: number, base: number, ref = 0): number => {
  const k = np.pistas[p];
  return k ? (valorEn(k, t, ref) as number) : base;
};

export function estado(np: NodoPreparado, t: number, m: Medio): Estado {
  const n = np.nodo;
  const { contenedor, lienzo } = m;
  const escala = num(np, 'escala', t, n.escala ?? 1);
  const s: Estado = {
    visible: n.visible !== false,
    x: num(np, 'x', t, medir(n.x, contenedor.ancho), contenedor.ancho),
    y: num(np, 'y', t, medir(n.y, contenedor.alto), contenedor.alto),
    escalaX: num(np, 'escalaX', t, n.escalaX ?? 1) * escala,
    escalaY: num(np, 'escalaY', t, n.escalaY ?? 1) * escala,
    rotacion: num(np, 'rotacion', t, n.rotacion ?? 0),
    opacidad: num(np, 'opacidad', t, n.opacidad ?? 1),
    trazo: num(np, 'trazo', t, 1),
    revelar: num(np, 'revelar', t, 1),
    caracteres: num(np, 'caracteres', t, 1),
  };
  if (np.pistas.relleno) s.relleno = valorEn(np.pistas.relleno, t, 0) as RGBA;
  if (np.pistas.contorno) s.contorno = valorEn(np.pistas.contorno, t, 0) as RGBA;

  // Entrada: antes de entrar la pieza no se ve.
  const e = np.entra;
  if (e) {
    if (t < e.en) s.visible = false;
    else if (e.dur > 0 && t < e.en + e.dur) {
      const u = (t - e.en) / e.dur;
      const k = suavizar(e.curva, u);
      const lineal = Math.min(1, Math.max(0, u));
      switch (e.tipo) {
        case 'aparece': s.opacidad *= k; break;
        case 'pop': s.escalaX *= k; s.escalaY *= k; s.opacidad *= Math.min(1, lineal * 4); break;
        case 'crece': s.escalaX *= k; s.escalaY *= k; break;
        case 'cae': s.y -= (1 - k) * lienzo.alto * 0.45; break;
        case 'sube': s.y += (1 - k) * lienzo.alto * 0.06; s.opacidad *= Math.min(1, lineal * 2); break;
        case 'desliza-izq': s.x -= (1 - k) * lienzo.ancho * 0.8; break;
        case 'desliza-der': s.x += (1 - k) * lienzo.ancho * 0.8; break;
        case 'dibuja':
          if (tieneContorno(np)) s.trazo *= k;
          else s.revelar *= k;
          break;
        case 'escribe':
          if (n.tipo === 'texto') s.caracteres *= k;
          else s.revelar *= k;
          break;
      }
    }
  }

  // Salida: después de salir la pieza no se ve.
  const x = np.sale;
  if (x) {
    const fin = x.en + x.dur;
    if (t >= fin) s.visible = false;
    else if (t >= x.en && x.dur > 0) {
      const u = (t - x.en) / x.dur;
      const k = suavizar(x.curva, u); // de 0 a 1 mientras sale
      switch (x.tipo) {
        case 'desaparece': s.opacidad *= 1 - k; break;
        case 'pop': {
          // Se infla un poco y desaparece.
          const g = 1 + 0.15 * Math.sin(Math.min(1, u) * Math.PI) - k;
          s.escalaX *= Math.max(0, g); s.escalaY *= Math.max(0, g);
          break;
        }
        case 'encoge': s.escalaX *= 1 - k; s.escalaY *= 1 - k; break;
        case 'cae': s.y += k * lienzo.alto * 0.6; s.opacidad *= 1 - Math.max(0, (u - 0.6) / 0.4); break;
        case 'sube': s.y -= k * lienzo.alto * 0.06; s.opacidad *= 1 - k; break;
        case 'desliza-izq': s.x -= k * lienzo.ancho * 0.8; break;
        case 'desliza-der': s.x += k * lienzo.ancho * 0.8; break;
        case 'corta': break;
      }
    }
  }

  for (const c of np.ciclos) {
    if (t < c.desde || t >= c.hasta) continue;
    const fase = ((t - c.desde) / c.periodo) * 2 * Math.PI;
    switch (c.tipo) {
      case 'flota': s.y += c.amplitud * Math.sin(fase); break;
      case 'late': {
        const g = 1 + c.amplitud * (0.5 - 0.5 * Math.cos(fase));
        s.escalaX *= g; s.escalaY *= g;
        break;
      }
      case 'mece': s.rotacion += c.amplitud * Math.sin(fase); break;
      case 'gira': s.rotacion += (c.amplitud * (t - c.desde)) / c.periodo; break;
    }
  }

  s.opacidad = Math.min(1, Math.max(0, s.opacidad));
  return s;
}

function tieneContorno(np: NodoPreparado): boolean {
  const n = np.nodo;
  return (n.tipo === 'trazo' || n.tipo === 'rect' || n.tipo === 'elipse') && !!n.contorno;
}
