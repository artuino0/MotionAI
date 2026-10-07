<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { dibujarCuadro, type Registro } from '@motionai/motor';
import { useEstudio, type Vista } from '../tiendas/estudio.js';
import { dibujarSeleccion, dibujarVista, piezaEn } from '../util/dibujo.js';

const e = useEstudio();
const lienzo = ref<HTMLCanvasElement>();
const capa = ref<HTMLCanvasElement>();
const area = ref<HTMLDivElement>();
const tam = ref({ w: 0, h: 0 });
let registros: Registro[] = [];

const tc = (t: number) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};

function acomodar() {
  const esc = e.escenario;
  if (!esc || !area.value) return;
  const w = area.value.clientWidth - 32, h = area.value.clientHeight - 32;
  const k = Math.min(w / esc.ancho, h / esc.alto);
  tam.value = { w: Math.floor(esc.ancho * k), h: Math.floor(esc.alto * k) };
}

function dibujar() {
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
  dibujarVista(ctx, esc, e.vista);
  const sel = e.seleccion && registros.find((r) => r.ruta === e.seleccion);
  if (sel) dibujarSeleccion(ctx, sel, tam.value.w / esc.ancho);
}

function clic(ev: MouseEvent) {
  const esc = e.escenario;
  if (!esc || !capa.value) return;
  const r = capa.value.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * esc.ancho;
  const y = ((ev.clientY - r.top) / r.height) * esc.alto;
  const p = piezaEn(registros, x, y);
  if (!p) { e.seleccionar(null); return; }
  e.seleccionar(p.ruta);
  e.referir({ tipo: 'pieza', id: p.ruta, nombre: p.nodo.nombre, escena: e.escenaActual?.escena.id, t: e.tiempo, punto: [x, y] });
}

function saltarEscena(dir: number) {
  const esc = e.escenario;
  if (!esc) return;
  const inicios = esc.escenas.map((x) => x.inicio);
  const t = e.tiempo;
  const destino = dir > 0 ? inicios.find((i) => i > t + 1e-3) ?? esc.duracion : [...inicios].reverse().find((i) => i < t - 0.05) ?? 0;
  e.pausar();
  e.irA(destino);
}

const vistas: { id: Vista; nombre: string }[] = [
  { id: 'limpia', nombre: 'Vista limpia' }, { id: 'tiktok', nombre: 'Como en TikTok' },
  { id: 'reels', nombre: 'Como en Reels' }, { id: 'facebook', nombre: 'Como en Facebook' },
];
const escena = computed(() => e.escenaActual?.escena);

watch(() => [e.escenario, e.tiempo, e.seleccion, e.vista, e.entorno], dibujar);
let obs: ResizeObserver;
onMounted(() => {
  obs = new ResizeObserver(() => { acomodar(); });
  obs.observe(area.value!);
  dibujar();
});
onBeforeUnmount(() => obs.disconnect());
</script>

<template>
  <section class="monitor">
    <div ref="area" class="area">
      <div v-if="e.errorDocumento && !e.escenario" class="error">{{ e.errorDocumento }}</div>
      <div class="pantalla" :style="{ width: tam.w + 'px', height: tam.h + 'px' }">
        <canvas ref="lienzo" />
        <canvas ref="capa" class="capa" @click="clic" />
      </div>
    </div>
    <div class="controles">
      <span class="tc mono">{{ tc(e.tiempo) }} <span class="tenue">/ {{ tc(e.duracion) }}</span></span>
      <span class="tenue escena">{{ escena ? escena.nombre ?? escena.id : '' }}</span>
      <span class="centro">
        <button class="icono" title="Escena anterior" @click="saltarEscena(-1)">⏮</button>
        <button class="icono play" :title="e.reproduciendo ? 'Pausa (espacio)' : 'Reproducir (espacio)'" @click="e.alternar()">{{ e.reproduciendo ? '❚❚' : '▶' }}</button>
        <button class="icono" title="Escena siguiente" @click="saltarEscena(1)">⏭</button>
      </span>
      <span />
      <select v-model="e.vista" class="vista">
        <option v-for="v in vistas" :key="v.id" :value="v.id">{{ v.nombre }}</option>
      </select>
    </div>
  </section>
</template>

<style scoped>
.monitor { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: #0f1114; }
.area { flex: 1; display: grid; place-items: center; min-height: 0; position: relative; }
.pantalla { position: relative; box-shadow: 0 10px 40px #000a; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.capa { cursor: crosshair; }
.controles { display: grid; grid-template-columns: auto 1fr auto 1fr auto; align-items: center; gap: 12px; padding: 8px 14px; border-top: 1px solid var(--borde); background: var(--panel); }
.tc { font-size: 14px; }
.escena { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.centro { display: flex; gap: 6px; }
.play { min-width: 46px; font-size: 15px; }
.error { position: absolute; top: 16px; left: 16px; right: 16px; color: var(--rojo); white-space: pre-wrap; z-index: 2; font-size: 12px; }
</style>
