// Página para la prueba de paridad: dibuja cuadros con el motor en el navegador y los devuelve como PNG.
import { conFormato, leerProyecto, type Formato } from '@motionai/documento';
import { dibujarCuadro, preparar } from '@motionai/motor';
import { cargarRecursosNavegador } from './recursos.js';

declare global {
  interface Window {
    renderizar(urlProyecto: string, formato: Formato | null, tiempos: number[]): Promise<string[]>;
  }
}

window.renderizar = async (urlProyecto, formato, tiempos) => {
  const datos = await (await fetch(urlProyecto)).json();
  let proyecto = leerProyecto(datos);
  if (formato) proyecto = conFormato(proyecto, formato);
  const base = new URL('.', new URL(urlProyecto, location.href)).href;
  const { entorno, faltantes } = await cargarRecursosNavegador(proyecto, base);
  if (faltantes.length) throw new Error(`Faltan archivos: ${faltantes.join(', ')}`);
  const esc = preparar(proyecto);
  const canvas = document.createElement('canvas');
  canvas.width = esc.ancho;
  canvas.height = esc.alto;
  const ctx = canvas.getContext('2d')!;
  return tiempos.map((t) => {
    dibujarCuadro(ctx, esc, t, entorno);
    return canvas.toDataURL('image/png');
  });
};
