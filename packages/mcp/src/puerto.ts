import path from 'node:path';
import type { Componente, Formato, Frase, Nodo, ProyectoEntrada } from '@motionai/documento';
import { Estudio, type Resultado, type Tramo, type Version } from '@motionai/estudio';

/** Lo que la app sabe y Claude no: qué ve el usuario y qué tocó para el mensaje. */
export interface EstadoApp {
  tiempo: number | null;
  seleccion: string[];
  referencias: Referencia[];
}

/** Algo que el usuario tocó en la interfaz y viaja con su mensaje. */
export interface Referencia {
  tipo: 'pieza' | 'escena' | 'frase' | 'tiempo';
  id?: string;
  nombre?: string;
  escena?: string;
  /** Segundo del proyecto. */
  t?: number;
  /** Punto del lienzo donde hizo clic. */
  punto?: [number, number];
}

export interface Cambio {
  version: number;
  herramienta: string;
  mensaje: string;
}

export type ResultadoAudio = Resultado & { tramos?: Tramo[]; duracion?: number };
export interface ResultadoExportar { salida: string; cuadros: number; segundos: number; segundosRender: number }
export interface OpcionesNuevo {
  nombre: string;
  formato?: Formato;
  duracion?: number;
  fps?: number;
  ancho?: number;
  alto?: number;
  fondo?: string;
  carpeta?: string;
}

/**
 * Todo lo que las herramientas pueden pedirle al proyecto. Lo implementa el servidor solo (PuertoLocal)
 * o la app abierta, a través de un socket (PuertoRemoto): así Claude y el usuario editan el mismo documento.
 */
export interface PuertoEstudio {
  estado(): Promise<Record<string, unknown> | null>;
  resumen(): Promise<string>;
  documento(): Promise<ProyectoEntrada>;
  nuevo(op: OpcionesNuevo): Promise<{ ruta: string; resumen: string }>;
  abrir(ruta: string): Promise<{ ruta: string; resumen: string }>;
  ajustes(cambios: Record<string, unknown>): Promise<Resultado>;
  crearPieza(c: Componente, reemplazar: boolean): Promise<Resultado>;
  agregarPieza(op: { pieza: Nodo; escena?: string; dentro_de?: string; posicion?: number | 'frente' | 'fondo' }): Promise<Resultado>;
  cambiar(cambios: ({ id: string } & Record<string, unknown>)[]): Promise<Resultado>;
  quitarPieza(ids: string[]): Promise<Resultado>;
  escenas(op: Parameters<Estudio['escenas']>[0]): Promise<Resultado>;
  audio(op: { archivo: string; tipo?: 'voz' | 'musica'; inicio?: number; volumen?: number; frases?: Frase[] }): Promise<ResultadoAudio>;
  buscarBiblioteca(texto?: string, tipo?: string): Promise<Componente[]>;
  verCuadro(tiempos: number[], op: { zonas?: boolean; resaltar?: string[]; formato?: Formato; lado?: number }): Promise<Buffer>;
  exportar(op: { salida?: string; formato?: Formato; desde?: number; hasta?: number }): Promise<ResultadoExportar>;
  versiones(limite?: number): Promise<Version[]>;
  volverA(numero: number): Promise<Resultado>;
}

export const METODOS_PUERTO = [
  'estado', 'resumen', 'documento', 'nuevo', 'abrir', 'ajustes', 'crearPieza', 'agregarPieza', 'cambiar', 'quitarPieza',
  'escenas', 'audio', 'buscarBiblioteca', 'verCuadro', 'exportar', 'versiones', 'volverA',
] as const satisfies readonly (keyof PuertoEstudio)[];

export class ErrorSinProyecto extends Error {
  constructor() {
    super('No hay un proyecto abierto. Usa nuevo_proyecto o abrir_proyecto.');
  }
}

/** El proyecto vive en este proceso. Lo usan el servidor MCP suelto y la app. */
export class PuertoLocal implements PuertoEstudio {
  estudio?: Estudio;
  private oyentes = new Set<(c: Cambio) => void>();
  private oyentesProyecto = new Set<(e: Estudio) => void>();

  constructor(
    readonly carpetaProyectos: string,
    private op: {
      estadoApp?: () => EstadoApp;
      /** En la app el usuario decide qué proyecto está abierto; Claude no puede cambiarlo. */
      bloquearProyecto?: boolean;
      progresoExportar?: (hechos: number, total: number) => void;
    } = {},
  ) {}

  /** Avisa cada cambio aplicado (de Claude o del usuario). */
  alCambiar(f: (c: Cambio) => void): () => void {
    this.oyentes.add(f);
    return () => this.oyentes.delete(f);
  }

  /** Avisa cuando se abre o crea un proyecto. */
  alAbrir(f: (e: Estudio) => void): () => void {
    this.oyentesProyecto.add(f);
    return () => this.oyentesProyecto.delete(f);
  }

  private abierto(): Estudio {
    if (!this.estudio) throw new ErrorSinProyecto();
    return this.estudio;
  }

  private async cambio(herramienta: string, r: Promise<Resultado>): Promise<Resultado> {
    const res = await r;
    if (res.ok) for (const f of this.oyentes) f({ version: res.version, herramienta, mensaje: res.mensaje });
    return res;
  }

  usar(e: Estudio): void {
    if (this.estudio && this.estudio !== e) this.estudio.cerrar();
    this.estudio = e;
    for (const f of this.oyentesProyecto) f(e);
  }

  async estado() {
    if (!this.estudio) return null;
    return { ...this.estudio.estado(), ...(this.op.estadoApp?.() ?? {}) };
  }
  async resumen() { return this.abierto().resumen(); }
  async documento() { return this.abierto().documento; }

  async nuevo(op: OpcionesNuevo) {
    if (this.op.bloquearProyecto) throw new Error('En la app, el usuario elige qué proyecto está abierto. Trabaja sobre el actual.');
    const slug = op.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto';
    const carpeta = op.carpeta ? path.resolve(this.carpetaProyectos, op.carpeta) : path.join(this.carpetaProyectos, slug);
    this.usar(await Estudio.crear({ ...op, carpeta }));
    return { ruta: this.estudio!.ruta, resumen: this.estudio!.resumen() };
  }

  async abrir(ruta: string) {
    if (this.op.bloquearProyecto) throw new Error('En la app, el usuario elige qué proyecto está abierto. Trabaja sobre el actual.');
    let r = path.resolve(this.carpetaProyectos, ruta);
    if (!r.endsWith('.json')) r = path.join(r, 'proyecto.json');
    this.usar(await Estudio.abrir(r));
    return { ruta: this.estudio!.ruta, resumen: this.estudio!.resumen() };
  }

  ajustes(c: Record<string, unknown>) { return this.cambio('ajustes_proyecto', this.abierto().ajustes(c)); }
  crearPieza(c: Componente, reemplazar: boolean) { return this.cambio('crear_pieza', this.abierto().crearPieza(c, reemplazar)); }
  agregarPieza(op: Parameters<PuertoEstudio['agregarPieza']>[0]) { return this.cambio('agregar_pieza', this.abierto().agregarPieza(op)); }
  cambiar(c: Parameters<PuertoEstudio['cambiar']>[0]) { return this.cambio('cambiar', this.abierto().cambiar(c)); }
  quitarPieza(ids: string[]) { return this.cambio('quitar_pieza', this.abierto().quitarPieza(ids)); }
  escenas(op: Parameters<PuertoEstudio['escenas']>[0]) { return this.cambio('escenas', this.abierto().escenas(op)); }
  async audio(op: Parameters<PuertoEstudio['audio']>[0]) {
    const r = await this.abierto().audio(op);
    if (r.ok) for (const f of this.oyentes) f({ version: r.version, herramienta: 'voz', mensaje: r.mensaje });
    return r;
  }
  async buscarBiblioteca(texto?: string, tipo?: string) { return this.abierto().buscarBiblioteca(texto, tipo); }
  verCuadro(tiempos: number[], op: Parameters<PuertoEstudio['verCuadro']>[1]) { return this.abierto().verCuadro(tiempos, op); }
  exportar(op: Parameters<PuertoEstudio['exportar']>[0]) { return this.abierto().exportar({ ...op, progreso: this.op.progresoExportar }); }
  async versiones(limite?: number) { return this.abierto().versiones(limite); }
  volverA(n: number) { return this.cambio('versiones', this.abierto().volverA(n)); }
}
