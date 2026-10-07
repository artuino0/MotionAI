import {
  PROPIEDADES_COLOR,
  dimensiones,
  duracionDe,
  resolverTiempo,
  type Ciclo,
  type CicloTipo,
  type Componente,
  type Curva,
  type Entrada,
  type Escena,
  type Frase,
  type Nodo,
  type Propiedad,
  type Proyecto,
  type Salida,
  type Tiempo,
} from '@motionai/documento';
import { leerColor, type RGBA } from './color.js';
import { aplanar, leerTrazado, type Aplanado, type Comando } from './svg.js';

export interface KeyResuelto {
  t: number;
  /** Número, color, o porcentaje (`"50%"`) que se resuelve contra el contenedor al dibujar. */
  v: number | RGBA | string;
  curva?: Curva;
}

export interface MovResuelto<T extends string> {
  tipo: T;
  en: number;
  dur: number;
  curva: Curva;
}

export interface CicloResuelto {
  tipo: CicloTipo;
  amplitud: number;
  periodo: number;
  desde: number;
  hasta: number;
}

export interface NodoPreparado {
  nodo: Nodo;
  pistas: Partial<Record<Propiedad, KeyResuelto[]>>;
  entra?: MovResuelto<Entrada>;
  sale?: MovResuelto<Salida>;
  ciclos: CicloResuelto[];
  /** Hijos de un grupo, o la raíz del componente de una instancia. */
  hijos: NodoPreparado[];
  /** Trazado ya leído (solo para `trazo`). */
  trazado?: Comando[];
  aplanado?: Aplanado;
  /** Memoria del motor para no recalcular por cuadro (límites, renglones de texto, formas). */
  memo: Map<string, unknown>;
}

export interface EscenaPreparada {
  escena: Escena;
  inicio: number;
  fin: number;
  hijos: NodoPreparado[];
}

export interface Escenario {
  proyecto: Proyecto;
  ancho: number;
  alto: number;
  fps: number;
  duracion: number;
  frases: Frase[];
  escenas: EscenaPreparada[];
}

export class ErrorPreparar extends Error {}

const DURACION_ENTRADA: Record<Entrada, number> = {
  aparece: 0.4, pop: 0.4, crece: 0.5, cae: 0.7, sube: 0.45, 'desliza-izq': 0.5, 'desliza-der': 0.5, dibuja: 0.9, escribe: 0,
};
const CURVA_ENTRADA: Record<Entrada, Curva> = {
  aparece: 'salida', pop: 'rebote', crece: 'salida', cae: 'golpe', sube: 'salida',
  'desliza-izq': 'salida', 'desliza-der': 'salida', dibuja: 'entrada-salida', escribe: 'lineal',
};
const DURACION_SALIDA: Record<Salida, number> = {
  desaparece: 0.3, pop: 0.3, encoge: 0.35, cae: 0.5, sube: 0.35, 'desliza-izq': 0.4, 'desliza-der': 0.4, corta: 0,
};
const CICLO_POR_DEFECTO: Record<CicloTipo, { amplitud: number; periodo: number }> = {
  flota: { amplitud: 12, periodo: 2.4 },
  late: { amplitud: 0.05, periodo: 1.2 },
  mece: { amplitud: 4, periodo: 2 },
  gira: { amplitud: 360, periodo: 6 },
};

const MAX_ANIDADO = 16;

/** Convierte un proyecto validado en una estructura lista para dibujar cuadro por cuadro. */
export function preparar(proyecto: Proyecto): Escenario {
  const { ancho, alto } = dimensiones(proyecto.ajustes);
  const biblioteca = new Map<string, Componente>(proyecto.biblioteca.map((c) => [c.id, c]));
  const frases = proyecto.frases;

  const escenas = [...proyecto.escenas]
    .sort((a, b) => a.inicio - b.inicio)
    .map((escena): EscenaPreparada => {
      const ctxT = { frases, escena: { inicio: escena.inicio, fin: escena.fin } };
      const resolver = (desfase: number) => (t: Tiempo) =>
        typeof t === 'number' ? t + desfase : resolverTiempo(t, ctxT);

      const prepararNodo = (nodo: Nodo, desfase: number, prof: number): NodoPreparado => {
        if (prof > MAX_ANIDADO) throw new ErrorPreparar(`Demasiados componentes anidados en "${nodo.id}"`);
        const rt = resolver(desfase);
        const a = nodo.animacion;
        const np: NodoPreparado = { nodo, pistas: {}, ciclos: [], hijos: [], memo: new Map() };

        for (const [prop, keys] of Object.entries(a?.pistas ?? {}) as [Propiedad, NonNullable<NonNullable<typeof a>['pistas']>[Propiedad]][]) {
          if (!keys) continue;
          np.pistas[prop] = keys
            .map((k): KeyResuelto => {
              let v: KeyResuelto['v'] = k.v;
              if (PROPIEDADES_COLOR.has(prop)) {
                if (typeof k.v !== 'string') throw new ErrorPreparar(`La pista "${prop}" de "${nodo.id}" necesita colores`);
                v = leerColor(k.v);
              } else if (typeof k.v === 'string' && !(prop === 'x' || prop === 'y')) {
                throw new ErrorPreparar(`La pista "${prop}" de "${nodo.id}" necesita números`);
              }
              return { t: rt(k.t), v, curva: k.curva };
            })
            .sort((p, q) => p.t - q.t);
        }

        if (a?.entra) {
          const tipo = a.entra.tipo;
          let dur = a.entra.dur ?? DURACION_ENTRADA[tipo];
          if (tipo === 'escribe' && !a.entra.dur) {
            const n = nodo.tipo === 'texto' ? nodo.texto.length : 20;
            dur = Math.min(3, Math.max(0.4, n * 0.045));
          }
          np.entra = { tipo, en: rt(a.entra.en), dur, curva: a.entra.curva ?? CURVA_ENTRADA[tipo] };
        }
        if (a?.sale) {
          const tipo = a.sale.tipo;
          np.sale = { tipo, en: rt(a.sale.en), dur: a.sale.dur ?? DURACION_SALIDA[tipo], curva: a.sale.curva ?? 'entrada' };
        }
        np.ciclos = (a?.ciclos ?? []).map((c: Ciclo): CicloResuelto => {
          const d = CICLO_POR_DEFECTO[c.tipo];
          const desde = c.desde !== undefined ? rt(c.desde) : np.entra ? np.entra.en + np.entra.dur : escena.inicio;
          return {
            tipo: c.tipo,
            amplitud: c.amplitud ?? d.amplitud,
            periodo: c.periodo ?? d.periodo,
            desde,
            hasta: c.hasta !== undefined ? rt(c.hasta) : Infinity,
          };
        });

        if (nodo.tipo === 'trazo') {
          np.trazado = leerTrazado(nodo.d);
          np.aplanado = aplanar(np.trazado);
        } else if (nodo.tipo === 'grupo') {
          np.hijos = nodo.hijos.map((h) => prepararNodo(h, desfase, prof + 1));
        } else if (nodo.tipo === 'instancia') {
          const comp = biblioteca.get(nodo.componente);
          if (!comp) throw new ErrorPreparar(`No existe el componente "${nodo.componente}"`);
          // Los tiempos en segundos dentro de un componente cuentan desde que aparece la instancia.
          const base = np.entra?.en ?? escena.inicio;
          np.hijos = [prepararNodo(aplicarCambios(comp.raiz, nodo.cambios ?? {}), base, prof + 1)];
        }
        return np;
      };

      return {
        escena,
        inicio: escena.inicio,
        fin: escena.fin,
        hijos: escena.hijos.map((h) => prepararNodo(h, 0, 0)),
      };
    });

  return { proyecto, ancho, alto, fps: proyecto.ajustes.fps, duracion: duracionDe(proyecto), frases, escenas };
}

function aplicarCambios(raiz: Nodo, cambios: NonNullable<Extract<Nodo, { tipo: 'instancia' }>['cambios']>): Nodo {
  if (Object.keys(cambios).length === 0) return raiz;
  const copiar = (n: Nodo): Nodo => {
    const c = cambios[n.id];
    let out: Nodo = n;
    if (c) {
      out = { ...n };
      if (c.visible !== undefined) out.visible = c.visible;
      if (c.texto !== undefined && out.tipo === 'texto') out.texto = c.texto;
      if (c.relleno !== undefined) {
        if (out.tipo === 'texto' && typeof c.relleno === 'string') out.relleno = c.relleno;
        else if (out.tipo === 'rect' || out.tipo === 'elipse' || out.tipo === 'trazo') out.relleno = c.relleno;
      }
      if (c.contorno !== undefined && (out.tipo === 'rect' || out.tipo === 'elipse' || out.tipo === 'trazo' || out.tipo === 'texto')) {
        out.contorno = c.contorno;
      }
    }
    if (out.tipo === 'grupo') out = { ...out, hijos: out.hijos.map(copiar) };
    return out;
  };
  return copiar(raiz);
}
