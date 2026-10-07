/**
 * Prueba de cierre de la fase 4: Claude hace el comercial de Flow Sites solo con lo que daría un usuario
 * (guion, voz, colores e isotipo en SVG), sin el .pen ni el motor de Python, con las herramientas MCP de la
 * app. La voz se transcribe con whisper.cpp (MOTIONAI_WHISPER y MOTIONAI_WHISPER_MODELO).
 *
 * Uso: pnpm fase4
 * Deja el proyecto, el MP4, una hoja de cuadros y la bitácora en salida/fase4/.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Estudio, encontrarWhisper } from '@motionai/estudio';
import { lanzarAgente, type EventoAgente } from '@motionai/mcp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'salida', 'fase4');
const MARCA = path.join(RAIZ, 'referencia', 'flow-sites', 'marca');
const VOZ = path.join(MARCA, 'voz_flow_sites.mp3');
const ISOTIPO = path.join(MARCA, 'isotipo-flow.svg');
const GUION = [
  '[curious] ¿Tienes página web… pero nadie la actualiza?',
  '[concerned] ¿Y los mensajes que te dejan ahí… se te pierden?',
  '[confident] Con Flow Sites, tu página está conectada a tu negocio.',
  '[warm] Cuando un cliente te deja sus datos, aparecen solitos en tu lista de clientes.',
  '[reassuring] Cuando alguien agenda una cita, cae directo en tu agenda… y le llega un correo para confirmarla.',
  '[calm] Vincula tu dominio, publica cuando quieras y mira cuántas personas te visitan.',
  '[cheerful] Pruébalo gratis quince días.',
  '[proud] Flow, tu negocio en un solo flujo.',
];
const BRIEF = [
  'Haz mi comercial de Flow Sites para TikTok y Reels (9:16), en estilo papel recortado.',
  '',
  'Flow es una plataforma para negocios chicos (estéticas, consultorios, talleres) que junta clientes, agenda y avisos en un solo lugar. ' +
    'Flow Sites es su creador de páginas web: la página queda conectada al negocio. Los datos que deja un cliente entran solos a la lista de clientes, ' +
    'las citas caen en la agenda y al cliente le llega un correo para confirmar; además se vincula un dominio, se publica cuando quieras y se ven las visitas.',
  '',
  `La voz está en ${VOZ}. Este es el guion; lo que va entre corchetes son indicaciones de tono para la locutora, no se dice:`,
  ...GUION.map((l) => `- ${l}`),
  '',
  'El video dura lo que dura la voz y lleva subtítulos. Cada escena debe mostrar lo que dice la voz en ese momento.',
  'Colores de la marca: azul petróleo #006E84, turquesa #0091AE, coral #FF7A66, menta #9ED3C0, mostaza #EDB43E, crema #FBF3E4 y tinta #3A2E30. Letra: Nunito.',
  `Nuestro isotipo está en ${ISOTIPO}. Cierra con el isotipo, la palabra «Flow» y «tu negocio en un solo flujo».`,
  '',
  'Cuando esté listo, revísalo y expórtalo.',
].join('\n');

/** Palabras del guion sin indicaciones ni puntuación, para comparar con las frases que quedaron. */
const palabras = (s: string) => s.replace(/\[[^\]]*\]/g, ' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-zñ]+/g) ?? [];

const recortar = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n)}…` : s).replace(/\n/g, ' ⏎ ');

async function principal() {
  if (!encontrarWhisper()) throw new Error('Falta whisper.cpp: define MOTIONAI_WHISPER y MOTIONAI_WHISPER_MODELO.');
  await rm(SALIDA, { recursive: true, force: true });
  const carpeta = path.join(SALIDA, 'proyectos');
  await mkdir(carpeta, { recursive: true });
  const bitacora = path.join(SALIDA, 'bitacora.md');
  await writeFile(bitacora, `# Prueba de la fase 4\n\nBrief:\n\n${BRIEF}\n\n`);
  const anotar = async (s: string) => { console.log(s); await appendFile(bitacora, s + '\n'); };

  const conteo = { llamadas: 0, rechazos: 0, vistas: 0, porHerramienta: new Map<string, number>() };
  const nombres = new Map<string, string>();
  let fin: Extract<EventoAgente, { tipo: 'fin' }> | undefined;
  const inicio = Date.now();
  const cola: Promise<void>[] = [];

  await lanzarAgente({ mensaje: BRIEF, carpetaProyectos: carpeta }, (e) => {
    switch (e.tipo) {
      case 'inicio':
        cola.push(anotar(`- Sesión ${e.sesion} · modelo ${e.modelo} · herramientas: ${e.herramientas.join(', ')}\n`));
        break;
      case 'texto':
        cola.push(anotar(`\n> ${e.texto.replace(/\n/g, '\n> ')}\n`));
        break;
      case 'herramienta':
        conteo.llamadas++;
        nombres.set(e.id, e.nombre);
        conteo.porHerramienta.set(e.nombre, (conteo.porHerramienta.get(e.nombre) ?? 0) + 1);
        if (e.nombre === 'ver_cuadro') conteo.vistas++;
        cola.push(anotar(`- **${e.nombre}** ${recortar(JSON.stringify(e.entrada))}`));
        break;
      case 'resultado':
        if (e.error) conteo.rechazos++;
        cola.push(anotar(`  - ${e.error ? '✗' : '→'} ${recortar(e.texto, e.error ? 600 : 160)}${e.imagenes ? ` [${e.imagenes} imagen]` : ''}`));
        break;
      case 'fin':
        fin = e;
        break;
    }
  });
  await Promise.all(cola);

  const minutos = (Date.now() - inicio) / 60000;
  await anotar(`\n## Respuesta final\n\n${fin?.texto ?? '(sin respuesta)'}\n`);

  // Verificación independiente de lo que dejó Claude.
  const proyectos = execFileSync('find', [carpeta, '-name', 'proyecto.json'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  if (!proyectos.length) throw new Error('Claude no creó ningún proyecto.');
  const estudio = await Estudio.abrir(proyectos[0]!);
  const p = estudio.proyecto();
  const piezas = p.escenas.reduce((n, e) => n + e.hijos.length, 0);
  const mp4s = execFileSync('find', [path.dirname(proyectos[0]!), '-name', '*.mp4'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const dur = mp4s[0] ? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4s[0]], { encoding: 'utf8' })) : 0;
  const duracion = p.ajustes.duracion ?? Math.max(...p.escenas.map((e) => e.fin));
  // Un cuadro a media frase, para ver cada momento de la voz con lo que muestra.
  const tiempos = p.frases.map((f) => Math.round(((f.inicio + f.fin) / 2) * 10) / 10);
  for (let i = 0; i < tiempos.length; i += 6) {
    await writeFile(path.join(SALIDA, `hoja_${i / 6 + 1}.png`), await estudio.verCuadro(tiempos.slice(i, i + 6), { lado: 640 }));
  }
  const dichas = palabras(p.frases.map((f) => f.texto).join(' ')), guion = palabras(GUION.join(' '));
  const coinciden = guion.filter((w, i) => dichas[i] === w).length / guion.length;
  const finVoz = (p.ajustes.audio.voz?.inicio ?? 0) + Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', VOZ], { encoding: 'utf8' }));
  const usaIsotipo = p.biblioteca.some((c) => JSON.stringify(c).includes('0091AE') && JSON.stringify(p.escenas).includes(`"componente":"${c.id}"`));

  const checks: [string, boolean][] = [
    ['Proyecto creado por Claude', true],
    ['Formato 9:16 y estilo papel', p.ajustes.formato === '9:16' && p.ajustes.estilo === 'papel'],
    ['Voz cargada', p.ajustes.audio.voz?.archivo.endsWith('.mp3') === true],
    [`Subtítulos iguales al guion (${Math.round(coinciden * 100)} % de las palabras)`, coinciden > 0.95],
    [`El video dura al menos lo que la voz (${duracion} s; la voz termina en ${finVoz.toFixed(2)} s)`, duracion >= finVoz - 0.05],
    ['Isotipo importado del SVG y usado', usaIsotipo],
    ['Más de una escena', p.escenas.length > 1],
    ['Claude revisó su trabajo con ver_cuadro', conteo.vistas > 0],
    ['MP4 exportado de la duración del video', Math.abs(dur - duracion) < 0.2],
    ['Sin herramientas fuera del MCP', [...conteo.porHerramienta.keys()].every((n) => !/^(Bash|Read|Write|Edit|Glob|Grep)$/.test(n))],
  ];
  const resumen = [
    '\n## Resultado\n',
    ...checks.map(([c, ok]) => `- ${ok ? '✓' : '✗'} ${c}`),
    '',
    `- Escenas: ${p.escenas.length} · piezas en escena: ${piezas} · componentes: ${p.biblioteca.length} · versiones: ${estudio.version}`,
    `- Llamadas a herramientas: ${conteo.llamadas} (${[...conteo.porHerramienta].map(([k, v]) => `${k} ${v}`).join(', ')})`,
    `- Cambios rechazados por el validador o mal escritos: ${conteo.rechazos}`,
    `- Tiempo: ${minutos.toFixed(1)} min · turnos: ${fin?.turnos ?? '?'} · costo equivalente: ${fin?.costoUsd?.toFixed(2) ?? '?'} USD`,
    `- Proyecto: ${path.relative(RAIZ, proyectos[0]!)}`,
    `- Video: ${mp4s[0] ? path.relative(RAIZ, mp4s[0]) : '(no se exportó)'}`,
  ].join('\n');
  await anotar(resumen);
  estudio.cerrar();
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

principal().catch((e) => { console.error(e); process.exit(1); });
