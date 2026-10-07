import { FORMATOS, conFormato, leerProyecto, zonasTapadas, type Formato, type Proyecto } from '@motionai/documento';
import { dibujarCuadro, escenaEn, preparar, totalCuadros, type Entorno, type Escenario } from '@motionai/motor';
import { cargarRecursosNavegador } from './recursos.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const lienzo = $<HTMLCanvasElement>('lienzo');
const ctx = lienzo.getContext('2d')!;
const barra = $<HTMLInputElement>('barra');
const play = $<HTMLButtonElement>('play');
const selFormato = $<HTMLSelectElement>('formato');
const chkZonas = $<HTMLInputElement>('zonas');
const chkSubs = $<HTMLInputElement>('subtitulos');

const params = new URLSearchParams(location.search);
const urlProyecto = params.get('proyecto') ?? '/ejemplos/demo/proyecto.json';

let original: Proyecto;
let esc: Escenario;
let entorno: Entorno;
let audios: { el: HTMLAudioElement; inicio: number }[] = [];
let t = 0;
let reproduciendo = false;
let ultimoReloj = 0;

async function iniciar() {
  try {
    original = leerProyecto(await (await fetch(urlProyecto)).json());
  } catch (e) {
    document.querySelector('main')!.innerHTML = `<div class="error">${(e as Error).message}</div>`;
    return;
  }
  const base = new URL('.', new URL(urlProyecto, location.href)).href;
  const r = await cargarRecursosNavegador(original, base);
  if (r.faltantes.length) console.warn('Faltan archivos:', r.faltantes);
  entorno = r.entorno;
  audios = [original.ajustes.audio.voz, original.ajustes.audio.musica]
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => {
      const el = new Audio(new URL(p.archivo, base).href);
      el.volume = Math.min(1, p.volumen);
      return { el, inicio: p.inicio };
    });

  $('titulo').textContent = original.nombre;
  for (const [id, f] of Object.entries(FORMATOS)) selFormato.add(new Option(f.nombre, id));
  selFormato.value = original.ajustes.formato === 'libre' ? '9:16' : original.ajustes.formato;
  selFormato.onchange = () => cambiarFormato(selFormato.value as Formato);
  chkZonas.onchange = chkSubs.onchange = () => dibujar();
  cambiarFormato(selFormato.value as Formato);

  barra.oninput = () => { pausar(); t = Number(barra.value) / esc.fps; dibujar(); };
  play.onclick = () => (reproduciendo ? pausar() : reproducir());
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); play.click(); }
    if (e.code === 'ArrowRight') { pausar(); t = Math.min(esc.duracion, t + 1 / esc.fps); dibujar(); }
    if (e.code === 'ArrowLeft') { pausar(); t = Math.max(0, t - 1 / esc.fps); dibujar(); }
  });
}

function cambiarFormato(f: Formato) {
  esc = preparar(f === original.ajustes.formato ? original : conFormato(original, f));
  lienzo.width = esc.ancho;
  lienzo.height = esc.alto;
  barra.max = String(totalCuadros(esc) - 1);
  ajustarTamano();
  dibujar();
}

/** Escala el lienzo para que quepa completo en el área del monitor. */
function ajustarTamano() {
  const area = document.querySelector('main')!;
  const w = area.clientWidth - 32, h = area.clientHeight - 32;
  const k = Math.min(w / esc.ancho, h / esc.alto);
  lienzo.style.width = `${Math.floor(esc.ancho * k)}px`;
  lienzo.style.height = `${Math.floor(esc.alto * k)}px`;
}
addEventListener('resize', () => esc && ajustarTamano());

function dibujar() {
  dibujarCuadro(ctx, esc, t, entorno, { subtitulos: chkSubs.checked });
  if (chkZonas.checked) dibujarZonas();
  barra.value = String(Math.round(t * esc.fps));
  $('tiempo').textContent = `${t.toFixed(2)} / ${esc.duracion.toFixed(2)} s`;
  $('escena').textContent = escenaEn(esc, t)?.escena.nombre ?? '';
}

function dibujarZonas() {
  const { formato, plataformas } = esc.proyecto.ajustes;
  ctx.save();
  ctx.font = `600 ${Math.round(esc.alto / 70)}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  const renglon = Math.round(esc.alto / 60);
  plataformas.forEach((p, i) => {
    for (const z of zonasTapadas(p, formato)) {
      const x = z.x * esc.ancho, y = z.y * esc.alto, w = z.ancho * esc.ancho, h = z.alto * esc.alto;
      ctx.fillStyle = 'rgba(255, 60, 60, 0.12)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255, 60, 60, 0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(200, 30, 30, 0.9)';
      ctx.fillText(z.motivo, x + 10, y + 8 + i * renglon);
    }
  });
  ctx.restore();
}

function reproducir() {
  if (t >= esc.duracion) t = 0;
  reproduciendo = true;
  play.textContent = '❚❚ Pausa';
  ultimoReloj = performance.now();
  for (const a of audios) {
    const pos = t - a.inicio;
    if (pos >= 0) { a.el.currentTime = pos; void a.el.play(); }
  }
  requestAnimationFrame(cuadro);
}

function pausar() {
  reproduciendo = false;
  play.textContent = '▶ Play';
  for (const a of audios) a.el.pause();
}

function cuadro(ahora: number) {
  if (!reproduciendo) return;
  t += (ahora - ultimoReloj) / 1000;
  ultimoReloj = ahora;
  for (const a of audios) {
    if (a.el.paused && t >= a.inicio && t - a.inicio < (a.el.duration || Infinity)) { a.el.currentTime = t - a.inicio; void a.el.play(); }
  }
  if (t >= esc.duracion) { t = esc.duracion; dibujar(); pausar(); return; }
  dibujar();
  requestAnimationFrame(cuadro);
}

void iniciar();
