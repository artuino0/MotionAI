<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { NodoPreparado } from '@motionai/motor';
import { useEstudio } from '../tiendas/estudio.js';
import { miniatura } from '../util/dibujo.js';

const e = useEstudio();
const contenedor = ref<HTMLDivElement>();
const anchoVisible = ref(800);
const zoom = ref(1); // 1 = todo el video cabe en pantalla
const IZQ = 110;

const pps = computed(() => (Math.max(200, anchoVisible.value - IZQ - 24) / Math.max(1, e.duracion)) * zoom.value);
const x = (t: number) => t * pps.value;

const marcas = computed(() => {
  const paso = pps.value > 120 ? 0.5 : pps.value > 50 ? 1 : pps.value > 20 ? 2 : 5;
  const out: number[] = [];
  for (let t = 0; t <= e.duracion + 1e-6; t += paso) out.push(Math.round(t * 100) / 100);
  return out;
});

interface Clip { id: string; nombre: string; inicio: number; fin: number; tipo: string; escena: string; fila: number }

/** Piezas de primer nivel con el tramo en que se ven, acomodadas en filas sin encimarse. */
const clips = computed<Clip[]>(() => {
  const esc = e.escenario;
  if (!esc) return [];
  const lista = esc.escenas.flatMap((x) =>
    x.hijos.map((np: NodoPreparado) => {
      const n = np.nodo;
      const inicio = np.entra?.en ?? x.inicio;
      const fin = np.sale ? np.sale.en + np.sale.dur : x.fin;
      const nombre = n.nombre ?? (n.tipo === 'texto' ? `${n.id} · ${n.texto.replace(/\n/g, ' ')}` : n.tipo === 'instancia' ? `${n.id} · ${n.componente}` : n.id);
      return { id: n.id, nombre, inicio: Math.max(x.inicio, inicio), fin: Math.min(x.fin, Math.max(fin, inicio + 0.1)), tipo: n.tipo, escena: x.escena.id, fila: 0 };
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
watch(() => e.revision, () => {
  const esc = e.escenario;
  if (!esc) return;
  setTimeout(() => {
    const m: Record<string, string> = {};
    for (const s of esc.escenas) m[s.escena.id] = miniatura(esc, e.entorno, Math.max(s.inicio, Math.min(s.fin - 0.05, s.inicio + (s.fin - s.inicio) * 0.8)), 90);
    minis.value = m;
  }, 400);
}, { immediate: true });

const audio = computed(() => {
  const a = e.proyecto?.ajustes.audio;
  return [a?.voz && { nombre: `Voz · ${a.voz.archivo}`, inicio: a.voz.inicio }, a?.musica && { nombre: `Música · ${a.musica.archivo}`, inicio: a.musica.inicio }]
    .filter(Boolean) as { nombre: string; inicio: number }[];
});

// Arrastrar en la regla mueve el cabezal (solo para ver: no edita nada).
let arrastrando = false;
function tiempoDe(ev: MouseEvent) {
  const r = contenedor.value!.getBoundingClientRect();
  return (ev.clientX - r.left + contenedor.value!.scrollLeft - IZQ) / pps.value;
}
function bajar(ev: MouseEvent) { arrastrando = true; e.pausar(); e.irA(tiempoDe(ev)); }
function mover(ev: MouseEvent) { if (arrastrando) e.irA(tiempoDe(ev)); }
function soltar() { arrastrando = false; }

function elegirClip(c: Clip) {
  e.pausar();
  if (e.tiempo < c.inicio || e.tiempo > c.fin) e.irA(c.inicio + Math.min(0.6, (c.fin - c.inicio) / 2));
  e.seleccionar(c.id);
  e.referir({ tipo: 'pieza', id: c.id, nombre: c.nombre, escena: c.escena, t: e.tiempo });
}
function elegirFrase(i: number) {
  const f = e.proyecto!.frases[i]!;
  e.pausar();
  e.irA(f.inicio);
  e.referir({ tipo: 'frase', id: `f${i + 1}`, nombre: f.texto, t: f.inicio });
}
function elegirEscena(id: string, inicio: number, nombre?: string) {
  e.pausar();
  e.irA(inicio);
  e.referir({ tipo: 'escena', id, nombre, t: inicio });
}

const color = (tipo: string) => (tipo === 'texto' ? 'texto' : tipo === 'instancia' || tipo === 'grupo' ? 'grupo' : tipo === 'imagen' ? 'imagen' : 'forma');

let obs: ResizeObserver;
onMounted(() => {
  obs = new ResizeObserver(() => (anchoVisible.value = contenedor.value!.clientWidth));
  obs.observe(contenedor.value!);
  addEventListener('mouseup', soltar);
});
onBeforeUnmount(() => { obs.disconnect(); removeEventListener('mouseup', soltar); });
</script>

<template>
  <section class="linea">
    <div class="cabeza">
      <span class="etiqueta">Línea de tiempo</span>
      <span class="tenue">Solo para ver y elegir: un clic agrega la pieza a tu mensaje.</span>
      <span class="espacio" />
      <label class="tenue">Zoom <input v-model.number="zoom" type="range" min="1" max="8" step="0.25" /></label>
    </div>
    <div ref="contenedor" class="pistas desplazable" @mousemove="mover">
      <div class="lienzo" :style="{ width: IZQ + x(e.duracion) + 24 + 'px' }">
        <div class="regla" @mousedown="bajar">
          <span v-for="m in marcas" :key="m" class="marca mono" :style="{ left: IZQ + x(m) + 'px' }">{{ m % 1 === 0 ? `${m}s` : '' }}</span>
        </div>

        <div class="pista">
          <span class="nombre">Texto</span>
          <div v-for="(f, i) in e.proyecto?.frases" :key="i" class="clip frase" :style="{ left: IZQ + x(f.inicio) + 'px', width: x(f.fin - f.inicio) + 'px' }" :title="f.texto" @click="elegirFrase(i)">
            {{ f.texto }}
          </div>
        </div>

        <div class="pista piezas" :style="{ height: filas * 26 + 8 + 'px' }">
          <span class="nombre">Piezas</span>
          <div
            v-for="c in clips" :key="c.id" class="clip" :class="[color(c.tipo), { sel: e.seleccion === c.id }]"
            :style="{ left: IZQ + x(c.inicio) + 'px', width: Math.max(6, x(c.fin - c.inicio)) + 'px', top: 4 + c.fila * 26 + 'px' }"
            :title="c.nombre" @click="elegirClip(c)"
          >◆ {{ c.nombre }}</div>
        </div>

        <div class="pista principal">
          <span class="nombre">Principal</span>
          <div
            v-for="s in e.proyecto?.escenas" :key="s.id" class="clip escena" :class="{ actual: e.escenaActual?.escena.id === s.id }"
            :style="{ left: IZQ + x(s.inicio) + 'px', width: x(s.fin - s.inicio) + 'px', backgroundImage: minis[s.id] ? `url(${minis[s.id]})` : undefined }"
            @click="elegirEscena(s.id, s.inicio, s.nombre)"
          ><span>{{ s.nombre ?? s.id }}</span></div>
        </div>

        <div v-if="audio.length" class="pista">
          <span class="nombre">Audio</span>
          <div v-for="a in audio" :key="a.nombre" class="clip audio" :style="{ left: IZQ + x(a.inicio) + 'px', right: '24px' }">♪ {{ a.nombre }}</div>
        </div>

        <div class="cabezal" :style="{ left: IZQ + x(e.tiempo) + 'px' }" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.linea { display: flex; flex-direction: column; background: var(--panel); min-height: 0; }
.cabeza { display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--borde); }
.cabeza label { display: flex; align-items: center; gap: 8px; }
.espacio { flex: 1; }
.pistas { flex: 1; position: relative; }
.lienzo { position: relative; min-height: 100%; }
.regla { position: sticky; top: 0; height: 26px; background: var(--panel); border-bottom: 1px solid var(--borde); z-index: 3; cursor: ew-resize; }
.marca { position: absolute; top: 0; height: 100%; border-left: 1px solid #3a3f48; padding-left: 4px; font-size: 10px; color: var(--muy-tenue); line-height: 24px; }
.pista { position: relative; height: 36px; border-bottom: 1px solid #23262c; }
.pista.principal { height: 58px; }
.nombre { position: sticky; left: 0; display: flex; align-items: center; width: 100px; height: 100%; padding-left: 14px; color: var(--tenue); background: var(--panel); z-index: 2; font-size: 12px; }
.clip { position: absolute; top: 5px; height: 22px; border-radius: 5px; padding: 0 8px; font-size: 12px; line-height: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; color: #0b1a1d; font-weight: 600; border: 1px solid #0003; }
.clip:hover { filter: brightness(1.12); }
.clip.sel { outline: 2px solid #fff; outline-offset: 1px; }
.frase { background: var(--mostaza); color: #fff; }
.forma { background: var(--coral); }
.grupo { background: var(--acento); }
.texto { background: #6fd3b0; }
.imagen { background: var(--amarillo); }
.escena { top: 4px; height: 48px; background-color: #2a2e35; background-size: auto 100%; background-repeat: repeat-x; color: #fff; padding: 0; border: 2px solid #0000; }
.escena span { display: inline-block; background: #000a; padding: 0 8px; border-radius: 0 0 5px 0; line-height: 20px; }
.escena.actual { border-color: var(--acento); }
.audio { background: #7c6cf2; color: #fff; }
.cabezal { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; z-index: 4; pointer-events: none; box-shadow: 0 0 6px #0008; }
.cabezal::before { content: ''; position: absolute; top: 0; left: -6px; border: 7px solid transparent; border-top: 9px solid #fff; }
</style>
