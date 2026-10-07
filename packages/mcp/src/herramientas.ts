import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  CICLOS, CURVAS, ENTRADAS, FORMATO_IDS, NodoEsquema, PLATAFORMAS, SALIDAS,
  type Componente, type Formato, type Frase, type Nodo,
} from '@motionai/documento';
import { Estudio, catalogoFuentes, type Resultado } from '@motionai/estudio';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(AQUI, '../skill');
const DOCS = path.resolve(AQUI, '../../../docs');

export const INSTRUCCIONES =
  'Herramientas de MotionAI para hacer motion graphics. Antes de empezar llama leer_skill con tema "inicio": ' +
  'explica cómo trabajar, el formato del documento y cómo revisar tu trabajo.';

/** Estado del servidor: el proyecto abierto y dónde se crean los nuevos. */
export interface Sesion {
  estudio?: Estudio;
  /** Carpeta donde `nuevo_proyecto` crea proyectos. */
  carpetaProyectos: string;
}

const texto = (t: string, error = false): CallToolResult => ({ content: [{ type: 'text', text: t }], ...(error ? { isError: true } : {}) });

function respuesta(r: Resultado): CallToolResult {
  const partes = [r.ok ? `✓ Versión ${r.version}. ${r.mensaje}` : `✗ ${r.mensaje} El documento sigue en la versión ${r.version}.`];
  if (r.errores?.length) partes.push(`Motivos:\n- ${r.errores.join('\n- ')}`);
  if (r.avisos?.length) partes.push(`Avisos:\n- ${r.avisos.join('\n- ')}`);
  return texto(partes.join('\n'), !r.ok);
}

function abierto(s: Sesion): Estudio {
  if (!s.estudio) throw new Error('No hay un proyecto abierto. Usa nuevo_proyecto o abrir_proyecto.');
  return s.estudio;
}

/** Valida una pieza antes de mandarla al documento, para dar errores con la ruta dentro de la pieza. */
function validarPieza(p: unknown, donde = 'pieza'): Nodo {
  const r = NodoEsquema.safeParse(p);
  if (r.success) return r.data;
  const errores = r.error.issues.map((i) => `${[donde, ...i.path].join('.')}: ${i.message}`);
  throw new Error(`La pieza no es válida:\n- ${errores.slice(0, 12).join('\n- ')}`);
}

/** Envuelve un manejador para que los errores lleguen a Claude como texto y no como fallas del protocolo. */
function seguro<A>(f: (args: A) => Promise<CallToolResult> | CallToolResult) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await f(args);
    } catch (e) {
      return texto(`✗ ${(e as Error).message}`, true);
    }
  };
}

const PIEZA = z
  .looseObject({ id: z.string(), tipo: z.enum(['rect', 'elipse', 'trazo', 'texto', 'imagen', 'grupo', 'instancia']) })
  .describe(
    'Pieza del documento (ver leer_skill "documento"). Ejemplo: {"id":"titulo","tipo":"texto","texto":"Hola","fuente":"Nunito",' +
    '"peso":900,"tamano":110,"relleno":"#1E1E1E","x":"50%","y":"40%","ancla":"centro","animacion":{"entra":{"tipo":"sube","en":"escena+0.2"}}}',
  );

export function registrarHerramientas(server: McpServer, s: Sesion): void {
  server.registerTool(
    'leer_skill',
    {
      title: 'Leer guía',
      description:
        'Guías para trabajar en la app. Temas: "inicio" (cómo trabajar; léelo primero), "diseno" (principios de motion y recetas), ' +
        '"documento" (formato exacto de piezas, animación y tiempos), "fuentes" (fuentes disponibles).',
      inputSchema: { tema: z.enum(['inicio', 'diseno', 'documento', 'fuentes']).default('inicio') },
      annotations: { readOnlyHint: true },
    },
    seguro(({ tema }) => {
      if (tema === 'documento') return texto(readFileSync(path.join(DOCS, 'documento.md'), 'utf8'));
      if (tema === 'fuentes') {
        const filas = catalogoFuentes().map((f) => `- **${f.familia}** (pesos ${Object.keys(f.pesos).join(', ')}): ${f.estilo}`);
        return texto(
          `# Fuentes disponibles\n\nEscribe el nombre en \`fuente\` de un texto; la app la agrega al proyecto sola.\n\n${filas.join('\n')}\n\n` +
          'Si pides un peso que no está, se usa el más cercano. Combina como mucho dos familias por video.',
        );
      }
      return texto(readFileSync(path.join(SKILL, `${tema}.md`), 'utf8'));
    }),
  );

  server.registerTool(
    'leer_estado',
    {
      title: 'Leer estado',
      description: 'Proyecto abierto, versión, formato, escenas, y (cuando la app está abierta) tiempo actual, selección y referencias del mensaje.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    seguro(() => {
      if (!s.estudio) return texto(JSON.stringify({ proyecto: null, nota: 'No hay proyecto abierto. Usa nuevo_proyecto o abrir_proyecto.', carpetaProyectos: s.carpetaProyectos }, null, 2));
      return texto(JSON.stringify(s.estudio.estado(), null, 2));
    }),
  );

  server.registerTool(
    'leer_proyecto',
    {
      title: 'Leer proyecto',
      description:
        'El proyecto completo. detalle "resumen" (por defecto): escenas y piezas con tipo, posición y animación, en texto corto. ' +
        '"json": el documento tal cual. Con `id` devuelve solo esa pieza, escena o componente en JSON.',
      inputSchema: { detalle: z.enum(['resumen', 'json']).default('resumen'), id: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    seguro(({ detalle, id }) => {
      const e = abierto(s);
      const doc = e.documento;
      if (id) {
        const buscar = (n: Nodo): Nodo | undefined => n.id === id ? n : n.tipo === 'grupo' ? n.hijos.map(buscar).find(Boolean) : undefined;
        const encontrado =
          doc.escenas.find((x) => x.id === id) ??
          doc.biblioteca?.find((c) => c.id === id) ??
          [...doc.escenas.flatMap((x) => x.hijos), ...(doc.biblioteca ?? []).map((c) => c.raiz)].map(buscar).find(Boolean);
        if (!encontrado) throw new Error(`No hay nada con id "${id}".`);
        return texto(JSON.stringify(encontrado, null, 2));
      }
      return texto(detalle === 'json' ? JSON.stringify(doc, null, 2) : e.resumen());
    }),
  );

  server.registerTool(
    'nuevo_proyecto',
    {
      title: 'Nuevo proyecto',
      description: 'Crea un proyecto vacío con una sola escena que dura todo el video, y lo deja abierto.',
      inputSchema: {
        nombre: z.string().min(1),
        formato: z.enum(FORMATO_IDS).default('9:16').describe('9:16 TikTok/Reels/Shorts, 4:5 feed, 1:1, 16:9 YouTube, o libre con ancho y alto'),
        duracion: z.number().positive().max(180).default(15).describe('Segundos'),
        fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]).default(30),
        ancho: z.number().int().optional(),
        alto: z.number().int().optional(),
        fondo: z.string().optional().describe('Color de fondo por defecto, #RRGGBB'),
        carpeta: z.string().optional().describe('Carpeta del proyecto; por defecto una nueva dentro de la carpeta de proyectos'),
      },
    },
    seguro(async (a) => {
      const slug = a.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto';
      const carpeta = a.carpeta ? path.resolve(s.carpetaProyectos, a.carpeta) : path.join(s.carpetaProyectos, slug);
      s.estudio?.cerrar();
      s.estudio = await Estudio.crear({ ...a, carpeta, formato: a.formato as Formato });
      return texto(`✓ Proyecto "${a.nombre}" creado en ${s.estudio.ruta}.\n${s.estudio.resumen()}`);
    }),
  );

  server.registerTool(
    'abrir_proyecto',
    {
      title: 'Abrir proyecto',
      description: 'Abre un proyecto existente (ruta al proyecto.json o a su carpeta).',
      inputSchema: { ruta: z.string() },
    },
    seguro(async ({ ruta }) => {
      let r = path.resolve(s.carpetaProyectos, ruta);
      if (!r.endsWith('.json')) r = path.join(r, 'proyecto.json');
      s.estudio?.cerrar();
      s.estudio = await Estudio.abrir(r);
      return texto(`✓ Abrí ${s.estudio.ruta}.\n${s.estudio.resumen()}`);
    }),
  );

  server.registerTool(
    'ajustes_proyecto',
    {
      title: 'Ajustes de proyecto',
      description:
        'Cambia ajustes del proyecto; solo manda lo que cambia (se mezcla con lo que hay, null borra). Claves: formato, ancho, alto, fps, ' +
        'duracion, plataformas, fondo, subtitulos {activados, maxRenglones, posicion, tamano, fuente, peso, color, contorno}, ' +
        'audio {voz, musica, fundidoFinal}, exportar {codec, calidad, carpeta, nombreArchivo}.',
      inputSchema: {
        cambios: z.looseObject({
          formato: z.enum(FORMATO_IDS).optional(),
          plataformas: z.array(z.enum(PLATAFORMAS)).optional(),
        }),
      },
    },
    seguro(async ({ cambios }) => respuesta(await abierto(s).ajustes(cambios))),
  );

  server.registerTool(
    'crear_pieza',
    {
      title: 'Crear pieza',
      description:
        'Diseña una pieza reusable con primitivas (rect, elipse, trazo, texto, imagen, grupo) y la guarda en la biblioteca del proyecto. ' +
        'Para ponerla en una escena usa agregar_pieza con {"tipo":"instancia","componente":"<id>","cambios":{"<id interno>":{"texto":"…","relleno":"#…"}}}. ' +
        'Los tiempos dentro del componente cuentan desde que aparece la instancia.',
      inputSchema: {
        id: z.string().describe('Id del componente'),
        nombre: z.string(),
        tipo: z.string().optional().describe('Para buscarla: tarjeta, icono, etiqueta, personaje, fondo…'),
        nota: z.string().optional().describe('Cómo se mueve o para qué sirve'),
        raiz: PIEZA,
        reemplazar: z.boolean().default(false),
      },
    },
    seguro(async ({ id, nombre, tipo, nota, raiz, reemplazar }) => {
      const comp: Componente = { id, nombre, ...(tipo ? { tipo } : {}), ...(nota ? { nota } : {}), raiz: validarPieza(raiz, 'raiz') };
      return respuesta(await abierto(s).crearPieza(comp, reemplazar));
    }),
  );

  server.registerTool(
    'agregar_pieza',
    {
      title: 'Agregar pieza',
      description:
        'Pone una pieza en una escena (o dentro de un grupo): una primitiva, un grupo con hijos, o una instancia de un componente. ' +
        'Incluye su animación. Se dibuja encima de las demás salvo que digas posicion.',
      inputSchema: {
        escena: z.string().optional().describe('Id de la escena; opcional si solo hay una'),
        dentro_de: z.string().optional().describe('Id de un grupo existente donde meterla'),
        pieza: PIEZA,
        posicion: z.union([z.number().int(), z.enum(['frente', 'fondo'])]).optional(),
      },
    },
    seguro(async ({ escena, dentro_de, pieza, posicion }) =>
      respuesta(await abierto(s).agregarPieza({ pieza: validarPieza(pieza), escena, dentro_de, posicion })),
    ),
  );

  server.registerTool(
    'cambiar',
    {
      title: 'Cambiar',
      description:
        'Lote de cambios por id a piezas, escenas o componentes. Cada cambio es {"id": "...", <propiedades>}: las propiedades se reemplazan ' +
        '(null borra). animacion se mezcla por partes: {"animacion":{"entra":{…}}} solo cambia la entrada; ' +
        '{"animacion":{"pistas":{"x":[…]}}} solo esa pista. "capa": frente | fondo | adelante | atras cambia el orden de dibujo. ' +
        `Entradas: ${ENTRADAS.join(', ')}. Salidas: ${SALIDAS.join(', ')}. Ciclos: ${CICLOS.join(', ')}. Curvas: ${CURVAS.join(', ')}.`,
      inputSchema: { cambios: z.array(z.looseObject({ id: z.string() })).min(1) },
    },
    seguro(async ({ cambios }) => respuesta(await abierto(s).cambiar(cambios))),
  );

  server.registerTool(
    'quitar_pieza',
    {
      title: 'Quitar pieza',
      description: 'Saca piezas de su escena o grupo, o componentes que nadie usa, por id.',
      inputSchema: { ids: z.array(z.string()).min(1) },
    },
    seguro(async ({ ids }) => respuesta(await abierto(s).quitarPieza(ids))),
  );

  server.registerTool(
    'buscar_biblioteca',
    {
      title: 'Buscar en la biblioteca',
      description: 'Componentes del proyecto por texto (id, nombre, tipo, nota) o tipo. Sin filtros lista todos.',
      inputSchema: { texto: z.string().optional(), tipo: z.string().optional(), con_piezas: z.boolean().default(false).describe('Incluir el árbol de piezas de cada componente') },
      annotations: { readOnlyHint: true },
    },
    seguro(({ texto: q, tipo, con_piezas }) => {
      const r = abierto(s).buscarBiblioteca(q, tipo);
      if (!r.length) return texto('No hay componentes que coincidan. Crea uno con crear_pieza.');
      return texto(JSON.stringify(con_piezas ? r : r.map(({ raiz, ...c }) => ({ ...c, raiz: { id: raiz.id, tipo: raiz.tipo } })), null, 2));
    }),
  );

  server.registerTool(
    'escenas',
    {
      title: 'Escenas',
      description:
        'Operaciones de escena. crear {id, nombre, inicio, fin, fondo}; quitar {id}; partir {id, en, nuevo_id, nombre} (la parte nueva queda vacía); ' +
        'mover_corte {id, fin} (mueve el fin de la escena y el inicio de la siguiente). Para cambiar nombre o fondo usa cambiar con el id de la escena.',
      inputSchema: {
        operacion: z.enum(['crear', 'quitar', 'partir', 'mover_corte']),
        id: z.string(),
        nombre: z.string().optional(),
        inicio: z.number().nonnegative().optional(),
        fin: z.number().positive().optional(),
        en: z.number().positive().optional(),
        nuevo_id: z.string().optional(),
        fondo: z.unknown().optional().describe('Color "#RRGGBB" o degradado {tipo, de, a, paradas}'),
      },
    },
    seguro(async (a) => {
      const e = abierto(s);
      const falta = (k: string) => { throw new Error(`Para ${a.operacion} falta ${k}.`); };
      switch (a.operacion) {
        case 'crear':
          return respuesta(await e.escenas({ operacion: 'crear', id: a.id, nombre: a.nombre, inicio: a.inicio ?? falta('inicio'), fin: a.fin ?? falta('fin'), fondo: a.fondo as never }));
        case 'quitar':
          return respuesta(await e.escenas({ operacion: 'quitar', id: a.id }));
        case 'partir':
          return respuesta(await e.escenas({ operacion: 'partir', id: a.id, en: a.en ?? falta('en'), nuevo_id: a.nuevo_id ?? falta('nuevo_id'), nombre: a.nombre }));
        case 'mover_corte':
          return respuesta(await e.escenas({ operacion: 'mover_corte', id: a.id, fin: a.fin ?? falta('fin') }));
      }
    }),
  );

  server.registerTool(
    'voz',
    {
      title: 'Voz y música',
      description:
        'Carga un audio (lo copia a recursos/). Con tipo "voz" devuelve los tramos con habla separados por pausas; luego vuelve a llamar ' +
        'con `frases` [{inicio, fin, texto, subtitulo?}] para poner el texto de cada tramo (subtitulo: false si la frase ya va en un letrero). ' +
        'Con tipo "musica" solo la carga.',
      inputSchema: {
        archivo: z.string().describe('Ruta al audio (relativa al proyecto o absoluta)'),
        tipo: z.enum(['voz', 'musica']).default('voz'),
        inicio: z.number().nonnegative().default(0).describe('Segundo del proyecto en que empieza a sonar'),
        volumen: z.number().min(0).max(2).default(1),
        frases: z.array(z.object({ inicio: z.number(), fin: z.number(), texto: z.string(), subtitulo: z.boolean().optional() })).optional(),
      },
    },
    seguro(async (a) => {
      const r = await abierto(s).audio({ ...a, frases: a.frases as Frase[] | undefined });
      const base = respuesta(r);
      if (r.ok && r.tramos) {
        const lista = r.tramos.map((t, i) => `  ${i + 1}. ${t.inicio}–${t.fin} s`).join('\n');
        (base.content[0] as { text: string }).text += `\nDuración ${r.duracion?.toFixed(2)} s. Tramos con voz (del audio; suma "inicio" para tiempos del proyecto):\n${lista}`;
      }
      return base;
    }),
  );

  server.registerTool(
    'ver_cuadro',
    {
      title: 'Ver cuadro',
      description:
        'Imagen de uno a seis cuadros del video, reducidos, para revisar tu trabajo. Pide los segundos donde algo debe verse ' +
        '(en reposo, justo antes de un corte, a media entrada). zonas: dibuja lo que tapan las plataformas. resaltar: ids a marcar con un recuadro.',
      inputSchema: {
        tiempos: z.array(z.number().nonnegative()).min(1).max(6),
        zonas: z.boolean().default(false),
        resaltar: z.array(z.string()).optional(),
        formato: z.enum(FORMATO_IDS).optional().describe('Ver en otro formato sin cambiar el proyecto'),
      },
      annotations: { readOnlyHint: true },
    },
    seguro(async ({ tiempos, zonas, resaltar, formato }) => {
      const png = await abierto(s).verCuadro(tiempos, { zonas, resaltar, formato: formato as Formato | undefined });
      return {
        content: [
          { type: 'image', data: png.toString('base64'), mimeType: 'image/png' },
          { type: 'text', text: `Cuadros en ${tiempos.map((t) => `${t} s`).join(', ')}.` },
        ],
      };
    }),
  );

  server.registerTool(
    'exportar',
    {
      title: 'Exportar MP4',
      description: 'Renderiza el video a MP4 con el mismo motor del previo y avisa cuando termina. Por defecto todo el video en el formato del proyecto.',
      inputSchema: {
        salida: z.string().optional().describe('Ruta del MP4; por defecto la carpeta de exportación del proyecto'),
        formato: z.enum(FORMATO_IDS).optional(),
        desde: z.number().nonnegative().optional(),
        hasta: z.number().positive().optional(),
      },
    },
    seguro(async (a) => {
      const r = await abierto(s).exportar({ ...a, formato: a.formato as Formato | undefined });
      return texto(`✓ Exporté ${r.salida} · ${r.cuadros} cuadros · ${r.segundos.toFixed(2)} s de video · ${r.segundosRender.toFixed(1)} s de render.`);
    }),
  );

  server.registerTool(
    'versiones',
    {
      title: 'Versiones',
      description: 'Historial del documento. operacion "listar" muestra las últimas versiones; "volver" regresa a una (queda como versión nueva).',
      inputSchema: { operacion: z.enum(['listar', 'volver']).default('listar'), version: z.number().int().positive().optional(), limite: z.number().int().positive().max(100).default(20) },
    },
    seguro(async ({ operacion, version, limite }) => {
      const e = abierto(s);
      if (operacion === 'volver') {
        if (!version) throw new Error('Di a qué versión volver.');
        return respuesta(await e.volverA(version));
      }
      return texto(e.versiones(limite).map((v) => `${v.numero} · ${v.fecha.slice(0, 19).replace('T', ' ')} · ${v.herramienta}: ${v.resumen}`).join('\n'));
    }),
  );
}
