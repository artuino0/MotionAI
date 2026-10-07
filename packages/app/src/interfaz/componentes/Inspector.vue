<script setup lang="ts">
import { computed } from 'vue';
import { dimensiones, type Nodo } from '@motionai/documento';
import { useEstudio } from '../tiendas/estudio.js';

const e = useEstudio();

/** La pieza seleccionada en el documento (por el último id de su ruta). */
const pieza = computed<Nodo | undefined>(() => {
  const id = e.seleccion?.split('/').pop();
  const p = e.proyecto;
  if (!id || !p) return undefined;
  const buscar = (n: Nodo): Nodo | undefined => (n.id === id ? n : n.tipo === 'grupo' ? n.hijos.map(buscar).find(Boolean) : undefined);
  return [...p.escenas.flatMap((x) => x.hijos), ...p.biblioteca.map((c) => c.raiz)].map(buscar).find(Boolean);
});

const filas = computed(() => {
  const n = pieza.value;
  if (!n) return [];
  const { animacion, ...resto } = n as Nodo & { hijos?: unknown };
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(resto)) {
    if (k === 'hijos') { out.push([k, `${(v as unknown[]).length} piezas`]); continue; }
    out.push([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
  }
  if (animacion?.entra) out.push(['entra', `${animacion.entra.tipo} en ${animacion.entra.en}${animacion.entra.dur ? ` · ${animacion.entra.dur} s` : ''}`]);
  if (animacion?.sale) out.push(['sale', `${animacion.sale.tipo} en ${animacion.sale.en}`]);
  for (const [p, keys] of Object.entries(animacion?.pistas ?? {})) out.push([`pista ${p}`, keys!.map((k) => `${k.t}→${k.v}`).join(', ')]);
  for (const c of animacion?.ciclos ?? []) out.push(['ciclo', c.tipo]);
  return out;
});

const proyecto = computed(() => {
  const p = e.proyecto;
  if (!p) return [];
  const { ancho, alto } = dimensiones(p.ajustes);
  return [
    ['Formato', `${p.ajustes.formato} · ${ancho}×${alto}`],
    ['Cuadros por segundo', `${p.ajustes.fps}`],
    ['Duración', `${e.duracion.toFixed(2)} s`],
    ['Escenas', `${p.escenas.length}`],
    ['Piezas', `${p.escenas.reduce((n, x) => n + x.hijos.length, 0)}`],
    ['Componentes', `${p.biblioteca.length}`],
    ['Frases', `${p.frases.length}`],
    ['Voz', p.ajustes.audio.voz?.archivo ?? '—'],
    ['Música', p.ajustes.audio.musica?.archivo ?? '—'],
    ['Plataformas', p.ajustes.plataformas.join(', ')],
    ['Fuentes', [...new Set(p.fuentes.map((f) => f.familia))].join(', ') || '—'],
    ['Versión', `${e.version}`],
  ];
});

function referir() {
  if (!e.seleccion) return;
  e.referir({ tipo: 'pieza', id: e.seleccion, escena: e.escenaActual?.escena.id, t: e.tiempo });
}
</script>

<template>
  <section class="inspector desplazable">
    <template v-if="pieza">
      <div class="etiqueta">Pieza</div>
      <h3 class="mono">{{ e.seleccion }}</h3>
      <dl>
        <template v-for="[k, v] in filas" :key="k"><dt>{{ k }}</dt><dd class="mono">{{ v }}</dd></template>
      </dl>
      <div class="botones">
        <button @click="referir">Mencionar en el chat</button>
        <button @click="e.seleccionar(null)">Quitar selección</button>
      </div>
      <p class="tenue nota">Para cambiarla, pídeselo a Claude en el chat.</p>
    </template>
    <template v-else>
      <div class="etiqueta">Proyecto</div>
      <h3>{{ e.abierto?.documento.nombre }}</h3>
      <dl>
        <template v-for="[k, v] in proyecto" :key="k"><dt>{{ k }}</dt><dd class="mono">{{ v }}</dd></template>
      </dl>
      <p class="tenue ruta mono">{{ e.abierto?.ruta }}</p>
      <p class="tenue nota">Haz clic en una pieza del monitor para ver sus datos.</p>
    </template>
  </section>
</template>

<style scoped>
.inspector { padding: 16px; }
h3 { margin: 4px 0 14px; font-size: 16px; word-break: break-all; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 7px 14px; margin: 0; }
dt { color: var(--tenue); }
dd { margin: 0; word-break: break-word; font-size: 12px; user-select: text; }
.botones { display: flex; gap: 8px; margin-top: 16px; }
.nota { margin-top: 14px; }
.ruta { font-size: 11px; word-break: break-all; margin-top: 16px; user-select: text; }
</style>
