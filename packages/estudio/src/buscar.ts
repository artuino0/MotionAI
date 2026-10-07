import type { Componente, Escena, Nodo, ProyectoEntrada } from '@motionai/documento';

export interface Ubicacion {
  nodo: Nodo;
  /** Lista que contiene al nodo (hijos de una escena o de un grupo). Vacía si es la raíz de un componente. */
  lista: Nodo[] | null;
  indice: number;
  escena?: Escena;
  componente?: Componente;
}

/** Busca una pieza por id en las escenas y en la biblioteca. */
export function buscarPieza(doc: ProyectoEntrada, id: string): Ubicacion | undefined {
  const enLista = (lista: Nodo[], extra: Partial<Ubicacion>): Ubicacion | undefined => {
    for (let i = 0; i < lista.length; i++) {
      const n = lista[i]!;
      if (n.id === id) return { nodo: n, lista, indice: i, ...extra };
      if (n.tipo === 'grupo') {
        const r = enLista(n.hijos, extra);
        if (r) return r;
      }
    }
    return undefined;
  };
  for (const escena of doc.escenas) {
    const r = enLista(escena.hijos, { escena });
    if (r) return r;
  }
  for (const componente of doc.biblioteca ?? []) {
    if (componente.raiz.id === id) return { nodo: componente.raiz, lista: null, indice: 0, componente };
    if (componente.raiz.tipo === 'grupo') {
      const r = enLista(componente.raiz.hijos, { componente });
      if (r) return r;
    }
  }
  return undefined;
}

export function buscarEscena(doc: ProyectoEntrada, id: string): Escena | undefined {
  return doc.escenas.find((e) => e.id === id);
}

/** Todos los ids del documento, para sugerir uno libre. */
export function idsUsados(doc: ProyectoEntrada): Set<string> {
  const ids = new Set<string>();
  const visitar = (n: Nodo) => {
    ids.add(n.id);
    if (n.tipo === 'grupo') n.hijos.forEach(visitar);
  };
  for (const e of doc.escenas) { ids.add(e.id); e.hijos.forEach(visitar); }
  for (const c of doc.biblioteca ?? []) visitar(c.raiz);
  return ids;
}
