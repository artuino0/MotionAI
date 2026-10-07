<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { Referencia, Turno } from '../../compartido/api.js';
import { t, type Clave } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import { markdown } from '../util/markdown.js';
import { nombreEscena, verboHerramienta } from '../util/nombres.js';
import Icono from './Icono.vue';

const e = useEstudio();
const texto = ref('');
const lista = ref<HTMLDivElement>();
const campo = ref<HTMLTextAreaElement>();
const abiertas = ref<Set<string>>(new Set());
const EJEMPLOS: Clave[] = ['chat.ejemplo.1', 'chat.ejemplo.2', 'chat.ejemplo.3', 'chat.ejemplo.4'];

const conectado = computed(() => !!e.claude?.sesionIniciada);
const puedeEnviar = computed(() => !!texto.value.trim() && !e.respondiendo && conectado.value);
const vacio = computed(() => !e.turnos.length);

async function enviar() {
  if (!puedeEnviar.value) return;
  const tx = texto.value.trim();
  texto.value = '';
  pegado = true;
  try { await e.enviar(tx); } catch (err) { e.avisar((err as Error).message, 'error'); }
}
function tecla(ev: KeyboardEvent) {
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); void enviar(); }
}
function usarEjemplo(k: Clave) {
  texto.value = t(k);
  void nextTick(() => campo.value?.focus());
}
const cancelar = () => void window.motionai.cancelar();

// Solo baja sola si el usuario ya estaba abajo: no le quita lo que está releyendo.
let pegado = true;
function alDesplazar() {
  const l = lista.value;
  if (l) pegado = l.scrollHeight - l.scrollTop - l.clientHeight < 60;
}
watch(() => e.turnos.map((x) => x.texto.length + (x.herramientas?.length ?? 0) + (x.enCurso ? 1 : 0)).join(), async () => {
  await nextTick();
  if (pegado) lista.value?.scrollTo({ top: lista.value.scrollHeight });
}, { flush: 'post' });

const chip = (r: Referencia) => r.nombre ?? r.id ?? `${r.t?.toFixed(2)} s`;
const detalle = (r: Referencia) =>
  [r.escena && r.tipo !== 'escena' ? t('chat.refEn', { escena: nombreEscena(e.proyecto, r.escena) }) : '', r.t !== undefined ? t('chat.refA', { t: r.t.toFixed(1) }) : '']
    .filter(Boolean).join(' · ');

function alternar(id: string) {
  const s = new Set(abiertas.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  abiertas.value = s;
}
const pasoActual = (x: Turno) => [...(x.herramientas ?? [])].reverse().find((h) => h.estado === 'curso');
const ajustes = (x: Turno) => x.herramientas?.filter((h) => h.estado === 'error').length ?? 0;
const cambio = (x: Turno) => !x.enCurso && x.versionDespues !== undefined && x.versionAntes !== undefined && x.versionDespues > x.versionAntes;

async function deshacer(x: Turno) {
  if (x.versionAntes === undefined || x.versionDespues === undefined) return;
  const n = x.versionDespues - x.versionAntes;
  const si = await e.confirmar({
    titulo: t('dlg.deshacerTitulo'),
    texto: t('dlg.deshacerTexto', { n, a: x.versionAntes, b: x.versionDespues }),
    aceptar: t('dlg.deshacer'),
    peligro: true,
  });
  if (si) await e.volverA(x.versionAntes, false);
}
</script>

<template>
  <section class="chat">
    <div ref="lista" class="turnos desplazable" aria-live="polite" @scroll="alDesplazar">
      <div v-if="vacio" class="vacio">
        <h2>{{ t('chat.vacio.titulo') }}</h2>
        <p class="tenue">{{ t('chat.vacio.texto') }}</p>
        <h3 class="etiqueta">{{ t('chat.vacio.ejemplos') }}</h3>
        <ul class="ejemplos">
          <li v-for="k in EJEMPLOS" :key="k"><button class="ejemplo" :disabled="!conectado" @click="usarEjemplo(k)">{{ t(k) }}</button></li>
        </ul>
        <p class="tenue senal"><Icono nombre="message-square-plus" :tam="14" /> {{ t('chat.vacio.señalar') }}</p>
      </div>

      <article v-for="x in e.turnos" :key="x.id" class="turno" :class="x.rol">
        <template v-if="x.rol === 'usuario'">
          <div class="burbuja">{{ x.texto }}</div>
          <div v-if="x.referencias?.length" class="refs"><span v-for="(r, i) in x.referencias" :key="i" class="chip">{{ chip(r) }}</span></div>
        </template>
        <template v-else>
          <div v-if="x.enCurso" class="trabajando">
            <span class="punto" aria-hidden="true" />
            <strong>{{ pasoActual(x) ? t('chat.trabajandoPaso', { verbo: verboHerramienta(pasoActual(x)!.nombre) }) : t('chat.pensando') }}</strong>
            <span v-if="x.herramientas?.length" class="tenue">· {{ t('chat.pasos', { n: x.herramientas.length }) }}</span>
          </div>
          <div v-if="x.texto" class="respuesta" v-html="markdown(x.texto)" />
          <div v-if="x.error" class="error" role="alert"><Icono nombre="triangle-alert" :tam="14" /> {{ x.error }}</div>
          <div v-if="!x.enCurso && x.herramientas?.length" class="pasos">
            <button class="fantasma resumen" :aria-expanded="abiertas.has(x.id)" @click="alternar(x.id)">
              <Icono :nombre="abiertas.has(x.id) ? 'chevron-down' : 'chevron-right'" :tam="14" />
              {{ t('chat.hizo', { n: x.herramientas.length }) }}<template v-if="ajustes(x)"> · {{ t('chat.ajustes', { n: ajustes(x) }) }}</template>
            </button>
            <ol v-if="abiertas.has(x.id)">
              <li v-for="h in x.herramientas" :key="h.id" :class="h.estado">
                <Icono :nombre="h.estado === 'error' ? 'undo-2' : 'check'" :tam="13" />
                <span>{{ verboHerramienta(h.nombre) }}</span>
              </li>
            </ol>
          </div>
          <div v-if="cambio(x)" class="pie">
            <span class="chip">{{ t('chat.versiones', { a: x.versionAntes!, b: x.versionDespues! }) }}</span>
            <span class="espacio" />
            <button class="fantasma" @click="e.verDesdeInicio()"><Icono nombre="play" :tam="13" relleno /> {{ t('chat.verResultado') }}</button>
            <button class="fantasma" :title="t('chat.deshacerTitulo')" @click="deshacer(x)"><Icono nombre="undo-2" :tam="14" /> {{ t('chat.deshacer') }}</button>
          </div>
        </template>
      </article>
    </div>

    <div class="redactar" :class="{ grande: vacio }">
      <ul v-if="e.referencias.length" class="refs">
        <li v-for="(r, i) in e.referencias" :key="i" class="chip ref">
          <span class="nom">{{ chip(r) }}</span> <span v-if="detalle(r)" class="tenue">{{ detalle(r) }}</span>
          <button class="quitar" :aria-label="`${t('chat.quitarRef')}: ${chip(r)}`" :title="t('chat.quitarRef')" @click="e.quitarReferencia(i)"><Icono nombre="x" :tam="12" /></button>
        </li>
      </ul>
      <label class="solo-lector" for="campo-chat">{{ t('chat.enviar') }}</label>
      <textarea
        id="campo-chat" ref="campo" v-model="texto" :rows="vacio ? 5 : 3" :disabled="!conectado"
        :placeholder="conectado ? t('chat.placeholder') : t('chat.placeholderSinClaude')" @keydown="tecla"
      />
      <div class="acciones">
        <span class="tenue estado">{{ e.respondiendo ? t('chat.trabajando') : '' }}</span>
        <button v-if="e.respondiendo" class="peligro" @click="cancelar"><Icono nombre="x" :tam="14" /> {{ t('chat.detener') }}</button>
        <button v-else class="primario" :disabled="!puedeEnviar" @click="enviar">{{ t('chat.enviar') }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chat { display: flex; flex-direction: column; }
.turnos { flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.vacio h2 { font-size: 17px; margin: 4px 0 8px; line-height: 1.3; }
.vacio p { margin: 0 0 16px; line-height: 1.55; }
.vacio h3 { margin: 0 0 8px; }
.ejemplos { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ejemplo { width: 100%; text-align: left; justify-content: flex-start; background: var(--panel-2); line-height: 1.45; padding: 9px 12px; white-space: normal; }
.senal { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; }
.turno.usuario { align-self: flex-end; max-width: 88%; display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.burbuja { background: var(--panel-3); border: 1px solid var(--borde-fuerte); border-radius: 12px 12px 4px 12px; padding: 8px 12px; white-space: pre-wrap; user-select: text; line-height: 1.5; }
.turno.claude { display: flex; flex-direction: column; gap: 8px; }
.trabajando { display: flex; align-items: center; gap: 8px; color: #f6cf85; }
.punto { width: 8px; height: 8px; border-radius: 50%; background: var(--claude); display: inline-block; animation: latido 1.1s infinite; flex: none; }
.respuesta { user-select: text; line-height: 1.6; }
.respuesta :deep(p) { margin: 0 0 8px; }
.respuesta :deep(ul), .respuesta :deep(ol) { margin: 0 0 8px; padding-left: 20px; }
.respuesta :deep(li) { margin-bottom: 3px; }
.respuesta :deep(table) { border-collapse: collapse; margin: 0 0 8px; font-size: 12.5px; width: 100%; }
.respuesta :deep(th), .respuesta :deep(td) { border: 1px solid var(--borde); padding: 5px 7px; text-align: left; vertical-align: top; }
.respuesta :deep(code) { background: var(--panel-2); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
.pasos .resumen { padding: 3px 6px; margin-left: -6px; font-size: 12.5px; }
.pasos ol { list-style: none; margin: 4px 0 0; padding: 0 0 0 4px; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--tenue); }
.pasos li { display: flex; gap: 8px; align-items: center; }
.pasos li.ok :first-child { color: var(--verde); }
.pasos li.error :first-child { color: var(--claude); }
.error { color: var(--rojo); white-space: pre-wrap; font-size: 12.5px; display: flex; gap: 6px; align-items: flex-start; }
.pie { display: flex; gap: 6px; align-items: center; padding-top: 2px; border-top: 1px solid var(--borde); padding-top: 8px; }
.pie .fantasma { padding: 4px 8px; font-size: 12.5px; }
.espacio { flex: 1; }
.redactar { border-top: 1px solid var(--borde); padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; background: var(--panel); }
.refs { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.ref { color: var(--texto); border-color: var(--acento); background: var(--acento-suave); padding-right: 4px; max-width: 100%; }
.ref .nom { overflow: hidden; text-overflow: ellipsis; }
.quitar { background: none; border: none; padding: 2px; min-height: 0; color: var(--tenue); border-radius: 50%; }
.quitar:hover:not(:disabled) { background: #ffffff1a; border: none; color: var(--texto); }
textarea { resize: none; width: 100%; line-height: 1.5; }
.grande textarea { font-size: 14px; }
.acciones { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.estado { font-size: 12.5px; }
</style>
