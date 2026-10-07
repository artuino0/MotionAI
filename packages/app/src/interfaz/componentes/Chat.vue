<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { Referencia, Turno } from '../../compartido/api.js';
import { useEstudio } from '../tiendas/estudio.js';
import { markdown } from '../util/markdown.js';

const e = useEstudio();
const texto = ref('');
const lista = ref<HTMLDivElement>();
const abiertas = ref<Set<string>>(new Set());

const puedeEnviar = computed(() => !!texto.value.trim() && !e.respondiendo && !!e.claude?.sesionIniciada);

async function enviar() {
  if (!puedeEnviar.value) return;
  const t = texto.value.trim();
  texto.value = '';
  try { await e.enviar(t); } catch (err) { e.avisar((err as Error).message, 'error'); }
}

function tecla(ev: KeyboardEvent) {
  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); void enviar(); }
}

watch(() => e.turnos.map((t) => t.texto.length + (t.herramientas?.length ?? 0)).join(), async () => {
  await nextTick();
  lista.value?.scrollTo({ top: lista.value.scrollHeight, behavior: 'smooth' });
}, { flush: 'post' });

const chip = (r: Referencia) =>
  r.tipo === 'pieza' ? `◆ ${r.id}` : r.tipo === 'escena' ? `▤ ${r.nombre ?? r.id}` : r.tipo === 'frase' ? `“${r.id}”` : `${r.t?.toFixed(2)} s`;
const detalle = (r: Referencia) => [r.escena, r.t !== undefined ? `${r.t.toFixed(2)} s` : ''].filter(Boolean).join(' · ');

function alternar(id: string) {
  const s = new Set(abiertas.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  abiertas.value = s;
}
const enCurso = (t: Turno) => t.herramientas?.find((h) => h.estado === 'curso');
const errores = (t: Turno) => t.herramientas?.filter((h) => h.estado === 'error').length ?? 0;

const cancelar = () => void window.motionai.cancelar();

async function deshacer(t: Turno) {
  if (t.versionAntes === undefined) return;
  if (!confirm(`¿Volver el proyecto a como estaba antes de esta respuesta (versión ${t.versionAntes})?`)) return;
  const r = await window.motionai.volverA(t.versionAntes);
  e.avisar(r.ok ? `Volví a la versión ${t.versionAntes}.` : (r.errores ?? []).join('\n'), r.ok ? 'ok' : 'error');
}
</script>

<template>
  <section class="chat">
    <div ref="lista" class="turnos desplazable">
      <div v-if="!e.turnos.length" class="vacio">
        <p><strong>Pídele a Claude el video que quieres.</strong></p>
        <p class="tenue">Por ejemplo: «Haz un video de 15 segundos para TikTok de mi cafetería, que anuncie el pan de muerto. Tono cálido.»</p>
        <p class="tenue">Haz clic en una pieza del monitor o de la línea de tiempo para señalarla en tu mensaje.</p>
      </div>
      <div v-for="t in e.turnos" :key="t.id" class="turno" :class="t.rol">
        <template v-if="t.rol === 'usuario'">
          <div class="burbuja">{{ t.texto }}</div>
          <div v-if="t.referencias?.length" class="refs"><span v-for="(r, i) in t.referencias" :key="i" class="chip">{{ chip(r) }}</span></div>
        </template>
        <template v-else>
          <div v-if="t.herramientas?.length" class="herramientas">
            <button class="resumen" @click="alternar(t.id)">
              <span v-if="t.enCurso" class="punto" />
              {{ t.enCurso && enCurso(t) ? `Usando ${enCurso(t)!.nombre}…` : `Usó ${t.herramientas.length} herramientas` }}
              <span v-if="errores(t)" class="rechazos">· {{ errores(t) }} rechazos corregidos</span>
              <span class="flecha">{{ abiertas.has(t.id) ? '▾' : '▸' }}</span>
            </button>
            <ul v-if="abiertas.has(t.id)">
              <li v-for="h in t.herramientas" :key="h.id" :class="h.estado">
                <span class="mono">{{ h.estado === 'ok' ? '✓' : h.estado === 'error' ? '✗' : '…' }} {{ h.nombre }}</span>
                <span v-if="h.resumen" class="tenue">{{ h.resumen }}</span>
              </li>
            </ul>
          </div>
          <div v-if="t.texto" class="respuesta" v-html="markdown(t.texto)" />
          <div v-else-if="t.enCurso && !t.herramientas?.length" class="tenue pensando"><span class="punto" /> Claude está pensando…</div>
          <div v-if="t.error" class="error">{{ t.error }}</div>
          <div v-if="!t.enCurso && t.versionDespues !== undefined && t.versionAntes !== undefined && t.versionDespues > t.versionAntes" class="pie">
            <span class="chip">versión {{ t.versionAntes }} → {{ t.versionDespues }}</span>
            <button class="icono" title="Volver a como estaba antes de esta respuesta" @click="deshacer(t)">Deshacer</button>
          </div>
        </template>
      </div>
    </div>

    <div class="redactar">
      <div v-if="e.referencias.length" class="refs">
        <span v-for="(r, i) in e.referencias" :key="i" class="chip ref" :title="detalle(r)">
          {{ chip(r) }} <span class="tenue">{{ detalle(r) }}</span>
          <button class="quitar" title="Quitar" @click="e.quitarReferencia(i)">×</button>
        </span>
      </div>
      <textarea v-model="texto" rows="3" :placeholder="e.claude?.sesionIniciada ? 'Escribe qué quieres… (Enter envía, Shift+Enter cambia de renglón)' : 'Conecta Claude Code para usar el chat'" @keydown="tecla" />
      <div class="acciones">
        <span class="tenue">{{ e.respondiendo ? 'Claude está trabajando en el proyecto…' : '' }}</span>
        <button v-if="e.respondiendo" class="peligro" @click="cancelar">Detener</button>
        <button v-else class="primario" :disabled="!puedeEnviar" @click="enviar">Enviar</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chat { display: flex; flex-direction: column; }
.turnos { flex: 1; padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.vacio { padding: 8px; } .vacio p { margin: 0 0 10px; }
.turno.usuario { align-self: flex-end; max-width: 88%; display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.burbuja { background: #2ec4d622; border: 1px solid #2ec4d655; border-radius: 12px 12px 3px 12px; padding: 8px 12px; white-space: pre-wrap; user-select: text; }
.turno.claude { display: flex; flex-direction: column; gap: 8px; }
.respuesta { user-select: text; line-height: 1.55; }
.respuesta :deep(p) { margin: 0 0 8px; }
.respuesta :deep(ul), .respuesta :deep(ol) { margin: 0 0 8px; padding-left: 20px; }
.respuesta :deep(table) { border-collapse: collapse; margin: 0 0 8px; font-size: 12px; width: 100%; }
.respuesta :deep(th), .respuesta :deep(td) { border: 1px solid var(--borde); padding: 4px 6px; text-align: left; vertical-align: top; }
.respuesta :deep(code) { background: var(--panel-2); padding: 1px 4px; border-radius: 4px; font-size: 12px; }
.herramientas .resumen { background: none; border: 1px dashed var(--borde); color: var(--tenue); width: 100%; text-align: left; display: flex; align-items: center; gap: 6px; }
.flecha { margin-left: auto; }
.rechazos { color: var(--amarillo); }
.herramientas ul { list-style: none; margin: 6px 0 0; padding: 0 0 0 6px; display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
.herramientas li { display: flex; flex-direction: column; }
.herramientas li.error .mono { color: var(--amarillo); }
.herramientas li span.tenue { padding-left: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.punto { width: 8px; height: 8px; border-radius: 50%; background: var(--acento); display: inline-block; animation: latido 1s infinite; }
@keyframes latido { 50% { opacity: 0.3; } }
.pensando { display: flex; align-items: center; gap: 8px; }
.error { color: var(--rojo); white-space: pre-wrap; font-size: 12px; }
.pie { display: flex; gap: 8px; align-items: center; }
.redactar { border-top: 1px solid var(--borde); padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.refs { display: flex; flex-wrap: wrap; gap: 6px; }
.ref { color: var(--texto); border-color: var(--acento); }
.quitar { background: none; border: none; padding: 0 0 0 2px; color: var(--tenue); font-size: 14px; line-height: 1; }
textarea { resize: none; width: 100%; }
.acciones { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
</style>
