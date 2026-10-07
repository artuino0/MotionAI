<script setup lang="ts">
import { computed } from 'vue';
import { dimensiones, type Nodo } from '@motionai/documento';
import type { NodoPreparado } from '@motionai/motor';
import { t } from '../i18n.js';
import { useEstudio } from '../tiendas/estudio.js';
import { nombreMovimiento, nombreNodo } from '../util/nombres.js';
import Icono from './Icono.vue';

const e = useEstudio();
const pieza = computed<Nodo | undefined>(() => {
  const id = e.seleccion?.split('/').pop();
  return id ? e.indice.get(id) : undefined;
});

/** La pieza ya preparada por el motor: tiene los tiempos resueltos en segundos. */
const preparada = computed<NodoPreparado | undefined>(() => {
  const id = pieza.value?.id;
  const buscar = (l: NodoPreparado[]): NodoPreparado | undefined => {
    for (const np of l) {
      if (np.nodo.id === id) return np;
      const h = buscar(np.hijos);
      if (h) return h;
    }
    return undefined;
  };
  return id ? buscar(e.escenario?.escenas.flatMap((x) => x.hijos) ?? []) : undefined;
});

const medida = (v: unknown) => (v === undefined ? '0' : typeof v === 'number' ? `${Math.round(v)}` : String(v));
const color = (v: unknown) => (typeof v === 'string' ? v.toUpperCase() : v ? '↗' : '');

/** Lo que una persona quiere saber de una pieza, en sus palabras. */
const filas = computed(() => {
  const n = pieza.value;
  if (!n) return [] as { k: string; v: string; muestra?: string }[];
  const out: { k: string; v: string; muestra?: string }[] = [{ k: t('insp.tipo'), v: t(`tipo.${n.tipo}` as const) }];
  if (n.tipo === 'texto') {
    out.push({ k: t('insp.texto'), v: n.texto });
    out.push({ k: t('insp.fuente'), v: `${n.fuente} · ${n.tamano} px` });
  }
  if (n.tipo === 'instancia') {
    const c = e.proyecto?.biblioteca.find((x) => x.id === n.componente);
    out.push({ k: t('insp.componente'), v: c?.nombre ?? n.componente });
  }
  if (n.tipo === 'grupo') out.push({ k: t('insp.contiene'), v: t('insp.piezas', { n: n.hijos.length }) });
  out.push({ k: t('insp.posicion'), v: `${medida(n.x)}, ${medida(n.y)}` });
  if ('ancho' in n && n.ancho !== undefined) out.push({ k: t('insp.tamano'), v: `${medida(n.ancho)} × ${medida(n.alto)}` });
  if (n.escala !== undefined && n.escala !== 1) out.push({ k: t('insp.escala'), v: `${Math.round(n.escala * 100)} %` });
  if (n.rotacion) out.push({ k: t('insp.rotacion'), v: `${n.rotacion}°` });
  if (n.opacidad !== undefined && n.opacidad !== 1) out.push({ k: t('insp.opacidad'), v: `${Math.round(n.opacidad * 100)} %` });
  if ('relleno' in n && n.relleno) out.push({ k: t('insp.color'), v: color(n.relleno), muestra: typeof n.relleno === 'string' ? n.relleno : undefined });
  if ('contorno' in n && n.contorno) out.push({ k: t('insp.contorno'), v: `${color(n.contorno.color)} · ${n.contorno.ancho} px`, muestra: n.contorno.color });
  const a = n.animacion;
  const np = preparada.value;
  const seg = (resuelto: number | undefined, crudo: unknown) => (resuelto ?? (typeof crudo === 'number' ? crudo : 0)).toFixed(2);
  if (a?.entra) out.push({ k: t('insp.entra'), v: t('insp.enSeg', { mov: nombreMovimiento(a.entra.tipo), t: seg(np?.entra?.en, a.entra.en) }) });
  if (a?.sale) out.push({ k: t('insp.sale'), v: t('insp.enSeg', { mov: nombreMovimiento(a.sale.tipo), t: seg(np?.sale?.en, a.sale.en) }) });
  if (a?.ciclos?.length) out.push({ k: t('insp.movimiento'), v: a.ciclos.map((c) => nombreMovimiento(c.tipo)).join(', ') });
  if (a?.pistas && Object.keys(a.pistas).length) out.push({ k: t('insp.animado'), v: Object.keys(a.pistas).join(', ') });
  return out;
});

const proyecto = computed(() => {
  const p = e.proyecto;
  if (!p) return [];
  const { ancho, alto } = dimensiones(p.ajustes);
  const nada = t('insp.ninguna');
  return [
    [t('insp.formato'), `${t(`formato.corto.${p.ajustes.formato}` as const)} · ${ancho}×${alto}`],
    [t('insp.fps'), `${p.ajustes.fps}`],
    [t('insp.duracion'), `${e.duracion.toFixed(1)} s`],
    [t('insp.escenas'), `${p.escenas.length}`],
    [t('insp.piezasTotal'), `${p.escenas.reduce((n, x) => n + x.hijos.length, 0)}`],
    [t('insp.componentes'), `${p.biblioteca.length}`],
    [t('insp.frases'), `${p.frases.length}`],
    [t('insp.voz'), p.ajustes.audio.voz?.archivo.split('/').pop() ?? nada],
    [t('insp.musica'), p.ajustes.audio.musica?.archivo.split('/').pop() ?? nada],
    [t('insp.plataformas'), p.ajustes.plataformas.map((x) => t(`plat.${x}` as const)).join(', ') || nada],
    [t('insp.fuentes'), [...new Set(p.fuentes.map((f) => f.familia))].join(', ') || nada],
    [t('insp.version'), `${e.version}`],
  ];
});

function mencionar() {
  if (e.seleccion) e.senalarPieza(e.seleccion);
}
</script>

<template>
  <section class="inspector desplazable">
    <template v-if="pieza">
      <span class="etiqueta">{{ t('insp.pieza') }}</span>
      <h2>{{ e.nombre(e.seleccion!) || nombreNodo(pieza) }}</h2>
      <dl>
        <template v-for="f in filas" :key="f.k">
          <dt>{{ f.k }}</dt>
          <dd><i v-if="f.muestra" class="muestra" :style="{ background: f.muestra }" aria-hidden="true" />{{ f.v }}</dd>
        </template>
      </dl>
      <div class="botones">
        <button class="primario" @click="mencionar"><Icono nombre="message-square-plus" :tam="14" /> {{ t('insp.mencionar') }}</button>
        <button @click="e.seleccionar(null)">{{ t('insp.quitarSel') }}</button>
      </div>
      <p class="tenue nota">{{ t('insp.nota') }}</p>
      <details class="tecnico">
        <summary>{{ t('insp.tecnico') }}</summary>
        <pre>{{ JSON.stringify(pieza, null, 2) }}</pre>
      </details>
    </template>
    <template v-else>
      <span class="etiqueta">{{ t('insp.proyecto') }}</span>
      <h2>{{ e.abierto?.documento.nombre }}</h2>
      <dl>
        <template v-for="[k, v] in proyecto" :key="k"><dt>{{ k }}</dt><dd>{{ v }}</dd></template>
      </dl>
      <p class="tenue nota">{{ t('insp.notaProyecto') }}</p>
      <details class="tecnico">
        <summary>{{ t('insp.tecnico') }}</summary>
        <p class="ruta">{{ t('insp.carpeta') }}: {{ e.abierto?.base }}</p>
      </details>
    </template>
  </section>
</template>

<style scoped>
.inspector { padding: 16px; }
h2 { margin: 4px 0 16px; font-size: 16px; line-height: 1.35; word-break: break-word; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin: 0; }
dt { color: var(--tenue); }
dd { margin: 0; word-break: break-word; user-select: text; display: flex; gap: 6px; align-items: center; }
.muestra { width: 14px; height: 14px; border-radius: 4px; border: 1px solid #ffffff33; flex: none; }
.botones { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
.nota { margin: 14px 0; line-height: 1.5; }
.tecnico summary { cursor: pointer; color: var(--tenue); width: fit-content; }
.tecnico pre { font-size: 12px; background: var(--fondo); border: 1px solid var(--borde); border-radius: var(--radio-chico); padding: 10px; overflow: auto; user-select: text; max-height: 320px; }
.ruta { word-break: break-all; user-select: text; font-size: 12px; color: var(--tenue); }
</style>
