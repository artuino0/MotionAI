/**
 * Prueba de motion complejo: Claude hace una pieza de nivel After Effects (tipografía cinética, cámara 3D,
 * máscaras, partículas, morphing) con el motor que se pida, solo por las herramientas de la app.
 *
 * Uso: pnpm tsx herramientas/prueba-motion.ts [motor] [modelo] [esfuerzo]
 *      (por defecto hyperframes, opus, high). Deja todo en salida/motion/.
 * Con MOTION_BRIEF (archivo con el brief), MOTION_NOMBRE, MOTION_DURACION y MOTION_REFERENCIAS (archivos
 * separados por coma que se copian a composicion/referencias/) hace otro encargo; sale en salida/motion-<nombre>/.
 */
import { execFileSync } from 'node:child_process';
import { appendFile, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Estudio } from '@motionai/estudio';
import { lanzarAgente, type Esfuerzo, type EventoAgente } from '@motionai/mcp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOTOR = (process.argv[2] ?? 'hyperframes') as 'motionai' | 'hyperframes';
const MODELO = process.argv[3] ?? 'opus';
const ESFUERZO = (process.argv[4] ?? 'high') as Esfuerzo;
const NOMBRE = process.env.MOTION_NOMBRE ?? 'PULSE';
const slug = NOMBRE.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const SALIDA = path.join(RAIZ, 'salida', process.env.MOTION_BRIEF ? `motion-${slug}` : 'motion');
const DURACION = Number(process.env.MOTION_DURACION ?? 20);
const REFERENCIAS = (process.env.MOTION_REFERENCIAS ?? '').split(',').filter(Boolean);

const BRIEF = process.env.MOTION_BRIEF ? await readFile(process.env.MOTION_BRIEF, 'utf8') : [
  `Haz una pieza de motion graphics de ${DURACION} segundos en 9:16 con nivel de After Effects, nada caricaturesco: el lanzamiento de «PULSE», ` +
    'un reloj inteligente ficticio para corredores. Estilo editorial y tecnológico, oscuro, con un color de acento eléctrico.',
  '',
  'Quiero ver técnicas de motion designer de verdad, no solo cosas que aparecen:',
  '- Tipografía cinética: palabras que entran por letras con escalonado, máscaras que revelan texto, cambios de peso o de escala con ritmo.',
  '- Una «cámara» con profundidad: perspectiva 3D, capas en distintos planos que se mueven a distinta velocidad (parallax), un push-in o un giro de cámara.',
  '- Transiciones entre escenas que no sean cortes ni fundidos: barridos con máscara, match cuts, un objeto que se convierte en la siguiente escena.',
  '- Formas que se transforman (morphing de trazos) y líneas que se dibujan.',
  '- Datos animados: contadores que suben (ritmo cardiaco, kilómetros, ritmo por km) y una gráfica que se traza.',
  '- Detalle de acabado: brillos y luces con modos de fusión, desenfoque de movimiento en lo que se mueve rápido, grano o textura sutil, partículas con semilla.',
  '- Curvas de animación cuidadas (nada lineal salvo lo que deba serlo) y un ritmo con pausas: que respire.',
  '',
  'Estructura sugerida (puedes mejorarla): gancho fuerte en los primeros 2 segundos, tres beneficios (ritmo cardiaco, GPS, batería de 14 días) y cierre con el nombre PULSE y «Corre más lejos».',
  'No hay voz ni música. No inventes precios ni fechas. Revisa con cuadros a media transición y en reposo, corrige, revisa la composición y exporta.',
].join('\n');

const recortar = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n)}…` : s).replace(/\n/g, ' ⏎ ');

await rm(SALIDA, { recursive: true, force: true });
await mkdir(SALIDA, { recursive: true });
const bitacora = path.join(SALIDA, 'bitacora.md');
await writeFile(bitacora, `# Prueba de motion complejo\n\nMotor ${MOTOR} · modelo ${MODELO} · esfuerzo ${ESFUERZO}\n\n${BRIEF}\n\n`);
const anotar = async (s: string) => { console.log(s); await appendFile(bitacora, s + '\n'); };

const e = await Estudio.crear({ carpeta: path.join(SALIDA, 'proyecto'), nombre: NOMBRE, motor: MOTOR, formato: '9:16', duracion: DURACION, fondo: process.env.MOTION_BRIEF ? '#FFFFFF' : '#07080B' });
const ruta = e.ruta;
if (REFERENCIAS.length && MOTOR === 'hyperframes') {
  await mkdir(path.join(e.composicion, 'referencias'), { recursive: true });
  for (const [i, f] of REFERENCIAS.entries()) await copyFile(f, path.join(e.composicion, 'referencias', `imagen-${i + 1}${path.extname(f)}`));
}
e.cerrar();

const conteo = new Map<string, number>();
let fin: Extract<EventoAgente, { tipo: 'fin' }> | undefined;
let modeloUsado = '';
const inicio = Date.now();
const cola: Promise<void>[] = [];
await lanzarAgente({
  mensaje: BRIEF, carpetaProyectos: path.dirname(ruta), proyecto: ruta, cwd: path.dirname(ruta),
  archivos: MOTOR !== 'motionai', modelo: MODELO, esfuerzo: ESFUERZO,
}, (ev) => {
  if (ev.tipo === 'inicio') modeloUsado = ev.modelo ?? '';
  if (ev.tipo === 'texto') cola.push(anotar(`\n> ${ev.texto.replace(/\n/g, '\n> ')}\n`));
  if (ev.tipo === 'herramienta') { conteo.set(ev.nombre, (conteo.get(ev.nombre) ?? 0) + 1); cola.push(anotar(`- **${ev.nombre}** ${recortar(JSON.stringify(ev.entrada))}`)); }
  if (ev.tipo === 'resultado') cola.push(anotar(`  - ${ev.error ? '✗' : '→'} ${recortar(ev.texto, ev.error ? 500 : 160)}`));
  if (ev.tipo === 'fin') fin = ev;
});
await Promise.all(cola);

const estudio = await Estudio.abrir(ruta);
const tiempos = Array.from({ length: 8 }, (_, i) => Math.round(((i + 0.5) / 8) * DURACION * 10) / 10);
await writeFile(path.join(SALIDA, 'hoja.png'), await estudio.verCuadro(tiempos.slice(0, 6), { lado: 640 }));
await writeFile(path.join(SALIDA, 'hoja_2.png'), await estudio.verCuadro(tiempos.slice(6), { lado: 640 }));
const revision = await estudio.revisar();
const mp4s = execFileSync('find', [path.dirname(ruta), '-name', '*.mp4', '-not', '-name', '.*'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
let mp4 = mp4s[0];
if (!mp4) mp4 = (await estudio.exportar()).salida;
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }));
const html = MOTOR === 'hyperframes' ? await readFile(path.join(estudio.composicion, 'index.html'), 'utf8') : '';
const tecnicas = MOTOR === 'hyperframes' ? {
  perspectiva3d: /perspective|rotate[XY3]|translateZ|preserve-3d/.test(html),
  mascaras: /clip-path|mask-image|-webkit-mask/.test(html),
  fusion: /mix-blend-mode|background-blend-mode/.test(html),
  desenfoque: /blur\(/.test(html),
  trazosSVG: /stroke-dash(offset|array)|getTotalLength/.test(html),
  morphing: /\bd:\s*['"`]?path|['"]d['"]\s*:/.test(html),
  semilla: /mulberry|seed|semilla|xorshift|lcg/i.test(html),
} : {};
await anotar([
  '\n## Resultado\n',
  `- Modelo que contestó: ${modeloUsado}`,
  `- Tiempo: ${((Date.now() - inicio) / 60000).toFixed(1)} min · turnos ${fin?.turnos ?? '?'} · costo equivalente ${fin?.costoUsd?.toFixed(2) ?? '?'} USD`,
  `- Herramientas: ${[...conteo].map(([k, v]) => `${k} ${v}`).join(', ')}`,
  `- Revisión: ${revision.errores.length} errores, ${revision.avisos.length} avisos${revision.errores.length ? `\n  - ${revision.errores.join('\n  - ')}` : ''}`,
  `- MP4: ${path.relative(RAIZ, mp4)} · ${dur.toFixed(2)} s`,
  ...(MOTOR === 'hyperframes' ? [`- Composición: ${html.length} caracteres · técnicas: ${Object.entries(tecnicas).map(([k, v]) => `${v ? '✓' : '✗'} ${k}`).join(', ')}`] : []),
].join('\n'));
estudio.cerrar();
