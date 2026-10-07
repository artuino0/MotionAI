/**
 * Importador de archivos .pen (Pencil). Trae las piezas reusables como componentes de la biblioteca y,
 * si el archivo tiene una campaña, también sus escenas con la animación, la voz y las frases.
 *
 * Mapeo:
 * - frame → grupo (con su relleno como rectángulo o imagen de fondo); frame reusable → componente;
 * - path → trazo (la geometría está en su viewBox, escalada al tamaño del nodo);
 * - text → texto; ref → instancia, con `descendants` como cambios;
 * - metadata `anim` de una ref → animación (las entradas y los tiempos usan la misma convención).
 */
import type { Animacion, Componente, Contorno, Entrada, Escena, Frase, Nodo, Salida, Sombra } from '@motionai/documento';

interface PenNodo {
  type: string;
  id: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  clip?: boolean;
  reusable?: boolean;
  fill?: unknown;
  stroke?: unknown;
  strokeWidth?: number;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  effect?: unknown;
  viewBox?: [number, number, number, number];
  geometry?: string;
  content?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  fontSize?: number;
  ref?: string;
  descendants?: Record<string, Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  children?: PenNodo[];
}

export interface DocumentoPen {
  version?: number;
  children: PenNodo[];
}

export interface ImportacionPen {
  componentes: Componente[];
  /** Archivos que usan las piezas (rutas relativas al .pen), para copiarlos al proyecto. */
  recursos: string[];
  avisos: string[];
}

export interface CampanaPen extends ImportacionPen {
  nombre: string;
  formato: '9:16' | '16:9' | '1:1' | '4:5';
  duracion: number;
  voz?: { archivo: string; inicio: number };
  frases: Frase[];
  escenas: Escena[];
}

const ENTRADAS: Record<string, Entrada> = {
  pop: 'pop', cae: 'cae', sube: 'sube', 'desliza-izq': 'desliza-izq', 'desliza-der': 'desliza-der',
  crece: 'crece', dibuja: 'dibuja', aparece: 'aparece', escribe: 'escribe', corta: 'aparece',
};
const SALIDAS: Record<string, Salida> = { pop: 'pop', cae: 'cae', corta: 'corta', desaparece: 'desaparece', sube: 'sube', encoge: 'encoge' };
const EXTREMOS: Record<string, Contorno['extremo']> = { round: 'redondo', butt: 'plano', square: 'cuadrado' };
const UNIONES: Record<string, Contorno['union']> = { round: 'redonda', miter: 'recta', bevel: 'biselada' };

const r2 = (n: number) => Math.round(n * 100) / 100;
const esColor = (v: unknown): v is string => typeof v === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);

class Importador {
  avisos: string[] = [];
  recursos = new Set<string>();
  porId = new Map<string, PenNodo>();
  private avisados = new Set<string>();

  constructor(readonly pen: DocumentoPen) {
    const indexar = (n: PenNodo) => {
      this.porId.set(n.id, n);
      n.children?.forEach(indexar);
    };
    pen.children.forEach(indexar);
  }

  avisar(clave: string, texto: string) {
    if (this.avisados.has(clave)) return;
    this.avisados.add(clave);
    this.avisos.push(texto);
  }

  /** Capas de relleno: el primer color, y las imágenes como recurso. */
  rellenos(fill: unknown): { color?: string; imagen?: string } {
    const capas = Array.isArray(fill) ? fill : fill === undefined ? [] : [fill];
    const out: { color?: string; imagen?: string } = {};
    for (const c of capas) {
      if (esColor(c)) out.color ??= c;
      else if (c && typeof c === 'object' && (c as { type?: string }).type === 'image') {
        const url = (c as { url?: string; blendMode?: string }).url;
        // El grano encima del papel es parte del estilo de papel recortado; en estilo plano no se trae.
        if (url && !(c as { blendMode?: string }).blendMode) { out.imagen ??= url; this.recursos.add(url); }
        else if (url) this.avisar('grano', 'Las texturas de grano del papel se omiten en el estilo plano.');
      } else if (c && typeof c === 'object' && esColor((c as { color?: string }).color)) out.color ??= (c as { color: string }).color;
      else if (c !== undefined) this.avisar(`relleno:${JSON.stringify(c).slice(0, 30)}`, `Un tipo de relleno no se pudo traer (${JSON.stringify(c).slice(0, 60)}).`);
    }
    return out;
  }

  sombra(effect: unknown): Sombra | undefined {
    const efectos = Array.isArray(effect) ? effect : effect ? [effect] : [];
    const s = efectos.find((e) => e && typeof e === 'object' && (e as { type?: string }).type === 'shadow') as
      | { offset?: { x?: number; y?: number }; blur?: number; color?: string } | undefined;
    if (!s || !esColor(s.color)) return undefined;
    return { color: s.color, desenfoque: s.blur ?? 0, x: s.offset?.x ?? 0, y: s.offset?.y ?? 0 };
  }

  nodo(n: PenNodo): Nodo | undefined {
    const base = { id: n.id, ...(n.name ? { nombre: n.name } : {}), x: r2(n.x ?? 0), y: r2(n.y ?? 0) };
    switch (n.type) {
      case 'frame': {
        const w = n.width ?? 0, h = n.height ?? 0;
        const { color, imagen } = this.rellenos(n.fill);
        const hijos: Nodo[] = [];
        if (imagen) hijos.push({ id: `${n.id}-imagen`, tipo: 'imagen', archivo: imagen, ancho: w, alto: h });
        else if (color) hijos.push({ id: `${n.id}-fondo`, tipo: 'rect', ancho: w, alto: h, relleno: color });
        for (const c of n.children ?? []) {
          const h2 = this.nodo(c);
          if (h2) hijos.push(h2);
        }
        const rot = n.rotation ? { rotacion: r2(n.rotation) } : {};
        return { ...base, tipo: 'grupo', ancho: r2(w), alto: r2(h), ...(n.clip ? { recortar: true } : {}), ...rot, hijos };
      }
      case 'path': {
        if (!n.geometry) return undefined;
        const [vx, vy, vw, vh] = n.viewBox ?? [0, 0, n.width ?? 1, n.height ?? 1];
        const sx = vw ? (n.width ?? vw) / vw : 1, sy = vh ? (n.height ?? vh) / vh : 1;
        const { color } = this.rellenos(n.fill);
        const contorno: Contorno | undefined = esColor(n.stroke) && n.strokeWidth
          ? {
            color: n.stroke, ancho: n.strokeWidth,
            ...(n.strokeLinecap && EXTREMOS[n.strokeLinecap] ? { extremo: EXTREMOS[n.strokeLinecap] } : {}),
            ...(n.strokeLinejoin && UNIONES[n.strokeLinejoin] ? { union: UNIONES[n.strokeLinejoin] } : {}),
          }
          : undefined;
        const sombra = this.sombra(n.effect);
        return {
          ...base, tipo: 'trazo', d: n.geometry,
          ...(Math.abs(sx - 1) > 1e-3 ? { escalaX: r2(sx * 1e4) / 1e4 } : {}),
          ...(Math.abs(sy - 1) > 1e-3 ? { escalaY: r2(sy * 1e4) / 1e4 } : {}),
          ...(vx || vy ? { ancla: [vx, vy] as [number, number] } : {}),
          ...(color ? { relleno: color } : {}),
          ...(contorno ? { contorno } : {}),
          ...(sombra ? { sombra } : {}),
        };
      }
      case 'text': {
        const peso = Number(n.fontWeight) || 400;
        return {
          ...base, tipo: 'texto', texto: n.content ?? '', fuente: n.fontFamily ?? 'Nunito', tamano: n.fontSize ?? 16,
          ...(peso !== 400 ? { peso } : {}), ...(esColor(n.fill) ? { relleno: n.fill } : {}),
        };
      }
      case 'ref': {
        const comp = n.ref ? this.porId.get(n.ref) : undefined;
        if (!comp) { this.avisar(`ref:${n.ref}`, `La pieza "${n.name ?? n.id}" usa un componente que no está en el archivo (${n.ref}).`); return undefined; }
        const cambios: Record<string, { texto?: string; relleno?: string }> = {};
        for (const [id, c] of Object.entries(n.descendants ?? {})) {
          const cambio: { texto?: string; relleno?: string } = {};
          if (typeof c.content === 'string') cambio.texto = c.content;
          const relleno = this.rellenos(c.fill).color;
          if (relleno) cambio.relleno = relleno;
          if (Object.keys(cambio).length) cambios[id] = cambio;
        }
        const extra: Partial<Extract<Nodo, { tipo: 'instancia' }>> = {};
        if (n.width && comp.width && Math.abs(n.width / comp.width - 1) > 1e-3) extra.escalaX = r2((n.width / comp.width) * 1e4) / 1e4;
        if (n.height && comp.height && Math.abs(n.height / comp.height - 1) > 1e-3) extra.escalaY = r2((n.height / comp.height) * 1e4) / 1e4;
        return { ...base, tipo: 'instancia', componente: comp.id, ...(Object.keys(cambios).length ? { cambios } : {}), ...extra };
      }
      default:
        this.avisar(`tipo:${n.type}`, `Los nodos de tipo "${n.type}" no se pueden importar todavía.`);
        return undefined;
    }
  }

  componente(frame: PenNodo): Componente {
    const raiz = this.nodo({ ...frame, x: 0, y: 0, rotation: undefined })!;
    const m = frame.metadata ?? {};
    if (m.type === 'actor') {
      this.avisar(`actor:${m.actor}`, `"${frame.name}" es un actor animado por código (${m.actor}); se trae como dibujo fijo. Su movimiento llega con el kit de Flow.`);
    }
    return {
      id: frame.id,
      nombre: frame.name ?? frame.id,
      ...(typeof m.type === 'string' ? { tipo: m.type } : {}),
      ...(typeof m.nota === 'string' ? { nota: m.nota } : {}),
      raiz,
    };
  }

  /** Componentes reusables, más los que estos usan por dentro. */
  componentes(ids?: string[]): Componente[] {
    const quiero = new Set(ids ?? [...this.porId.values()].filter((n) => n.reusable).map((n) => n.id));
    const pendientes = [...quiero];
    while (pendientes.length) {
      const n = this.porId.get(pendientes.pop()!);
      const recorrer = (x: PenNodo) => {
        if (x.type === 'ref' && x.ref && !quiero.has(x.ref)) { quiero.add(x.ref); pendientes.push(x.ref); }
        x.children?.forEach(recorrer);
      };
      if (n) n.children?.forEach(recorrer);
    }
    return [...quiero].map((id) => this.porId.get(id)).filter((n): n is PenNodo => !!n && n.type === 'frame').map((n) => this.componente(n));
  }
}

/** Lee y revisa un .pen. */
export function leerPen(datos: unknown): DocumentoPen {
  const d = (typeof datos === 'string' ? JSON.parse(datos) : datos) as DocumentoPen;
  if (!d || !Array.isArray(d.children)) throw new Error('No parece un archivo .pen: falta la lista children.');
  return d;
}

/** Nombres de las campañas que trae el archivo. */
export function campanasDePen(pen: DocumentoPen): string[] {
  return pen.children.filter((n) => n.metadata?.type === 'campana').map((n) => String(n.metadata!.nombre ?? n.name));
}

/** Piezas reusables del .pen como componentes (todas, o las de `ids` y lo que usan). */
export function componentesDePen(pen: DocumentoPen, ids?: string[]): ImportacionPen {
  const imp = new Importador(pen);
  const componentes = imp.componentes(ids);
  return { componentes, recursos: [...imp.recursos], avisos: imp.avisos };
}

/** Una campaña completa: escenas con su animación, voz, frases y los componentes que usa. */
export function campanaDePen(pen: DocumentoPen, nombre?: string): CampanaPen {
  const campanas = pen.children.filter((n) => n.metadata?.type === 'campana');
  const c = nombre ? campanas.find((n) => n.metadata!.nombre === nombre || n.name === nombre) : campanas[0];
  if (!c) throw new Error(nombre ? `El archivo no tiene la campaña "${nombre}". Tiene: ${campanasDePen(pen).join(', ') || 'ninguna'}.` : 'El archivo no tiene campañas.');
  const m = c.metadata as { nombre?: string; audio?: string; offset?: number; duracion?: number; formato?: string; frases?: [number, number, string][]; sin_subtitulo?: number[] };
  const nombreC = String(m.nombre ?? c.name);
  const imp = new Importador(pen);
  const sinSub = new Set(m.sin_subtitulo ?? []);
  const frases: Frase[] = (m.frases ?? []).map(([inicio, fin, texto], i) => ({ inicio, fin, texto, ...(sinSub.has(i + 1) ? { subtitulo: false } : {}) }));

  const marcos = pen.children
    .filter((n) => n.metadata?.type === 'escena' && n.metadata.campana === nombreC)
    .sort((a, b) => Number(a.metadata!.inicio) - Number(b.metadata!.inicio));
  const usados = new Set<string>();
  const escenas: Escena[] = marcos.map((f) => {
    const em = f.metadata as { inicio: number; fin: number; desat?: number };
    if (em.desat) imp.avisar(`desat:${f.id}`, `"${f.name}" tiene los colores apagados (desat ${em.desat}); eso todavía no se importa.`);
    const hijos: Nodo[] = [];
    for (const h of f.children ?? []) {
      const nodo = imp.nodo(h);
      if (!nodo) continue;
      if (h.type === 'ref' && h.ref) usados.add(h.ref);
      hijos.push(animar(imp, h, nodo));
    }
    return { id: f.id, nombre: f.name ?? f.id, inicio: em.inicio, fin: em.fin, hijos };
  });
  if (m.audio) imp.recursos.add(m.audio);
  const componentes = imp.componentes([...usados]);
  const formato = m.formato === 'horizontal' ? '16:9' : '9:16';
  return {
    nombre: nombreC, formato, duracion: m.duracion ?? Math.max(0, ...escenas.map((e) => e.fin)),
    ...(m.audio ? { voz: { archivo: m.audio, inicio: m.offset ?? 0 } } : {}),
    frases, escenas, componentes, recursos: [...imp.recursos], avisos: imp.avisos,
  };
}

/** Pasa la metadata `anim` de una ref de escena a la animación de MotionAI. */
function animar(imp: Importador, h: PenNodo, nodo: Nodo): Nodo {
  const m = h.metadata ?? {};
  const comp = h.ref ? imp.porId.get(h.ref) : undefined;
  const cm = comp?.metadata ?? {};
  const out = { ...nodo } as Nodo & { cambios?: Record<string, { texto?: string; relleno?: string }> };
  const animacion: Animacion = {};
  if (typeof m.entra === 'string') {
    const tipo = ENTRADAS[m.entra];
    if (tipo) animacion.entra = { tipo, en: (m.en as number | string) ?? 0, ...(typeof m.dur === 'number' ? { dur: m.dur } : m.entra === 'corta' ? { dur: 0.01 } : {}) };
    else imp.avisar(`entra:${m.entra}`, `La entrada "${m.entra}" no existe en MotionAI; la pieza aparece sin animación.`);
  }
  if (typeof m.sale === 'string') {
    const tipo = SALIDAS[m.sale];
    if (tipo && m.sale_en !== undefined) animacion.sale = { tipo, en: m.sale_en as number | string };
  }
  if (Object.keys(animacion).length) out.animacion = animacion;
  // Escala y pop desde el ancla del componente; la posición se corrige para que la esquina quede igual.
  const escala = typeof m.escala === 'number' ? m.escala : 1;
  const ancla = Array.isArray(cm.anchor) ? (cm.anchor as [number, number]) : undefined;
  if (ancla) {
    out.ancla = [r2(ancla[0]), r2(ancla[1])];
    out.x = r2(Number(out.x ?? 0) + ancla[0] * escala * (out.escalaX ?? 1));
    out.y = r2(Number(out.y ?? 0) + ancla[1] * escala * (out.escalaY ?? 1));
  }
  if (escala !== 1) out.escala = escala;
  // Las etiquetas y globos de Flow se dibujan girados `ang` grados alrededor de su ancla.
  const ang = typeof m.ang === 'number' ? m.ang : typeof cm.ang === 'number' ? cm.ang : 0;
  if ((cm.type === 'etiqueta' || cm.type === 'globo') && ang && out.rotacion === undefined) out.rotacion = ang;
  if (cm.type === 'etiqueta' && h.descendants && Object.values(h.descendants).some((d) => (d as { content?: string }).content !== undefined)) {
    imp.avisar('etiqueta-texto', 'Las etiquetas con otro texto conservan el papel del diseño original; con el kit de Flow el papel se ajusta al texto.');
  }
  // Etiquetas: bg y fg cambian el color del papel y del texto.
  if (out.tipo === 'instancia' && comp && (typeof m.bg === 'string' || typeof m.fg === 'string')) {
    const cambios = { ...(out.cambios ?? {}) };
    const recorrer = (x: PenNodo) => {
      const color = imp.rellenos(x.fill).color?.toUpperCase();
      if (typeof m.bg === 'string' && x.type === 'path' && x.name === 'Papel' && color === String(cm.bg).toUpperCase()) cambios[x.id] = { ...cambios[x.id], relleno: m.bg };
      if (typeof m.fg === 'string' && x.type === 'text' && color === String(cm.fg).toUpperCase()) cambios[x.id] = { ...cambios[x.id], relleno: m.fg };
      x.children?.forEach(recorrer);
    };
    recorrer(comp);
    if (Object.keys(cambios).length) out.cambios = cambios;
  }
  const actor = typeof cm.actor === 'string' ? cm.actor : undefined;
  if (actor && Object.keys(m).some((k) => !['type', 'entra', 'en', 'dur', 'sale', 'sale_en', 'escala', 'bg', 'fg', 'ang'].includes(k))) {
    imp.avisar(`params:${actor}`, `Los parámetros de movimiento del actor "${actor}" se omiten por ahora.`);
  }
  return out;
}
