<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { FORMATOS, PLATAFORMAS, type Ajustes } from '@motionai/documento';
import { t } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import Icono from './Icono.vue';

const e = useEstudio();
const original = e.proyecto!.ajustes;
// Copia editable; al guardar solo se mandan los campos que cambiaron.
const a = ref<Ajustes>(JSON.parse(JSON.stringify(original)));
const duracionAuto = ref(original.duracion === undefined);
const errores = ref<string[]>([]);
const guardando = ref(false);
const dialogo = ref<HTMLFormElement>();
const cajaErrores = ref<HTMLDivElement>();

const CATALOGO = ['Nunito', 'Montserrat', 'Poppins', 'Bebas Neue', 'Playfair Display', 'Caveat', 'Space Grotesk'];
const familias = computed(() => [...new Set([...e.proyecto!.fuentes.map((f) => f.familia), ...CATALOGO])]);
const PESOS = [400, 700, 800, 900] as const;
const CALIDADES = [
  { id: 'alta', crf: 18 },
  { id: 'equilibrada', crf: 23 },
  { id: 'chica', crf: 28 },
] as const;
const calidad = computed({
  get: () => CALIDADES.find((c) => c.crf === a.value.exportar.calidad)?.id ?? 'personalizada',
  set: (id: string) => { const c = CALIDADES.find((x) => x.id === id); if (c) a.value.exportar.calidad = c.crf; },
});

function diferencias(antes: unknown, ahora: unknown): unknown {
  if (JSON.stringify(antes) === JSON.stringify(ahora)) return undefined;
  if (ahora && typeof ahora === 'object' && !Array.isArray(ahora) && antes && typeof antes === 'object' && !Array.isArray(antes)) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(antes), ...Object.keys(ahora)])) {
      const d = diferencias((antes as Record<string, unknown>)[k], (ahora as Record<string, unknown>)[k]);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return ahora === undefined ? null : ahora;
}

function cambios(): Record<string, unknown> | undefined {
  const nuevo = JSON.parse(JSON.stringify(a.value)) as Ajustes;
  if (duracionAuto.value) delete nuevo.duracion;
  if (nuevo.formato !== 'libre') { delete nuevo.ancho; delete nuevo.alto; }
  return diferencias(original, nuevo) as Record<string, unknown> | undefined;
}

async function cerrar() {
  if (cambios()) {
    const si = await e.confirmar({ titulo: t('aj.descartarTitulo'), texto: t('aj.descartarTexto'), aceptar: t('aj.descartar'), cancelar: t('aj.seguir'), peligro: true });
    if (!si) return;
  }
  e.verAjustes = false;
}

async function guardar() {
  const c = cambios();
  if (!c) { e.verAjustes = false; return; }
  guardando.value = true;
  errores.value = [];
  const r = await window.motionai.cambiarAjustes(c);
  guardando.value = false;
  if (r.ok) {
    e.verAjustes = false;
    e.avisar(t('aj.guardados', { n: r.version }), 'ok');
  } else {
    errores.value = r.errores ?? [r.mensaje];
    await nextTick();
    cajaErrores.value?.scrollIntoView({ block: 'nearest' });
    cajaErrores.value?.focus();
  }
}

function tecla(ev: KeyboardEvent) {
  if (e.dialogo) return;
  if (ev.key === 'Escape') { ev.stopPropagation(); void cerrar(); }
  // Mantiene el foco dentro de la ventana.
  if (ev.key === 'Tab' && dialogo.value) {
    const f = [...dialogo.value.querySelectorAll<HTMLElement>('button, input, select, textarea, summary')].filter((x) => !x.hasAttribute('disabled') && x.offsetParent);
    const primero = f[0], ultimo = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo?.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero?.focus(); }
  }
}

onMounted(() => nextTick(() => dialogo.value?.querySelector<HTMLElement>('select, input')?.focus()));
</script>

<template>
  <div class="fondo" @click.self="cerrar" @keydown="tecla">
    <form ref="dialogo" class="dialogo" role="dialog" aria-modal="true" aria-labelledby="aj-titulo" @submit.prevent="guardar">
      <header>
        <h2 id="aj-titulo">{{ t('aj.titulo') }}</h2>
        <button type="button" class="fantasma icono" :aria-label="t('aj.cerrar')" @click="cerrar"><Icono nombre="x" /></button>
      </header>
      <div ref="cajaErrores" class="errores" role="alert" tabindex="-1" :hidden="!errores.length">
        <strong><Icono nombre="triangle-alert" :tam="14" /> {{ t('aj.noGuardo') }}</strong>
        <ul><li v-for="x in errores" :key="x">{{ x }}</li></ul>
      </div>
      <div class="cuerpo desplazable">
        <fieldset>
          <legend>{{ t('aj.formato') }}</legend>
          <label class="ancho">{{ t('aj.tamano') }}
            <select v-model="a.formato">
              <option v-for="(f, id) in FORMATOS" :key="id" :value="id">{{ t(`formato.${id}` as const) }} · {{ f.ancho }}×{{ f.alto }}</option>
              <option value="libre">{{ t('formato.libre') }}</option>
            </select>
          </label>
          <template v-if="a.formato === 'libre'">
            <label>{{ t('aj.ancho') }} <input v-model.number="a.ancho" type="number" min="16" max="7680" /></label>
            <label>{{ t('aj.alto') }} <input v-model.number="a.alto" type="number" min="16" max="7680" /></label>
          </template>
          <label class="ancho color">{{ t('aj.fondo') }}
            <span class="fila"><input v-model="a.fondo" type="color" /> <span class="tenue">{{ t('aj.fondoNota') }}</span></span>
          </label>
        </fieldset>

        <fieldset>
          <legend>{{ t('aj.tiempo') }}</legend>
          <label>{{ t('aj.fps') }}
            <select v-model.number="a.fps">
              <option v-for="f in [24, 25, 30, 60]" :key="f" :value="f">{{ f === 30 ? t('aj.fpsRecomendado', { n: f }) : f }}</option>
            </select>
          </label>
          <span />
          <label class="casilla ancho"><input v-model="duracionAuto" type="checkbox" /> {{ t('aj.duracionAuto') }}</label>
          <label v-if="!duracionAuto">{{ t('aj.duracion') }} <input v-model.number="a.duracion" type="number" min="0.5" step="0.1" /></label>
        </fieldset>

        <fieldset>
          <legend>{{ t('aj.plataformas') }}</legend>
          <p class="tenue ancho nota">{{ t('aj.plataformasNota') }}</p>
          <label v-for="p in PLATAFORMAS" :key="p" class="casilla"><input v-model="a.plataformas" type="checkbox" :value="p" /> {{ t(`plat.${p}` as const) }}</label>
        </fieldset>

        <fieldset>
          <legend>{{ t('aj.subtitulos') }}</legend>
          <label class="casilla ancho"><input v-model="a.subtitulos.activados" type="checkbox" /> {{ t('aj.subActivos') }}</label>
          <template v-if="a.subtitulos.activados">
            <label>{{ t('aj.subFuente') }}
              <select v-model="a.subtitulos.fuente"><option :value="undefined">{{ t('aj.subFuenteProyecto') }}</option><option v-for="f in familias" :key="f" :value="f">{{ f }}</option></select>
            </label>
            <label>{{ t('aj.subPeso') }}
              <select v-model.number="a.subtitulos.peso"><option v-for="p in PESOS" :key="p" :value="p">{{ t(`aj.peso.${p}` as const) }}</option></select>
            </label>
            <label>{{ t('aj.subTamano') }} <input v-model.number="a.subtitulos.tamano" type="number" min="20" max="160" /></label>
            <label>{{ t('aj.subRenglones') }} <input v-model.number="a.subtitulos.maxRenglones" type="number" min="1" max="5" /></label>
            <label class="ancho">{{ t('aj.subAltura', { n: Math.round(a.subtitulos.posicion * 100) }) }}
              <input v-model.number="a.subtitulos.posicion" type="range" min="0.1" max="0.95" step="0.01" />
            </label>
            <label>{{ t('aj.subColor') }} <input v-model="a.subtitulos.color" type="color" /></label>
            <label>{{ t('aj.subContorno') }} <input v-model="a.subtitulos.contorno.color" type="color" /></label>
            <label>{{ t('aj.subGrosor') }} <input v-model.number="a.subtitulos.contorno.ancho" type="number" min="0" max="30" /></label>
          </template>
        </fieldset>

        <fieldset>
          <legend>{{ t('aj.audio') }}</legend>
          <p v-if="!a.audio.voz && !a.audio.musica" class="tenue ancho nota">{{ t('aj.sinAudio') }}</p>
          <label v-if="a.audio.voz">{{ t('aj.vozVolumen') }} <input v-model.number="a.audio.voz.volumen" type="range" min="0" max="2" step="0.05" /></label>
          <label v-if="a.audio.voz">{{ t('aj.vozInicio') }} <input v-model.number="a.audio.voz.inicio" type="number" min="0" step="0.05" /></label>
          <label v-if="a.audio.musica">{{ t('aj.musicaVolumen') }} <input v-model.number="a.audio.musica.volumen" type="range" min="0" max="2" step="0.05" /></label>
          <label>{{ t('aj.fundido') }} <input v-model.number="a.audio.fundidoFinal" type="number" min="0" max="10" step="0.1" /></label>
        </fieldset>

        <fieldset>
          <legend>{{ t('aj.exportar') }}</legend>
          <div class="ancho segmentos" role="radiogroup" :aria-label="t('aj.calidad')">
            <span class="tenue">{{ t('aj.calidad') }}</span>
            <label v-for="c in CALIDADES" :key="c.id" class="segmento" :class="{ sel: calidad === c.id }">
              <input v-model="calidad" type="radio" name="calidad" :value="c.id" class="solo-lector" /> {{ t(`aj.calidad.${c.id}` as const) }}
            </label>
            <span v-if="calidad === 'personalizada'" class="chip">{{ t('aj.calidad.personalizada') }}</span>
          </div>
          <details class="ancho">
            <summary>{{ t('aj.avanzado') }}</summary>
            <div class="avanzado">
              <label>{{ t('aj.codec') }} <select v-model="a.exportar.codec"><option value="h264">{{ t('aj.codec.h264') }}</option><option value="h265">{{ t('aj.codec.h265') }}</option></select></label>
              <label>{{ t('aj.crf') }} <input v-model.number="a.exportar.calidad" type="number" min="0" max="51" /></label>
              <label>{{ t('aj.carpeta') }} <input v-model="a.exportar.carpeta" /></label>
              <label>{{ t('aj.archivo') }} <input v-model="a.exportar.nombreArchivo" :placeholder="t('aj.archivoEjemplo')" /></label>
              <label>{{ t('aj.fpsEstilo') }} <input v-model.number="a.fpsEstilo" type="number" min="1" max="60" /></label>
            </div>
          </details>
        </fieldset>
      </div>
      <footer>
        <button type="button" @click="cerrar">{{ t('aj.cancelar') }}</button>
        <button class="primario" type="submit" :disabled="guardando">{{ guardando ? t('aj.guardando') : t('aj.guardar') }}</button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.fondo { position: fixed; inset: 0; background: #000a; display: grid; place-items: center; z-index: 50; }
.dialogo { width: min(720px, 92vw); max-height: 88vh; background: var(--panel); border: 1px solid var(--borde-fuerte); border-radius: 12px; display: flex; flex-direction: column; box-shadow: var(--sombra); }
header, footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 12px 20px; flex: none; }
header { border-bottom: 1px solid var(--borde); } header h2 { margin: 0; font-size: 17px; }
footer { border-top: 1px solid var(--borde); justify-content: flex-end; gap: 10px; }
.errores { margin: 12px 20px 0; padding: 10px 12px; border-radius: var(--radio-chico); background: #ff767614; border: 1px solid #ff767655; color: #ffb4b4; flex: none; }
.errores strong { display: flex; gap: 6px; align-items: center; }
.errores ul { margin: 6px 0 0; padding-left: 20px; }
.cuerpo { padding: 0 20px 14px; }
fieldset { border: none; border-bottom: 1px solid var(--borde); padding: 6px 0 18px; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
fieldset:last-child { border-bottom: none; }
legend { font-weight: 700; padding: 16px 0 6px; float: left; width: 100%; grid-column: 1 / -1; font-size: 14px; }
label { display: flex; flex-direction: column; gap: 6px; color: var(--tenue); }
label.casilla { flex-direction: row; align-items: center; gap: 8px; color: var(--texto); }
.ancho { grid-column: 1 / -1; }
.nota { margin: 0; line-height: 1.5; }
.fila { display: flex; gap: 12px; align-items: center; }
input[type=color] { padding: 2px; height: 34px; width: 64px; cursor: pointer; }
label:not(.color) input[type=color] { width: 100%; }
.segmentos { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.segmentos > .tenue { margin-right: 8px; }
.segmento { flex-direction: row; padding: 6px 12px; border: 1px solid var(--borde); border-radius: var(--radio-chico); cursor: pointer; color: var(--texto); }
.segmento.sel { border-color: var(--acento); background: var(--acento-suave); }
.segmento:has(input:focus-visible) { outline: 2px solid var(--acento); outline-offset: 2px; }
details summary { cursor: pointer; color: var(--tenue); width: fit-content; }
.avanzado { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; margin-top: 12px; }
</style>
