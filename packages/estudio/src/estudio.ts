import { existsSync, statSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  FORMATO_IDS, VERSION_FORMATO, conFormato, dimensiones, duracionDe, validarProyecto,
  type Componente, type Escena, type Formato, type Frase, type Nodo, type Proyecto, type ProyectoEntrada,
} from '@motionai/documento';
import { ErrorPreparar, ErrorTrazado, preparar } from '@motionai/motor';
import { campanaDePen, campanasDePen, componenteDeSvg, componentesDePen, leerPen } from '@motionai/importar';
import { cargarRecursos, exportarMP4, rutaPorDefecto } from '@motionai/render';
import { buscarEscena, buscarPieza, idsUsados } from './buscar.js';
import { asegurarFuentes, catalogoFuentes } from './catalogo.js';
import { Historial, type Version } from './historial.js';
import { formatearJson } from './json.js';
import { analizar, claveHallazgo, type Analisis, type Hallazgo } from './reglas.js';
import { hojaDeCuadros, type OpcionesVista } from './vista.js';
import { armarFrases, encontrarWhisper, transcribir } from './transcribir.js';
import { duracionAudio, tramosDeVoz, type Tramo } from './voz.js';

export interface Resultado {
  ok: boolean;
  /** Versión del documento después del cambio (o la actual si no hubo cambio). */
  version: number;
  mensaje: string;
  errores?: string[];
  avisos?: string[];
}

export class ErrorEstudio extends Error {}

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => !!v && typeof v === 'object' && !Array.isArray(v);

/** Mezcla `cambios` sobre `destino`: los objetos se mezclan, lo demás se reemplaza y `null` borra. */
function mezclar(destino: Objeto, cambios: Objeto, profundo = true): void {
  for (const [k, v] of Object.entries(cambios)) {
    if (v === null) delete destino[k];
    else if (profundo && esObjeto(v) && esObjeto(destino[k])) mezclar(destino[k] as Objeto, v);
    else destino[k] = structuredClone(v);
  }
}

const describir = (h: Hallazgo) => `[${h.regla}] ${h.mensaje}`;

/**
 * Un proyecto abierto. Todo cambio pasa por `aplicar`: se valida el esquema, se prepara para el motor,
 * se revisan las reglas y solo entonces se guarda el archivo y una versión nueva.
 */
export class Estudio {
  private hallazgos: Set<string>;
  private cola: Promise<unknown> = Promise.resolve();
  private mtime = 0;
  private exportando = false;

  private constructor(
    readonly ruta: string,
    private doc: ProyectoEntrada,
    private historial: Historial,
    analisis: Analisis,
  ) {
    this.hallazgos = new Set([...analisis.errores, ...analisis.avisos].map(claveHallazgo));
  }

  get base(): string {
    return path.dirname(this.ruta);
  }

  get version(): number {
    return this.historial.ultima();
  }

  /** El documento tal como está escrito (sin valores por defecto). */
  get documento(): ProyectoEntrada {
    return structuredClone(this.doc);
  }

  static async abrir(ruta: string): Promise<Estudio> {
    ruta = path.resolve(ruta);
    if (!existsSync(ruta)) throw new ErrorEstudio(`No existe ${ruta}`);
    const doc = JSON.parse(await readFile(ruta, 'utf8')) as ProyectoEntrada;
    const r = validarProyecto(doc);
    if (!r.ok) throw new ErrorEstudio(`El proyecto no es válido:\n- ${r.errores.join('\n- ')}`);
    const historial = new Historial(path.dirname(ruta));
    if (historial.ultima() === 0) historial.guardar(doc, 'abrir_proyecto', 'Proyecto abierto');
    const { entorno } = await cargarRecursos({ proyecto: r.proyecto, base: path.dirname(ruta) });
    const e = new Estudio(ruta, doc, historial, analizar(r.proyecto, entorno));
    e.mtime = statSync(ruta).mtimeMs;
    return e;
  }

  static async crear(op: {
    carpeta: string;
    nombre: string;
    formato?: Formato;
    ancho?: number;
    alto?: number;
    fps?: number;
    duracion?: number;
    fondo?: string;
  }): Promise<Estudio> {
    const ruta = path.resolve(op.carpeta, 'proyecto.json');
    if (existsSync(ruta)) throw new ErrorEstudio(`Ya existe un proyecto en ${ruta}. Ábrelo con abrir_proyecto.`);
    const duracion = op.duracion ?? 15;
    const ajustes: Objeto = { formato: op.formato ?? '9:16', fps: op.fps ?? 30, duracion };
    if (op.formato === 'libre') { ajustes.ancho = op.ancho; ajustes.alto = op.alto; }
    if (op.fondo) ajustes.fondo = op.fondo;
    const doc = {
      formato: 'motionai',
      version: VERSION_FORMATO,
      nombre: op.nombre,
      ajustes,
      fuentes: [],
      frases: [],
      biblioteca: [],
      escenas: [{ id: 'e1', nombre: 'Escena 1', inicio: 0, fin: duracion, hijos: [] }],
    } as unknown as ProyectoEntrada;
    const r = validarProyecto(doc);
    if (!r.ok) throw new ErrorEstudio(`No se pudo crear el proyecto:\n- ${r.errores.join('\n- ')}`);
    await mkdir(path.join(path.dirname(ruta), 'recursos'), { recursive: true });
    await writeFile(ruta, formatearJson(doc) + '\n');
    return Estudio.abrir(ruta);
  }

  /** Proyecto validado, con los valores por defecto llenos. */
  proyecto(): Proyecto {
    const r = validarProyecto(this.doc);
    if (!r.ok) throw new ErrorEstudio(r.errores.join('\n'));
    return r.proyecto;
  }

  /** Si alguien editó el archivo a mano, lo vuelve a leer antes de cambiarlo. */
  private async recargarSiCambio(): Promise<void> {
    const m = statSync(this.ruta).mtimeMs;
    if (m === this.mtime) return;
    const doc = JSON.parse(await readFile(this.ruta, 'utf8')) as ProyectoEntrada;
    if (validarProyecto(doc).ok) {
      this.doc = doc;
      this.historial.guardar(doc, 'externo', 'Cambio hecho fuera de la app');
    }
    this.mtime = m;
  }

  /** Aplica un cambio al documento si pasa el esquema, el motor y las reglas. Los cambios van uno por uno. */
  aplicar(herramienta: string, mutar: (doc: ProyectoEntrada) => string | Promise<string>, op: { tolerarReglas?: boolean } = {}): Promise<Resultado> {
    const tarea = this.cola.then(() => this.aplicarAhora(herramienta, mutar, op.tolerarReglas));
    this.cola = tarea.catch(() => undefined);
    return tarea;
  }

  private async aplicarAhora(herramienta: string, mutar: (doc: ProyectoEntrada) => string | Promise<string>, tolerarReglas = false): Promise<Resultado> {
    await this.recargarSiCambio();
    const copia = structuredClone(this.doc);
    let mensaje: string;
    try {
      mensaje = await mutar(copia);
    } catch (e) {
      return this.rechazo([(e as Error).message]);
    }
    const nuevasFuentes = await asegurarFuentes(copia, this.base);
    const v = validarProyecto(copia);
    if (!v.ok) {
      const fuentes = v.errores.some((e) => e.includes('usa la fuente'))
        ? [`Fuentes disponibles: ${catalogoFuentes().map((f) => f.familia).join(', ')}.`]
        : [];
      return this.rechazo([...v.errores, ...fuentes]);
    }
    let analisis: Analisis;
    try {
      const { entorno, faltantes } = await cargarRecursos({ proyecto: v.proyecto, base: this.base });
      if (faltantes.length) return this.rechazo([`Faltan archivos en el proyecto: ${faltantes.join(', ')}`]);
      analisis = analizar(v.proyecto, entorno);
    } catch (e) {
      if (e instanceof ErrorPreparar || e instanceof ErrorTrazado || e instanceof Error) return this.rechazo([e.message]);
      throw e;
    }
    // Solo se rechaza por reglas que este cambio rompe; las que ya estaban rotas se reportan como aviso.
    // Una importación trae el diseño tal como era: sus errores quedan como avisos para corregirlos después.
    const nuevos = analisis.errores.filter((h) => !this.hallazgos.has(claveHallazgo(h)));
    if (nuevos.length && !tolerarReglas) return this.rechazo(nuevos.map(describir));

    this.doc = copia;
    await writeFile(this.ruta, formatearJson(copia) + '\n');
    this.mtime = statSync(this.ruta).mtimeMs;
    const version = this.historial.guardar(copia, herramienta, mensaje);
    this.hallazgos = new Set([...analisis.errores, ...analisis.avisos].map(claveHallazgo));
    const avisos = [...analisis.errores.map((h) => `${describir(h)} (${nuevos.includes(h) ? 'viene del archivo importado' : 'ya estaba así'})`), ...analisis.avisos.map(describir)];
    if (nuevasFuentes.length) mensaje += ` Agregué la fuente ${nuevasFuentes.join(', ')} al proyecto.`;
    return { ok: true, version, mensaje, ...(avisos.length ? { avisos } : {}) };
  }

  private rechazo(errores: string[]): Resultado {
    return { ok: false, version: this.version, mensaje: 'No se aplicó el cambio.', errores };
  }

  // ------------------------------------------------------------------ lectura

  estado() {
    const p = this.proyecto();
    const { ancho, alto } = dimensiones(p.ajustes);
    return {
      proyecto: { nombre: p.nombre, ruta: this.ruta, version: this.version },
      formato: `${p.ajustes.formato} · ${ancho}×${alto} · ${p.ajustes.fps} fps`,
      duracion: duracionDe(p),
      escenas: p.escenas.map((e) => ({ id: e.id, nombre: e.nombre, inicio: e.inicio, fin: e.fin, piezas: e.hijos.length })),
      frases: p.frases.length,
      biblioteca: p.biblioteca.map((c) => c.id),
      // Lo llena la app cuando está abierta (fase 3): tiempo del monitor, selección y referencias del mensaje.
      tiempo: null,
      seleccion: [],
      referencias: [],
    };
  }

  /** Resumen legible del documento: escenas, piezas con su tipo, posición y animación. */
  resumen(): string {
    const p = this.proyecto();
    const out: string[] = [];
    const { ancho, alto } = dimensiones(p.ajustes);
    out.push(`${p.nombre} · ${p.ajustes.formato} ${ancho}×${alto} · ${p.ajustes.fps} fps · ${duracionDe(p)} s · versión ${this.version}`);
    if (p.frases.length) {
      out.push('Frases:');
      p.frases.forEach((f, i) => out.push(`  f${i + 1} ${f.inicio}–${f.fin} s${f.subtitulo === false ? ' (sin subtítulo)' : ''}: ${f.texto}`));
    }
    const pieza = (n: Nodo, nivel: number) => {
      const sp = '  '.repeat(nivel);
      const a = n.animacion;
      const anim = [
        a?.entra && `entra ${a.entra.tipo} en ${a.entra.en}`,
        a?.sale && `sale ${a.sale.tipo} en ${a.sale.en}`,
        a?.pistas && `pistas: ${Object.keys(a.pistas).join(', ')}`,
        a?.ciclos && `ciclos: ${a.ciclos.map((c) => c.tipo).join(', ')}`,
      ].filter(Boolean).join('; ');
      const extra =
        n.tipo === 'texto' ? ` "${n.texto.replace(/\n/g, '⏎')}" ${n.fuente} ${n.tamano}px` :
        n.tipo === 'instancia' ? ` de ${n.componente}` :
        n.tipo === 'rect' || n.tipo === 'elipse' || n.tipo === 'imagen' ? ` ${n.ancho}×${n.alto}` : '';
      out.push(`${sp}- ${n.id} (${n.tipo}${extra}) en ${n.x ?? 0}, ${n.y ?? 0}${n.ancla ? ` ancla ${n.ancla}` : ''}${anim ? ` · ${anim}` : ''}`);
      if (n.tipo === 'grupo') n.hijos.forEach((h) => pieza(h, nivel + 1));
    };
    for (const e of p.escenas) {
      out.push(`Escena ${e.id}${e.nombre ? ` · ${e.nombre}` : ''} (${e.inicio}–${e.fin} s)`);
      e.hijos.forEach((h) => pieza(h, 1));
    }
    if (p.biblioteca.length) {
      out.push('Biblioteca:');
      for (const c of p.biblioteca) {
        out.push(`  ${c.id} · ${c.nombre}${c.tipo ? ` (${c.tipo})` : ''}${c.nota ? ` — ${c.nota}` : ''}`);
        pieza(c.raiz, 2);
      }
    }
    return out.join('\n');
  }

  buscarBiblioteca(texto = '', tipo?: string): Componente[] {
    const q = texto.toLowerCase();
    return (this.doc.biblioteca ?? []).filter(
      (c) =>
        (!tipo || c.tipo === tipo) &&
        (!q || [c.id, c.nombre, c.tipo, c.nota].some((s) => s?.toLowerCase().includes(q))),
    );
  }

  versiones(limite = 20): Version[] {
    return this.historial.listar(limite);
  }

  // ------------------------------------------------------------------ cambios

  ajustes(cambios: Objeto): Promise<Resultado> {
    return this.aplicar('ajustes_proyecto', (doc) => {
      if ('formato' in cambios && !(FORMATO_IDS as readonly string[]).includes(String(cambios.formato))) {
        throw new ErrorEstudio(`Formato "${cambios.formato}" desconocido. Usa ${FORMATO_IDS.join(', ')}.`);
      }
      doc.ajustes = (doc.ajustes ?? {}) as ProyectoEntrada['ajustes'];
      mezclar(doc.ajustes as Objeto, cambios);
      return `Ajustes cambiados: ${Object.keys(cambios).join(', ')}.`;
    });
  }

  crearPieza(componente: Componente, reemplazar = false): Promise<Resultado> {
    return this.aplicar('crear_pieza', (doc) => {
      doc.biblioteca ??= [];
      const i = doc.biblioteca.findIndex((c) => c.id === componente.id);
      if (i >= 0 && !reemplazar) throw new ErrorEstudio(`Ya existe el componente "${componente.id}". Usa reemplazar: true para cambiarlo.`);
      if (i >= 0) doc.biblioteca[i] = structuredClone(componente);
      else doc.biblioteca.push(structuredClone(componente));
      return `${i >= 0 ? 'Reemplacé' : 'Creé'} el componente "${componente.id}" en la biblioteca.`;
    });
  }

  agregarPieza(op: { pieza: Nodo; escena?: string; dentro_de?: string; posicion?: number | 'frente' | 'fondo' }): Promise<Resultado> {
    return this.aplicar('agregar_pieza', (doc) => {
      if (idsUsados(doc).has(op.pieza.id)) throw new ErrorEstudio(`El id "${op.pieza.id}" ya existe. Usa otro.`);
      let lista: Nodo[];
      let donde: string;
      if (op.dentro_de) {
        const u = buscarPieza(doc, op.dentro_de);
        if (!u || u.nodo.tipo !== 'grupo') throw new ErrorEstudio(`No hay un grupo con id "${op.dentro_de}".`);
        lista = u.nodo.hijos;
        donde = `el grupo "${op.dentro_de}"`;
      } else {
        const e = op.escena ? buscarEscena(doc, op.escena) : doc.escenas.length === 1 ? doc.escenas[0] : undefined;
        if (!e) throw new ErrorEstudio(op.escena ? `No existe la escena "${op.escena}".` : 'Di en qué escena va la pieza (escena: id).');
        lista = e.hijos;
        donde = `la escena "${e.id}"`;
      }
      const i = op.posicion === 'fondo' ? 0 : typeof op.posicion === 'number' ? Math.max(0, Math.min(lista.length, op.posicion)) : lista.length;
      lista.splice(i, 0, structuredClone(op.pieza));
      return `Agregué "${op.pieza.id}" (${op.pieza.tipo}) a ${donde}.`;
    });
  }

  /**
   * Cambia propiedades de piezas, escenas o componentes por id.
   * Mezcla `animacion` por partes (entra, sale, pistas por propiedad, ciclos); `null` borra.
   * `capa`: frente, fondo, adelante o atras mueve la pieza en el orden de dibujo.
   */
  cambiar(cambios: ({ id: string } & Objeto)[]): Promise<Resultado> {
    return this.aplicar('cambiar', (doc) => {
      const hechos: string[] = [];
      for (const { id, ...props } of cambios) {
        if ('tipo' in props) throw new ErrorEstudio(`No se puede cambiar el tipo de "${id}". Quítala y agrega otra.`);
        const u = buscarPieza(doc, id);
        if (u) {
          const { capa, animacion, ...resto } = props;
          const n = u.nodo as unknown as Objeto;
          // Las propiedades de una pieza se reemplazan completas (salvo la animación), para no dejar restos.
          mezclar(n, resto, false);
          if (animacion !== undefined) {
            if (animacion === null) delete n.animacion;
            else {
              const a = (n.animacion ?? {}) as Objeto;
              const { pistas, ...otras } = animacion as Objeto;
              mezclar(a, otras, false);
              if (pistas === null) delete a.pistas;
              else if (pistas !== undefined) {
                a.pistas = (a.pistas ?? {}) as Objeto;
                mezclar(a.pistas as Objeto, pistas as Objeto, false);
              }
              n.animacion = a;
            }
          }
          if (capa !== undefined) {
            if (!u.lista) throw new ErrorEstudio(`"${id}" es la raíz de un componente: no tiene capa.`);
            const [nodo] = u.lista.splice(u.indice, 1);
            const destino =
              capa === 'frente' ? u.lista.length : capa === 'fondo' ? 0 :
              capa === 'adelante' ? Math.min(u.lista.length, u.indice + 1) :
              capa === 'atras' ? Math.max(0, u.indice - 1) : NaN;
            if (Number.isNaN(destino)) throw new ErrorEstudio(`capa debe ser frente, fondo, adelante o atras.`);
            u.lista.splice(destino, 0, nodo!);
          }
          hechos.push(`${id}: ${Object.keys(props).join(', ')}`);
          continue;
        }
        const e = buscarEscena(doc, id);
        if (e) {
          if ('hijos' in props) throw new ErrorEstudio('Las piezas de una escena se cambian con agregar_pieza y quitar_pieza.');
          mezclar(e as unknown as Objeto, props, false);
          hechos.push(`escena ${id}: ${Object.keys(props).join(', ')}`);
          continue;
        }
        const c = doc.biblioteca?.find((x) => x.id === id);
        if (c) {
          mezclar(c as unknown as Objeto, props, false);
          hechos.push(`componente ${id}: ${Object.keys(props).join(', ')}`);
          continue;
        }
        throw new ErrorEstudio(`No hay ninguna pieza, escena o componente con id "${id}".`);
      }
      return `Cambié ${hechos.join('; ')}.`;
    });
  }

  quitarPieza(ids: string[]): Promise<Resultado> {
    return this.aplicar('quitar_pieza', (doc) => {
      for (const id of ids) {
        const u = buscarPieza(doc, id);
        if (u?.lista) { u.lista.splice(u.indice, 1); continue; }
        const i = doc.biblioteca?.findIndex((c) => c.id === id) ?? -1;
        if (i >= 0) {
          const usos = doc.escenas.flatMap((e) => e.hijos).filter((n) => n.tipo === 'instancia' && n.componente === id);
          if (usos.length) throw new ErrorEstudio(`El componente "${id}" se usa en ${usos.map((n) => n.id).join(', ')}. Quita esas piezas primero.`);
          doc.biblioteca!.splice(i, 1);
          continue;
        }
        throw new ErrorEstudio(`No hay ninguna pieza ni componente con id "${id}".`);
      }
      return `Quité ${ids.join(', ')}.`;
    });
  }

  escenas(op:
    | { operacion: 'crear'; id: string; nombre?: string; inicio: number; fin: number; fondo?: Escena['fondo'] }
    | { operacion: 'quitar'; id: string }
    | { operacion: 'partir'; id: string; en: number; nuevo_id: string; nombre?: string }
    | { operacion: 'mover_corte'; id: string; fin: number }
  ): Promise<Resultado> {
    return this.aplicar('escenas', (doc) => {
      const orden = () => doc.escenas.sort((a, b) => a.inicio - b.inicio);
      switch (op.operacion) {
        case 'crear': {
          if (idsUsados(doc).has(op.id)) throw new ErrorEstudio(`El id "${op.id}" ya existe.`);
          doc.escenas.push({ id: op.id, nombre: op.nombre, inicio: op.inicio, fin: op.fin, fondo: op.fondo, hijos: [] });
          orden();
          return `Creé la escena "${op.id}" de ${op.inicio} a ${op.fin} s.`;
        }
        case 'quitar': {
          if (doc.escenas.length === 1) throw new ErrorEstudio('El proyecto necesita al menos una escena.');
          const i = doc.escenas.findIndex((e) => e.id === op.id);
          if (i < 0) throw new ErrorEstudio(`No existe la escena "${op.id}".`);
          doc.escenas.splice(i, 1);
          return `Quité la escena "${op.id}" con sus piezas.`;
        }
        case 'partir': {
          const e = buscarEscena(doc, op.id);
          if (!e) throw new ErrorEstudio(`No existe la escena "${op.id}".`);
          if (op.en <= e.inicio || op.en >= e.fin) throw new ErrorEstudio(`Para partir "${op.id}" el corte debe estar entre ${e.inicio} y ${e.fin}.`);
          if (idsUsados(doc).has(op.nuevo_id)) throw new ErrorEstudio(`El id "${op.nuevo_id}" ya existe.`);
          doc.escenas.push({ id: op.nuevo_id, nombre: op.nombre, inicio: op.en, fin: e.fin, fondo: e.fondo, hijos: [] });
          e.fin = op.en;
          orden();
          return `Partí "${op.id}" en ${op.en} s; la parte nueva es "${op.nuevo_id}" (vacía).`;
        }
        case 'mover_corte': {
          orden();
          const i = doc.escenas.findIndex((e) => e.id === op.id);
          if (i < 0) throw new ErrorEstudio(`No existe la escena "${op.id}".`);
          const e = doc.escenas[i]!, sig = doc.escenas[i + 1];
          if (op.fin <= e.inicio) throw new ErrorEstudio(`El corte debe quedar después de ${e.inicio} s.`);
          if (sig && sig.inicio === e.fin) {
            if (op.fin >= sig.fin) throw new ErrorEstudio(`El corte debe quedar antes de ${sig.fin} s, donde termina "${sig.id}".`);
            sig.inicio = op.fin;
          }
          e.fin = op.fin;
          return `Moví el corte de "${op.id}" a ${op.fin} s.`;
        }
      }
    });
  }

  /** Carga un audio de voz o música (lo copia a recursos/) y, si se dan, pone las frases. */
  /**
   * Carga un audio de voz o música (lo copia a recursos/). Con voz y sin frases dadas, la transcribe con
   * whisper.cpp si está instalado y arma las frases con los tiempos de las pausas.
   */
  async audio(op: {
    archivo: string; tipo?: 'voz' | 'musica'; inicio?: number; volumen?: number; frases?: Frase[];
    transcribir?: boolean; idioma?: string;
  }): Promise<Resultado & { tramos?: Tramo[]; duracion?: number; transcripcion?: 'whisper' | 'sin-whisper' | 'dada' | 'no' }> {
    const tipo = op.tipo ?? 'voz';
    const origen = path.resolve(this.base, op.archivo);
    if (!existsSync(origen)) return this.rechazo([`No existe el archivo ${op.archivo}`]);
    const rel = path.relative(this.base, origen).startsWith('..') || path.isAbsolute(path.relative(this.base, origen))
      ? `recursos/${path.basename(origen)}`
      : path.relative(this.base, origen).split(path.sep).join('/');
    if (!existsSync(path.join(this.base, rel))) {
      await mkdir(path.join(this.base, 'recursos'), { recursive: true });
      await copyFile(origen, path.join(this.base, rel));
    }
    const abs = path.join(this.base, rel);
    const duracion = await duracionAudio(abs);
    const inicio = op.inicio ?? 0;
    const tramos = tipo === 'voz' ? await tramosDeVoz(abs) : undefined;
    let frases = op.frases;
    let transcripcion: 'whisper' | 'sin-whisper' | 'dada' | 'no' = frases ? 'dada' : 'no';
    if (tipo === 'voz' && !frases && op.transcribir !== false) {
      const w = encontrarWhisper();
      if (w) {
        const { palabras } = await transcribir(abs, w, op.idioma ?? 'auto');
        frases = armarFrases(palabras, tramos ?? [], inicio);
        transcripcion = 'whisper';
      } else transcripcion = 'sin-whisper';
    }
    const r = await this.aplicar('voz', (doc) => {
      doc.ajustes = (doc.ajustes ?? {}) as ProyectoEntrada['ajustes'];
      const audio = ((doc.ajustes as Objeto).audio ??= {}) as Objeto;
      audio[tipo] = { archivo: rel, inicio, volumen: op.volumen ?? 1 };
      if (frases) doc.frases = structuredClone(frases);
      const detalle = transcripcion === 'whisper' ? `; la transcribí en ${frases!.length} frases` : frases ? ` con ${frases.length} frases` : '';
      const total = (doc.ajustes as Objeto).duracion as number | undefined ?? Math.max(...doc.escenas.map((x) => x.fin));
      const larga = inicio + duracion > total + 0.05 ? ` Ojo: el audio termina en ${(inicio + duracion).toFixed(2)} s y el video dura ${total} s; ajusta la duración y las escenas.` : '';
      return `Cargué ${rel} como ${tipo} (${duracion.toFixed(2)} s)${detalle}.${larga}`;
    });
    return { ...r, tramos, duracion, transcripcion };
  }

  /**
   * Importa un SVG o un .pen. Un SVG se vuelve un componente de la biblioteca. De un .pen se traen sus
   * piezas reusables (`modo: 'biblioteca'`, por defecto) o una campaña completa (`modo: 'campana'`):
   * escenas, frases, voz y formato, que reemplazan a los del proyecto. Los archivos que usan las piezas
   * se copian a recursos/.
   */
  async importar(op: {
    archivo: string; modo?: 'biblioteca' | 'campana'; campana?: string; piezas?: string[];
    id?: string; nombre?: string; tipo?: string; reemplazar?: boolean;
  }): Promise<Resultado & { componentes?: string[]; campanas?: string[] }> {
    const origen = path.resolve(this.base, op.archivo);
    if (!existsSync(origen)) return this.rechazo([`No existe el archivo ${op.archivo}`]);
    const ext = path.extname(origen).toLowerCase();
    const avisos: string[] = [];
    let componentes: Componente[];
    let campana: ReturnType<typeof campanaDePen> | undefined;
    let campanas: string[] | undefined;
    try {
      if (ext === '.svg') {
        const base = path.basename(origen, ext);
        const id = op.id ?? (base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'svg');
        const r = componenteDeSvg(await readFile(origen, 'utf8'), {
          id, nombre: op.nombre ?? base, ...(op.tipo ? { tipo: op.tipo } : {}), fuentes: catalogoFuentes().map((f) => f.familia),
        });
        componentes = [r.componente];
        avisos.push(...r.avisos);
      } else if (ext === '.pen') {
        const pen = leerPen(await readFile(origen, 'utf8'));
        campanas = campanasDePen(pen);
        if (op.modo === 'campana') {
          campana = campanaDePen(pen, op.campana);
          componentes = campana.componentes;
          avisos.push(...campana.avisos);
        } else {
          const r = componentesDePen(pen, op.piezas);
          componentes = r.componentes;
          avisos.push(...r.avisos);
          await this.copiarRecursos(path.dirname(origen), r.recursos);
        }
        if (campana) await this.copiarRecursos(path.dirname(origen), campana.recursos);
      } else return this.rechazo([`No sé importar archivos ${ext || 'sin extensión'}: usa .svg o .pen.`]);
    } catch (e) {
      return this.rechazo([(e as Error).message]);
    }
    let nuevos: string[] = [];
    const r = await this.aplicar('importar', (doc) => {
      doc.biblioteca ??= [];
      const saltados: string[] = [];
      nuevos = [];
      for (const c of componentes) {
        const i = doc.biblioteca.findIndex((x) => x.id === c.id);
        if (i >= 0 && !op.reemplazar && !campana) { saltados.push(c.id); continue; }
        if (i >= 0) doc.biblioteca[i] = structuredClone(c);
        else doc.biblioteca.push(structuredClone(c));
        nuevos.push(c.id);
      }
      if (saltados.length) avisos.push(`Ya estaban en la biblioteca (usa reemplazar: true para cambiarlos): ${saltados.join(', ')}.`);
      if (campana) {
        doc.escenas = structuredClone(campana.escenas);
        doc.frases = structuredClone(campana.frases);
        doc.ajustes = (doc.ajustes ?? {}) as ProyectoEntrada['ajustes'];
        const a = doc.ajustes as Objeto;
        a.formato = campana.formato;
        delete a.ancho; delete a.alto;
        a.duracion = campana.duracion;
        if (campana.voz) ((a.audio ??= {}) as Objeto).voz = { archivo: campana.voz.archivo, inicio: campana.voz.inicio, volumen: 1 };
        return `Importé la campaña "${campana.nombre}": ${campana.escenas.length} escenas, ${campana.frases.length} frases y ${nuevos.length} componentes${campana.voz ? ', con su voz' : ''}.`;
      }
      return nuevos.length
        ? `Importé ${nuevos.length === 1 ? `el componente "${nuevos[0]}"` : `${nuevos.length} componentes`} a la biblioteca.`
        : 'No había componentes nuevos que importar.';
    }, { tolerarReglas: true });
    return { ...r, avisos: [...avisos, ...(r.avisos ?? [])], componentes: nuevos, ...(campanas ? { campanas } : {}) };
  }

  /** Copia al proyecto los archivos que usan las piezas importadas (rutas relativas a `desde`). */
  private async copiarRecursos(desde: string, rutas: string[]): Promise<void> {
    for (const rel of rutas) {
      if (rel.includes('..') || path.isAbsolute(rel)) throw new ErrorEstudio(`La ruta ${rel} sale de la carpeta del archivo.`);
      const o = path.join(desde, rel), d = path.join(this.base, rel);
      if (!existsSync(o)) throw new ErrorEstudio(`Falta ${rel} junto al archivo importado.`);
      if (existsSync(d)) continue;
      await mkdir(path.dirname(d), { recursive: true });
      await copyFile(o, d);
    }
  }

  async verCuadro(tiempos: number[], op: OpcionesVista & { formato?: Formato } = {}): Promise<Buffer> {
    let p = this.proyecto();
    if (op.formato) p = conFormato(p, op.formato);
    const { entorno } = await cargarRecursos({ proyecto: p, base: this.base });
    const esc = preparar(p);
    const ts = tiempos.map((t) => Math.max(0, Math.min(esc.duracion, t)));
    return hojaDeCuadros(esc, entorno, ts, op);
  }

  async exportar(op: { salida?: string; formato?: Formato; desde?: number; hasta?: number; progreso?: (h: number, t: number) => void } = {}) {
    if (this.exportando) throw new ErrorEstudio('Ya se está exportando este proyecto. Espera a que termine; el MP4 queda en la carpeta de exportados.');
    this.exportando = true;
    try {
      return await this.exportarAhora(op);
    } finally {
      this.exportando = false;
    }
  }

  private async exportarAhora(op: Parameters<Estudio['exportar']>[0] & object) {
    let p = this.proyecto();
    if (op.formato) p = conFormato(p, op.formato);
    const { entorno, faltantes } = await cargarRecursos({ proyecto: p, base: this.base });
    if (faltantes.length) throw new ErrorEstudio(`Faltan archivos: ${faltantes.join(', ')}`);
    const salida = op.salida ? path.resolve(this.base, op.salida) : rutaPorDefecto(p, this.base).replace(/\.mp4$/, op.formato ? `_${op.formato.replace(':', 'x')}.mp4` : '.mp4');
    const inicio = Date.now();
    const r = await exportarMP4(preparar(p), entorno, this.base, salida, op);
    return { ...r, segundosRender: (Date.now() - inicio) / 1000 };
  }

  /** Vuelve el documento a una versión anterior; eso también queda como versión nueva. */
  volverA(numero: number): Promise<Resultado> {
    const doc = this.historial.leer(numero) as ProyectoEntrada | undefined;
    if (!doc) return Promise.resolve(this.rechazo([`No existe la versión ${numero}.`]));
    return this.aplicar('versiones', (d) => {
      for (const k of Object.keys(d)) delete (d as unknown as Objeto)[k];
      Object.assign(d, structuredClone(doc));
      return `Volví a la versión ${numero}.`;
    });
  }

  cerrar(): void {
    this.historial.cerrar();
  }
}
