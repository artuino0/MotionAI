<script setup lang="ts">
import { computed } from 'vue';
import { dimensiones } from '@motionai/documento';
import { useEstudio } from '../tiendas/estudio.js';

const e = useEstudio();
const formato = computed(() => {
  const a = e.proyecto?.ajustes;
  if (!a) return '';
  const { ancho, alto } = dimensiones(a);
  return `${a.formato} · ${ancho}×${alto} · ${a.fps} fps`;
});
const piezas = computed(() => e.proyecto?.escenas.reduce((n, x) => n + x.hijos.length, 0) ?? 0);
const progreso = computed(() => (e.exportando ? Math.round((e.exportando.hechos / Math.max(1, e.exportando.total)) * 100) : 0));
</script>

<template>
  <header class="barra">
    <button class="icono volver" title="Volver al inicio" @click="e.cerrar()">←</button>
    <strong class="logo"><span>Motion</span>AI</strong>
    <strong class="nombre">{{ e.abierto?.documento.nombre }}</strong>
    <span class="chip">{{ formato }}</span>
    <span class="chip">{{ e.duracion.toFixed(1) }} s · {{ e.proyecto?.escenas.length ?? 0 }} escenas · {{ piezas }} piezas</span>
    <span class="chip">versión {{ e.version }}</span>
    <span v-if="e.errorDocumento" class="chip error" :title="e.errorDocumento">documento con errores</span>
    <span class="espacio" />
    <button @click="e.verAjustes = true">Ajustes de proyecto</button>
    <button class="primario exportar" :disabled="!!e.exportando || !e.escenario" @click="e.exportar()">
      <span v-if="e.exportando" class="progreso" :style="{ width: progreso + '%' }" />
      <span class="rotulo">{{ e.exportando ? `Exportando ${progreso} %` : 'Exportar MP4' }}</span>
    </button>
  </header>
</template>

<style scoped>
.barra { display: flex; align-items: center; gap: 10px; padding: 0 14px; background: var(--panel); border-bottom: 1px solid var(--borde); }
.logo { font-size: 16px; } .logo span { color: var(--acento); }
.nombre { font-size: 15px; margin: 0 6px; }
.espacio { flex: 1; }
.error { color: var(--rojo); border-color: var(--rojo); }
.exportar { position: relative; overflow: hidden; min-width: 150px; }
.progreso { position: absolute; inset: 0 auto 0 0; background: #ffffff55; transition: width 0.2s; }
.rotulo { position: relative; }
</style>
