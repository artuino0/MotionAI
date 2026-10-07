import { Canvas } from 'skia-canvas';
import { zonasTapadas, type Proyecto } from '@motionai/documento';
import { dibujarCuadro, maquetarSubtitulo, preparar, type Entorno, type Escenario, type Registro } from '@motionai/motor';

/** Una regla que no se cumple. Los errores rechazan el cambio; los avisos solo se reportan. */
export interface Hallazgo {
  regla: string;
  mensaje: string;
  pieza?: string;
  t?: number;
}

export interface Analisis {
  errores: Hallazgo[];
  avisos: Hallazgo[];
}

type Caja = [number, number, number, number];

const area = (c: Caja) => Math.max(0, c[2] - c[0]) * Math.max(0, c[3] - c[1]);
const interseccion = (a: Caja, b: Caja): Caja => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
const px = (c: Caja) => `x ${Math.round(c[0])}–${Math.round(c[2])}, y ${Math.round(c[1])}–${Math.round(c[3])}`;
const seg = (t: number) => `${t.toFixed(1)} s`;
const palabras = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2);

/** Segundos en que se revisa el video: cada 0.2 s y justo antes de cada corte. */
function muestras(esc: Escenario): number[] {
  const ts = new Set<number>();
  for (let t = 0; t < esc.duracion; t += 0.2) ts.add(Math.round(t * 1000) / 1000);
  for (const e of esc.escenas) ts.add(Math.max(e.inicio, e.fin - 0.05));
  return [...ts].sort((a, b) => a - b);
}

/** Recorre el video y registra dónde queda cada pieza en cada muestra. */
export function medirPiezas(esc: Escenario, entorno: Entorno): Map<number, Registro[]> {
  // El lienzo puede ser diminuto: solo interesan las transformaciones y las medidas del texto.
  const ctx = new Canvas(8, 8).getContext('2d') as unknown as CanvasRenderingContext2D;
  const out = new Map<number, Registro[]>();
  for (const t of muestras(esc)) {
    const regs: Registro[] = [];
    dibujarCuadro(ctx, esc, t, entorno, { subtitulos: false, registrar: (r) => regs.push(r) });
    out.set(t, regs);
  }
  return out;
}

/** Revisa las reglas generales de redes sobre un proyecto ya validado. */
export function analizar(proyecto: Proyecto, entorno: Entorno): Analisis {
  const errores: Hallazgo[] = [];
  const avisos: Hallazgo[] = [];
  const vistos = new Set<string>();
  const una = (lista: Hallazgo[], clave: string, h: Hallazgo) => {
    if (vistos.has(clave)) return;
    vistos.add(clave);
    lista.push(h);
  };

  const esc = preparar(proyecto);
  const { ajustes } = proyecto;
  const lienzo: Caja = [0, 0, esc.ancho, esc.alto];
  const k = Math.min(esc.ancho, esc.alto) / 1080;
  const zonas = ajustes.plataformas.flatMap((p) =>
    zonasTapadas(p, ajustes.formato).map((z) => ({
      motivo: z.motivo,
      caja: [z.x * esc.ancho, z.y * esc.alto, (z.x + z.ancho) * esc.ancho, (z.y + z.alto) * esc.alto] as Caja,
    })),
  );
  const conSubtitulo = ajustes.subtitulos.activados ? proyecto.frases.filter((f) => f.subtitulo !== false && f.texto.trim()) : [];
  const medidor = new Canvas(8, 8).getContext('2d') as unknown as CanvasRenderingContext2D;
  const cajasSub = new Map(conSubtitulo.map((f) => [f, maquetarSubtitulo(medidor, esc, f.texto).caja as Caja]));

  // Escenas: huecos y encimadas.
  const escenas = [...proyecto.escenas].sort((a, b) => a.inicio - b.inicio);
  let fin = 0;
  for (const e of escenas) {
    if (e.inicio > fin + 1e-6) {
      avisos.push({ regla: 'escenas', mensaje: `Entre ${seg(fin)} y ${seg(e.inicio)} no hay escena: se ve solo el fondo del proyecto.` });
    } else if (e.inicio < fin - 1e-6) {
      errores.push({ regla: 'escenas', mensaje: `La escena "${e.id}" empieza en ${seg(e.inicio)}, antes de que termine la anterior (${seg(fin)}). Las escenas no se pueden encimar.` });
    }
    fin = Math.max(fin, e.fin);
  }
  if (fin < esc.duracion - 1e-6) avisos.push({ regla: 'escenas', mensaje: `De ${seg(fin)} a ${seg(esc.duracion)} no hay escena.` });

  // Piezas que nunca se ven.
  for (const e of esc.escenas) {
    for (const np of e.hijos) {
      if (np.entra && np.entra.en >= e.fin) {
        avisos.push({ regla: 'nunca-se-ve', pieza: np.nodo.id, mensaje: `"${np.nodo.id}" entra en ${seg(np.entra.en)}, cuando su escena "${e.escena.id}" ya terminó (${seg(e.fin)}).` });
      }
    }
  }

  // Subtítulos en una zona tapada.
  for (const [f, caja] of cajasSub) {
    for (const z of zonas) {
      if (area(interseccion(caja, z.caja)) > area(caja) * 0.05) {
        const n = proyecto.frases.indexOf(f) + 1;
        una(errores, `sub-zona:${n}:${z.motivo}`, {
          regla: 'zona-tapada', t: f.inicio,
          mensaje: `El subtítulo de la frase ${n} ("${f.texto}") queda bajo la ${z.motivo} (ocupa ${px(caja)}). Cambia subtitulos.posicion o subtitulos.tamano, o acorta la frase.`,
        });
      }
    }
  }

  const registros = medirPiezas(esc, entorno);
  for (const [t, regs] of registros) {
    const frase = conSubtitulo.find((f) => t >= f.inicio && t < f.fin);
    for (const r of regs) {
      if (r.nodo.tipo !== 'texto' || !r.nodo.texto.trim()) continue;
      const c = r.caja as Caja;
      const a = area(c);
      if (a <= 0) continue;

      if (r.reposo) {
        for (const z of zonas) {
          const i = area(interseccion(c, z.caja));
          if (i > a * 0.05) {
            una(errores, `zona:${r.ruta}:${z.motivo}`, {
              regla: 'zona-tapada', pieza: r.ruta, t,
              mensaje: `El texto "${r.ruta}" queda bajo la ${z.motivo} en ${seg(t)} (ocupa ${px(c)}; la zona es ${px(z.caja)}).`,
            });
          }
        }
        const dentro = area(interseccion(c, lienzo));
        if (dentro < a * 0.95) {
          una(errores, `fuera:${r.ruta}`, {
            regla: 'fuera-del-lienzo', pieza: r.ruta, t,
            mensaje: `El texto "${r.ruta}" se sale del lienzo en ${seg(t)} (ocupa ${px(c)}; el lienzo es ${esc.ancho}×${esc.alto}).`,
          });
        }
        const tam = r.nodo.tamano * r.escala;
        if (tam < 28 * k) {
          una(avisos, `chico:${r.ruta}`, {
            regla: 'texto-chico', pieza: r.ruta, t,
            mensaje: `El texto "${r.ruta}" se ve de ${Math.round(tam)} px; en el teléfono se lee mal por debajo de ${Math.round(28 * k)} px.`,
          });
        }
      }

      if (frase) {
        if (area(interseccion(c, cajasSub.get(frase)!)) > a * 0.15) {
          una(avisos, `sub-encima:${r.ruta}:${frase.inicio}`, {
            regla: 'subtitulo-encima', pieza: r.ruta, t,
            mensaje: `El subtítulo de la frase "${frase.texto}" tapa el texto "${r.ruta}" en ${seg(t)}.`,
          });
        }
        const pf = palabras(frase.texto);
        const pt = new Set(palabras(r.nodo.texto));
        if (pf.length >= 2 && pf.filter((w) => pt.has(w)).length / pf.length >= 0.7) {
          const n = proyecto.frases.indexOf(frase) + 1;
          una(avisos, `duplicado:${n}`, {
            regla: 'subtitulo-duplicado', pieza: r.ruta, t,
            mensaje: `La frase ${n} ("${frase.texto}") ya está escrita en el texto "${r.ruta}". Ponle subtitulo: false para no repetirla.`,
          });
        }
      }
    }
  }
  return { errores, avisos };
}

/** Clave para saber si un hallazgo ya existía antes de un cambio. */
export const claveHallazgo = (h: Hallazgo) => `${h.regla}|${h.pieza ?? ''}|${h.mensaje.replace(/\d+(\.\d+)?/g, '#')}`;
