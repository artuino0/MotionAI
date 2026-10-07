<script setup lang="ts">
import { t } from '../i18n.js';
import { useEstudio, type Lateral } from '../tiendas/estudio.js';
import Chat from './Chat.vue';
import Historial from './Historial.vue';
import Inspector from './Inspector.vue';

const e = useEstudio();
const pestanas: Lateral[] = ['chat', 'inspector', 'historial'];
</script>

<template>
  <aside class="lateral">
    <div class="tabs" role="tablist">
      <button
        v-for="p in pestanas" :id="`tab-${p}`" :key="p" role="tab" :aria-selected="e.lateral === p"
        :aria-controls="`panel-${p}`" @click="e.lateral = p"
      >
        {{ t(`lateral.${p}` as const) }}
        <span v-if="p === 'chat' && e.respondiendo && e.lateral !== 'chat'" class="punto" aria-hidden="true" />
      </button>
    </div>
    <Chat v-show="e.lateral === 'chat'" id="panel-chat" class="cuerpo" role="tabpanel" aria-labelledby="tab-chat" />
    <Inspector v-if="e.lateral === 'inspector'" id="panel-inspector" class="cuerpo" role="tabpanel" aria-labelledby="tab-inspector" />
    <Historial v-if="e.lateral === 'historial'" id="panel-historial" class="cuerpo" role="tabpanel" aria-labelledby="tab-historial" />
  </aside>
</template>

<style scoped>
.lateral { display: flex; flex-direction: column; background: var(--panel); min-height: 0; }
.cuerpo { flex: 1; min-height: 0; }
.punto { width: 6px; height: 6px; border-radius: 50%; background: var(--claude); animation: latido 1.1s infinite; }
</style>
