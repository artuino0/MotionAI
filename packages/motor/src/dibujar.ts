import type { Contorno, Degradado, Nodo, Relleno } from '@motionai/documento';
import { estado, medir, type Estado, type Medio } from './animar.js';
import { colorCss, leerColor } from './color.js';
import type { EscenaPreparada, Escenario, NodoPreparado } from './preparar.js';
import { dibujarSubtitulos } from './subtitulos.js';
import { aplanar, limitesTrazado, trazadoElipse, trazadoRect, trazar, trazarParcial, type Aplanado, type Comando } from './svg.js';
import { bajadaDesdeCentro, fuenteCss, renglones } from './texto.js';

type Ctx = CanvasRenderingContext2D;
type Caja = [x0: number, y0: number, x1: number, y1: number];

/** Lo que el motor necesita del ambiente donde corre (navegador o Node). */
export interface Entorno {
  /** Imagen ya cargada de `recursos/`, o nada si no está. */
  imagen(archivo: string): CanvasImageSource | null | undefined;
}

export interface OpcionesCuadro {
  subtitulos?: boolean;
}

/** Escena que se ve en el segundo `t`. */
export function escenaEn(esc: Escenario, t: number): EscenaPreparada | undefined {
  for (let i = esc.escenas.length - 1; i >= 0; i--) {
    const e = esc.escenas[i]!;
    if (t >= e.inicio && (t < e.fin || (t === e.fin && i === esc.escenas.length - 1))) return e;
  }
  return undefined;
}

export const totalCuadros = (esc: Escenario) => Math.max(1, Math.round(esc.duracion * esc.fps));
export const tiempoDeCuadro = (esc: Escenario, i: number) => i / esc.fps;

/** Dibuja el cuadro del segundo `t` en un contexto del tamaño del lienzo. */
export function dibujarCuadro(ctx: Ctx, esc: Escenario, t: number, entorno: Entorno, op: OpcionesCuadro = {}): void {
  const lienzo = { ancho: esc.ancho, alto: esc.alto };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, lienzo.ancho, lienzo.alto);

  const escena = escenaEn(esc, t);
  ctx.fillStyle = estiloRelleno(ctx, escena?.escena.fondo ?? esc.proyecto.ajustes.fondo);
  ctx.fillRect(0, 0, lienzo.ancho, lienzo.alto);

  if (escena) {
    const m: Medio = { contenedor: lienzo, lienzo };
    for (const np of escena.hijos) dibujarNodo(ctx, np, t, m, entorno);
  }
  if (op.subtitulos !== false) dibujarSubtitulos(ctx, esc, t);
  ctx.restore();
}

function dibujarNodo(ctx: Ctx, np: NodoPreparado, t: number, m: Medio, entorno: Entorno): void {
  const s = estado(np, t, m);
  if (!s.visible || s.opacidad <= 0 || s.escalaX === 0 || s.escalaY === 0) return;
  const n = np.nodo;
  const caja = limitesLocales(ctx, np, m);
  const [ax, ay] = puntoAncla(n, caja);

  ctx.save();
  ctx.translate(s.x, s.y);
  if (s.rotacion) ctx.rotate((s.rotacion * Math.PI) / 180);
  if (s.escalaX !== 1 || s.escalaY !== 1) ctx.scale(s.escalaX, s.escalaY);
  ctx.translate(-ax, -ay);
  ctx.globalAlpha *= s.opacidad;
  if (n.sombra) {
    ctx.shadowColor = colorCss(leerColor(n.sombra.color));
    ctx.shadowBlur = n.sombra.desenfoque ?? 0;
    ctx.shadowOffsetX = n.sombra.x ?? 0;
    ctx.shadowOffsetY = n.sombra.y ?? 0;
  }
  if (s.revelar < 1) {
    if (s.revelar <= 0) { ctx.restore(); return; }
    // Recorta de izquierda a derecha, con margen para contornos y sombras.
    const margen = 200;
    ctx.beginPath();
    ctx.rect(caja[0] - margen, caja[1] - margen, (caja[2] - caja[0]) * s.revelar + margen, caja[3] - caja[1] + 2 * margen);
    ctx.clip();
  }

  switch (n.tipo) {
    case 'rect': {
      const w = medir(n.ancho, m.contenedor.ancho), h = medir(n.alto, m.contenedor.alto);
      const cmds = memo(np, `rect:${w}:${h}:${n.radio ?? 0}`, () => trazadoRect(w, h, n.radio ?? 0));
      dibujarForma(ctx, np, cmds, n, s);
      break;
    }
    case 'elipse': {
      const w = medir(n.ancho, m.contenedor.ancho), h = medir(n.alto, m.contenedor.alto);
      const cmds = memo(np, `elipse:${w}:${h}`, () => trazadoElipse(w, h));
      dibujarForma(ctx, np, cmds, n, s);
      break;
    }
    case 'trazo':
      dibujarForma(ctx, np, np.trazado!, n, s);
      break;
    case 'texto':
      dibujarTexto(ctx, np, n, s);
      break;
    case 'imagen': {
      const img = entorno.imagen(n.archivo);
      if (img) ctx.drawImage(img, 0, 0, medir(n.ancho, m.contenedor.ancho), medir(n.alto, m.contenedor.alto));
      break;
    }
    case 'grupo': {
      const cont = contenedorDeGrupo(n, m);
      if (n.recortar) {
        ctx.beginPath();
        ctx.rect(0, 0, cont.ancho, cont.alto);
        ctx.clip();
      }
      const mh: Medio = { contenedor: cont, lienzo: m.lienzo };
      for (const h of np.hijos) dibujarNodo(ctx, h, t, mh, entorno);
      break;
    }
    case 'instancia':
      for (const h of np.hijos) dibujarNodo(ctx, h, t, m, entorno);
      break;
  }
  ctx.restore();
}

function contenedorDeGrupo(n: Extract<Nodo, { tipo: 'grupo' }>, m: Medio) {
  return {
    ancho: n.ancho !== undefined ? medir(n.ancho, m.contenedor.ancho) : m.contenedor.ancho,
    alto: n.alto !== undefined ? medir(n.alto, m.contenedor.alto) : m.contenedor.alto,
  };
}

function memo<T>(np: NodoPreparado, clave: string, f: () => T): T {
  if (np.memo.has(clave)) return np.memo.get(clave) as T;
  const v = f();
  np.memo.set(clave, v);
  return v;
}

function estiloRelleno(ctx: Ctx, r: Relleno): string | CanvasGradient {
  if (typeof r === 'string') return colorCss(leerColor(r));
  return degradado(ctx, r);
}

function degradado(ctx: Ctx, d: Degradado): CanvasGradient {
  const g =
    d.tipo === 'lineal'
      ? ctx.createLinearGradient(d.de[0], d.de[1], (d.a ?? d.de)[0], (d.a ?? d.de)[1])
      : ctx.createRadialGradient(d.de[0], d.de[1], 0, d.de[0], d.de[1], d.radio ?? 100);
  for (const [pos, color] of d.paradas) g.addColorStop(pos, colorCss(leerColor(color)));
  return g;
}

const UNION: Record<NonNullable<Contorno['union']>, CanvasLineJoin> = { redonda: 'round', recta: 'miter', biselada: 'bevel' };
const EXTREMO: Record<NonNullable<Contorno['extremo']>, CanvasLineCap> = { redondo: 'round', plano: 'butt', cuadrado: 'square' };

function prepararContorno(ctx: Ctx, c: Contorno, color?: string) {
  ctx.lineWidth = c.ancho;
  ctx.lineJoin = UNION[c.union ?? 'redonda'];
  ctx.lineCap = EXTREMO[c.extremo ?? 'redondo'];
  ctx.setLineDash(c.guiones ?? []);
  ctx.strokeStyle = color ?? colorCss(leerColor(c.color));
}

function dibujarForma(
  ctx: Ctx,
  np: NodoPreparado,
  cmds: readonly Comando[],
  n: Extract<Nodo, { tipo: 'rect' | 'elipse' | 'trazo' }>,
  s: Estado,
): void {
  const relleno = s.relleno ? colorCss(s.relleno) : n.relleno !== undefined ? estiloRelleno(ctx, n.relleno) : undefined;
  if (relleno !== undefined) {
    // Mientras se dibuja el contorno, el relleno aparece al final.
    const f = s.trazo >= 1 ? 1 : Math.max(0, (s.trazo - 0.7) / 0.3);
    if (f > 0) {
      const alfa = ctx.globalAlpha;
      ctx.globalAlpha = alfa * f;
      trazar(ctx, cmds);
      ctx.fillStyle = relleno;
      ctx.fill(n.tipo === 'trazo' ? (n.reglaRelleno ?? 'nonzero') : 'nonzero');
      ctx.globalAlpha = alfa;
    }
  }
  if (n.contorno && n.contorno.ancho > 0 && s.trazo > 0) {
    ctx.save();
    if (relleno !== undefined) ctx.shadowColor = 'rgba(0,0,0,0)'; // la sombra ya salió con el relleno
    prepararContorno(ctx, n.contorno, s.contorno ? colorCss(s.contorno) : undefined);
    if (s.trazo >= 1) trazar(ctx, cmds);
    else trazarParcial(ctx, memo<Aplanado>(np, `aplanado:${cmds.length}`, () => np.aplanado ?? aplanar(cmds)), s.trazo);
    ctx.stroke();
    ctx.restore();
  }
}

function dibujarTexto(ctx: Ctx, np: NodoPreparado, n: Extract<Nodo, { tipo: 'texto' }>, s: Estado): void {
  const { lineas, ancho, alto } = medidasTexto(ctx, np, n);
  const lh = n.tamano * (n.interlineado ?? 1.2);
  ctx.font = fuenteCss(n);
  ctx.textBaseline = 'alphabetic';
  const bajada = bajadaDesdeCentro(ctx);
  const alin = n.alineacion ?? 'izq';
  ctx.textAlign = alin === 'izq' ? 'left' : alin === 'centro' ? 'center' : 'right';
  const x = alin === 'izq' ? 0 : alin === 'centro' ? ancho / 2 : ancho;
  void alto;

  let quedan = Number.POSITIVE_INFINITY;
  if (s.caracteres < 1) {
    const total = lineas.reduce((a, l) => a + [...l].length, 0);
    quedan = Math.round(total * Math.max(0, s.caracteres));
  }
  const visibles = lineas.map((l) => {
    const cs = [...l];
    const v = cs.slice(0, Math.max(0, quedan)).join('');
    quedan -= cs.length;
    return v;
  });

  if (n.contorno && n.contorno.ancho > 0) {
    ctx.save();
    prepararContorno(ctx, n.contorno, s.contorno ? colorCss(s.contorno) : undefined);
    ctx.lineJoin = 'round';
    visibles.forEach((l, i) => l && ctx.strokeText(l, x, i * lh + lh / 2 + bajada));
    ctx.restore();
    ctx.shadowColor = 'rgba(0,0,0,0)';
  }
  ctx.fillStyle = s.relleno ? colorCss(s.relleno) : colorCss(leerColor(n.relleno ?? '#000000'));
  visibles.forEach((l, i) => l && ctx.fillText(l, x, i * lh + lh / 2 + bajada));
}

function medidasTexto(ctx: Ctx, np: NodoPreparado, n: Extract<Nodo, { tipo: 'texto' }>) {
  return memo(np, `texto:${n.texto}`, () => {
    ctx.save();
    ctx.font = fuenteCss(n);
    const lineas = renglones(ctx, n.texto, n.anchoMax);
    const ancho = n.anchoMax ?? Math.max(0, ...lineas.map((l) => ctx.measureText(l).width));
    ctx.restore();
    return { lineas, ancho, alto: lineas.length * n.tamano * (n.interlineado ?? 1.2) };
  });
}

/** Caja de la pieza en sus propias coordenadas, sin transformar. */
function limitesLocales(ctx: Ctx, np: NodoPreparado, m: Medio): Caja {
  const n = np.nodo;
  return memo(np, `caja:${m.contenedor.ancho}:${m.contenedor.alto}`, (): Caja => {
    switch (n.tipo) {
      case 'rect':
      case 'elipse':
      case 'imagen':
        return [0, 0, medir(n.ancho, m.contenedor.ancho), medir(n.alto, m.contenedor.alto)];
      case 'trazo':
        return limitesTrazado(np.aplanado!);
      case 'texto': {
        const { ancho, alto } = medidasTexto(ctx, np, n);
        return [0, 0, ancho, alto];
      }
      case 'grupo': {
        if (n.ancho !== undefined && n.alto !== undefined) {
          const c = contenedorDeGrupo(n, m);
          return [0, 0, c.ancho, c.alto];
        }
        const mh: Medio = { contenedor: contenedorDeGrupo(n, m), lienzo: m.lienzo };
        return unir(np.hijos.map((h) => limitesEnPadre(ctx, h, mh)));
      }
      case 'instancia':
        return unir(np.hijos.map((h) => limitesEnPadre(ctx, h, m)));
    }
  });
}

/** Caja de la pieza en las coordenadas de su contenedor, con su transformación sin animar. */
function limitesEnPadre(ctx: Ctx, np: NodoPreparado, m: Medio): Caja {
  const n = np.nodo;
  const c = limitesLocales(ctx, np, m);
  const [ax, ay] = puntoAncla(n, c);
  const e = n.escala ?? 1;
  const sx = (n.escalaX ?? 1) * e, sy = (n.escalaY ?? 1) * e;
  const r = ((n.rotacion ?? 0) * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  const x = medir(n.x, m.contenedor.ancho), y = medir(n.y, m.contenedor.alto);
  const esquinas: [number, number][] = [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]];
  const pts = esquinas.map(([px, py]) => {
    const lx = (px - ax) * sx, ly = (py - ay) * sy;
    return [x + lx * cos - ly * sin, y + lx * sin + ly * cos] as const;
  });
  return [
    Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])),
    Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])),
  ];
}

function unir(cajas: Caja[]): Caja {
  if (!cajas.length) return [0, 0, 0, 0];
  return [
    Math.min(...cajas.map((c) => c[0])), Math.min(...cajas.map((c) => c[1])),
    Math.max(...cajas.map((c) => c[2])), Math.max(...cajas.map((c) => c[3])),
  ];
}

function puntoAncla(n: Nodo, c: Caja): [number, number] {
  const a = n.ancla;
  if (a === undefined) return [0, 0];
  if (Array.isArray(a)) return a;
  const fx = a.endsWith('izq') ? 0 : a.endsWith('der') ? 1 : 0.5;
  const fy = a.startsWith('arriba') ? 0 : a.startsWith('abajo') ? 1 : 0.5;
  return [c[0] + (c[2] - c[0]) * fx, c[1] + (c[3] - c[1]) * fy];
}
