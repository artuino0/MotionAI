<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Nodo } from '@motionai/documento';
import { t } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import { miniatura } from '../util/dibujo.js';
import type { NombreIcono } from '../util/iconos.js';
import { nombreEscena, nombreNodo } from '../util/nombres.js';
import Icono from './Icono.vue';

type Pestana = 'escenas' | 'piezas' | 'biblioteca' | 'frases';
const e = useEstudio();
const pestana = ref<Pestana>('escenas');
const pestanas: Pestana[] = ['escenas', 'piezas', 'biblioteca', 'frases'];
const minis = ref<Record<string, string>>({});
let pendiente: ReturnType<typeof setTimeout> | undefined;

// Miniaturas de cada escena en reposo (un poco antes del corte), recalculadas tras cada cambio.
watch(() => e.revision, () => {
  clearTimeout(pendiente);
  pendiente = setTimeout(() => {
    const esc = e.escenario;
    if (!esc) return;
    const m: Record<string, string> = {};
    for (const x of esc.escenas) m[x.escena.id] = miniatura(esc, e.entorno, Math.max(x.inicio, Math.min(x.fin - 0.05, x.inicio + (x.fin - x.inicio) * 0.8)), 220);
    minis.value = m;
  }, 250);
}, { immediate: true });

const vertical = computed(() => (e.escenario ? e.escenario.alto >= e.escenario.ancho : true));
const proporcion = computed(() => (e.escenario ? `${e.escenario.ancho} / ${e.escenario.alto}` : '9 / 16'));

function irEscena(id: string) {
  const x = e.proyecto?.escenas.find((s) => s.id === id);
  if (!x) return;
  e.pausar();
  e.irA(x.inicio + Math.min(0.8, (x.fin - x.inicio) / 2));
}
function mencionarEscena(id: string) {
  const x = e.proyecto?.escenas.find((s) => s.id === id);
  if (x) e.referir({ tipo: 'escena', id: x.id, nombre: nombreEscena(e.proyecto, x.id), t: x.inicio });
}

function aplanar(n: Nodo, nivel: number, out: { n: Nodo; nivel: number }[]) {
  out.push({ n, nivel });
  if (n.tipo === 'grupo') n.hijos.forEach((h) => aplanar(h, nivel + 1, out));
  return out;
}

function elegirPieza(id: string, inicio: number, entra?: number) {
  const destino = Math.max(inicio, (entra ?? inicio) + 0.6);
  if (e.tiempo < destino) { e.pausar(); e.irA(destino); }
  e.senalarPieza(id);
}

const ICONO: Record<Nodo['tipo'], NombreIcono> = {
  rect: 'square', elipse: 'circle', trazo: 'pen-tool', texto: 'type', imagen: 'image', grupo: 'layers', instancia: 'component',
};
const entradaDe = (id: string) => e.escenario?.escenas.flatMap((x) => x.hijos).find((h) => h.nodo.id === id)?.entra?.en;
</script>

<template>
  <aside class="medios">
    <div class="tabs" role="tablist">
      <button
        v-for="p in pestanas" :id="`tab-medios-${p}`" :key="p" role="tab"
        :aria-selected="pestana === p" :aria-controls="`panel-medios-${p}`" @click="pestana = p"
      >{{ t(`medios.${p}` as const) }}</button>
    </div>
    <div :id="`panel-medios-${pestana}`" class="contenido desplazable" role="tabpanel" :aria-labelledby="`tab-medios-${pestana}`">
      <template v-if="pestana === 'escenas'">
        <p v-if="!e.tieneContenido" class="vacio tenue">{{ t('medios.escenasVacio') }}</p>
        <ul class="escenas" :class="{ vertical }">
          <li v-for="x in e.proyecto?.escenas" :key="x.id" class="escena" :class="{ actual: e.escenaActual?.escena.id === x.id }">
            <button class="mini" :style="{ aspectRatio: proporcion }" :aria-label="nombreEscena(e.proyecto, x.id)" @click="irEscena(x.id)">
              <img v-if="minis[x.id]" :src="minis[x.id]" alt="" />
              <span class="dur">{{ (x.fin - x.inicio).toFixed(1) }} s</span>
            </button>
            <div class="pie">
              <span class="nombre">{{ nombreEscena(e.proyecto, x.id) }}</span>
              <button class="fantasma mencionar" :title="t('medios.mencionarTitulo')" :aria-label="`${t('medios.mencionar')}: ${nombreEscena(e.proyecto, x.id)}`" @click="mencionarEscena(x.id)">
                <Icono nombre="message-square-plus" :tam="14" />
              </button>
            </div>
          </li>
        </ul>
      </template>

      <template v-else-if="pestana === 'piezas'">
        <section v-for="x in e.proyecto?.escenas" :key="x.id" class="grupo-piezas">
          <h3 class="etiqueta">{{ nombreEscena(e.proyecto, x.id) }}</h3>
          <p v-if="!x.hijos.length" class="tenue vacio">{{ t('medios.sinPiezas') }}</p>
          <ul>
            <template v-for="h in x.hijos" :key="h.id">
              <li v-for="{ n, nivel } in aplanar(h, 0, [])" :key="n.id">
                <button
                  class="pieza" :class="{ sel: e.seleccion === n.id }" :style="{ paddingLeft: 8 + nivel * 16 + 'px' }"
                  :aria-pressed="e.seleccion === n.id" @click="elegirPieza(n.id, x.inicio, entradaDe(h.id))"
                >
                  <Icono :nombre="ICONO[n.tipo]" :tam="14" class="ico" />
                  <span class="txt">{{ nombreNodo(n, e.proyecto ?? undefined) }}</span>
                </button>
              </li>
            </template>
          </ul>
        </section>
      </template>

      <template v-else-if="pestana === 'biblioteca'">
        <p class="tenue vacio">{{ t('medios.bibliotecaNota') }}</p>
        <p v-if="!e.proyecto?.biblioteca.length" class="vacio">{{ t('medios.bibliotecaVacia') }}</p>
        <div v-for="c in e.proyecto?.biblioteca" :key="c.id" class="componente">
          <strong><Icono nombre="component" :tam="14" /> {{ c.nombre }}</strong>
          <div v-if="c.nota" class="tenue">{{ c.nota }}</div>
        </div>
      </template>

      <template v-else>
        <p v-if="!e.proyecto?.frases.length" class="tenue vacio">{{ t('medios.frasesVacia') }}</p>
        <ul class="frases">
          <li v-for="(f, i) in e.proyecto?.frases" :key="i">
            <button class="frase" @click="e.pausar(); e.irA(f.inicio)">
              <span class="tenue">{{ f.inicio.toFixed(2) }}–{{ f.fin.toFixed(2) }} s</span>
              <span>{{ f.texto }}</span>
              <span v-if="f.subtitulo === false" class="chip">{{ t('medios.sinSubtitulo') }}</span>
            </button>
          </li>
        </ul>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.medios { display: flex; flex-direction: column; background: var(--panel); min-height: 0; }
.contenido { flex: 1; padding: 12px; }
.tabs button { padding: 12px 6px 10px; font-size: 13px; }
ul { list-style: none; margin: 0; padding: 0; }
.escenas { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 10px; }
.escenas:not(.vertical) { grid-template-columns: 1fr; }
.escena { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mini { position: relative; padding: 0; border-radius: var(--radio-chico); overflow: hidden; border: 2px solid var(--borde); background: #000; width: 100%; display: block; }
.mini:hover:not(:disabled) { border-color: var(--borde-fuerte); background: #000; }
.escena.actual .mini { border-color: var(--acento); }
.mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dur { position: absolute; right: 5px; bottom: 5px; background: #000c; padding: 1px 6px; border-radius: 4px; font-size: 12px; color: #fff; }
.pie { display: flex; align-items: center; gap: 4px; min-width: 0; }
.nombre { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mencionar { padding: 4px; min-width: 26px; min-height: 26px; opacity: 0.6; }
.escena:hover .mencionar, .mencionar:focus-visible { opacity: 1; }
.grupo-piezas { margin-bottom: 14px; }
.grupo-piezas h3 { margin: 4px 0 6px; }
.pieza { width: 100%; justify-content: flex-start; gap: 8px; padding: 5px 8px; border: none; background: none; text-align: left; min-height: 30px; }
.pieza:hover:not(:disabled) { background: var(--panel-2); border: none; }
.pieza.sel { background: var(--acento-suave); box-shadow: inset 0 0 0 1px var(--acento); }
.ico { color: var(--tenue); }
.txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vacio { margin: 2px 0 12px; line-height: 1.5; }
.componente { padding: 10px; border: 1px solid var(--borde); border-radius: var(--radio-chico); margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px; }
.componente strong { display: flex; gap: 6px; align-items: center; }
.frases { display: flex; flex-direction: column; gap: 4px; }
.frase { width: 100%; flex-direction: column; align-items: flex-start; gap: 3px; padding: 8px 10px; background: none; border-color: transparent; text-align: left; }
.frase:hover:not(:disabled) { background: var(--panel-2); border-color: var(--borde); }
</style>
