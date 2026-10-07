/// <reference path="./color-name.d.ts" />
/**
 * Importador de SVG. Convierte un dibujo en un componente: un grupo del tamaño del viewBox con un trazo
 * por figura. Las transformaciones se aplican a las coordenadas (así funciona cualquier matrix), los
 * estilos salen de atributos, `style` y reglas simples de `<style>`, y los degradados lineales y
 * radiales pasan a degradados de MotionAI. Lo que no se puede traer (máscaras, filtros, patrones)
 * se reporta como aviso.
 */
import { XMLParser } from 'fast-xml-parser';
import colores from 'color-name';
import type { Componente, Contorno, Degradado, Nodo, Relleno } from '@motionai/documento';
import { aplanar, leerTrazado, limitesTrazado, type Comando } from '@motionai/motor';

type Matriz = [number, number, number, number, number, number]; // a b c d e f
const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0];
const multiplicar = (m: Matriz, n: Matriz): Matriz => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const aplicar = (m: Matriz, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const r2 = (n: number) => Math.round(n * 100) / 100;

function leerTransform(t: string | undefined): Matriz {
  let m = IDENTIDAD;
  if (!t) return m;
  for (const [, fn, args] of t.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = args!.split(/[\s,]+/).filter(Boolean).map(Number);
    let n: Matriz = IDENTIDAD;
    switch (fn) {
      case 'matrix': n = v.slice(0, 6) as Matriz; break;
      case 'translate': n = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0]; break;
      case 'scale': n = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const a = ((v[0] ?? 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
        const [cx, cy] = [v[1] ?? 0, v[2] ?? 0];
        n = multiplicar(multiplicar([1, 0, 0, 1, cx, cy], [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
        break;
      }
      case 'skewX': n = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': n = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
    }
    m = multiplicar(m, n);
  }
  return m;
}

/** Color CSS a #RRGGBB o #RRGGBBAA. */
export function colorCss(valor: string | undefined, opacidad = 1): string | undefined {
  if (!valor) return undefined;
  const v = valor.trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return undefined;
  let rgb: number[] | undefined;
  let a = 1;
  if (/^#[0-9a-f]{3,8}$/.test(v)) {
    let h = v.slice(1);
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else if (v.startsWith('rgb')) {
    const n = v.match(/[\d.]+%?/g)?.map((x) => (x.endsWith('%') ? (parseFloat(x) * 2.55) : parseFloat(x))) ?? [];
    rgb = n.slice(0, 3);
    if (n[3] !== undefined) a = v.match(/[\d.]+%?/g)![3]!.endsWith('%') ? n[3] / 255 : n[3];
  } else if (v.startsWith('hsl')) {
    const [h = 0, s = 0, l = 0, al] = (v.match(/[\d.]+/g) ?? []).map(Number);
    const k = (n: number) => (n + h / 30) % 12, sa = s / 100, li = l / 100;
    const f = (n: number) => li - sa * Math.min(li, 1 - li) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    rgb = [f(0) * 255, f(8) * 255, f(4) * 255];
    if (al !== undefined) a = al;
  } else if (v in colores) rgb = (colores as Record<string, number[]>)[v];
  if (!rgb) return undefined;
  a *= opacidad;
  const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0').toUpperCase();
  return `#${rgb.map(hex).join('')}${a < 0.999 ? hex(a * 255) : ''}`;
}

interface Elemento { tag: string; attrs: Record<string, string>; hijos: Elemento[]; texto: string }

function leerXml(texto: string): Elemento {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true, trimValues: false, parseAttributeValue: false });
  const convertir = (n: Record<string, unknown>): Elemento | undefined => {
    const tag = Object.keys(n).find((k) => k !== ':@');
    if (!tag) return undefined;
    const attrs = (n[':@'] as Record<string, string>) ?? {};
    const contenido = n[tag] as Record<string, unknown>[] | string;
    if (tag === '#text') return { tag, attrs: {}, hijos: [], texto: String(contenido) };
    const hijos = Array.isArray(contenido) ? contenido.map(convertir).filter((x): x is Elemento => !!x) : [];
    return { tag: tag.replace(/^svg:/, ''), attrs, hijos, texto: hijos.filter((h) => h.tag === '#text').map((h) => h.texto).join('') };
  };
  const raiz = (parser.parse(texto) as Record<string, unknown>[]).map(convertir).find((e) => e?.tag === 'svg');
  if (!raiz) throw new Error('No parece un SVG: no tiene un elemento <svg>.');
  return raiz;
}

/** Reglas simples de <style>: selectores de clase, etiqueta o id, separados por comas. */
function leerCss(css: string): { selector: string; decl: Record<string, string> }[] {
  const reglas: { selector: string; decl: Record<string, string> }[] = [];
  for (const [, sel, cuerpo] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const decl = leerDeclaraciones(cuerpo!);
    for (const s of sel!.split(',')) reglas.push({ selector: s.trim(), decl });
  }
  return reglas;
}
const leerDeclaraciones = (s: string) =>
  Object.fromEntries(s.split(';').map((d) => d.split(':').map((x) => x.trim())).filter((d) => d.length >= 2 && d[0]).map(([k, ...v]) => [k!, v.join(':')]));

const HEREDABLES = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'visibility'];

export interface ImportacionSvg {
  componente: Componente;
  avisos: string[];
}

export function componenteDeSvg(texto: string, op: { id: string; nombre: string; tipo?: string; fuentes?: string[] }): ImportacionSvg {
  const svg = leerXml(texto);
  const avisos = new Set<string>();
  const css = leerCss(buscar(svg, 'style').map((s) => s.texto).join('\n'));
  const porId = new Map<string, Elemento>();
  const indexar = (e: Elemento) => { if (e.attrs.id) porId.set(e.attrs.id, e); e.hijos.forEach(indexar); };
  indexar(svg);

  const vb = (svg.attrs.viewBox ?? svg.attrs.viewbox)?.split(/[\s,]+/).map(Number);
  const ancho = vb?.[2] ?? parseFloat(svg.attrs.width ?? '100');
  const alto = vb?.[3] ?? parseFloat(svg.attrs.height ?? '100');
  const origen: Matriz = vb ? [1, 0, 0, 1, -vb[0]!, -vb[1]!] : IDENTIDAD;
  const hijos: Nodo[] = [];
  let n = 0;
  const nuevoId = () => `${op.id}-${++n}`;

  const estilo = (e: Elemento, heredado: Record<string, string>) => {
    const s: Record<string, string> = {};
    for (const k of HEREDABLES) if (heredado[k] !== undefined) s[k] = heredado[k]!;
    const clases = (e.attrs.class ?? '').split(/\s+/).filter(Boolean);
    for (const r of css) {
      if (r.selector === e.tag || clases.some((c) => r.selector === `.${c}`) || (e.attrs.id && r.selector === `#${e.attrs.id}`)) Object.assign(s, r.decl);
    }
    for (const [k, v] of Object.entries(e.attrs)) if (HEREDABLES.includes(k) || k === 'opacity') s[k] = v;
    Object.assign(s, leerDeclaraciones(e.attrs.style ?? ''));
    return s;
  };

  const degradado = (ref: string, caja: [number, number, number, number], m: Matriz, opacidad: number): Degradado | undefined => {
    const g = porId.get(ref);
    if (!g || !/Gradient$/.test(g.tag)) return undefined;
    // Las paradas pueden venir de otro degradado (xlink:href).
    let fuente = g;
    const href = (g.attrs.href ?? g.attrs['xlink:href'])?.replace('#', '');
    if (!fuente.hijos.some((h) => h.tag === 'stop') && href && porId.get(href)) fuente = porId.get(href)!;
    const paradas = fuente.hijos.filter((h) => h.tag === 'stop').map((s): [number, string] => {
      const st = { ...s.attrs, ...leerDeclaraciones(s.attrs.style ?? '') };
      const off = st.offset?.endsWith('%') ? parseFloat(st.offset) / 100 : parseFloat(st.offset ?? '0');
      return [Math.max(0, Math.min(1, off)), colorCss(st['stop-color'] ?? '#000', parseFloat(st['stop-opacity'] ?? '1') * opacidad) ?? '#00000000'];
    });
    if (paradas.length < 2) return undefined;
    const bbox = g.attrs.gradientUnits !== 'userSpaceOnUse';
    const num = (v: string | undefined, def: number) => (v === undefined ? def : v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v));
    // En objectBoundingBox las coordenadas van de 0 a 1 sobre la caja de la figura (ya transformada).
    const punto = (x: number, y: number): [number, number] =>
      bbox ? [r2(caja[0] + x * (caja[2] - caja[0])), r2(caja[1] + y * (caja[3] - caja[1]))] : aplicar(m, x, y).map(r2) as [number, number];
    if (g.tag === 'linearGradient') {
      return { tipo: 'lineal', de: punto(num(g.attrs.x1, 0), num(g.attrs.y1, 0)), a: punto(num(g.attrs.x2, 1), num(g.attrs.y2, 0)), paradas };
    }
    const c = punto(num(g.attrs.cx, 0.5), num(g.attrs.cy, 0.5));
    const radio = num(g.attrs.r, 0.5) * (bbox ? Math.max(caja[2] - caja[0], caja[3] - caja[1]) : Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])));
    return { tipo: 'radial', de: c, radio: r2(radio), paradas };
  };

  const figura = (cmds: Comando[], s: Record<string, string>, m: Matriz, opacidad: number) => {
    const t = cmds.map((k): Comando => {
      switch (k.c) {
        case 'M': case 'L': { const [x, y] = aplicar(m, k.x, k.y); return { c: k.c, x, y }; }
        case 'C': {
          const [x1, y1] = aplicar(m, k.x1, k.y1), [x2, y2] = aplicar(m, k.x2, k.y2), [x, y] = aplicar(m, k.x, k.y);
          return { c: 'C', x1, y1, x2, y2, x, y };
        }
        case 'Q': { const [x1, y1] = aplicar(m, k.x1, k.y1), [x, y] = aplicar(m, k.x, k.y); return { c: 'Q', x1, y1, x, y }; }
        default: return k;
      }
    });
    if (!t.length) return;
    const caja = limitesTrazado(aplanar(t));
    const fill = s.fill ?? '#000000';
    let relleno: Relleno | undefined;
    const url = /url\(#([^)]+)\)/.exec(fill)?.[1];
    if (url) {
      relleno = degradado(url, caja, m, parseFloat(s['fill-opacity'] ?? '1') * opacidad);
      if (!relleno) avisos.add(`El relleno ${fill} no se pudo traer (solo se importan degradados lineales y radiales).`);
    } else relleno = colorCss(fill === 'currentColor' ? '#000' : fill, parseFloat(s['fill-opacity'] ?? '1') * opacidad);
    const stroke = s.stroke && !s.stroke.startsWith('url(') ? colorCss(s.stroke, parseFloat(s['stroke-opacity'] ?? '1') * opacidad) : undefined;
    if (s.stroke?.startsWith('url(')) avisos.add('Los contornos con degradado se importan sin contorno.');
    const escala = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    const contorno: Contorno | undefined = stroke
      ? {
        color: stroke, ancho: r2(parseFloat(s['stroke-width'] ?? '1') * escala),
        extremo: ({ round: 'redondo', square: 'cuadrado' } as const)[s['stroke-linecap'] as 'round'] ?? 'plano',
        union: ({ round: 'redonda', bevel: 'biselada' } as const)[s['stroke-linejoin'] as 'round'] ?? 'recta',
      }
      : undefined;
    if (!relleno && !contorno) return;
    hijos.push({
      id: nuevoId(), tipo: 'trazo', d: escribirTrazado(t),
      ...(relleno ? { relleno } : {}), ...(contorno ? { contorno } : {}),
      ...(s['fill-rule'] === 'evenodd' ? { reglaRelleno: 'evenodd' as const } : {}),
    });
  };

  const recorrer = (e: Elemento, heredado: Record<string, string>, m: Matriz, opacidad: number) => {
    if (['defs', 'style', 'title', 'desc', 'metadata', 'linearGradient', 'radialGradient', 'symbol', '#text', 'clipPath'].includes(e.tag)) return;
    const s = estilo(e, heredado);
    if (s.display === 'none' || s.visibility === 'hidden') return;
    const mm = multiplicar(m, leerTransform(e.attrs.transform));
    const op2 = opacidad * parseFloat(s.opacity ?? '1');
    const num = (k: string, def = 0) => parseFloat(e.attrs[k] ?? `${def}`);
    if (e.attrs['clip-path'] || e.attrs.mask || e.attrs.filter) avisos.add('Las máscaras, recortes y filtros del SVG se ignoran.');
    switch (e.tag) {
      case 'svg': case 'g': case 'a':
        for (const h of e.hijos) recorrer(h, s, mm, op2);
        return;
      case 'use': {
        const ref = porId.get((e.attrs.href ?? e.attrs['xlink:href'] ?? '').replace('#', ''));
        if (ref) recorrer(ref.tag === 'symbol' ? { ...ref, tag: 'g' } : ref, s, multiplicar(mm, [1, 0, 0, 1, num('x'), num('y')]), op2);
        return;
      }
      case 'path': if (e.attrs.d) figura(leerTrazado(e.attrs.d), s, mm, op2); return;
      case 'rect': {
        const x = num('x'), y = num('y'), w = num('width'), h = num('height');
        let rx = parseFloat(e.attrs.rx ?? e.attrs.ry ?? '0');
        rx = Math.min(rx, w / 2, h / 2);
        const d = rx
          ? `M${x + rx} ${y}H${x + w - rx}A${rx} ${rx} 0 0 1 ${x + w} ${y + rx}V${y + h - rx}A${rx} ${rx} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${rx} 0 0 1 ${x} ${y + h - rx}V${y + rx}A${rx} ${rx} 0 0 1 ${x + rx} ${y}Z`
          : `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
        figura(leerTrazado(d), s, mm, op2);
        return;
      }
      case 'circle': case 'ellipse': {
        const cx = num('cx'), cy = num('cy');
        const rx = e.tag === 'circle' ? num('r') : num('rx'), ry = e.tag === 'circle' ? num('r') : num('ry');
        figura(leerTrazado(`M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`), s, mm, op2);
        return;
      }
      case 'line':
        figura(leerTrazado(`M${num('x1')} ${num('y1')}L${num('x2')} ${num('y2')}`), { ...s, fill: 'none' }, mm, op2);
        return;
      case 'polyline': case 'polygon': {
        const p = (e.attrs.points ?? '').trim().split(/[\s,]+/).map(Number);
        if (p.length < 4) return;
        let d = `M${p[0]} ${p[1]}`;
        for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
        figura(leerTrazado(e.tag === 'polygon' ? `${d}Z` : d), e.tag === 'polyline' ? { ...s, fill: s.fill ?? 'none' } : s, mm, op2);
        return;
      }
      case 'text': {
        const contenido = (e.texto || e.hijos.map((h) => h.texto).join('')).trim();
        if (!contenido) return;
        const tam = parseFloat(s['font-size'] ?? '16') * Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2]));
        const [x, y] = aplicar(mm, num('x'), num('y'));
        const familia = (s['font-family'] ?? '').split(',')[0]!.replace(/['"]/g, '').trim();
        const fuente = op.fuentes?.find((f) => f.toLowerCase() === familia.toLowerCase()) ?? op.fuentes?.[0] ?? 'Nunito';
        if (familia && fuente.toLowerCase() !== familia.toLowerCase()) avisos.add(`La fuente "${familia}" no está en el catálogo; se usa ${fuente}.`);
        const anchor = s['text-anchor'];
        hijos.push({
          id: nuevoId(), tipo: 'texto', texto: contenido, fuente, tamano: r2(tam),
          ...(s['font-weight'] && Number(s['font-weight']) ? { peso: Number(s['font-weight']) } : s['font-weight'] === 'bold' ? { peso: 700 } : {}),
          relleno: colorCss(s.fill ?? '#000', op2) ?? '#000000',
          // (x, y) del SVG es la línea base; el texto de MotionAI se coloca por la caja, con ancla en la base aproximada.
          x: r2(x), y: r2(y - tam * 0.35),
          ancla: anchor === 'middle' ? 'centro' : anchor === 'end' ? 'der' : 'izq',
          ...(anchor === 'middle' ? { alineacion: 'centro' as const } : anchor === 'end' ? { alineacion: 'der' as const } : {}),
        });
        return;
      }
      case 'image': avisos.add('Las imágenes dentro del SVG se ignoran.'); return;
      case 'pattern': case 'mask': case 'filter': return;
      default: avisos.add(`El elemento <${e.tag}> no se importa.`);
    }
  };

  recorrer(svg, {}, origen, 1);
  if (!hijos.length) throw new Error('El SVG no tiene figuras que se puedan importar.');
  return {
    componente: {
      id: op.id, nombre: op.nombre, ...(op.tipo ? { tipo: op.tipo } : {}),
      raiz: { id: `${op.id}-raiz`, tipo: 'grupo', ancho: r2(ancho), alto: r2(alto), hijos },
    },
    avisos: [...avisos],
  };
}

function buscar(e: Elemento, tag: string): Elemento[] {
  return [...(e.tag === tag ? [e] : []), ...e.hijos.flatMap((h) => buscar(h, tag))];
}

/** Comandos a texto de path con dos decimales. */
export function escribirTrazado(cmds: Comando[]): string {
  const n = (v: number) => `${r2(v)}`.replace(/^-0$/, '0');
  return cmds.map((k) => {
    switch (k.c) {
      case 'M': case 'L': return `${k.c}${n(k.x)} ${n(k.y)}`;
      case 'C': return `C${n(k.x1)} ${n(k.y1)} ${n(k.x2)} ${n(k.y2)} ${n(k.x)} ${n(k.y)}`;
      case 'Q': return `Q${n(k.x1)} ${n(k.y1)} ${n(k.x)} ${n(k.y)}`;
      default: return 'Z';
    }
  }).join('');
}
