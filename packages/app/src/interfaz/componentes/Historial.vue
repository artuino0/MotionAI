<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { Version } from '@motionai/estudio';
import { fecha, hay, lista, t } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import { idsEnResumen, nombreNodo } from '../util/nombres.js';
import Icono from './Icono.vue';

const e = useEstudio();
const versiones = ref<Version[]>([]);
const cargar = async () => (versiones.value = await window.motionai.versiones());
onMounted(cargar);
watch(() => e.version, cargar);

const origen = (h: string) => (hay(`hist.origen.${h}`) ? t(`hist.origen.${h}` as never) : h);

/** Qué cambió, nombrando las piezas como se ven (sin ids). */
function descripcion(v: Version): string {
  const ids = idsEnResumen(v.resumen, e.indice);
  if (ids.length) {
    const nombres = ids.slice(0, 3).map((id) => nombreNodo(e.indice.get(id)!, e.proyecto ?? undefined));
    return lista(ids.length > 3 ? [...nombres, `+${ids.length - 3}`] : nombres);
  }
  const n = /versión (\d+)/i.exec(v.resumen)?.[1];
  if (v.herramienta === 'versiones' && n) return t('barra.version', { n });
  return '';
}
</script>

<template>
  <section class="historial desplazable">
    <p class="tenue nota">{{ t('hist.nota') }}</p>
    <ol>
      <li v-for="v in versiones" :key="v.numero" :class="{ actual: v.numero === e.version }">
        <div class="cab">
          <span class="num">v{{ v.numero }}</span>
          <strong>{{ origen(v.herramienta) }}</strong>
          <span class="tenue hora">{{ fecha(v.fecha, 'hora') }}</span>
        </div>
        <div v-if="descripcion(v)" class="texto" :title="v.resumen">{{ descripcion(v) }}</div>
        <div class="acc">
          <span v-if="v.numero === e.version" class="chip">{{ t('hist.actual') }}</span>
          <button v-else class="fantasma" :disabled="e.respondiendo" @click="e.volverA(v.numero)"><Icono nombre="history" :tam="13" /> {{ t('hist.volver') }}</button>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.historial { padding: 14px; }
.nota { margin: 0 0 12px; line-height: 1.5; }
ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
li { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 9px 10px; border: 1px solid var(--borde); border-radius: var(--radio-chico); align-items: center; }
li.actual { border-color: var(--acento); background: var(--acento-suave); }
.cab { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.num { font-weight: 700; color: var(--tenue); font-size: 12px; }
.hora { font-size: 12px; margin-left: auto; }
.texto { grid-column: 1; font-size: 12.5px; color: var(--tenue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acc { grid-column: 2; grid-row: 1 / span 2; }
.acc .fantasma { padding: 4px 8px; font-size: 12.5px; }
</style>
