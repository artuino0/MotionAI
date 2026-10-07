<script setup lang="ts">
import { useEstudio } from '../tiendas/estudio.js';
import Chat from './Chat.vue';
import Historial from './Historial.vue';
import Inspector from './Inspector.vue';

const e = useEstudio();
</script>

<template>
  <aside class="lateral">
    <nav class="tabs">
      <button :class="{ activo: e.lateral === 'chat' }" @click="e.lateral = 'chat'">Chat</button>
      <button :class="{ activo: e.lateral === 'inspector' }" @click="e.lateral = 'inspector'">Inspector</button>
      <button :class="{ activo: e.lateral === 'historial' }" @click="e.lateral = 'historial'">Historial</button>
    </nav>
    <Chat v-show="e.lateral === 'chat'" class="cuerpo" />
    <Inspector v-if="e.lateral === 'inspector'" class="cuerpo" />
    <Historial v-if="e.lateral === 'historial'" class="cuerpo" />
  </aside>
</template>

<style scoped>
.lateral { display: flex; flex-direction: column; background: var(--panel); min-height: 0; }
.cuerpo { flex: 1; min-height: 0; }
</style>
