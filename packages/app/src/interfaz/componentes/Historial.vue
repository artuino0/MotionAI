<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { Version } from '@motionai/estudio';
import { useEstudio } from '../tiendas/estudio.js';

const e = useEstudio();
const versiones = ref<Version[]>([]);
const cargar = async () => (versiones.value = await window.motionai.versiones());
onMounted(cargar);
watch(() => e.version, cargar);

const origen: Record<string, string> = {
  abrir_proyecto: 'Abierto', externo: 'Cambio fuera de la app', ajustes_proyecto: 'Ajustes', agregar_pieza: 'Pieza nueva',
  crear_pieza: 'Componente', cambiar: 'Cambio', quitar_pieza: 'Quitar', escenas: 'Escenas', voz: 'Audio', versiones: 'Volver',
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

async function volver(v: Version) {
  if (!confirm(`¿Volver el proyecto a la versión ${v.numero}? El cambio queda en el historial y se puede deshacer.`)) return;
  const r = await window.motionai.volverA(v.numero);
  e.avisar(r.ok ? `Volví a la versión ${v.numero}.` : (r.errores ?? []).join('\n'), r.ok ? 'ok' : 'error');
}
</script>

<template>
  <section class="historial desplazable">
    <p class="tenue">Cada cambio de Claude o de los ajustes queda como una versión. Volver a una también se guarda: nada se pierde.</p>
    <ol>
      <li v-for="v in versiones" :key="v.numero" :class="{ actual: v.numero === e.version }">
        <div class="cab">
          <span class="num mono">v{{ v.numero }}</span>
          <span class="chip">{{ origen[v.herramienta] ?? v.herramienta }}</span>
          <span class="tenue mono">{{ hora(v.fecha) }}</span>
          <button v-if="v.numero !== e.version" class="icono volver" @click="volver(v)">Volver</button>
          <span v-else class="tenue">actual</span>
        </div>
        <div class="texto">{{ v.resumen }}</div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.historial { padding: 14px; }
ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
li { padding: 8px 10px; border: 1px solid var(--borde); border-radius: 6px; }
li.actual { border-color: var(--acento); }
.cab { display: flex; align-items: center; gap: 8px; }
.num { font-weight: 700; }
.volver { margin-left: auto; }
.cab .tenue:last-child { margin-left: auto; }
.texto { margin-top: 4px; font-size: 12px; color: var(--tenue); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
</style>
