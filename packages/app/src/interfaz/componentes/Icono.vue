<script setup lang="ts">
import { computed } from 'vue';
import { ICONOS, type NombreIcono } from '../util/iconos.js';

const p = withDefaults(defineProps<{ nombre: NombreIcono; tam?: number; relleno?: boolean }>(), { tam: 16, relleno: false });
const svg = computed(() => ICONOS[p.nombre]);
</script>

<template>
  <svg
    class="icono-svg" :width="tam" :height="tam" viewBox="0 0 24 24" aria-hidden="true"
    :fill="relleno ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    v-html="svg"
  />
</template>

<style scoped>
.icono-svg { flex: none; display: inline-block; vertical-align: middle; }
</style>
