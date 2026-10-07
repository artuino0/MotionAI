import { contextBridge, ipcRenderer } from 'electron';
import type { ApiMotionAI } from '../compartido/api.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const escuchar = (canal: string) => (f: (x: any) => void) => {
  const h = (_e: unknown, x: unknown) => f(x);
  ipcRenderer.on(canal, h);
  return () => ipcRenderer.removeListener(canal, h);
};

const api: ApiMotionAI = {
  revisarClaude: () => ipcRenderer.invoke('claude:revisar'),
  recientes: () => ipcRenderer.invoke('recientes'),
  nuevoProyecto: (op) => ipcRenderer.invoke('proyecto:nuevo', op),
  abrirProyecto: (ruta) => ipcRenderer.invoke('proyecto:abrir', ruta),
  proyectoActual: () => ipcRenderer.invoke('proyecto:actual'),
  cerrarProyecto: () => ipcRenderer.invoke('proyecto:cerrar'),
  cambiarAjustes: (c) => ipcRenderer.invoke('ajustes', c),
  versiones: () => ipcRenderer.invoke('versiones'),
  volverA: (v) => ipcRenderer.invoke('versiones:volver', v),
  exportar: (op) => ipcRenderer.invoke('exportar', op ?? {}),
  mostrarArchivo: (r) => ipcRenderer.invoke('archivo:mostrar', r),
  chat: () => ipcRenderer.invoke('chat'),
  enviar: (t, r) => ipcRenderer.invoke('chat:enviar', t, r),
  cancelar: () => ipcRenderer.invoke('chat:cancelar'),
  estadoApp: (e) => ipcRenderer.send('estado-app', e),
  alCambiar: escuchar('proyecto:cambio'),
  alTurno: escuchar('chat:turno'),
  alExportar: escuchar('exportar:progreso'),
};

contextBridge.exposeInMainWorld('motionai', api);
