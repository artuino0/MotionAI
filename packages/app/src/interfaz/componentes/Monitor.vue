<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { dibujarCuadro, type Registro } from '@motionai/motor';
import { idioma, t } from '../i18n.js';
import { useEstudio, type Vista } from '../tiendas/estudio.js';
import { dibujarMarca, dibujarVista, piezaEn } from '../util/dibujo.js';
import { nombreEscena } from '../util/nombres.js';
import Icono from './Icono.vue';
import '@hyperframes/player';

/** Lo que usamos del reproductor de HyperFrames. */
interface Jugador extends HTMLElement {
  seek(t: number): void;
  readonly ready: boolean;
  readonly duration: number;
  readonly scenes: { id: string; start: number; duration: number }[];
}
const jugador = ref<Jugador>();
const ancho = computed(() => e.escenario?.ancho ?? 1080);
const alto = computed(() => e.escenario?.alto ?? 1920);
// La versión en la URL hace que el reproductor recargue cuando Claude cambia la composición.
const fuente = computed(() => `proyecto://local/composicion/index.html?v=${e.version}`);
let pendiente = false;
function irAlTiempo() {
  if (!e.esHtml || pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    if (jugador.value?.ready) jugador.value.seek(e.tiempo);
  });
}
function listo() {
  const j = jugador.value;
  if (!j) return;
  j.seek(e.tiempo);
}

const e = useEstudio();
const lienzo = ref<HTMLCanvasElement>();
const capa = ref<HTMLCanvasElement>();
const area = ref<HTMLDivElement>();
const tam = ref({ w: 0, h: 0 });
let registros: Registro[] = [];

const tc = (s: number) => {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`;
};

function acomodar() {
  const esc = e.escenario;
  if (!esc || !area.value) return;
  const w = area.value.clientWidth - 40, h = area.value.clientHeight - 40;
  const k = Math.min(w / esc.ancho, h / esc.alto);
  tam.value = { w: Math.floor(esc.ancho * k), h: Math.floor(esc.alto * k) };
}

/** Con HTML solo se dibuja la capa (vista de la plataforma); el cuadro lo pone el reproductor. */
function dibujarCapaHtml() {
  const esc = e.escenario, o = capa.value;
  if (!esc || !o) return;
  if (o.width !== esc.ancho || o.height !== esc.alto) { o.width = esc.ancho; o.height = esc.alto; acomodar(); }
  const ctx = o.getContext('2d')!;
  ctx.clearRect(0, 0, o.width, o.height);
  dibujarVista(ctx, esc, e.vista, {
    zona: t('monitor.zona'),
    soloVertical: t('monitor.soloVertical'),
    cabecera: idioma.value === 'en' ? 'Following     For You' : 'Siguiendo     Para ti',
  });
}

function dibujar() {
  if (e.esHtml) { dibujarCapaHtml(); irAlTiempo(); return; }
  const esc = e.escenario, c = lienzo.value, o = capa.value;
  if (!esc || !c || !o) return;
  if (c.width !== esc.ancho || c.height !== esc.alto) {
    c.width = o.width = esc.ancho;
    c.height = o.height = esc.alto;
    acomodar();
  }
  registros = [];
  dibujarCuadro(c.getContext('2d')!, esc, e.tiempo, e.entorno, { registrar: (r) => registros.push(r) });
  const ctx = o.getContext('2d')!;
  ctx.clearRect(0, 0, o.width, o.height);
  dibujarVista(ctx, esc, e.vista, {
    zona: t('monitor.zona'),
    soloVertical: t('monitor.soloVertical'),
    cabecera: idioma.value === 'en' ? 'Following     For You' : 'Siguiendo     Para ti',
  });
  const k = tam.value.w / esc.ancho || 1;
  const sel = e.seleccion && registros.find((r) => r.ruta === e.seleccion);
  if (sel) dibujarMarca(ctx, sel, k, e.nombre(sel.ruta), '#2ec4d6', '#06272c');
  const cambio = e.resaltado && registros.find((r) => r.ruta === e.resaltado);
  if (cambio && cambio !== sel) dibujarMarca(ctx, cambio, k, `✦ ${e.nombre(cambio.ruta)}`, '#f2b84b', '#2b1c02');
}

function clic(ev: MouseEvent) {
  const esc = e.escenario;
  if (!esc || !capa.value) return;
  const r = capa.value.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * esc.ancho;
  const y = ((ev.clientY - r.top) / r.height) * esc.alto;
  // En HTML no hay piezas medidas: se señala el momento y el punto, y Claude ubica el elemento en su composición.
  if (e.esHtml) { e.senalarMomento([Math.round(x), Math.round(y)]); return; }
  const p = piezaEn(registros, x, y);
  if (!p) { e.seleccionar(null); return; }
  e.senalarPieza(p.ruta, [Math.round(x), Math.round(y)]);
}

const vistas: Vista[] = ['limpia', 'tiktok', 'reels', 'facebook'];
const escena = computed(() => nombreEscena(e.proyecto, e.escenaActual?.escena.id));

watch(() => [e.escenario, e.tiempo, e.seleccion, e.vista, e.entorno, e.resaltado, idioma.value], dibujar);
let obs: ResizeObserver;
onMounted(() => {
  obs = new ResizeObserver(() => acomodar());
  obs.observe(area.value!);
  dibujar();
});
onBeforeUnmount(() => obs.disconnect());
</script>

<template>
  <section class="monitor">
    <div ref="area" class="area">
      <div v-if="e.respondiendo" class="claude" role="status">
        <span class="punto" aria-hidden="true" />
        {{ e.trabajandoEn ? t('monitor.claude', { escena: e.trabajandoEn }) : t('monitor.claudeSinEscena') }}
      </div>
      <div v-if="e.errorDocumento && !e.escenario" class="error" role="alert">{{ e.errorDocumento }}</div>
      <div class="pantalla" :class="{ trabajando: e.respondiendo }" :style="{ width: tam.w + 'px', height: tam.h + 'px' }">
        <hyperframes-player
          v-if="e.esHtml" ref="jugador" class="jugador" :src="fuente" :width="ancho" :height="alto"
          muted disable-click-to-play assets-loading-ui="none" @ready="listo"
        />
        <canvas v-else ref="lienzo" />
        <canvas ref="capa" class="capa" role="img" :aria-label="t('monitor.lienzo')" @click="clic" />
      </div>
    </div>
    <div class="controles">
      <span class="tc"><strong>{{ tc(e.tiempo) }}</strong> <span class="tenue">/ {{ tc(e.duracion) }}</span></span>
      <span class="escena tenue">{{ escena }}</span>
      <span class="transporte">
        <button class="fantasma icono" :aria-label="t('monitor.anterior')" :title="t('monitor.anterior')" @click="e.saltarEscena(-1)"><Icono nombre="skip-back" /></button>
        <button class="icono play" :aria-label="e.reproduciendo ? t('monitor.pausar') : t('monitor.reproducir')" :title="e.reproduciendo ? t('monitor.pausar') : t('monitor.reproducir')" @click="e.alternar()">
          <Icono :nombre="e.reproduciendo ? 'pause' : 'play'" :tam="18" relleno />
        </button>
        <button class="fantasma icono" :aria-label="t('monitor.siguiente')" :title="t('monitor.siguiente')" @click="e.saltarEscena(1)"><Icono nombre="skip-forward" /></button>
      </span>
      <span />
      <label class="vista">
        <span class="solo-lector">{{ t('monitor.vista') }}</span>
        <select v-model="e.vista">
          <option v-for="v in vistas" :key="v" :value="v">{{ t(`monitor.vista.${v}` as const) }}</option>
        </select>
      </label>
    </div>
  </section>
</template>

<style scoped>
.monitor { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: #0f1114; }
.area { flex: 1; display: grid; place-items: center; min-height: 0; position: relative; }
.pantalla { position: relative; box-shadow: 0 14px 40px -10px #000; border-radius: 2px; transition: box-shadow 300ms ease; }
.pantalla.trabajando { box-shadow: 0 14px 40px -10px #000, 0 0 0 2px #f2b84b66; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.capa { cursor: crosshair; }
.jugador { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.claude {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2;
  display: flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px;
  background: #2a2214; border: 1px solid #f2b84b66; color: #f6cf85; font-weight: 600; font-size: 12.5px; white-space: nowrap;
}
.punto { width: 7px; height: 7px; border-radius: 50%; background: var(--claude); animation: latido 1.1s infinite; }
.controles { display: grid; grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 6px 12px; border-top: 1px solid var(--borde); background: var(--panel); }
.tc { font-size: 14px; white-space: nowrap; }
.escena { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.transporte { display: flex; gap: 4px; align-items: center; }
.play { min-width: 44px; min-height: 36px; background: var(--panel-3); }
.error { position: absolute; top: 52px; left: 16px; right: 16px; color: var(--rojo); white-space: pre-wrap; z-index: 2; font-size: 12px; background: #1b1e23ee; padding: 10px; border-radius: var(--radio-chico); }
</style>
