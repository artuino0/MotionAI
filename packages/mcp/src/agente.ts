/**
 * Puente con la IA: lanza el Claude Code del usuario (`claude -p`) con las herramientas de la app y nada más,
 * y traduce su salida en streaming a eventos simples. Es el único lugar que conoce el formato de esa salida,
 * así un cambio entre versiones de Claude Code se arregla aquí.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const servidorTs = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'servidor.ts');
const NOMBRE_MCP = 'motionai';

/** Cuánto espera Claude Code a una herramienta (exportar un video largo puede tardar minutos). */
export const TIEMPO_HERRAMIENTA_MS = 15 * 60 * 1000;

/** Herramientas de archivos de Claude Code para los motores que se escriben en archivos. Sin terminal ni web. */
export const HERRAMIENTAS_ARCHIVOS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];

export const ESFUERZOS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Esfuerzo = (typeof ESFUERZOS)[number];

export interface OpcionesAgente {
  mensaje: string;
  /** Carpeta donde se crean los proyectos nuevos. */
  carpetaProyectos: string;
  /** Proyecto que el servidor abre al arrancar. */
  proyecto?: string;
  /** Sesión de Claude Code a continuar (una por proyecto, así recuerda lo que ya hizo). */
  sesion?: string;
  /** Modelo de Claude: un alias (`opus`, `sonnet`…) o un nombre completo. Sin él, el de Claude Code. */
  modelo?: string;
  /** Esfuerzo de razonamiento. Sin él, el de Claude Code. */
  esfuerzo?: Esfuerzo;
  /**
   * Con un motor que se escribe en archivos (HyperFrames), Claude puede leer y editar archivos, pero solo
   * dentro de `cwd` (la carpeta del proyecto): las ediciones fuera de ella piden permiso y en modo -p se niegan.
   */
  archivos?: boolean;
  /** Ejecutable de Claude Code; por defecto `claude` del PATH. */
  claude?: string;
  cwd?: string;
  /** Texto extra para el system prompt. */
  sistema?: string;
  /** Socket de la app abierta: el servidor MCP le pasa cada herramienta. */
  socket?: string;
  /** Cómo lanzar el servidor MCP (la app empaquetada usa su propio ejecutable). Por defecto, tsx sobre el código. */
  servidor?: { command: string; args: string[]; env?: Record<string, string> };
  /** Para cancelar la respuesta en curso. */
  senal?: AbortSignal;
}

export type EventoAgente =
  | { tipo: 'inicio'; sesion: string; modelo?: string; herramientas: string[] }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'herramienta'; id: string; nombre: string; entrada: unknown }
  | { tipo: 'resultado'; id: string; error: boolean; texto: string; imagenes: number }
  | { tipo: 'fin'; sesion?: string; error: boolean; texto?: string; costoUsd?: number; duracionMs?: number; turnos?: number };

/** Configuración MCP que apunta al servidor de la app. */
export function configuracionMcp(op: Pick<OpcionesAgente, 'carpetaProyectos' | 'proyecto' | 'socket' | 'servidor'>) {
  const extra = ['--carpeta', op.carpetaProyectos];
  if (op.proyecto) extra.push('--proyecto', op.proyecto);
  if (op.socket) extra.push('--socket', op.socket);
  if (op.servidor) {
    const { command, args, env } = op.servidor;
    return { mcpServers: { [NOMBRE_MCP]: { command, args: [...args, ...extra], ...(env ? { env } : {}), timeout: TIEMPO_HERRAMIENTA_MS } } };
  }
  const tsx = createRequire(import.meta.url).resolve('tsx/cli');
  // timeout: cuánto puede tardar una herramienta sin dar señales (ver_cuadro o revisar con HyperFrames pueden tardar).
  return { mcpServers: { [NOMBRE_MCP]: { command: process.execPath, args: ['--disable-warning=ExperimentalWarning', tsx, servidorTs(), ...extra], timeout: TIEMPO_HERRAMIENTA_MS } } };
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
    '--tools', op.archivos ? HERRAMIENTAS_ARCHIVOS.join(',') : '',
    '--allowedTools', [`mcp__${NOMBRE_MCP}`, ...(op.archivos ? HERRAMIENTAS_ARCHIVOS : [])].join(','),
    ...(op.archivos ? ['--permission-mode', 'acceptEdits'] : []),
  ];
  if (op.sesion) args.push('--resume', op.sesion);
  if (op.modelo) args.push('--model', op.modelo);
  if (op.esfuerzo) args.push('--effort', op.esfuerzo);
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
  // spawn falla con ENOENT (como si no existiera claude) cuando falta la carpeta de trabajo.
  const cwd = op.cwd ?? op.carpetaProyectos;
  await mkdir(cwd, { recursive: true });
  // Si la app corre dentro de otra sesión de Claude Code, el hijo no debe heredar su id de sesión.
  const { CLAUDE_CODE_SESSION_ID: _, ...resto } = process.env;
  // Exportar un video tarda más que el minuto que Claude Code espera por defecto a una herramienta MCP.
  const env = {
    ...resto,
    MCP_TOOL_TIMEOUT: resto.MCP_TOOL_TIMEOUT ?? String(TIEMPO_HERRAMIENTA_MS),
    CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: resto.CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT ?? String(TIEMPO_HERRAMIENTA_MS),
  };
  const hijo = spawn(op.claude ?? 'claude', argumentosClaude(op, rutaConfig), {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(op.senal ? { signal: op.senal } : {}),
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
    hijo.on('error', (e) => {
      if (op.senal?.aborted) ok(130);
      else mal(new Error(`No se pudo lanzar Claude Code (${op.claude ?? 'claude'}): ${e.message}`));
    });
    hijo.on('close', (c) => ok(c ?? 130));
  });
  if (op.senal?.aborted) alEvento({ tipo: 'fin', sesion, error: true, texto: 'Cancelado.' });
  else if (codigo !== 0 && errores.trim()) alEvento({ tipo: 'fin', sesion, error: true, texto: errores.trim().slice(-2000) });
  return { codigo, sesion };
}

export interface EstadoClaude {
  instalado: boolean;
  version?: string;
  sesionIniciada: boolean;
  /** Qué hacer si falta algo. */
  pasos?: string[];
}

/** Revisa que Claude Code esté instalado, en una versión soportada y con sesión iniciada. */
export async function revisarClaude(claude = 'claude'): Promise<EstadoClaude> {
  const correr = (args: string[]) =>
    new Promise<{ codigo: number; salida: string }>((ok) => {
      const h = spawn(claude, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let salida = '';
      h.stdout.on('data', (d) => (salida += d));
      h.on('error', () => ok({ codigo: -1, salida: '' }));
      h.on('close', (c) => ok({ codigo: c ?? 1, salida }));
    });
  const v = await correr(['--version']);
  if (v.codigo !== 0) {
    return {
      instalado: false,
      sesionIniciada: false,
      pasos: ['Instala Claude Code: https://code.claude.com', 'Abre una terminal y corre `claude` una vez para iniciar sesión.', 'Vuelve a la app.'],
    };
  }
  const version = /\d+\.\d+\.\d+/.exec(v.salida)?.[0];
  const minima = [2, 0, 0];
  const actual = (version ?? '0.0.0').split('.').map(Number);
  const i = actual.findIndex((n, k) => n !== minima[k]);
  const vieja = i >= 0 && actual[i]! < minima[i]!;
  const a = await correr(['auth', 'status', '--json']);
  let sesionIniciada = false;
  try { sesionIniciada = !!JSON.parse(a.salida).loggedIn; } catch { /* versión sin auth status */ }
  const pasos: string[] = [];
  if (vieja) pasos.push(`Actualiza Claude Code (tienes ${version}; la app necesita ${minima.join('.')} o más nueva).`);
  if (!sesionIniciada) pasos.push('Abre una terminal y corre `claude` una vez para iniciar sesión con tu cuenta (Pro o Max).');
  return { instalado: true, version, sesionIniciada, ...(pasos.length ? { pasos } : {}) };
}
