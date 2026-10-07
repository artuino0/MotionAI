import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { recursosDe, validarProyecto, type Proyecto, type ProyectoEntrada } from '@motionai/documento';
import { escenaEn, preparar, type Entorno, type Escenario } from '@motionai/motor';
import { cargarRecursosNavegador } from '@motionai/visor';
import type { EstadoClaude, ProyectoAbierto, Referencia, Turno } from '../../compartido/api.js';

export type Vista = 'limpia' | 'tiktok' | 'reels' | 'facebook';
export type Lateral = 'chat' | 'inspector' | 'historial';

interface Aviso {
  id: number;
  texto: string;
  tipo: 'info' | 'error' | 'ok';
  accion?: { texto: string; hacer: () => void };
}

const api = () => window.motionai;
let reloj = 0;
let audios: { el: HTMLAudioElement; inicio: number }[] = [];
let siguienteAviso = 1;

export const useEstudio = defineStore('estudio', {
  state: () => ({
    claude: null as EstadoClaude | null,
    abierto: null as ProyectoAbierto | null,
    proyecto: null as Proyecto | null,
    escenario: null as Escenario | null,
    entorno: markRaw({ imagen: () => undefined }) as Entorno,
    clavesRecursos: '',
    errorDocumento: null as string | null,
    version: 0,
    /** Cambia cada vez que hay que redibujar miniaturas. */
    revision: 0,
    tiempo: 0,
    reproduciendo: false,
    seleccion: null as string | null,
    vista: 'limpia' as Vista,
    referencias: [] as Referencia[],
    lateral: 'chat' as Lateral,
    verAjustes: false,
    exportando: null as { hechos: number; total: number } | null,
    turnos: [] as Turno[],
    avisos: [] as Aviso[],
  }),

  getters: {
    duracion: (s) => s.escenario?.duracion ?? 0,
    escenaActual: (s) => (s.escenario ? escenaEn(s.escenario, s.tiempo) : undefined),
    respondiendo: (s) => s.turnos.some((t) => t.enCurso),
  },

  actions: {
    avisar(texto: string, tipo: Aviso['tipo'] = 'info', accion?: Aviso['accion']) {
      const id = siguienteAviso++;
      this.avisos.push({ id, texto, tipo, accion });
      setTimeout(() => (this.avisos = this.avisos.filter((a) => a.id !== id)), accion ? 9000 : 4500);
    },

    async iniciar() {
      api().alCambiar((c) => {
        void this.aplicarDocumento(c.documento, c.version);
      });
      api().alTurno((t) => {
        const i = this.turnos.findIndex((x) => x.id === t.id);
        if (i >= 0) this.turnos[i] = t;
        else this.turnos.push(t);
      });
      api().alExportar((p) => (this.exportando = p));
      this.claude = await api().revisarClaude();
      const actual = await api().proyectoActual();
      if (actual) await this.abrir(actual);
    },

    async abrir(p: ProyectoAbierto) {
      this.pausar();
      this.abierto = p;
      this.tiempo = 0;
      this.seleccion = null;
      this.referencias = [];
      this.clavesRecursos = '';
      await this.aplicarDocumento(p.documento, p.version);
      this.turnos = await api().chat();
    },

    async cerrar() {
      this.pausar();
      await api().cerrarProyecto();
      this.abierto = null;
      this.proyecto = null;
      this.escenario = null;
      this.turnos = [];
    },

    /** Valida el documento, carga fuentes e imágenes nuevas y lo prepara para el motor. */
    async aplicarDocumento(doc: ProyectoEntrada, version: number) {
      if (!this.abierto) return;
      this.abierto = { ...this.abierto, documento: doc, version };
      this.version = version;
      const r = validarProyecto(doc);
      if (!r.ok) {
        this.errorDocumento = r.errores.join('\n');
        return;
      }
      this.errorDocumento = null;
      const rec = recursosDe(r.proyecto);
      const claves = JSON.stringify([rec.fuentes, rec.imagenes, rec.audio]);
      if (claves !== this.clavesRecursos) {
        // Las fuentes se cargan antes de preparar: el motor mide los textos al dibujar y guarda esas medidas.
        const { entorno, faltantes } = await cargarRecursosNavegador(r.proyecto, 'proyecto://local/');
        if (faltantes.length) this.avisar(`Faltan archivos: ${faltantes.join(', ')}`, 'error');
        this.entorno = markRaw(entorno);
        this.clavesRecursos = claves;
        this.prepararAudio(r.proyecto);
      }
      this.proyecto = markRaw(r.proyecto);
      try {
        this.escenario = markRaw(preparar(r.proyecto));
        if (this.tiempo > this.escenario.duracion) this.tiempo = this.escenario.duracion;
      } catch (e) {
        this.errorDocumento = (e as Error).message;
      }
      this.revision++;
    },

    prepararAudio(p: Proyecto) {
      for (const a of audios) a.el.pause();
      audios = [p.ajustes.audio.voz, p.ajustes.audio.musica]
        .filter((x): x is NonNullable<typeof x> => !!x)
        .map((x) => {
          const el = new Audio(`proyecto://local/${x.archivo}`);
          el.volume = Math.min(1, x.volumen);
          return { el, inicio: x.inicio };
        });
    },

    irA(t: number) {
      this.tiempo = Math.max(0, Math.min(this.duracion, t));
      if (this.reproduciendo) for (const a of audios) a.el.currentTime = Math.max(0, this.tiempo - a.inicio);
      this.informar();
    },

    reproducir() {
      if (!this.escenario) return;
      if (this.tiempo >= this.duracion - 1e-3) this.tiempo = 0;
      this.reproduciendo = true;
      reloj = performance.now();
      for (const a of audios) {
        const pos = this.tiempo - a.inicio;
        if (pos >= 0) { a.el.currentTime = pos; void a.el.play().catch(() => undefined); }
      }
      const paso = (ahora: number) => {
        if (!this.reproduciendo) return;
        this.tiempo = Math.min(this.duracion, this.tiempo + (ahora - reloj) / 1000);
        reloj = ahora;
        for (const a of audios) {
          if (a.el.paused && this.tiempo >= a.inicio && this.tiempo - a.inicio < (a.el.duration || Infinity)) {
            a.el.currentTime = this.tiempo - a.inicio;
            void a.el.play().catch(() => undefined);
          }
        }
        if (this.tiempo >= this.duracion) { this.pausar(); return; }
        requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    },

    pausar() {
      this.reproduciendo = false;
      for (const a of audios) a.el.pause();
      this.informar();
    },

    alternar() {
      if (this.reproduciendo) this.pausar();
      else this.reproducir();
    },

    seleccionar(ruta: string | null) {
      this.seleccion = ruta;
      this.informar();
    },

    /** Agrega algo que el usuario tocó al próximo mensaje (sin repetir). */
    referir(r: Referencia) {
      const clave = (x: Referencia) => `${x.tipo}:${x.id ?? ''}`;
      const i = this.referencias.findIndex((x) => clave(x) === clave(r));
      if (i >= 0) this.referencias[i] = r;
      else this.referencias.push(r);
      this.lateral = 'chat';
      this.informar();
    },

    quitarReferencia(i: number) {
      this.referencias.splice(i, 1);
      this.informar();
    },

    /** Le dice al proceso principal qué ve el usuario (para leer_estado). */
    informar() {
      api().estadoApp({
        tiempo: Math.round(this.tiempo * 100) / 100,
        seleccion: this.seleccion ? [this.seleccion] : [],
        referencias: JSON.parse(JSON.stringify(this.referencias)),
      });
    },

    async enviar(texto: string) {
      const refs = JSON.parse(JSON.stringify(this.referencias)) as Referencia[];
      this.referencias = [];
      await api().enviar(texto, refs);
    },

    async exportar() {
      if (this.exportando) return;
      this.exportando = { hechos: 0, total: 1 };
      try {
        const r = await api().exportar();
        this.avisar(`Video listo en ${r.segundosRender.toFixed(1)} s`, 'ok', { texto: 'Mostrar en carpeta', hacer: () => void api().mostrarArchivo(r.salida) });
      } catch (e) {
        this.avisar(`No se pudo exportar: ${(e as Error).message}`, 'error');
      } finally {
        this.exportando = null;
      }
    },
  },
});
