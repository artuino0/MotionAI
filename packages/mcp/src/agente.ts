/**
 * Puente con la IA: lanza el Claude Code del usuario (`claude -p`) con las herramientas de la app y nada más,
 * y traduce su salida en streaming a eventos simples. Es el único lugar que conoce el formato de esa salida,
 * así un cambio entre versiones de Claude Code se arregla aquí.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const SERVIDOR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'servidor.ts');
const NOMBRE_MCP = 'motionai';

export interface OpcionesAgente {
  mensaje: string;
  /** Carpeta donde se crean los proyectos nuevos. */
  carpetaProyectos: string;
  /** Proyecto que el servidor abre al arrancar. */
  proyecto?: string;
  /** Sesión de Claude Code a continuar (una por proyecto, así recuerda lo que ya hizo). */
  sesion?: string;
  modelo?: string;
  /** Ejecutable de Claude Code; por defecto `claude` del PATH. */
  claude?: string;
  cwd?: string;
  /** Texto extra para el system prompt. */
  sistema?: string;
}

export type EventoAgente =
  | { tipo: 'inicio'; sesion: string; modelo?: string; herramientas: string[] }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'herramienta'; id: string; nombre: string; entrada: unknown }
  | { tipo: 'resultado'; id: string; error: boolean; texto: string; imagenes: number }
  | { tipo: 'fin'; sesion?: string; error: boolean; texto?: string; costoUsd?: number; duracionMs?: number; turnos?: number };

/** Configuración MCP que apunta al servidor de la app. */
export function configuracionMcp(op: Pick<OpcionesAgente, 'carpetaProyectos' | 'proyecto'>) {
  const tsx = createRequire(import.meta.url).resolve('tsx/cli');
  const args = ['--disable-warning=ExperimentalWarning', tsx, SERVIDOR, '--carpeta', op.carpetaProyectos];
  if (op.proyecto) args.push('--proyecto', op.proyecto);
  return { mcpServers: { [NOMBRE_MCP]: { command: process.execPath, args } } };
}

/**
 * Argumentos de `claude`. Las herramientas propias de Claude Code (archivos, terminal, web) quedan apagadas
 * con `--tools ""`: Claude solo puede tocar el documento a través del MCP de la app.
 */
export function argumentosClaude(op: OpcionesAgente, rutaConfig: string): string[] {
  const args = [
    '-p', op.mensaje,
    '--output-format', 'stream-json', '--verbose',
    '--mcp-config', rutaConfig, '--strict-mcp-config',
    '--tools', '',
    '--allowedTools', `mcp__${NOMBRE_MCP}`,
  ];
  if (op.sesion) args.push('--resume', op.sesion);
  if (op.modelo) args.push('--model', op.modelo);
  if (op.sistema) args.push('--append-system-prompt', op.sistema);
  return args;
}

/** Traduce un renglón de `--output-format stream-json` a eventos. */
export function leerRenglon(json: unknown, nombres: Map<string, string>): EventoAgente[] {
  const m = json as Record<string, any>;
  const out: EventoAgente[] = [];
  const corto = (n: string) => n.replace(`mcp__${NOMBRE_MCP}__`, '');
  if (m.type === 'system' && m.subtype === 'init') {
    out.push({ tipo: 'inicio', sesion: m.session_id, modelo: m.model, herramientas: (m.tools ?? []).map(corto) });
  } else if (m.type === 'assistant') {
    for (const c of m.message?.content ?? []) {
      if (c.type === 'text' && c.text?.trim()) out.push({ tipo: 'texto', texto: c.text });
      if (c.type === 'tool_use') {
        nombres.set(c.id, corto(c.name));
        out.push({ tipo: 'herramienta', id: c.id, nombre: corto(c.name), entrada: c.input });
      }
    }
  } else if (m.type === 'user') {
    for (const c of m.message?.content ?? []) {
      if (c.type !== 'tool_result') continue;
      const partes = Array.isArray(c.content) ? c.content : [{ type: 'text', text: String(c.content ?? '') }];
      out.push({
        tipo: 'resultado',
        id: c.tool_use_id,
        error: !!c.is_error,
        texto: partes.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n'),
        imagenes: partes.filter((p: any) => p.type === 'image').length,
      });
    }
  } else if (m.type === 'result') {
    out.push({
      tipo: 'fin', sesion: m.session_id, error: !!m.is_error, texto: m.result,
      costoUsd: m.total_cost_usd, duracionMs: m.duration_ms, turnos: m.num_turns,
    });
  }
  return out;
}

/** Lanza Claude Code con un mensaje y entrega los eventos conforme llegan. */
export async function lanzarAgente(op: OpcionesAgente, alEvento: (e: EventoAgente) => void): Promise<{ codigo: number; sesion?: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'motionai-agente-'));
  const rutaConfig = path.join(dir, 'mcp.json');
  await writeFile(rutaConfig, JSON.stringify(configuracionMcp(op)));
  // Si la app corre dentro de otra sesión de Claude Code, el hijo no debe heredar su id de sesión.
  const { CLAUDE_CODE_SESSION_ID: _, ...env } = process.env;
  const hijo = spawn(op.claude ?? 'claude', argumentosClaude(op, rutaConfig), {
    cwd: op.cwd ?? op.carpetaProyectos,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let sesion: string | undefined;
  let errores = '';
  hijo.stderr.on('data', (d) => (errores += d));
  const nombres = new Map<string, string>();
  const lector = createInterface({ input: hijo.stdout });
  lector.on('line', (linea) => {
    if (!linea.trim()) return;
    let json: unknown;
    try { json = JSON.parse(linea); } catch { return; }
    for (const e of leerRenglon(json, nombres)) {
      if (e.tipo === 'inicio' || e.tipo === 'fin') sesion = e.sesion ?? sesion;
      alEvento(e);
    }
  });
  const codigo = await new Promise<number>((ok, mal) => {
    hijo.on('error', (e) => mal(new Error(`No se pudo lanzar Claude Code (${op.claude ?? 'claude'}): ${e.message}`)));
    hijo.on('close', (c) => ok(c ?? 1));
  });
  if (codigo !== 0 && errores.trim()) alEvento({ tipo: 'fin', sesion, error: true, texto: errores.trim().slice(-2000) });
  return { codigo, sesion };
}
