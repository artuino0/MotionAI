<script setup lang="ts">
import { useEstudio } from '../tiendas/estudio.js';
const e = useEstudio();
</script>

<template>
  <div class="avisos">
    <div v-for="a in e.avisos" :key="a.id" class="aviso" :class="a.tipo">
      <span>{{ a.texto }}</span>
      <button v-if="a.accion" @click="a.accion.hacer()">{{ a.accion.texto }}</button>
    </div>
  </div>
</template>

<style scoped>
.avisos { position: fixed; right: 18px; bottom: 18px; display: flex; flex-direction: column; gap: 8px; z-index: 50; }
.aviso { display: flex; gap: 12px; align-items: center; background: var(--panel-2); border: 1px solid var(--borde); border-left: 3px solid var(--acento); border-radius: var(--radio); padding: 10px 14px; box-shadow: 0 8px 30px #0008; max-width: 460px; }
.aviso.error { border-left-color: var(--rojo); }
.aviso.ok { border-left-color: var(--verde); }
</style>
