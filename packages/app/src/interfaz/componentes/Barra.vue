<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import Icono from './Icono.vue';
import SelectorIdioma from './SelectorIdioma.vue';

const e = useEstudio();
const resumen = computed(() => {
  const a = e.proyecto?.ajustes;
  if (!a) return '';
  return t('barra.resumen', {
    formato: t(`formato.corto.${a.formato}` as const),
    duracion: e.duracion.toFixed(e.duracion % 1 ? 1 : 0),
    escenas: t('barra.escenas', { n: e.esHtml ? e.escenasHtml.length : e.proyecto!.escenas.length }),
  });
});
const progreso = computed(() => (e.exportando ? Math.round((e.exportando.hechos / Math.max(1, e.exportando.total)) * 100) : 0));
const motivoExportar = computed(() =>
  e.respondiendo ? t('barra.exportarEspera') : !e.tieneContenido ? t('barra.exportarVacio') : t('barra.exportarTitulo'));
</script>

<template>
  <header class="barra">
    <button class="fantasma icono" :aria-label="t('barra.volver')" :title="t('barra.volver')" @click="e.cerrar()"><Icono nombre="arrow-left" /></button>
    <span class="logo" aria-hidden="true">MotionAI</span>
    <span class="separador" aria-hidden="true" />
    <h1 class="nombre">{{ e.abierto?.documento.nombre }}</h1>
    <button class="fantasma resumen" :title="t('barra.ajustesTitulo')" @click="e.verAjustes = true">{{ resumen }}</button>
    <button class="fantasma version" :title="t('barra.versionTitulo')" @click="e.lateral = 'historial'">
      <Icono nombre="history" :tam="14" /> {{ t('barra.version', { n: e.version }) }}
    </button>
    <span v-if="e.errorDocumento" class="chip error" :title="e.errorDocumento"><Icono nombre="triangle-alert" :tam="14" /> {{ t('barra.errorDoc') }}</span>
    <span class="espacio" />
    <SelectorIdioma />
    <button class="fantasma icono" :aria-label="t('barra.ayuda')" :title="t('barra.ayuda')" @click="e.verAtajos = true"><Icono nombre="circle-help" /></button>
    <button @click="e.verAjustes = true"><Icono nombre="settings" /> {{ t('barra.ajustes') }}</button>
    <button
      class="exportar" :class="{ primario: e.tieneContenido && !e.respondiendo }"
      :disabled="!!e.exportando || !e.escenario || !e.tieneContenido || e.respondiendo"
      :title="motivoExportar" @click="e.exportar()"
    >
      <span v-if="e.exportando" class="progreso" :style="{ transform: `scaleX(${progreso / 100})` }" />
      <span class="rotulo"><Icono nombre="download" /> {{ e.exportando ? t('barra.exportando', { n: progreso }) : t('barra.exportar') }}</span>
    </button>
  </header>
</template>

<style scoped>
.barra { display: flex; align-items: center; gap: 8px; padding: 0 12px 0 8px; background: var(--panel); border-bottom: 1px solid var(--borde); min-width: 0; }
.logo { font-weight: 750; font-size: 14px; letter-spacing: -0.01em; color: var(--tenue); }
.separador { width: 1px; height: 18px; background: var(--borde-fuerte); margin: 0 4px; }
.nombre { font-size: 15px; font-weight: 650; margin: 0 4px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 60px; }
.resumen, .version { font-size: 12.5px; padding: 4px 8px; white-space: nowrap; }
.espacio { flex: 1; }
.error { color: var(--rojo); border-color: #ff767666; }
.exportar { position: relative; overflow: hidden; min-width: 156px; }
.exportar:disabled.primario { opacity: 1; }
.progreso { position: absolute; inset: 0; background: #ffffff40; transform-origin: left; transition: transform 200ms linear; }
.rotulo { position: relative; display: inline-flex; gap: 6px; align-items: center; }
@media (max-width: 1240px) { .resumen { display: none; } }
</style>
