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
  const escribiendo = t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable;
  const mod = ev.ctrlKey || ev.metaKey;
  if (e.dialogo || e.verAjustes || e.verAtajos) return; // cada ventana maneja sus teclas
  if (mod && ev.key.toLowerCase() === 'z' && !escribiendo) { ev.preventDefault(); void (ev.shiftKey ? e.rehacerCambio() : e.deshacer()); return; }
  if (mod && ev.key.toLowerCase() === 'y' && !escribiendo) { ev.preventDefault(); void e.rehacerCambio(); return; }
  if (mod && ev.key.toLowerCase() === 'e') { ev.preventDefault(); void e.exportar(); return; }
  if (mod && ev.key === ',') { ev.preventDefault(); e.verAjustes = true; return; }
  if (escribiendo) return;
  const fps = e.escenario?.fps ?? 30;
  switch (ev.key) {
    case ' ': ev.preventDefault(); e.alternar(); break;
    case 'ArrowRight': ev.preventDefault(); e.pausar(); e.irA(e.tiempo + (ev.shiftKey ? 1 : 1 / fps)); break;
    case 'ArrowLeft': ev.preventDefault(); e.pausar(); e.irA(e.tiempo - (ev.shiftKey ? 1 : 1 / fps)); break;
    case 'ArrowUp': ev.preventDefault(); e.saltarEscena(-1); break;
    case 'ArrowDown': ev.preventDefault(); e.saltarEscena(1); break;
    case 'Home': ev.preventDefault(); e.pausar(); e.irA(0); break;
    case 'End': ev.preventDefault(); e.pausar(); e.irA(e.duracion); break;
    case 'j': case 'J': e.pausar(); e.irA(e.tiempo - 1); break;
    case 'k': case 'K': e.pausar(); break;
    case 'l': case 'L': if (!e.reproduciendo) e.alternar(); break;
    case '?': e.verAtajos = true; break;
    case 'Escape': e.seleccionar(null); break;
  }
}
onMounted(() => addEventListener('keydown', teclas));
onBeforeUnmount(() => removeEventListener('keydown', teclas));
</script>

<template>
  <div class="editor" :class="{ plegada: !e.lineaAbierta }">
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
  grid-template-columns: 264px minmax(0, 1fr) clamp(360px, 30vw, 460px);
  grid-template-rows: 52px minmax(0, 1fr) 272px;
  grid-template-areas: 'barra barra barra' 'medios monitor lateral' 'linea linea lateral';
}
.editor.plegada { grid-template-rows: 52px minmax(0, 1fr) 42px; }
.barra { grid-area: barra; }
.medios { grid-area: medios; border-right: 1px solid var(--borde); }
.monitor { grid-area: monitor; }
.lateral { grid-area: lateral; border-left: 1px solid var(--borde); }
.linea { grid-area: linea; border-top: 1px solid var(--borde); }
@media (max-width: 1240px) {
  .editor { grid-template-columns: 220px minmax(0, 1fr) 360px; }
}
</style>
