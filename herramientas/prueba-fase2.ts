/**
 * Prueba de cierre de la fase 2: Claude crea desde cero un video de 15 s a partir de un brief de texto,
 * sin ningún archivo previo, usando solo las herramientas MCP de la app (sin archivos ni terminal).
 *
 * Uso: pnpm fase2 ["brief"]
 * Deja el proyecto, el MP4, una hoja de cuadros y la bitácora en salida/fase2/.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Estudio } from '@motionai/estudio';
import { lanzarAgente, type EventoAgente } from '@motionai/mcp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'salida', 'fase2');
const BRIEF =
  process.argv[2] ??
  'Haz un video de 15 segundos en 9:16 para TikTok de "Café Luna", una cafetería de barrio que lanza su cold brew de temporada. ' +
  'Tono cálido y alegre. Cierra con "@cafeluna · Ven hoy". No hay voz ni música. Cuando esté listo, revísalo y expórtalo.';

const recortar = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n)}…` : s).replace(/\n/g, ' ⏎ ');

async function principal() {
  await rm(SALIDA, { recursive: true, force: true });
  const carpeta = path.join(SALIDA, 'proyectos');
  await mkdir(carpeta, { recursive: true });
  const bitacora = path.join(SALIDA, 'bitacora.md');
  await writeFile(bitacora, `# Prueba de la fase 2\n\nBrief: ${BRIEF}\n\n`);
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
  const tiempos = [0.1, 0.2, 0.4, 0.6, 0.8, 0.95].map((f) => Math.round(f * duracion * 10) / 10);
  await writeFile(path.join(SALIDA, 'hoja.png'), await estudio.verCuadro(tiempos, { lado: 640 }));

  const checks: [string, boolean][] = [
    ['Proyecto creado por Claude', true],
    ['Duración de 15 s', Math.abs(duracion - 15) < 0.01],
    ['Formato 9:16', p.ajustes.formato === '9:16'],
    ['Más de una escena', p.escenas.length > 1],
    ['Claude revisó su trabajo con ver_cuadro', conteo.vistas > 0],
    ['MP4 exportado de ~15 s', Math.abs(dur - 15) < 0.2],
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
