import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { recursosDe, validarProyecto, type Nodo, type Proyecto, type ProyectoEntrada } from '@motionai/documento';
import { escenaEn, preparar, type Entorno, type Escenario, type EscenaPreparada } from '@motionai/motor';
import { cargarRecursosNavegador } from '@motionai/visor';
import type { EstadoClaude, ProyectoAbierto, Referencia, Turno } from '../../compartido/api.js';
import { t } from '../i18n.js';
import { indicePiezas, nombreEscena, nombreRuta } from '../util/nombres.js';

export type Vista = 'limpia' | 'tiktok' | 'reels' | 'facebook';
export type Lateral = 'chat' | 'inspector' | 'historial';

interface Aviso {
  id: number;
  texto: string;
  tipo: 'info' | 'error' | 'ok';
  detalle?: string;
  acciones?: { texto: string; hacer: () => void }[];
}

export interface Dialogo {
  titulo: string;
  texto: string;
  aceptar: string;
  cancelar?: string;
  peligro?: boolean;
  responder: (si: boolean) => void;
}

const api = () => window.motionai;
let reloj = 0;
let audios: { el: HTMLAudioElement; inicio: number }[] = [];
let siguienteAviso = 1;
let temporizadorResaltado: ReturnType<typeof setTimeout> | undefined;

/** Segundo en que una escena ya se ve completa: después de la última entrada, antes del corte. */
function cuadroEnReposo(e: EscenaPreparada, id?: string): number {
  const np = id ? e.hijos.find((h) => h.nodo.id === id) : undefined;
  const entradas = (np ? [np] : e.hijos).map((h) => (h.entra ? h.entra.en + h.entra.dur : e.inicio));
  const listo = Math.max(e.inicio, ...entradas) + 0.35;
  return Math.max(e.inicio, Math.min(e.fin - 0.05, Math.max(listo, e.inicio + (e.fin - e.inicio) * 0.5)));
}

/** Ids de piezas que cambiaron entre dos versiones del documento. */
function piezasCambiadas(antes: ProyectoEntrada | undefined, ahora: ProyectoEntrada): string[] {
  const huella = (d?: ProyectoEntrada) => {
    const m = new Map<string, string>();
    for (const e of d?.escenas ?? []) for (const h of e.hijos) m.set(h.id, JSON.stringify(h));
    return m;
  };
  const a = huella(antes), b = huella(ahora);
  return [...b].filter(([id, j]) => a.get(id) !== j).map(([id]) => id);
}

export const useEstudio = defineStore('estudio', {
  state: () => ({
    claude: null as EstadoClaude | null,
    abierto: null as ProyectoAbierto | null,
    proyecto: null as Proyecto | null,
    escenario: null as Escenario | null,
    indice: markRaw(new Map()) as Map<string, Nodo>,
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
    verAtajos: false,
    lineaAbierta: true,
    exportando: null as { hechos: number; total: number } | null,
    turnos: [] as Turno[],
    avisos: [] as Aviso[],
    dialogo: null as Dialogo | null,
    /** Pieza que Claude acaba de cambiar, para marcarla un momento en el monitor. */
    resaltado: null as string | null,
    /** Escena donde Claude está trabajando ahora. */
    trabajandoEn: null as string | null,
    /** El monitor sigue a Claude hasta que el usuario mueve el cabezal. */
    seguirAClaude: true,
    /** Versiones a las que se puede regresar con Ctrl+Shift+Z. */
    rehacer: [] as number[],
    cargandoAudio: null as 'voz' | 'musica' | null,
  }),

  getters: {
    duracion: (s) => s.escenario?.duracion ?? 0,
    escenaActual: (s) => (s.escenario ? escenaEn(s.escenario, s.tiempo) : undefined),
    respondiendo: (s) => s.turnos.some((x) => x.enCurso),
    /** Hay algo que exportar: al menos una pieza en alguna escena. */
    tieneContenido: (s) => !!s.proyecto?.escenas.some((e) => e.hijos.length),
  },

  actions: {
    nombre(ruta: string): string {
      return nombreRuta(ruta, this.proyecto, this.indice);
    },

    avisar(texto: string, tipo: Aviso['tipo'] = 'info', extra: Pick<Aviso, 'detalle' | 'acciones'> = {}) {
      const id = siguienteAviso++;
      this.avisos.push({ id, texto, tipo, ...extra });
      // Los errores y los avisos con acciones se quedan hasta que el usuario los cierra.
      if (tipo !== 'error' && !extra.acciones) setTimeout(() => this.cerrarAviso(id), 4500);
    },

    cerrarAviso(id: number) {
      this.avisos = this.avisos.filter((a) => a.id !== id);
    },

    confirmar(d: Omit<Dialogo, 'responder'>): Promise<boolean> {
      this.dialogo?.responder(false);
      return new Promise((ok) => {
        this.dialogo = { ...d, responder: (si) => { this.dialogo = null; ok(si); } };
      });
    },

    async iniciar() {
      api().alCambiar((c) => {
        void this.aplicarDocumento(c.documento, c.version);
      });
      api().alTurno((turno) => this.recibirTurno(turno));
      api().alExportar((p) => (this.exportando = p));
      try { this.lineaAbierta = localStorage.getItem('motionai.linea') !== 'cerrada'; } catch { /* sin almacenamiento */ }
      this.claude = await api().revisarClaude();
      const actual = await api().proyectoActual();
      if (actual) await this.abrir(actual);
    },

    recibirTurno(turno: Turno) {
      const i = this.turnos.findIndex((x) => x.id === turno.id);
      const antes = i >= 0 ? this.turnos[i] : undefined;
      if (i >= 0) this.turnos[i] = turno;
      else this.turnos.push(turno);
      if (turno.rol !== 'claude') return;
      if (turno.enCurso && !antes) {
        // Empieza una respuesta: el monitor sigue a Claude hasta que el usuario lo mueva.
        this.seguirAClaude = true;
        this.rehacer = [];
      }
      if (antes?.enCurso && !turno.enCurso) {
        this.trabajandoEn = null;
        const cambio = (turno.versionDespues ?? 0) > (turno.versionAntes ?? 0);
        // El primer video se muestra completo al terminar: es el momento que el usuario esperaba.
        if (cambio && (turno.versionAntes ?? 0) <= 1 && !this.reproduciendo) {
          this.irA(0, false);
          this.reproducir();
        }
      }
    },

    async abrir(p: ProyectoAbierto) {
      this.pausar();
      this.abierto = p;
      this.tiempo = 0;
      this.seleccion = null;
      this.referencias = [];
      this.clavesRecursos = '';
      this.rehacer = [];
      this.turnos = await api().chat();
      await this.aplicarDocumento(p.documento, p.version);
      // Abrir en un cuadro con contenido, no en el primer cuadro vacío.
      const e = this.escenario?.escenas.find((x) => x.hijos.length);
      if (e) this.tiempo = cuadroEnReposo(e);
    },

    async cerrar() {
      if (this.respondiendo) {
        const si = await this.confirmar({ titulo: t('dlg.salirTitulo'), texto: t('dlg.salirTexto'), aceptar: t('dlg.salir'), peligro: true });
        if (!si) return;
        await api().cancelar();
      }
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
      const anterior = this.abierto.documento;
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
        if (faltantes.length) this.avisar(t('aviso.faltan', { lista: faltantes.join(', ') }), 'error');
        this.entorno = markRaw(entorno);
        this.clavesRecursos = claves;
        this.prepararAudio(r.proyecto);
      }
      this.proyecto = markRaw(r.proyecto);
      this.indice = markRaw(indicePiezas(r.proyecto));
      try {
        this.escenario = markRaw(preparar(r.proyecto));
        if (this.tiempo > this.escenario.duracion) this.tiempo = this.escenario.duracion;
      } catch (e) {
        this.errorDocumento = (e as Error).message;
      }
      this.revision++;
      if (this.respondiendo) this.seguirCambio(anterior, doc);
    },

    /** Mientras Claude trabaja, lleva el monitor a la pieza que cambió y la marca un momento. */
    seguirCambio(antes: ProyectoEntrada, ahora: ProyectoEntrada) {
      const esc = this.escenario;
      if (!esc) return;
      const [id] = piezasCambiadas(antes, ahora);
      const escena = id ? esc.escenas.find((e) => e.hijos.some((h) => h.nodo.id === id)) : undefined;
      if (!escena) return;
      this.trabajandoEn = nombreEscena(this.proyecto, escena.escena.id);
      if (this.seguirAClaude && !this.reproduciendo) this.tiempo = cuadroEnReposo(escena, id);
      this.resaltado = id!;
      clearTimeout(temporizadorResaltado);
      temporizadorResaltado = setTimeout(() => (this.resaltado = null), 1800);
      this.informar();
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

    /** Mueve el cabezal. Si lo mueve el usuario mientras Claude trabaja, el monitor deja de seguir a Claude. */
    irA(segundo: number, porUsuario = true) {
      if (porUsuario && this.respondiendo) this.seguirAClaude = false;
      this.tiempo = Math.max(0, Math.min(this.duracion, segundo));
      if (this.reproduciendo) for (const a of audios) a.el.currentTime = Math.max(0, this.tiempo - a.inicio);
      this.informar();
    },

    saltarEscena(dir: 1 | -1) {
      const esc = this.escenario;
      if (!esc) return;
      const inicios = esc.escenas.map((x) => x.inicio);
      const destino = dir > 0
        ? inicios.find((i) => i > this.tiempo + 1e-3) ?? esc.duracion
        : [...inicios].reverse().find((i) => i < this.tiempo - 0.05) ?? 0;
      this.pausar();
      this.irA(destino);
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
      else {
        if (this.respondiendo) this.seguirAClaude = false;
        this.reproducir();
      }
    },

    verDesdeInicio() {
      this.pausar();
      this.irA(0);
      this.reproducir();
    },

    seleccionar(ruta: string | null) {
      this.seleccion = ruta;
      this.informar();
    },

    /** Agrega algo que el usuario señaló al próximo mensaje (sin repetir). */
    referir(r: Referencia) {
      const clave = (x: Referencia) => `${x.tipo}:${x.id ?? ''}`;
      const i = this.referencias.findIndex((x) => clave(x) === clave(r));
      if (i >= 0) this.referencias[i] = r;
      else this.referencias.push(r);
      this.lateral = 'chat';
      this.informar();
    },

    /** Señala una pieza: la selecciona y la agrega al mensaje con su nombre y su escena. */
    senalarPieza(ruta: string, punto?: [number, number]) {
      this.seleccionar(ruta);
      const escena = this.escenaActual?.escena.id;
      this.referir({ tipo: 'pieza', id: ruta, nombre: this.nombre(ruta), escena, t: Math.round(this.tiempo * 100) / 100, ...(punto ? { punto } : {}) });
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

    async volverA(version: number, preguntar = true): Promise<boolean> {
      if (this.respondiendo) { this.avisar(t('aviso.esperaClaude')); return false; }
      if (preguntar) {
        const si = await this.confirmar({ titulo: t('dlg.volverTitulo', { n: version }), texto: t('dlg.volverTexto'), aceptar: t('dlg.volver') });
        if (!si) return false;
      }
      const r = await api().volverA(version);
      if (r.ok) this.avisar(t('aviso.volvi', { n: version }), 'ok');
      else this.avisar((r.errores ?? [r.mensaje]).join('\n'), 'error');
      return r.ok;
    },

    /** Ctrl+Z: regresa a la versión anterior (y deja la actual para Ctrl+Shift+Z). */
    async deshacer() {
      if (this.respondiendo) { this.avisar(t('aviso.esperaClaude')); return; }
      const versiones = await api().versiones();
      const actual = versiones[0];
      const previa = versiones[1];
      if (!actual || !previa) { this.avisar(t('aviso.nadaQueDeshacer')); return; }
      const actualNum = this.version;
      if (await this.volverA(previa.numero, false)) {
        this.rehacer.push(actualNum);
        this.avisar(t('aviso.deshice', { texto: actual.resumen.replace(/\s*\(.*?\)\s*/g, ' ').slice(0, 80) }));
      }
    },

    async rehacerCambio() {
      const v = this.rehacer.pop();
      if (v === undefined) return;
      if (await this.volverA(v, false)) this.avisar(t('aviso.rehice'));
    },

    async exportar() {
      if (this.exportando) return;
      if (this.respondiendo) { this.avisar(t('barra.exportarEspera')); return; }
      this.exportando = { hechos: 0, total: 1 };
      try {
        const r = await api().exportar();
        const archivo = r.salida.split(/[\\/]/).pop()!;
        this.avisar(t('aviso.listo'), 'ok', {
          detalle: t('aviso.listoDetalle', { archivo, segundos: r.segundosRender.toFixed(1) }),
          acciones: [
            { texto: t('aviso.reproducir'), hacer: () => void api().abrirArchivo(r.salida) },
            { texto: t('aviso.mostrar'), hacer: () => void api().mostrarArchivo(r.salida) },
          ],
        });
      } catch (e) {
        this.avisar(t('aviso.exportFallo', { error: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }), 'error');
      } finally {
        this.exportando = null;
      }
    },

    /** Elige un audio y lo carga; la voz se transcribe en la computadora (puede tardar unos segundos). */
    async cargarAudio(tipo: 'voz' | 'musica') {
      if (this.respondiendo) { this.avisar(t('aviso.esperaClaude')); return; }
      this.cargandoAudio = tipo;
      try {
        const r = await api().cargarAudio(tipo);
        if (!r) return;
        if (!r.ok) this.avisar((r.errores ?? [r.mensaje]).join('\n'), 'error');
        else if (tipo === 'musica') this.avisar(t('aviso.musicaLista'), 'ok');
        else if (r.transcripcion === 'whisper') this.avisar(t('aviso.vozLista', { n: r.frases ?? 0 }), 'ok', { detalle: t('aviso.vozListaDetalle') });
        else this.avisar(t('aviso.vozSinTranscribir'), 'info');
        const fin = Math.max(0, ...(this.proyecto?.frases.map((f) => f.fin) ?? []));
        if (tipo === 'voz' && fin > this.duracion + 0.05) {
          this.avisar(t('aviso.vozLarga', { voz: fin.toFixed(1), video: this.duracion.toFixed(1) }), 'info', { acciones: [{ texto: t('barra.ajustes'), hacer: () => (this.verAjustes = true) }] });
        }
      } catch (e) {
        this.avisar((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'error');
      } finally {
        this.cargandoAudio = null;
      }
    },

    alternarLinea() {
      this.lineaAbierta = !this.lineaAbierta;
      try { localStorage.setItem('motionai.linea', this.lineaAbierta ? 'abierta' : 'cerrada'); } catch { /* sin almacenamiento */ }
    },
  },
});

