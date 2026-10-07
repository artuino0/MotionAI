import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BrowserWindow, app, dialog, ipcMain, net, protocol, shell } from 'electron';
import type { Formato } from '@motionai/documento';
import { Estudio } from '@motionai/estudio';
import { PuertoLocal, revisarClaude, rutaSocket, servirPuerto, type EstadoApp } from '@motionai/mcp';
import type { NuevoProyecto, ProyectoAbierto, Turno } from '../compartido/api.js';
import { Chat } from './chat.js';
import { Recientes } from './recientes.js';

const DIST = path.dirname(fileURLToPath(import.meta.url));
process.env.MOTIONAI_FUENTES ??= path.join(DIST, 'recursos/fuentes');
process.env.MOTIONAI_GUIAS ??= path.join(DIST, 'recursos/guias');

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
    socket,
    claude: process.env.MOTIONAI_CLAUDE,
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

function carpetaLibre(nombre: string): string {
  const slug = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto';
  let carpeta = path.join(carpetaProyectos(), slug);
  for (let i = 2; existsSync(carpeta); i++) carpeta = path.join(carpetaProyectos(), `${slug}-${i}`);
  return carpeta;
}

function registrarIpc() {
  ipcMain.handle('claude:revisar', () => revisarClaude(process.env.MOTIONAI_CLAUDE));
  ipcMain.handle('recientes', () => recientes().listar());
  ipcMain.handle('proyecto:nuevo', async (_e, op: NuevoProyecto) =>
    usar(await Estudio.crear({ carpeta: carpetaLibre(op.nombre), nombre: op.nombre, formato: op.formato as Formato, duracion: op.duracion, fps: op.fps })),
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
  ipcMain.handle('archivo:abrir', async (_e, ruta: string) => {
    const error = await shell.openPath(ruta);
    if (error) throw new Error(error);
  });
  ipcMain.on('idioma', (_e, i: 'es' | 'en') => (idioma = i === 'en' ? 'en' : 'es'));
  ipcMain.handle('chat', () => chat?.cargar() ?? []);
  ipcMain.handle('chat:enviar', (_e, texto: string, referencias) => {
    if (!chat) throw new Error(idioma === 'en' ? 'No project is open.' : 'No hay un proyecto abierto.');
    estadoApp = { ...estadoApp, referencias };
    // No se espera: la respuesta llega por chat:turno.
    void chat.enviar(texto, referencias, () => puerto.estudio?.version ?? 0, (t: Turno) => enviar('chat:turno', t), idioma);
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
    const archivo = path.resolve(base, rel);
    if (!archivo.startsWith(base + path.sep) || !existsSync(archivo)) return new Response('No existe', { status: 404 });
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
