<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { idioma, t, type Clave } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import Icono from './Icono.vue';

const e = useEstudio();
const cerrar = ref<HTMLButtonElement>();
onMounted(() => nextTick(() => cerrar.value?.focus()));

const atajos: [string[], Clave][] = [
  [['Espacio'], 'atajos.reproducir'],
  [['←', '→'], 'atajos.cuadro'],
  [['Shift', '←/→'], 'atajos.segundo'],
  [['↑', '↓'], 'atajos.escena'],
  [['Inicio', 'Fin'], 'atajos.extremos'],
  [['J', 'K', 'L'], 'atajos.jkl'],
  [['Ctrl', 'Z'], 'atajos.deshacer'],
  [['Ctrl', 'Shift', 'Z'], 'atajos.rehacer'],
  [['Ctrl', 'E'], 'atajos.exportar'],
  [['Ctrl', ','], 'atajos.ajustes'],
  [['Enter'], 'atajos.enviar'],
  [['Esc'], 'atajos.quitarSel'],
  [['?'], 'atajos.ayuda'],
];
const glosario: Clave[] = ['glos.escena', 'glos.pieza', 'glos.reusable', 'glos.version', 'glos.señalar'];
const NOMBRES: Record<string, { es: string; en: string }> = {
  Espacio: { es: 'Espacio', en: 'Space' }, Inicio: { es: 'Inicio', en: 'Home' }, Fin: { es: 'Fin', en: 'End' },
};
const tecla = (k: string) => NOMBRES[k]?.[idioma.value] ?? k;
</script>

<template>
  <div class="fondo" @click.self="e.verAtajos = false" @keydown.esc.stop="e.verAtajos = false">
    <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="atajos-titulo">
      <header>
        <h2 id="atajos-titulo"><Icono nombre="keyboard" :tam="18" /> {{ t('atajos.titulo') }}</h2>
        <button ref="cerrar" class="fantasma icono" :aria-label="t('aj.cerrar')" @click="e.verAtajos = false"><Icono nombre="x" /></button>
      </header>
      <div class="cuerpo">
        <dl class="atajos">
          <template v-for="[teclas, clave] in atajos" :key="clave">
            <dt><kbd v-for="k in teclas" :key="k">{{ tecla(k) }}</kbd></dt>
            <dd>{{ t(clave) }}</dd>
          </template>
        </dl>
        <section>
          <h3>{{ t('atajos.glosario') }}</h3>
          <ul><li v-for="g in glosario" :key="g">{{ t(g) }}</li></ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fondo { position: fixed; inset: 0; background: #000a; display: grid; place-items: center; z-index: 65; }
.dialogo { width: min(720px, 92vw); max-height: 86vh; overflow: auto; background: var(--panel); border: 1px solid var(--borde-fuerte); border-radius: 12px; box-shadow: var(--sombra); }
header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px 10px 20px; border-bottom: 1px solid var(--borde); }
h2 { margin: 0; font-size: 17px; display: flex; gap: 10px; align-items: center; }
.cuerpo { display: grid; grid-template-columns: 1.1fr 1fr; gap: 28px; padding: 18px 20px 22px; }
.atajos { display: grid; grid-template-columns: auto 1fr; gap: 9px 14px; margin: 0; align-items: center; }
dt { display: flex; gap: 4px; justify-content: flex-end; }
dd { margin: 0; color: var(--tenue); }
kbd { font: 600 12px system-ui, sans-serif; padding: 2px 7px; border: 1px solid var(--borde-fuerte); border-bottom-width: 2px; border-radius: 5px; background: var(--panel-2); min-width: 22px; text-align: center; }
h3 { margin: 0 0 10px; font-size: 14px; }
ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 9px; color: var(--tenue); line-height: 1.5; }
</style>
