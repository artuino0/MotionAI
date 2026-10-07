<script setup lang="ts">
import { t } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import Icono from './Icono.vue';

const e = useEstudio();
const icono = { info: 'info', ok: 'check', error: 'triangle-alert' } as const;
</script>

<template>
  <div class="avisos" aria-live="polite">
    <TransitionGroup name="aviso">
      <div v-for="a in e.avisos" :key="a.id" class="aviso" :class="a.tipo" :role="a.tipo === 'error' ? 'alert' : 'status'">
        <span class="marca"><Icono :nombre="icono[a.tipo]" :tam="16" /></span>
        <div class="cuerpo">
          <strong>{{ a.texto }}</strong>
          <span v-if="a.detalle" class="tenue">{{ a.detalle }}</span>
          <div v-if="a.acciones" class="acciones">
            <button v-for="(x, i) in a.acciones" :key="x.texto" :class="{ primario: i === 0 }" @click="x.hacer()">{{ x.texto }}</button>
          </div>
        </div>
        <button class="fantasma icono" :aria-label="t('aviso.cerrar')" @click="e.cerrarAviso(a.id)"><Icono nombre="x" :tam="14" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.avisos { position: fixed; left: 16px; bottom: 16px; flex-direction: column-reverse; display: flex; flex-direction: column; gap: 8px; z-index: 60; width: min(380px, calc(100vw - 32px)); }
.aviso { display: flex; gap: 10px; align-items: flex-start; background: var(--panel-2); border: 1px solid var(--borde-fuerte); border-radius: var(--radio); padding: 10px 8px 10px 12px; box-shadow: var(--sombra); }
.marca { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--acento-suave); color: var(--acento); flex: none; }
.ok .marca { background: #4fcb8d26; color: var(--verde); }
.error .marca { background: #ff767626; color: var(--rojo); }
.cuerpo { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; padding-top: 3px; word-break: break-word; }
.acciones { display: flex; gap: 8px; margin-top: 8px; }
.aviso-enter-active, .aviso-leave-active { transition: opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
.aviso-enter-from, .aviso-leave-to { opacity: 0; transform: translateY(6px); }
</style>
