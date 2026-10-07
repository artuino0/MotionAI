<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Nodo } from '@motionai/documento';
import { useEstudio } from '../tiendas/estudio.js';
import { miniatura } from '../util/dibujo.js';

const e = useEstudio();
const pestaña = ref<'escenas' | 'piezas' | 'biblioteca' | 'frases'>('escenas');
const minis = ref<Record<string, string>>({});
let pendiente: ReturnType<typeof setTimeout> | undefined;

// Miniaturas de cada escena en reposo (un poco antes del corte), recalculadas tras cada cambio.
watch(() => e.revision, () => {
  clearTimeout(pendiente);
  pendiente = setTimeout(() => {
    const esc = e.escenario;
    if (!esc) return;
    const m: Record<string, string> = {};
    for (const x of esc.escenas) m[x.escena.id] = miniatura(esc, e.entorno, Math.max(x.inicio, Math.min(x.fin - 0.05, x.inicio + (x.fin - x.inicio) * 0.8)), 220);
    minis.value = m;
  }, 250);
}, { immediate: true });

const vertical = computed(() => (e.escenario ? e.escenario.alto > e.escenario.ancho : true));

function irEscena(id: string) {
  const x = e.proyecto?.escenas.find((s) => s.id === id);
  if (!x) return;
  e.pausar();
  e.irA(x.inicio);
  e.referir({ tipo: 'escena', id: x.id, nombre: x.nombre, t: x.inicio });
}

function aplanar(n: Nodo, nivel: number, out: { n: Nodo; nivel: number }[]) {
  out.push({ n, nivel });
  if (n.tipo === 'grupo') n.hijos.forEach((h) => aplanar(h, nivel + 1, out));
  return out;
}

function elegirPieza(id: string, escena: string, inicio: number) {
  e.seleccionar(id);
  if (e.tiempo < inicio) e.irA(inicio);
  e.referir({ tipo: 'pieza', id, escena, t: e.tiempo });
}

const icono = (t: Nodo['tipo']) => ({ rect: '▭', elipse: '◯', trazo: '✎', texto: 'T', imagen: '▣', grupo: '▤', instancia: '◇' })[t];
const describir = (n: Nodo) => (n.tipo === 'texto' ? n.texto.replace(/\n/g, ' ') : n.tipo === 'instancia' ? `de ${n.componente}` : '');
</script>

<template>
  <aside class="medios">
    <nav class="tabs">
      <button :class="{ activo: pestaña === 'escenas' }" @click="pestaña = 'escenas'">Escenas</button>
      <button :class="{ activo: pestaña === 'piezas' }" @click="pestaña = 'piezas'">Piezas</button>
      <button :class="{ activo: pestaña === 'biblioteca' }" @click="pestaña = 'biblioteca'">Biblioteca</button>
      <button :class="{ activo: pestaña === 'frases' }" @click="pestaña = 'frases'">Frases</button>
    </nav>
    <div class="contenido desplazable">
      <div v-if="pestaña === 'escenas'" class="escenas" :class="{ vertical }">
        <div v-for="x in e.proyecto?.escenas" :key="x.id" class="escena" :class="{ actual: e.escenaActual?.escena.id === x.id }" @click="irEscena(x.id)">
          <div class="mini">
            <img v-if="minis[x.id]" :src="minis[x.id]" />
            <span class="dur mono">{{ (x.fin - x.inicio).toFixed(1) }} s</span>
          </div>
          <span class="nombre">{{ x.nombre ?? x.id }}</span>
        </div>
      </div>

      <div v-else-if="pestaña === 'piezas'">
        <div v-for="x in e.proyecto?.escenas" :key="x.id" class="grupo-piezas">
          <div class="etiqueta">{{ x.nombre ?? x.id }}</div>
          <p v-if="!x.hijos.length" class="tenue vacio">Sin piezas</p>
          <template v-for="h in x.hijos" :key="h.id">
            <div v-for="{ n, nivel } in aplanar(h, 0, [])" :key="n.id" class="pieza" :class="{ sel: e.seleccion === n.id }" :style="{ paddingLeft: 10 + nivel * 14 + 'px' }" @click="elegirPieza(n.id, x.id, x.inicio)">
              <span class="ico">{{ icono(n.tipo) }}</span>
              <span class="id">{{ n.id }}</span>
              <span class="tenue desc">{{ describir(n) }}</span>
            </div>
          </template>
        </div>
      </div>

      <div v-else-if="pestaña === 'biblioteca'">
        <p class="tenue vacio">Componentes que Claude creó para reusar en el video.</p>
        <p v-if="!e.proyecto?.biblioteca.length" class="tenue vacio">Todavía no hay componentes.</p>
        <div v-for="c in e.proyecto?.biblioteca" :key="c.id" class="componente">
          <strong>{{ c.nombre }}</strong> <span class="chip">{{ c.tipo ?? c.raiz.tipo }}</span>
          <div class="tenue mono">{{ c.id }}</div>
          <div v-if="c.nota" class="tenue">{{ c.nota }}</div>
        </div>
      </div>

      <div v-else>
        <p v-if="!e.proyecto?.frases.length" class="tenue vacio">Sin voz. Pídele a Claude que cargue un audio de voz para tener frases y subtítulos.</p>
        <div v-for="(f, i) in e.proyecto?.frases" :key="i" class="frase" @click="e.irA(f.inicio); e.referir({ tipo: 'frase', id: `f${i + 1}`, nombre: f.texto, t: f.inicio })">
          <span class="mono tenue">f{{ i + 1 }} · {{ f.inicio.toFixed(2) }}–{{ f.fin.toFixed(2) }}</span>
          <span>{{ f.texto }}</span>
          <span v-if="f.subtitulo === false" class="chip">sin subtítulo</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.medios { display: flex; flex-direction: column; background: var(--panel); min-height: 0; }
.contenido { flex: 1; padding: 12px; }
.escenas { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.escenas:not(.vertical) { grid-template-columns: 1fr; }
.escena { cursor: pointer; display: flex; flex-direction: column; gap: 6px; }
.mini { position: relative; border-radius: 6px; overflow: hidden; border: 2px solid var(--borde); background: #000; aspect-ratio: 9 / 16; }
.escenas:not(.vertical) .mini { aspect-ratio: 16 / 9; }
.escena.actual .mini { border-color: var(--acento); }
.mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dur { position: absolute; right: 6px; bottom: 6px; background: #000b; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
.nombre { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grupo-piezas { margin-bottom: 14px; }
.grupo-piezas .etiqueta { margin: 4px 0 6px; }
.pieza { display: flex; gap: 8px; align-items: baseline; padding: 4px 10px; border-radius: 5px; cursor: pointer; white-space: nowrap; }
.pieza:hover { background: var(--panel-2); }
.pieza.sel { background: #2ec4d622; outline: 1px solid var(--acento); }
.ico { width: 14px; color: var(--acento); text-align: center; }
.desc { overflow: hidden; text-overflow: ellipsis; }
.vacio { margin: 4px 0 10px; }
.componente { padding: 10px; border: 1px solid var(--borde); border-radius: 6px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 3px; }
.frase { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: 6px; cursor: pointer; border: 1px solid transparent; }
.frase:hover { background: var(--panel-2); border-color: var(--borde); }
</style>
