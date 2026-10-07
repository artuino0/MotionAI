<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { NuevoProyecto, Reciente } from '../../compartido/api.js';
import { fecha, t } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import Icono from './Icono.vue';
import SelectorIdioma from './SelectorIdioma.vue';

const e = useEstudio();
const recientes = ref<Reciente[]>([]);
const revisando = ref(false);
const nuevo = ref<NuevoProyecto>({ nombre: '', formato: '9:16', duracion: 15, fps: 30, motor: 'motionai' });
const MOTORES = ['motionai', 'hyperframes'] as const;
const brief = ref('');
const creando = ref(false);
const FORMATOS = ['9:16', '4:5', '1:1', '16:9'] as const;
const DURACIONES = [10, 15, 30, 60];

onMounted(async () => (recientes.value = await window.motionai.recientes()));

const listo = computed(() => !!(e.claude?.instalado && e.claude.sesionIniciada));
const motivo = computed(() => (!listo.value ? t('inicio.nuevo.faltaClaude') : !nuevo.value.nombre.trim() ? t('inicio.nuevo.faltaNombre') : ''));

async function elegir() {
  const r = await window.motionai.elegirClaude();
  if (r) e.claude = r;
}
async function revisar() {
  revisando.value = true;
  e.claude = await window.motionai.revisarClaude();
  revisando.value = false;
}

async function crear() {
  if (motivo.value) return;
  creando.value = true;
  try {
    await e.abrir(await window.motionai.nuevoProyecto({ ...nuevo.value, nombre: nuevo.value.nombre.trim() }));
    if (brief.value.trim()) await e.enviar(brief.value.trim());
  } catch (err) {
    e.avisar((err as Error).message, 'error');
  } finally {
    creando.value = false;
  }
}

async function abrir(ruta?: string) {
  try {
    const p = await window.motionai.abrirProyecto(ruta);
    if (p) await e.abrir(p);
  } catch (err) {
    e.avisar((err as Error).message, 'error');
  }
}
</script>

<template>
  <div class="inicio desplazable">
    <header>
      <div>
        <h1>MotionAI</h1>
        <p class="tenue">{{ t('app.lema') }}</p>
      </div>
      <SelectorIdioma />
    </header>

    <section class="claude" :class="{ ok: listo }" aria-live="polite">
      <span class="estado"><Icono :nombre="!e.claude ? 'circle' : listo ? 'check' : 'triangle-alert'" :tam="16" /></span>
      <template v-if="!e.claude"><span>{{ t('inicio.claude.revisando') }}</span></template>
      <div v-else-if="listo" class="texto">
        <strong>{{ t('inicio.claude.listo', { version: e.claude.version ?? '' }) }}</strong>
        <span class="tenue">{{ t('inicio.claude.listoDetalle') }}</span>
      </div>
      <div v-else class="texto">
        <strong>{{ t('inicio.claude.falta') }}</strong>
        <ol><li v-for="p in e.claude.pasos" :key="p">{{ p }}</li></ol>
        <button :disabled="revisando" @click="revisar">{{ revisando ? t('inicio.claude.revisandoBoton') : t('inicio.claude.revisar') }}</button>
        <button v-if="!e.claude.instalado" class="fantasma" @click="elegir">{{ t('inicio.claude.elegir') }}</button>
        <details v-if="e.claude.detalle" class="detalle">
          <summary>{{ t('inicio.claude.detalle') }}</summary>
          <pre>{{ e.claude.detalle }}</pre>
        </details>
      </div>
    </section>

    <div class="columnas">
      <form class="tarjeta nuevo" @submit.prevent="crear">
        <h2>{{ t('inicio.nuevo.titulo') }}</h2>
        <label>{{ t('inicio.nuevo.nombre') }}
          <input v-model="nuevo.nombre" :placeholder="t('inicio.nuevo.nombreEjemplo')" autofocus />
        </label>
        <label>{{ t('inicio.nuevo.brief') }}
          <textarea v-model="brief" rows="3" :placeholder="t('inicio.nuevo.briefEjemplo')" />
          <span class="nota">{{ t('inicio.nuevo.briefNota') }}</span>
        </label>
        <fieldset>
          <legend>{{ t('inicio.nuevo.formato') }}</legend>
          <div class="opciones formatos">
            <label v-for="f in FORMATOS" :key="f" class="opcion" :class="{ sel: nuevo.formato === f }">
              <input v-model="nuevo.formato" type="radio" name="formato" :value="f" class="solo-lector" />
              <span class="forma" :class="'f' + f.replace(':', 'x')" aria-hidden="true" />
              <span>{{ t(`formato.${f}` as const) }}</span>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>{{ t('inicio.nuevo.duracion') }}</legend>
          <div class="opciones">
            <label v-for="d in DURACIONES" :key="d" class="opcion corta" :class="{ sel: nuevo.duracion === d }">
              <input v-model.number="nuevo.duracion" type="radio" name="duracion" :value="d" class="solo-lector" />
              {{ t('inicio.nuevo.segundos', { n: d }) }}
            </label>
          </div>
        </fieldset>
        <details>
          <summary>{{ t('inicio.nuevo.mas') }}</summary>
          <label>{{ t('inicio.nuevo.fps') }}
            <select v-model.number="nuevo.fps"><option :value="24">24</option><option :value="25">25</option><option :value="30">30</option><option :value="60">60</option></select>
            <span class="nota">{{ t('inicio.nuevo.fpsNota') }}</span>
          </label>
          <label>{{ t('inicio.nuevo.motor') }}
            <select v-model="nuevo.motor"><option v-for="m in MOTORES" :key="m" :value="m">{{ t(`motor.${m}` as const) }}</option></select>
            <span class="nota">{{ t(`motor.${nuevo.motor ?? 'motionai'}.nota` as const) }}</span>
          </label>
        </details>
        <div class="enviar">
          <button class="primario grande" type="submit" :disabled="creando || !!motivo" :aria-describedby="motivo ? 'motivo' : undefined">
            <Icono nombre="sparkles" /> {{ creando ? t('inicio.nuevo.creando') : t('inicio.nuevo.crear') }}
          </button>
          <span v-if="motivo" id="motivo" class="tenue">{{ motivo }}</span>
        </div>
      </form>

      <section class="tarjeta">
        <div class="titulo">
          <h2>{{ t('inicio.recientes.titulo') }}</h2>
          <button @click="abrir()"><Icono nombre="folder-open" /> {{ t('inicio.recientes.abrir') }}</button>
        </div>
        <p v-if="!recientes.length" class="tenue">{{ t('inicio.recientes.vacio') }}</p>
        <ul class="recientes">
          <li v-for="r in recientes" :key="r.ruta">
            <button class="reciente" :title="r.ruta" @click="abrir(r.ruta)">
              <Icono nombre="film" :tam="18" />
              <span class="nombre">{{ r.nombre }}</span>
              <span class="tenue">{{ fecha(r.abierto) }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.inicio { height: 100%; padding: 48px max(32px, calc(50% - 500px)) 40px; display: flex; flex-direction: column; gap: 22px; }
header { display: flex; justify-content: space-between; align-items: flex-start; }
h1 { font-size: 32px; margin: 0; letter-spacing: -0.02em; font-weight: 750; }
header p { margin: 4px 0 0; font-size: 15px; }
h2 { font-size: 16px; margin: 0; }
.claude { display: flex; gap: 12px; align-items: flex-start; background: var(--panel); border: 1px solid var(--borde); border-radius: var(--radio); padding: 14px 16px; }
.estado { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #edb43e26; color: var(--amarillo); flex: none; }
.detalle { margin-top: 8px; }
.detalle pre { white-space: pre-wrap; word-break: break-all; font-size: 11.5px; user-select: text; max-height: 180px; overflow: auto; background: var(--panel-2); padding: 8px; border-radius: var(--radio-chico); }
.claude.ok .estado { background: #4fcb8d26; color: var(--verde); }
.texto { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; padding-top: 3px; }
.texto ol { margin: 4px 0 6px; padding-left: 20px; line-height: 1.6; }
.columnas { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 20px; align-items: start; }
.tarjeta { background: var(--panel); border: 1px solid var(--borde); border-radius: var(--radio); padding: 20px; min-width: 0; }
.nuevo { display: flex; flex-direction: column; gap: 16px; }
label { display: flex; flex-direction: column; gap: 6px; color: var(--tenue); }
textarea { resize: vertical; min-height: 64px; }
.nota { font-size: 12px; color: var(--muy-tenue); }
fieldset { border: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
legend { color: var(--tenue); padding: 0; margin-bottom: 6px; }
.opciones { display: flex; flex-wrap: wrap; gap: 8px; }
.formatos { display: grid; grid-template-columns: 1fr 1fr; }
.opcion { flex-direction: row; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--borde); border-radius: var(--radio-chico); cursor: pointer; color: var(--texto); transition: border-color var(--rapido), background var(--rapido); }
.opcion:hover { border-color: var(--borde-fuerte); }
.opcion.sel { border-color: var(--acento); background: var(--acento-suave); }
.opcion:has(input:focus-visible) { outline: 2px solid var(--acento); outline-offset: 2px; }
.opcion.corta { justify-content: center; min-width: 64px; }
.forma { border: 2px solid currentColor; border-radius: 3px; flex: none; opacity: 0.8; }
.f9x16 { width: 12px; height: 20px; } .f4x5 { width: 16px; height: 20px; } .f1x1 { width: 18px; height: 18px; } .f16x9 { width: 24px; height: 14px; }
details summary { cursor: pointer; color: var(--tenue); width: fit-content; }
details[open] summary { margin-bottom: 10px; }
.enviar { display: flex; align-items: center; gap: 12px; }
.grande { padding: 9px 18px; font-size: 14px; }
.titulo { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.recientes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.reciente { width: 100%; justify-content: flex-start; gap: 12px; background: none; border-color: transparent; padding: 10px 10px; text-align: left; }
.reciente:hover:not(:disabled) { background: var(--panel-2); border-color: var(--borde); }
.reciente .nombre { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 980px) { .columnas { grid-template-columns: 1fr; } }
</style>
