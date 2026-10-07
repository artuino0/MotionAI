import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BrowserWindow, app, dialog, ipcMain, net, protocol, shell } from 'electron';
import { CARPETA_COMPOSICION, type Formato } from '@motionai/documento';
import { Estudio } from '@motionai/estudio';
import { campanasDePen, leerPen } from '@motionai/importar';
import { readFile } from 'node:fs/promises';
import { PuertoLocal, revisarClaude, rutaSocket, servirPuerto, type Esfuerzo, type EstadoApp } from '@motionai/mcp';
import { ESFUERZOS_APP, MODELOS, type NuevoProyecto, type OpcionesClaude, type ProyectoAbierto, type Turno } from '../compartido/api.js';

/** Solo pasan a la línea de comandos los valores de las listas. */
function opcionesValidas(o: OpcionesClaude | undefined): { modelo?: string; esfuerzo?: Esfuerzo } {
  const modelo = o?.modelo && (MODELOS as readonly string[]).includes(o.modelo) ? o.modelo : undefined;
  const esfuerzo = o?.esfuerzo && (ESFUERZOS_APP as readonly string[]).includes(o.esfuerzo) ? (o.esfuerzo as Esfuerzo) : undefined;
  return { ...(modelo ? { modelo } : {}), ...(esfuerzo ? { esfuerzo } : {}) };
}
import { Chat } from './chat.js';
import { Recientes } from './recientes.js';

const DIST = path.dirname(fileURLToPath(import.meta.url));
process.env.MOTIONAI_FUENTES ??= path.join(DIST, 'recursos/fuentes');
process.env.MOTIONAI_GUIAS ??= path.join(DIST, 'recursos/guias');
// whisper.cpp va en recursos/whisper (el instalador lo incluye); MOTIONAI_WHISPER lo reemplaza en desarrollo.
process.env.MOTIONAI_RECURSOS ??= path.join(DIST, 'recursos');
// El instalador trae ffmpeg y ffprobe en recursos/ffmpeg: van primero en el PATH (también para Claude y el servidor MCP).
{
  const ffmpeg = path.join(DIST, 'recursos', 'ffmpeg');
  if (existsSync(ffmpeg)) process.env.PATH = `${ffmpeg}${path.delimiter}${process.env.PATH ?? ''}`;
}
/**
 * Claude Code que eligió el usuario (o MOTIONAI_CLAUDE). Sin elección, resolverClaude lo busca en el PATH y donde lo
 * dejan sus instaladores.
 */
function rutaClaude(): string | undefined {
  if (process.env.MOTIONAI_CLAUDE) return process.env.MOTIONAI_CLAUDE;
  try {
    const r = (JSON.parse(readFileSync(path.join(app.getPath('userData'), 'claude.json'), 'utf8')) as { ruta?: string }).ruta;
    return r && existsSync(r) ? r : undefined;
  } catch {
    return undefined;
  }
}

// proyecto://local/<ruta> sirve archivos de la carpeta del proyecto abierto (fuentes, imágenes, audio).
protocol.registerSchemesAsPrivileged([
  { scheme: 'proyecto', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const carpetaProyectos = () => process.env.MOTIONAI_CARPETA ?? path.join(app.getPath('documents'), 'MotionAI');
let ventana: BrowserWindow | undefined;
let estadoApp: EstadoApp = { tiempo: null, seleccion: [], referencias: [] };
let chat: Chat | undefined;
let socket = '';
let idioma: 'es' | 'en' = 'es';

const enviar = (canal: string, dato: unknown) => ventana?.webContents.send(canal, dato);

const puerto = new PuertoLocal(carpetaProyectos(), {
  estadoApp: () => estadoApp,
  bloquearProyecto: true,
  progresoExportar: (hechos, total) => enviar('exportar:progreso', { hechos, total }),
});

puerto.alCambiar((c) => {
  const e = puerto.estudio;
  if (e) enviar('proyecto:cambio', { ...c, documento: e.documento });
});

function abierto(): ProyectoAbierto | null {
  const e = puerto.estudio;
  return e ? { ruta: e.ruta, base: e.base, documento: e.documento, version: e.version } : null;
}

const recientes = () => new Recientes(path.join(app.getPath('userData'), 'recientes.json'));

async function usar(e: Estudio): Promise<ProyectoAbierto> {
  puerto.usar(e);
  await recientes().agregar(e.ruta, e.documento.nombre);
  chat = new Chat(e.base, {
    carpetaProyectos: e.base,
    cwd: e.base,
    // Con HyperFrames, Claude escribe la composición con herramientas de archivos, solo dentro del proyecto.
    archivos: e.motor !== 'motionai',
    alTerminar: () => puerto.sincronizar(),
    socket,
    claude: rutaClaude(),
    modelo: process.env.MOTIONAI_MODELO,
    // Claude Code lanza el servidor MCP con el Node de Electron; el servidor le pasa todo a esta app por el socket.
    servidor: {
      command: process.execPath,
      args: [path.join(DIST, 'mcp.mjs')],
      env: {
        ELECTRON_RUN_AS_NODE: '1',
        NODE_OPTIONS: '--disable-warning=ExperimentalWarning',
        MOTIONAI_GUIAS: process.env.MOTIONAI_GUIAS!,
        MOTIONAI_FUENTES: process.env.MOTIONAI_FUENTES!,
      },
    },
  });
  await chat.cargar();
  return abierto()!;
}

/** Pone el runtime de HyperFrames al principio del <head>, como su vista previa: así el reproductor puede controlar la página. */
function conRuntime(html: string): string {
  const tag = '<script src="proyecto://local/__hyperframes/runtime.js"></script>';
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (h) => `${h}\n    ${tag}`);
  return tag + html;
}

function carpetaLibre(nombre: string): string {
  const slug = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto';
  let carpeta = path.join(carpetaProyectos(), slug);
  for (let i = 2; existsSync(carpeta); i++) carpeta = path.join(carpetaProyectos(), `${slug}-${i}`);
  return carpeta;
}

function registrarIpc() {
  ipcMain.handle('claude:revisar', () => revisarClaude(rutaClaude()));
  // Si no lo encuentra solo, el usuario puede señalar dónde está claude (claude.exe o claude.cmd en Windows).
  ipcMain.handle('claude:elegir', async () => {
    const r = await dialog.showOpenDialog(ventana!, {
      title: idioma === 'en' ? 'Where is Claude Code?' : '¿Dónde está Claude Code?',
      properties: ['openFile'],
      ...(process.platform === 'win32' ? { filters: [{ name: 'Claude Code', extensions: ['exe', 'cmd'] }] } : {}),
    });
    if (r.canceled || !r.filePaths[0]) return null;
    writeFileSync(path.join(app.getPath('userData'), 'claude.json'), JSON.stringify({ ruta: r.filePaths[0] }));
    return revisarClaude(r.filePaths[0]);
  });
  ipcMain.handle('recientes', () => recientes().listar());
  ipcMain.handle('proyecto:nuevo', async (_e, op: NuevoProyecto) =>
    usar(await Estudio.crear({
      carpeta: carpetaLibre(op.nombre), nombre: op.nombre, formato: op.formato as Formato, duracion: op.duracion, fps: op.fps,
      motor: op.motor ?? 'motionai',
    })),
  );
  ipcMain.handle('proyecto:abrir', async (_e, ruta?: string) => {
    if (!ruta) {
      const r = await dialog.showOpenDialog(ventana!, {
        title: idioma === 'en' ? 'Open project' : 'Abrir proyecto',
        defaultPath: carpetaProyectos(),
        properties: ['openFile'],
        filters: [{ name: idioma === 'en' ? 'MotionAI project' : 'Proyecto MotionAI', extensions: ['json'] }],
      });
      if (r.canceled || !r.filePaths[0]) return null;
      ruta = r.filePaths[0];
    }
    return usar(await Estudio.abrir(ruta));
  });
  ipcMain.handle('proyecto:actual', () => abierto());
  ipcMain.handle('proyecto:cerrar', () => {
    chat?.cancelar();
    puerto.estudio?.cerrar();
    puerto.estudio = undefined;
    chat = undefined;
  });
  ipcMain.handle('ajustes', (_e, c: Record<string, unknown>) => puerto.ajustes(c));
  ipcMain.handle('versiones', () => puerto.versiones(200));
  ipcMain.handle('versiones:volver', (_e, n: number) => puerto.volverA(n));
  ipcMain.handle('exportar', (_e, op: { formato?: Formato }) => puerto.exportar(op));
  ipcMain.handle('archivo:mostrar', (_e, ruta: string) => shell.showItemInFolder(ruta));
  ipcMain.handle('audio:cargar', async (_e, tipo: 'voz' | 'musica') => {
    const e = puerto.estudio;
    if (!e) throw new Error(idioma === 'en' ? 'No project is open.' : 'No hay un proyecto abierto.');
    const r = await dialog.showOpenDialog(ventana!, {
      title: idioma === 'en' ? (tipo === 'voz' ? 'Choose the voice-over' : 'Choose the music') : tipo === 'voz' ? 'Elige la voz' : 'Elige la música',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const res = await puerto.audio({ archivo: r.filePaths[0], tipo });
    return {
      ok: res.ok, mensaje: res.mensaje, errores: res.errores, transcripcion: res.transcripcion,
      frases: res.ok ? (puerto.estudio?.documento.frases?.length ?? 0) : undefined,
    };
  });
  ipcMain.handle('importar', async () => {
    if (!puerto.estudio) throw new Error(idioma === 'en' ? 'No project is open.' : 'No hay un proyecto abierto.');
    const en = idioma === 'en';
    const r = await dialog.showOpenDialog(ventana!, {
      title: en ? 'Import an SVG or .pen file' : 'Importar un SVG o un .pen',
      properties: ['openFile'],
      filters: [{ name: 'SVG, Pencil', extensions: ['svg', 'pen'] }],
    });
    const archivo = r.filePaths[0];
    if (r.canceled || !archivo) return null;
    let modo: 'biblioteca' | 'campana' = 'biblioteca';
    let campana: string | undefined;
    if (archivo.toLowerCase().endsWith('.pen')) {
      // Si el .pen trae una campaña, se puede traer completa (reemplaza escenas, frases y voz).
      let campanas: string[] = [];
      try { campanas = campanasDePen(leerPen(await readFile(archivo, 'utf8'))); } catch { /* el estudio da el error */ }
      if (campanas.length) {
        campana = campanas[0];
        const b = await dialog.showMessageBox(ventana!, {
          type: 'question',
          message: en ? `This file includes the campaign “${campana}”.` : `Este archivo trae la campaña «${campana}».`,
          detail: en
            ? 'You can bring only its pieces to the library, or the whole campaign: scenes, animation, phrases and voice. The whole campaign replaces this project’s scenes (you can go back in History).'
            : 'Puedes traer solo sus piezas a la biblioteca, o la campaña completa: escenas, animación, frases y voz. La campaña completa reemplaza las escenas de este proyecto (puedes volver desde el Historial).',
          buttons: en ? ['Pieces only', 'Whole campaign', 'Cancel'] : ['Solo las piezas', 'Campaña completa', 'Cancelar'],
          defaultId: 0, cancelId: 2,
        });
        if (b.response === 2) return null;
        if (b.response === 1) modo = 'campana';
      }
    }
    const res = await puerto.importar({ archivo, modo, ...(modo === 'campana' ? { campana } : {}) });
    return { ok: res.ok, mensaje: res.mensaje, errores: res.errores, componentes: res.componentes?.length ?? 0, campana: modo === 'campana' };
  });
  ipcMain.handle('archivo:abrir', async (_e, ruta: string) => {
    const error = await shell.openPath(ruta);
    if (error) throw new Error(error);
  });
  ipcMain.on('idioma', (_e, i: 'es' | 'en') => (idioma = i === 'en' ? 'en' : 'es'));
  ipcMain.handle('chat', () => chat?.cargar() ?? []);
  ipcMain.handle('chat:enviar', (_e, texto: string, referencias, opciones?: OpcionesClaude) => {
    if (!chat) throw new Error(idioma === 'en' ? 'No project is open.' : 'No hay un proyecto abierto.');
    estadoApp = { ...estadoApp, referencias };
    // No se espera: la respuesta llega por chat:turno.
    void chat.enviar(texto, referencias, () => puerto.estudio?.version ?? 0, (t: Turno) => enviar('chat:turno', t), idioma, opcionesValidas(opciones));
  });
  ipcMain.handle('chat:cancelar', () => chat?.cancelar());
  ipcMain.on('estado-app', (_e, e: EstadoApp) => (estadoApp = e));
}

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#14161a',
    title: 'MotionAI',
    webPreferences: { preload: path.join(DIST, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  ventana.removeMenu();
  void ventana.loadFile(path.join(DIST, 'interfaz/index.html'));
  ventana.on('closed', () => (ventana = undefined));
}

app.whenReady().then(async () => {
  protocol.handle('proyecto', (req) => {
    const base = puerto.estudio?.base;
    if (!base) return new Response('Sin proyecto', { status: 404 });
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    // Runtime de HyperFrames para el reproductor del monitor (lo inyecta en cada HTML de la composición).
    if (rel === '__hyperframes/runtime.js') {
      return net.fetch(pathToFileURL(path.join(DIST, 'recursos/hyperframes/runtime.js')).toString());
    }
    const archivo = path.resolve(base, rel);
    if (!archivo.startsWith(base + path.sep) || !existsSync(archivo)) return new Response('No existe', { status: 404 });
    if (archivo.startsWith(path.join(base, CARPETA_COMPOSICION) + path.sep) && archivo.endsWith('.html')) {
      return readFile(archivo, 'utf8').then((html) => new Response(conRuntime(html), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }));
    }
    return net.fetch(pathToFileURL(archivo).toString());
  });
  socket = (await servirPuerto(puerto, rutaSocket())).ruta;
  registrarIpc();
  crearVentana();
  // Para pruebas: abrir un proyecto al arrancar.
  if (process.env.MOTIONAI_ABRIR) await usar(await Estudio.abrir(process.env.MOTIONAI_ABRIR));
});

app.on('window-all-closed', () => {
  chat?.cancelar();
  app.quit();
});
