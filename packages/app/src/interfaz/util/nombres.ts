/**
 * Nombres que entiende una persona. Los ids son para Claude; en la interfaz cada pieza se llama
 * por lo que se ve: su texto, el componente del que es copia, o su tipo.
 */
import { recorrer, type Nodo, type Proyecto } from '@motionai/documento';
import { hay, t } from '../i18n.js';

const recortar = (s: string, n = 32) => {
  const limpio = s.replace(/\s+/g, ' ').trim();
  return limpio.length > n ? `${limpio.slice(0, n - 1)}…` : limpio;
};

/** Índice de piezas por id (escenas y biblioteca) para buscar rápido. */
export function indicePiezas(p: Proyecto): Map<string, Nodo> {
  const m = new Map<string, Nodo>();
  for (const raiz of [...p.escenas.flatMap((e) => e.hijos), ...p.biblioteca.map((c) => c.raiz)]) {
    for (const n of recorrer(raiz)) m.set(n.id, n);
  }
  return m;
}

/** Nombre de una pieza, sin ids. */
export function nombreNodo(n: Nodo, p?: Proyecto): string {
  if (n.nombre) return n.nombre;
  if (n.tipo === 'texto') return `“${recortar(n.texto)}”`;
  if (n.tipo === 'instancia') {
    const c = p?.biblioteca.find((x) => x.id === n.componente);
    // Si la copia cambia un texto, ese texto la distingue de las demás.
    const texto = Object.values(n.cambios ?? {}).find((c) => c.texto)?.texto;
    if (texto) return `“${recortar(texto)}”`;
    return c?.nombre ?? t('tipo.instancia');
  }
  if (n.tipo === 'grupo') {
    const texto = [...recorrer(n)].find((h): h is Extract<Nodo, { tipo: 'texto' }> => h.tipo === 'texto');
    if (texto) return `“${recortar(texto.texto)}”`;
  }
  return t(`tipo.${n.tipo}` as const);
}

/**
 * Nombre de lo que registra el motor al dibujar. Dentro de una copia de un componente la ruta es
 * `idCopia/idPieza`: se nombra la pieza y, si no dice nada propio, la copia.
 */
export function nombreRuta(ruta: string, p: Proyecto | null, indice?: Map<string, Nodo>): string {
  if (!p) return ruta;
  const idx = indice ?? indicePiezas(p);
  const partes = ruta.split('/');
  const pieza = idx.get(partes[partes.length - 1]!);
  if (partes.length === 1) return pieza ? nombreNodo(pieza, p) : ruta;
  const copia = idx.get(partes[0]!);
  const nombreCopia = copia ? nombreNodo(copia, p) : partes[0]!;
  if (!pieza) return nombreCopia;
  // Una pieza interna sin texto propio («Círculo») se entiende mejor con la copia a la que pertenece.
  return pieza.tipo === 'texto' || pieza.nombre ? nombreNodo(pieza, p) : `${nombreNodo(pieza, p)} · ${nombreCopia}`;
}

export function nombreEscena(p: Proyecto | null, id?: string): string {
  if (!p || !id) return id ?? '';
  const e = p.escenas.find((x) => x.id === id);
  if (!e) return id;
  if (e.nombre) return e.nombre;
  return t('medios.escenaN', { n: p.escenas.indexOf(e) + 1 });
}

/** Verbo de una herramienta del MCP («Agregando una pieza»). */
export function verboHerramienta(nombre: string): string {
  const k = `herr.${nombre}`;
  return hay(k) ? t(k) : nombre;
}

export function nombreMovimiento(tipo: string): string {
  const k = `mov.${tipo}`;
  return hay(k) ? t(k) : tipo;
}

/** Ids de piezas que aparecen en el resumen de una versión («Cambié e1-titulo: …», «Agregué "x"»). */
export function idsEnResumen(resumen: string, idx: Map<string, Nodo>): string[] {
  const vistos = new Set<string>();
  for (const m of resumen.matchAll(/"([^"]+)"|([\w-]+):/g)) {
    const id = m[1] ?? m[2]!;
    if (idx.has(id)) vistos.add(id);
  }
  return [...vistos];
}
