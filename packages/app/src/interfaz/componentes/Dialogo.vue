<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { t } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';

const e = useEstudio();
const aceptar = ref<HTMLButtonElement>();
const d = e.dialogo!;
onMounted(() => nextTick(() => aceptar.value?.focus()));

function tecla(ev: KeyboardEvent) {
  if (ev.key === 'Escape') { ev.stopPropagation(); d.responder(false); }
}
</script>

<template>
  <div class="fondo" @click.self="d.responder(false)" @keydown="tecla">
    <div class="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dlg-titulo" aria-describedby="dlg-texto">
      <h2 id="dlg-titulo">{{ d.titulo }}</h2>
      <p id="dlg-texto">{{ d.texto }}</p>
      <div class="botones">
        <button @click="d.responder(false)">{{ d.cancelar ?? t('dlg.cancelar') }}</button>
        <button ref="aceptar" :class="d.peligro ? 'peligro relleno' : 'primario'" @click="d.responder(true)">{{ d.aceptar }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fondo { position: fixed; inset: 0; background: #000a; display: grid; place-items: center; z-index: 70; animation: entra 160ms ease; }
.dialogo { width: min(440px, 92vw); background: var(--panel); border: 1px solid var(--borde-fuerte); border-radius: 12px; padding: 22px 22px 18px; box-shadow: var(--sombra); }
h2 { margin: 0 0 8px; font-size: 17px; }
p { margin: 0 0 20px; color: var(--tenue); line-height: 1.55; }
.botones { display: flex; justify-content: flex-end; gap: 10px; }
@keyframes entra { from { opacity: 0; } }
</style>
