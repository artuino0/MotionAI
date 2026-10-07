<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { NuevoProyecto, Reciente } from '../../compartido/api.js';
import { useEstudio } from '../tiendas/estudio.js';

const e = useEstudio();
const recientes = ref<Reciente[]>([]);
const revisando = ref(false);
const nuevo = ref<NuevoProyecto>({ nombre: '', formato: '9:16', duracion: 15, fps: 30 });
const creando = ref(false);

onMounted(async () => (recientes.value = await window.motionai.recientes()));

async function revisar() {
  revisando.value = true;
  e.claude = await window.motionai.revisarClaude();
  revisando.value = false;
}

async function crear() {
  if (!nuevo.value.nombre.trim()) return;
  creando.value = true;
  try {
    await e.abrir(await window.motionai.nuevoProyecto({ ...nuevo.value, nombre: nuevo.value.nombre.trim() }));
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

const listo = () => e.claude?.instalado && e.claude.sesionIniciada;
const fecha = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<template>
  <div class="inicio">
    <header>
      <h1><span class="marca">Motion</span>AI</h1>
      <p class="tenue">Motion graphics pidiéndoselos a Claude.</p>
    </header>

    <section class="claude" :class="{ ok: listo() }">
      <template v-if="!e.claude">Revisando Claude Code…</template>
      <template v-else-if="listo()">
        <strong>✓ Claude Code {{ e.claude.version }}</strong>
        <span class="tenue">listo, con tu sesión iniciada.</span>
      </template>
      <template v-else>
        <strong>Falta conectar Claude Code</strong>
        <ol><li v-for="p in e.claude.pasos" :key="p">{{ p }}</li></ol>
        <button :disabled="revisando" @click="revisar">{{ revisando ? 'Revisando…' : 'Revisar de nuevo' }}</button>
      </template>
    </section>

    <div class="columnas">
      <section class="tarjeta">
        <h2>Nuevo proyecto</h2>
        <form @submit.prevent="crear">
          <label>Nombre <input v-model="nuevo.nombre" placeholder="Promo de temporada" autofocus /></label>
          <label>Formato
            <select v-model="nuevo.formato">
              <option value="9:16">Vertical 9:16 · TikTok, Reels, Shorts</option>
              <option value="4:5">Feed 4:5</option>
              <option value="1:1">Cuadrado 1:1</option>
              <option value="16:9">Horizontal 16:9 · YouTube</option>
            </select>
          </label>
          <div class="fila">
            <label>Duración (s) <input v-model.number="nuevo.duracion" type="number" min="1" max="180" /></label>
            <label>Cuadros por segundo
              <select v-model.number="nuevo.fps"><option :value="24">24</option><option :value="25">25</option><option :value="30">30</option><option :value="60">60</option></select>
            </label>
          </div>
          <button class="primario" type="submit" :disabled="creando || !nuevo.nombre.trim() || !listo()">
            {{ creando ? 'Creando…' : 'Crear proyecto' }}
          </button>
        </form>
      </section>

      <section class="tarjeta">
        <div class="titulo"><h2>Recientes</h2><button @click="abrir()">Abrir proyecto…</button></div>
        <p v-if="!recientes.length" class="tenue">Todavía no hay proyectos.</p>
        <ul class="recientes">
          <li v-for="r in recientes" :key="r.ruta" @click="abrir(r.ruta)">
            <strong>{{ r.nombre }}</strong>
            <span class="tenue">{{ fecha(r.abierto) }}</span>
            <span class="ruta mono">{{ r.ruta }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.inicio { height: 100%; overflow: auto; padding: 56px max(32px, calc(50% - 480px)); display: flex; flex-direction: column; gap: 24px; }
h1 { font-size: 34px; margin: 0; letter-spacing: -0.02em; }
.marca { color: var(--acento); }
header p { margin: 4px 0 0; font-size: 15px; }
h2 { font-size: 16px; margin: 0 0 14px; }
.claude { background: var(--panel); border: 1px solid var(--borde); border-left: 3px solid var(--amarillo); border-radius: var(--radio); padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.claude.ok { border-left-color: var(--verde); flex-direction: row; align-items: center; }
.claude ol { margin: 0; padding-left: 20px; }
.columnas { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.tarjeta { background: var(--panel); border: 1px solid var(--borde); border-radius: var(--radio); padding: 20px; min-width: 0; }
form { display: flex; flex-direction: column; gap: 12px; }
label { display: flex; flex-direction: column; gap: 5px; color: var(--tenue); }
.fila { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.titulo { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.titulo h2 { margin: 0; }
.recientes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.recientes li { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 10px 12px; border-radius: 6px; cursor: pointer; border: 1px solid transparent; }
.recientes li:hover { background: var(--panel-2); border-color: var(--borde); }
.ruta { grid-column: 1 / -1; font-size: 11px; color: var(--muy-tenue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
