<script setup lang="ts">
import { onMounted } from 'vue';
import { useEstudio } from '../tiendas/estudio.js';
import Ajustes from './Ajustes.vue';
import Avisos from './Avisos.vue';
import Editor from './Editor.vue';
import Inicio from './Inicio.vue';

const e = useEstudio();
onMounted(() => void e.iniciar());
</script>

<template>
  <Editor v-if="e.abierto" />
  <Inicio v-else />
  <Ajustes v-if="e.verAjustes && e.proyecto" />
  <Avisos />
</template>
