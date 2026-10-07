<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { NodoPreparado } from '@motionai/motor';
import { t } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import { miniatura } from '../util/dibujo.js';
import { nombreEscena, nombreNodo } from '../util/nombres.js';
import Icono from './Icono.vue';

const e = useEstudio();
const contenedor = ref<HTMLDivElement>();
const anchoVisible = ref(800);
const zoom = ref(1); // 1 = todo el video cabe en pantalla
const IZQ = 96;
const FILA = 26;

const pps = computed(() => (Math.max(200, anchoVisible.value - IZQ - 24) / Math.max(1, e.duracion)) * zoom.value);
const x = (s: number) => s * pps.value;

const marcas = computed(() => {
  const paso = pps.value > 120 ? 0.5 : pps.value > 50 ? 1 : pps.value > 20 ? 2 : 5;
  const out: number[] = [];
  for (let s = 0; s <= e.duracion + 1e-6; s += paso) out.push(Math.round(s * 100) / 100);
  return out;
});

type Clase = 'texto' | 'forma' | 'grupo' | 'imagen';
interface Clip { id: string; nombre: string; inicio: number; fin: number; clase: Clase; fila: number }
const claseDe = (tipo: string): Clase => (tipo === 'texto' ? 'texto' : tipo === 'instancia' || tipo === 'grupo' ? 'grupo' : tipo === 'imagen' ? 'imagen' : 'forma');

/** Piezas de primer nivel con el tramo en que se ven, acomodadas en filas sin encimarse. */
const clips = computed<Clip[]>(() => {
  const esc = e.escenario;
  if (!esc) return [];
  const lista = esc.escenas.flatMap((s) =>
    s.hijos.map((np: NodoPreparado) => {
      const inicio = np.entra?.en ?? s.inicio;
      const fin = np.sale ? np.sale.en + np.sale.dur : s.fin;
      return {
        id: np.nodo.id, nombre: nombreNodo(np.nodo, e.proyecto ?? undefined),
        inicio: Math.max(s.inicio, inicio), fin: Math.min(s.fin, Math.max(fin, inicio + 0.1)),
        clase: claseDe(np.nodo.tipo), fila: 0,
      };
    }),
  ).sort((a, b) => a.inicio - b.inicio);
  const finFilas: number[] = [];
  for (const c of lista) {
    let f = finFilas.findIndex((fin) => fin <= c.inicio + 1e-3);
    if (f < 0) { f = finFilas.length; finFilas.push(0); }
    finFilas[f] = c.fin;
    c.fila = f;
  }
  return lista;
});
const filas = computed(() => Math.max(1, ...clips.value.map((c) => c.fila + 1)));

const minis = ref<Record<string, string>>({});
let pendiente: ReturnType<typeof setTimeout> | undefined;
watch(() => e.revision, () => {
  clearTimeout(pendiente);
  pendiente = setTimeout(() => {
    const esc = e.escenario;
    if (!esc) return;
    const m: Record<string, string> = {};
    for (const s of esc.escenas) m[s.escena.id] = miniatura(esc, e.entorno, Math.max(s.inicio, Math.min(s.fin - 0.05, s.inicio + (s.fin - s.inicio) * 0.8)), 90);
    minis.value = m;
  }, 400);
}, { immediate: true });

const voz = computed(() => e.proyecto?.ajustes.audio.voz);
const musica = computed(() => e.proyecto?.ajustes.audio.musica);

// Arrastrar en la regla mueve el cabezal (solo para ver: no edita nada).
let arrastrando = false;
function tiempoDe(ev: MouseEvent) {
  const r = contenedor.value!.getBoundingClientRect();
  return (ev.clientX - r.left + contenedor.value!.scrollLeft - IZQ) / pps.value;
}
function bajar(ev: MouseEvent) { arrastrando = true; e.pausar(); e.irA(tiempoDe(ev)); }
function mover(ev: MouseEvent) { if (arrastrando) e.irA(tiempoDe(ev)); }
function soltar() { arrastrando = false; }
function rueda(ev: WheelEvent) {
  if (!ev.ctrlKey && !ev.metaKey) return;
  ev.preventDefault();
  zoom.value = Math.min(8, Math.max(1, zoom.value * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
}

function elegirClip(c: Clip) {
  e.pausar();
  if (e.tiempo < c.inicio || e.tiempo > c.fin) e.irA(c.inicio + Math.min(0.6, (c.fin - c.inicio) / 2));
  e.senalarPieza(c.id);
}
function irA(s: number) { e.pausar(); e.irA(s); }

const leyenda: Clase[] = ['texto', 'forma', 'grupo', 'imagen'];

let obs: ResizeObserver | undefined;
onMounted(() => addEventListener('mouseup', soltar));
watch(contenedor, (el) => {
  obs?.disconnect();
  if (!el) return;
  obs = new ResizeObserver(() => (anchoVisible.value = el.clientWidth));
  obs.observe(el);
});
onBeforeUnmount(() => { obs?.disconnect(); removeEventListener('mouseup', soltar); });
</script>

<template>
  <section class="linea" :aria-label="t('linea.titulo')">
    <div class="cabeza">
      <button class="fantasma plegar" :aria-expanded="e.lineaAbierta" :title="e.lineaAbierta ? t('linea.plegar') : t('linea.desplegar')" @click="e.alternarLinea()">
        <Icono :nombre="e.lineaAbierta ? 'chevron-down' : 'chevron-up'" :tam="14" /> {{ t('linea.titulo') }}
      </button>
      <template v-if="e.lineaAbierta">
        <span class="tenue nota">{{ t('linea.nota') }}</span>
        <span class="espacio" />
        <span class="leyenda" aria-hidden="true">
          <span v-for="c in leyenda" :key="c" class="muestra"><i :class="c" />{{ t(`linea.leyenda.${c}` as const) }}</span>
        </span>
        <label class="zoom"><span class="tenue">{{ t('linea.zoom') }}</span> <input v-model.number="zoom" type="range" min="1" max="8" step="0.25" /></label>
      </template>
    </div>
    <div v-if="e.lineaAbierta" ref="contenedor" class="pistas desplazable" @mousemove="mover" @wheel="rueda">
      <div class="lienzo" :style="{ width: IZQ + x(e.duracion) + 24 + 'px' }">
        <div class="regla" @mousedown="bajar">
          <span v-for="m in marcas" :key="m" class="marca" :style="{ left: IZQ + x(m) + 'px' }">{{ m % 1 === 0 ? `${m}s` : '' }}</span>
        </div>

        <div v-if="voz || e.proyecto?.frases.length" class="pista">
          <span class="nombre"><Icono nombre="mic" :tam="13" /> {{ t('linea.voz') }}</span>
          <button
            v-for="(f, i) in e.proyecto?.frases" :key="i" class="clip frase"
            :style="{ left: IZQ + x(f.inicio) + 'px', width: x(f.fin - f.inicio) + 'px' }" :title="f.texto" @click="irA(f.inicio)"
          >{{ f.texto }}</button>
          <span v-if="voz && !e.proyecto?.frases.length" class="clip audio" :style="{ left: IZQ + x(voz.inicio) + 'px', right: '24px' }">{{ t('linea.audioVoz') }}</span>
        </div>

        <div class="pista piezas" :style="{ height: filas * FILA + 8 + 'px' }">
          <span class="nombre"><Icono nombre="layers" :tam="13" /> {{ t('linea.piezas') }}</span>
          <button
            v-for="c in clips" :key="c.id" class="clip" :class="[c.clase, { sel: e.seleccion === c.id, cambio: e.resaltado === c.id }]"
            :style="{ left: IZQ + x(c.inicio) + 'px', width: Math.max(8, x(c.fin - c.inicio)) + 'px', top: 4 + c.fila * FILA + 'px' }"
            :title="c.nombre" :aria-pressed="e.seleccion === c.id" @click="elegirClip(c)"
          >{{ c.nombre }}</button>
        </div>

        <div class="pista principal">
          <span class="nombre"><Icono nombre="film" :tam="13" /> {{ t('linea.escenas') }}</span>
          <button
            v-for="s in e.proyecto?.escenas" :key="s.id" class="clip escena" :class="{ actual: e.escenaActual?.escena.id === s.id }"
            :style="{ left: IZQ + x(s.inicio) + 'px', width: x(s.fin - s.inicio) + 'px' }" @click="irA(s.inicio)"
          >
            <img v-if="minis[s.id]" :src="minis[s.id]" alt="" />
            <span>{{ nombreEscena(e.proyecto, s.id) }}</span>
          </button>
          <button
            v-for="(s, i) in e.esHtml ? e.escenasHtml : []" :key="s.id" class="clip escena"
            :class="{ actual: e.tiempo >= s.inicio && e.tiempo < s.fin }"
            :style="{ left: IZQ + x(s.inicio) + 'px', width: x(s.fin - s.inicio) + 'px' }" @click="irA(s.inicio)"
          >
            <span>{{ t('medios.escenaN', { n: i + 1 }) }}</span>
          </button>
        </div>

        <div v-if="musica" class="pista">
          <span class="nombre"><Icono nombre="music" :tam="13" /> {{ t('linea.musica') }}</span>
          <span class="clip audio" :style="{ left: IZQ + x(musica.inicio) + 'px', right: '24px' }">{{ musica.archivo.split('/').pop() }}</span>
        </div>

        <div class="cabezal" :style="{ transform: `translateX(${IZQ + x(e.tiempo)}px)` }" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.linea { display: flex; flex-direction: column; background: var(--panel); min-height: 0; }
.cabeza { display: flex; align-items: center; gap: 12px; padding: 4px 12px 4px 6px; border-bottom: 1px solid var(--borde); min-height: 41px; flex: none; }
.plegar { font-weight: 650; color: var(--texto); }
.nota { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.espacio { flex: 1; }
.leyenda { display: flex; gap: 12px; font-size: 12px; color: var(--tenue); white-space: nowrap; }
.muestra { display: inline-flex; align-items: center; gap: 5px; }
.muestra i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.zoom { display: flex; align-items: center; gap: 8px; }
.zoom input { width: 110px; }
.pistas { flex: 1; position: relative; }
.lienzo { position: relative; min-height: 100%; }
.regla { position: sticky; top: 0; height: 24px; background: var(--panel); border-bottom: 1px solid var(--borde); z-index: 3; cursor: ew-resize; }
.marca { position: absolute; top: 0; height: 100%; border-left: 1px solid #3a3f48; padding-left: 4px; font-size: 12px; color: var(--muy-tenue); line-height: 22px; }
.pista { position: relative; height: 34px; border-bottom: 1px solid #23262c; }
.pista.principal { height: 54px; }
.nombre { position: sticky; left: 0; display: flex; align-items: center; gap: 6px; width: 88px; height: 100%; padding-left: 12px; color: var(--tenue); background: var(--panel); z-index: 2; font-size: 12px; }
.clip {
  position: absolute; top: 5px; height: 22px; border-radius: 5px; padding: 0 8px; font-size: 12px; line-height: 20px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; text-align: left;
  color: #0b1a1d; font-weight: 600; border: 1px solid #0003; min-height: 0; justify-content: flex-start;
}
.clip:hover:not(:disabled) { filter: brightness(1.1); border-color: #0003; }
.clip.sel { box-shadow: 0 0 0 2px var(--fondo), 0 0 0 4px var(--acento); z-index: 1; }
.clip.cambio { box-shadow: 0 0 0 2px var(--fondo), 0 0 0 4px var(--claude); z-index: 1; }
.frase, i.frase { background: var(--mostaza); color: #2a1d05; }
.forma, i.forma { background: var(--coral); }
.grupo, i.grupo { background: var(--acento); }
.texto, i.texto { background: #7dd8b6; }
.imagen, i.imagen { background: #b8a6ff; }
.leyenda .texto { background: #7dd8b6; } .leyenda .forma { background: var(--coral); } .leyenda .grupo { background: var(--acento); } .leyenda .imagen { background: #b8a6ff; }
.escena { top: 4px; height: 44px; padding: 0; background: var(--panel-3); color: #fff; border: 2px solid transparent; }
.escena:hover:not(:disabled) { background: var(--panel-3); }
.escena img { position: absolute; left: 0; top: 0; height: 100%; width: auto; opacity: 0.95; }
.escena span { position: absolute; left: 0; bottom: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; background: #000b; padding: 0 7px; border-radius: 0 5px 0 0; line-height: 18px; font-size: 12px; }
.escena.actual { border-color: var(--acento); }
.audio { background: #8f80f5; color: #fff; }
.cabezal { position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #fff; z-index: 4; pointer-events: none; box-shadow: 0 0 6px #0008; }
.cabezal::before { content: ''; position: absolute; top: 0; left: -6px; border: 7px solid transparent; border-top: 9px solid #fff; }
@media (max-width: 1240px) { .leyenda, .nota { display: none; } }
</style>
