import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { lanzarAgente, type EventoAgente, type OpcionesAgente, type Referencia } from '@motionai/mcp';
import type { Turno } from '../compartido/api.js';

/** Describe las referencias que tocó el usuario para que viajen con su mensaje. */
export function describirReferencias(refs: Referencia[]): string {
  if (!refs.length) return '';
  const linea = (r: Referencia) => {
    const partes = [
      r.tipo === 'pieza' ? `pieza "${r.id}"${r.nombre && r.nombre !== r.id ? ` (${r.nombre})` : ''}` :
      r.tipo === 'escena' ? `escena "${r.id}"${r.nombre ? ` (${r.nombre})` : ''}` :
      r.tipo === 'frase' ? `frase ${r.id}${r.nombre ? ` ("${r.nombre}")` : ''}` : 'momento',
      r.escena && r.tipo !== 'escena' ? `en la escena "${r.escena}"` : '',
      r.t !== undefined ? `a los ${r.t.toFixed(2)} s` : '',
      r.punto ? `punto (${Math.round(r.punto[0])}, ${Math.round(r.punto[1])}) del lienzo` : '',
    ].filter(Boolean);
    return `- ${partes.join(', ')}`;
  };
  return `\n\nReferencias que tocó el usuario en la app:\n${refs.map(linea).join('\n')}`;
}

const SISTEMA: Record<'es' | 'en', string> = {
  es:
    'Trabajas dentro de la app de escritorio MotionAI. El proyecto ya está abierto y el usuario lo ve en vivo en el monitor ' +
    'mientras lo cambias: no crees ni abras otros proyectos. Las referencias al final de un mensaje son piezas, escenas o ' +
    'momentos que el usuario tocó en la app; úsalas para saber a qué se refiere. Responde breve en español: qué hiciste y qué ' +
    'podría pedir después. Al hablar de piezas usa lo que se ve (su texto, su forma o su nombre), no sus ids. No exportes salvo que te lo pidan.',
  en:
    'You are working inside the MotionAI desktop app. The project is already open and the user watches it live in the monitor ' +
    'while you change it: do not create or open other projects. References at the end of a message are pieces, scenes or ' +
    'moments the user clicked in the app; use them to know what they mean. The guides and tool results are in Spanish, but ' +
    'reply briefly in English: what you did and what they could ask next. When talking about pieces, describe what is visible ' +
    '(their text, shape or name), not their ids. Do not export unless asked.',
};

interface Guardado {
  sesion?: string;
  turnos: Turno[];
}

/**
 * Conversación de un proyecto: una sola sesión de Claude Code (se continúa con --resume) y los turnos
 * que muestra la app, guardados en .motionai/chat.json.
 */
export class Chat {
  private datos: Guardado = { turnos: [] };
  private control?: AbortController;
  private archivo: string;

  constructor(base: string, private lanzar: Omit<OpcionesAgente, 'mensaje' | 'sesion' | 'senal'>) {
    this.archivo = path.join(base, '.motionai', 'chat.json');
  }

  async cargar(): Promise<Turno[]> {
    if (existsSync(this.archivo)) {
      try { this.datos = JSON.parse(await readFile(this.archivo, 'utf8')); } catch { this.datos = { turnos: [] }; }
    }
    // Si la app se cerró a media respuesta, ese turno ya no sigue.
    for (const t of this.datos.turnos) if (t.enCurso) { t.enCurso = false; t.error ??= 'Se interrumpió.'; }
    return this.datos.turnos;
  }

  get ocupado(): boolean {
    return !!this.control;
  }

  private async guardar(): Promise<void> {
    await mkdir(path.dirname(this.archivo), { recursive: true });
    await writeFile(this.archivo, JSON.stringify(this.datos, null, 2));
  }

  /** Manda un mensaje. `alTurno` recibe cada turno cada vez que cambia; `version` da la versión actual del documento. */
  async enviar(texto: string, referencias: Referencia[], version: () => number, alTurno: (t: Turno) => void, idioma: 'es' | 'en' = 'es'): Promise<void> {
    if (this.control) throw new Error(idioma === 'en' ? 'Claude is still answering the previous message.' : 'Claude todavía está respondiendo el mensaje anterior.');
    const id = () => Math.random().toString(36).slice(2, 10);
    const usuario: Turno = { id: id(), rol: 'usuario', texto, fecha: new Date().toISOString(), ...(referencias.length ? { referencias } : {}) };
    const claude: Turno = { id: id(), rol: 'claude', texto: '', fecha: new Date().toISOString(), herramientas: [], versionAntes: version(), enCurso: true };
    this.datos.turnos.push(usuario, claude);
    alTurno(usuario);
    alTurno(claude);
    this.control = new AbortController();
    const alEvento = (e: EventoAgente) => {
      switch (e.tipo) {
        case 'inicio':
          this.datos.sesion = e.sesion;
          break;
        case 'texto':
          claude.texto += (claude.texto ? '\n\n' : '') + e.texto;
          break;
        case 'herramienta':
          claude.herramientas!.push({ id: e.id, nombre: e.nombre, estado: 'curso' });
          break;
        case 'resultado': {
          const h = claude.herramientas!.find((x) => x.id === e.id);
          if (h) { h.estado = e.error ? 'error' : 'ok'; h.resumen = e.texto.split('\n').slice(0, 3).join(' ').slice(0, 300); }
          break;
        }
        case 'fin':
          if (e.sesion) this.datos.sesion = e.sesion;
          if (e.error) claude.error = e.texto ?? 'Claude terminó con un error.';
          else if (e.texto && !claude.texto) claude.texto = e.texto;
          break;
      }
      claude.versionDespues = version();
      alTurno({ ...claude, herramientas: [...claude.herramientas!] });
    };
    try {
      await lanzarAgente(
        { ...this.lanzar, mensaje: texto + describirReferencias(referencias), sesion: this.datos.sesion, senal: this.control.signal, sistema: SISTEMA[idioma] },
        alEvento,
      );
    } catch (e) {
      claude.error = (e as Error).message;
    } finally {
      this.control = undefined;
      claude.enCurso = false;
      claude.versionDespues = version();
      alTurno({ ...claude, herramientas: [...claude.herramientas!] });
      await this.guardar();
    }
  }

  cancelar(): void {
    this.control?.abort();
  }
}
