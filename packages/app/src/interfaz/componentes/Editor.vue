<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useEstudio } from '../tiendas/estudio.js';
import Barra from './Barra.vue';
import Lateral from './Lateral.vue';
import LineaTiempo from './LineaTiempo.vue';
import Medios from './Medios.vue';
import Monitor from './Monitor.vue';

const e = useEstudio();

function teclas(ev: KeyboardEvent) {
  const t = ev.target as HTMLElement;
  if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
  if (ev.code === 'Space') { ev.preventDefault(); e.alternar(); }
  if (ev.code === 'ArrowRight') { e.pausar(); e.irA(e.tiempo + (ev.shiftKey ? 1 : 1 / (e.escenario?.fps ?? 30))); }
  if (ev.code === 'ArrowLeft') { e.pausar(); e.irA(e.tiempo - (ev.shiftKey ? 1 : 1 / (e.escenario?.fps ?? 30))); }
  if (ev.code === 'Escape') e.seleccionar(null);
}
onMounted(() => addEventListener('keydown', teclas));
onBeforeUnmount(() => removeEventListener('keydown', teclas));
</script>

<template>
  <div class="editor">
    <Barra class="barra" />
    <Medios class="medios" />
    <Monitor class="monitor" />
    <Lateral class="lateral" />
    <LineaTiempo class="linea" />
  </div>
</template>

<style scoped>
.editor {
  height: 100%;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 380px;
  grid-template-rows: 52px minmax(0, 1fr) 300px;
  grid-template-areas: 'barra barra barra' 'medios monitor lateral' 'linea linea linea';
}
.barra { grid-area: barra; }
.medios { grid-area: medios; border-right: 1px solid var(--borde); }
.monitor { grid-area: monitor; }
.lateral { grid-area: lateral; border-left: 1px solid var(--borde); }
.linea { grid-area: linea; border-top: 1px solid var(--borde); }
</style>
