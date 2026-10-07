/** Lo que el proceso principal le ofrece a la interfaz (a través del preload). */
import type { ProyectoEntrada } from '@motionai/documento';
import type { Resultado, Version } from '@motionai/estudio';
import type { Esfuerzo, EstadoApp, EstadoClaude, EventoAgente, Referencia } from '@motionai/mcp';

export type { Esfuerzo, EstadoApp, EstadoClaude, EventoAgente, Referencia };

/** Modelos que se ofrecen, como alias de Claude Code (siempre apuntan a la versión más nueva). Vacío: el de Claude Code. */
export const MODELOS = ['', 'opus', 'sonnet', 'haiku', 'fable'] as const;
export type Modelo = (typeof MODELOS)[number];
export const ESFUERZOS_APP = ['', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

/** Con qué modelo y esfuerzo trabaja Claude. */
export interface OpcionesClaude {
  modelo?: Modelo;
  esfuerzo?: Esfuerzo | '';
}

export interface ProyectoAbierto {
  ruta: string;
  base: string;
  documento: ProyectoEntrada;
  version: number;
}

export interface Reciente {
  ruta: string;
  nombre: string;
  abierto: string;
}

export interface CambioDocumento {
  documento: ProyectoEntrada;
  version: number;
  herramienta: string;
  mensaje: string;
}

export interface HerramientaUsada {
  id: string;
  nombre: string;
  /** Mientras no llega el resultado está en curso. */
  estado: 'curso' | 'ok' | 'error';
  resumen?: string;
}

export interface Turno {
  id: string;
  rol: 'usuario' | 'claude';
  texto: string;
  fecha: string;
  referencias?: Referencia[];
  herramientas?: HerramientaUsada[];
  /** Versiones que dejó esta respuesta. */
  versionAntes?: number;
  versionDespues?: number;
  error?: string;
  enCurso?: boolean;
  /** Modelo que contestó (el que reporta Claude Code) y esfuerzo pedido. */
  modelo?: string;
  esfuerzo?: Esfuerzo;
}

export interface NuevoProyecto {
  nombre: string;
  formato: '9:16' | '4:5' | '1:1' | '16:9';
  duracion: number;
  fps: 24 | 25 | 30 | 60;
  /** Con qué se escribe el video: el motor propio o HyperFrames (HTML). */
  motor?: 'motionai' | 'hyperframes';
}

export interface ApiMotionAI {
  revisarClaude(): Promise<EstadoClaude>;
  /** El usuario señala dónde está Claude Code; null si cancela. */
  elegirClaude(): Promise<EstadoClaude | null>;
  recientes(): Promise<Reciente[]>;
  nuevoProyecto(op: NuevoProyecto): Promise<ProyectoAbierto>;
  /** Sin ruta muestra el diálogo para elegir un proyecto.json. */
  abrirProyecto(ruta?: string): Promise<ProyectoAbierto | null>;
  proyectoActual(): Promise<ProyectoAbierto | null>;
  cerrarProyecto(): Promise<void>;
  cambiarAjustes(cambios: Record<string, unknown>): Promise<Resultado>;
  versiones(): Promise<Version[]>;
  volverA(version: number): Promise<Resultado>;
  exportar(op?: { formato?: string }): Promise<{ salida: string; segundosRender: number }>;
  mostrarArchivo(ruta: string): Promise<void>;
  /** Elige un audio y lo carga como voz (se transcribe) o como música. Null si el usuario cancela. */
  cargarAudio(tipo: 'voz' | 'musica'): Promise<{ ok: boolean; mensaje: string; errores?: string[]; frases?: number; transcripcion?: string } | null>;
  /** Elige un SVG o .pen y lo importa a la biblioteca (o la campaña completa de un .pen). Null si el usuario cancela. */
  importar(): Promise<{ ok: boolean; mensaje: string; errores?: string[]; componentes: number; campana: boolean } | null>;
  /** Abre un archivo con la app predeterminada (para reproducir el MP4). */
  abrirArchivo(ruta: string): Promise<void>;
  /** Idioma de la interfaz: el principal lo usa en sus diálogos y para pedirle a Claude que responda igual. */
  idioma(i: 'es' | 'en'): void;
  chat(): Promise<Turno[]>;
  enviar(texto: string, referencias: Referencia[], opciones?: OpcionesClaude): Promise<void>;
  cancelar(): Promise<void>;
  /** La interfaz avisa qué ve el usuario, para leer_estado. */
  estadoApp(e: EstadoApp): void;
  alCambiar(f: (c: CambioDocumento) => void): () => void;
  alTurno(f: (t: Turno) => void): () => void;
  alExportar(f: (p: { hechos: number; total: number }) => void): () => void;
}

declare global {
  interface Window {
    motionai: ApiMotionAI;
  }
}
