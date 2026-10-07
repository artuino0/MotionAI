<script setup lang="ts">
import { idioma, t } from '../i18n.js';
</script>

<template>
  <div class="idioma" role="radiogroup" :aria-label="t('idioma.etiqueta')">
    <button role="radio" :aria-checked="idioma === 'es'" lang="es" @click="idioma = 'es'">ES</button>
    <button role="radio" :aria-checked="idioma === 'en'" lang="en" @click="idioma = 'en'">EN</button>
  </div>
</template>

<style scoped>
.idioma { display: inline-flex; border: 1px solid var(--borde); border-radius: var(--radio-chico); padding: 2px; gap: 2px; }
button { border: none; background: none; padding: 3px 8px; font-size: 12px; font-weight: 650; color: var(--tenue); border-radius: 4px; min-height: 0; }
button[aria-checked=true] { background: var(--panel-3); color: var(--texto); }
</style>
