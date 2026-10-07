<script setup lang="ts">
import { computed, ref } from 'vue';
import { FORMATOS, PLATAFORMAS, type Ajustes } from '@motionai/documento';
import { useEstudio } from '../tiendas/estudio.js';

const e = useEstudio();
const original = e.proyecto!.ajustes;
// Copia editable; al guardar solo se mandan los campos que cambiaron.
const a = ref<Ajustes>(JSON.parse(JSON.stringify(original)));
const duracionAuto = ref(original.duracion === undefined);
const errores = ref<string[]>([]);
const guardando = ref(false);
const familias = computed(() => [...new Set(e.proyecto!.fuentes.map((f) => f.familia)), 'Nunito', 'Montserrat', 'Poppins', 'Bebas Neue', 'Playfair Display', 'Caveat', 'Space Grotesk'].filter((f, i, l) => l.indexOf(f) === i));
const nombresPlataforma: Record<string, string> = { tiktok: 'TikTok', reels: 'Instagram Reels', facebook: 'Facebook', shorts: 'YouTube Shorts' };

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

async function guardar() {
  const nuevo = JSON.parse(JSON.stringify(a.value)) as Ajustes;
  if (duracionAuto.value) delete nuevo.duracion;
  if (nuevo.formato !== 'libre') { delete nuevo.ancho; delete nuevo.alto; }
  const cambios = diferencias(original, nuevo) as Record<string, unknown> | undefined;
  if (!cambios) { e.verAjustes = false; return; }
  guardando.value = true;
  const r = await window.motionai.cambiarAjustes(cambios);
  guardando.value = false;
  if (r.ok) {
    e.verAjustes = false;
    e.avisar(`Ajustes guardados (versión ${r.version}).`, 'ok');
  } else errores.value = r.errores ?? [r.mensaje];
}
</script>

<template>
  <div class="fondo" @click.self="e.verAjustes = false">
    <form class="dialogo" @submit.prevent="guardar">
      <header><h2>Ajustes de proyecto</h2><button type="button" class="icono" @click="e.verAjustes = false">✕</button></header>
      <div class="cuerpo desplazable">
        <fieldset>
          <legend>Formato</legend>
          <label class="ancho">Tamaño
            <select v-model="a.formato">
              <option v-for="(f, id) in FORMATOS" :key="id" :value="id">{{ f.nombre }} · {{ f.ancho }}×{{ f.alto }}</option>
              <option value="libre">Tamaño libre</option>
            </select>
          </label>
          <template v-if="a.formato === 'libre'">
            <label>Ancho (px) <input v-model.number="a.ancho" type="number" min="16" max="7680" /></label>
            <label>Alto (px) <input v-model.number="a.alto" type="number" min="16" max="7680" /></label>
          </template>
          <label>Fondo por defecto <input v-model="a.fondo" type="color" /></label>
        </fieldset>

        <fieldset>
          <legend>Tiempo</legend>
          <label>Cuadros por segundo
            <select v-model.number="a.fps"><option :value="24">24</option><option :value="25">25</option><option :value="30">30</option><option :value="60">60</option></select>
          </label>
          <label>Animación del estilo (fps) <input v-model.number="a.fpsEstilo" type="number" min="1" max="60" /></label>
          <label class="casilla"><input v-model="duracionAuto" type="checkbox" /> Duración según las escenas</label>
          <label v-if="!duracionAuto">Duración (s) <input v-model.number="a.duracion" type="number" min="0.5" step="0.1" /></label>
        </fieldset>

        <fieldset>
          <legend>Plataformas</legend>
          <p class="tenue ancho">Se revisa que nada importante quede bajo los botones y la descripción de estas apps.</p>
          <label v-for="p in PLATAFORMAS" :key="p" class="casilla"><input v-model="a.plataformas" type="checkbox" :value="p" /> {{ nombresPlataforma[p] }}</label>
        </fieldset>

        <fieldset>
          <legend>Subtítulos</legend>
          <label class="casilla ancho"><input v-model="a.subtitulos.activados" type="checkbox" /> Mostrar subtítulos de la voz</label>
          <template v-if="a.subtitulos.activados">
            <label>Fuente
              <select v-model="a.subtitulos.fuente"><option :value="undefined">La primera del proyecto</option><option v-for="f in familias" :key="f" :value="f">{{ f }}</option></select>
            </label>
            <label>Peso <select v-model.number="a.subtitulos.peso"><option :value="400">Normal</option><option :value="700">Negrita</option><option :value="800">Extra negrita</option><option :value="900">Black</option></select></label>
            <label>Tamaño (px en 1080) <input v-model.number="a.subtitulos.tamano" type="number" min="20" max="160" /></label>
            <label>Máximo de renglones <input v-model.number="a.subtitulos.maxRenglones" type="number" min="1" max="5" /></label>
            <label class="ancho">Altura: {{ Math.round(a.subtitulos.posicion * 100) }} % <input v-model.number="a.subtitulos.posicion" type="range" min="0.1" max="0.95" step="0.01" /></label>
            <label>Color <input v-model="a.subtitulos.color" type="color" /></label>
            <label>Contorno <input v-model="a.subtitulos.contorno.color" type="color" /></label>
            <label>Grosor del contorno <input v-model.number="a.subtitulos.contorno.ancho" type="number" min="0" max="30" /></label>
          </template>
        </fieldset>

        <fieldset>
          <legend>Audio</legend>
          <p v-if="!a.audio.voz && !a.audio.musica" class="tenue ancho">Sin audio. Pídele a Claude que cargue la voz o la música.</p>
          <label v-if="a.audio.voz">Volumen de la voz <input v-model.number="a.audio.voz.volumen" type="range" min="0" max="2" step="0.05" /></label>
          <label v-if="a.audio.voz">La voz empieza en (s) <input v-model.number="a.audio.voz.inicio" type="number" min="0" step="0.05" /></label>
          <label v-if="a.audio.musica">Volumen de la música <input v-model.number="a.audio.musica.volumen" type="range" min="0" max="2" step="0.05" /></label>
          <label>Fundido al final (s) <input v-model.number="a.audio.fundidoFinal" type="number" min="0" max="10" step="0.1" /></label>
        </fieldset>

        <fieldset>
          <legend>Exportar</legend>
          <label>Códec <select v-model="a.exportar.codec"><option value="h264">H.264 (compatible con todo)</option><option value="h265">H.265 (archivo más chico)</option></select></label>
          <label>Calidad (CRF, menos es mejor) <input v-model.number="a.exportar.calidad" type="number" min="0" max="51" /></label>
          <label>Carpeta <input v-model="a.exportar.carpeta" /></label>
          <label>Nombre del archivo <input v-model="a.exportar.nombreArchivo" placeholder="según el nombre del proyecto" /></label>
        </fieldset>

        <div v-if="errores.length" class="errores"><strong>No se guardaron:</strong><ul><li v-for="x in errores" :key="x">{{ x }}</li></ul></div>
      </div>
      <footer>
        <button type="button" @click="e.verAjustes = false">Cancelar</button>
        <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.fondo { position: fixed; inset: 0; background: #000a; display: grid; place-items: center; z-index: 40; }
.dialogo { width: min(720px, 92vw); max-height: 88vh; background: var(--panel); border: 1px solid var(--borde); border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 20px 60px #000c; }
header, footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; }
header { border-bottom: 1px solid var(--borde); } header h2 { margin: 0; font-size: 17px; }
footer { border-top: 1px solid var(--borde); justify-content: flex-end; gap: 10px; }
.cuerpo { padding: 6px 18px 18px; }
fieldset { border: none; border-bottom: 1px solid var(--borde); padding: 14px 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
legend { font-weight: 700; color: var(--acento); padding: 14px 0 4px; float: left; width: 100%; grid-column: 1 / -1; }
label { display: flex; flex-direction: column; gap: 5px; color: var(--tenue); }
label.casilla { flex-direction: row; align-items: center; gap: 8px; color: var(--texto); }
.ancho { grid-column: 1 / -1; margin: 0; }
input[type=color] { padding: 2px; height: 34px; width: 100%; }
.errores { color: var(--rojo); margin-top: 14px; } .errores ul { margin: 6px 0 0; padding-left: 18px; }
</style>
