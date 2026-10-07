#!/usr/bin/env -S npx tsx
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ErrorProyecto, FORMATO_IDS, conFormato, dimensiones, validarProyecto, type Formato } from '@motionai/documento';
import { preparar } from '@motionai/motor';
import { readFile } from 'node:fs/promises';
import { cargarProyecto, cargarRecursos } from './recursos.js';
import { pngCuadro } from './cuadro.js';
import { exportarMP4, rutaPorDefecto } from './exportar.js';

const AYUDA = `motionai · motor de render

Uso:
  motionai validar <proyecto.json>
  motionai cuadro  <proyecto.json> <segundos[,segundos…]> [--dir carpeta] [--formato 16:9]
  motionai render  <proyecto.json> [salida.mp4] [--formato 16:9] [--desde s] [--hasta s]

Formatos: ${FORMATO_IDS.filter((f) => f !== 'libre').join(', ')}`;

async function principal(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: 'string' },
      formato: { type: 'string' },
      desde: { type: 'string' },
      hasta: { type: 'string' },
      ayuda: { type: 'boolean', short: 'h' },
    },
  });
  const [orden, ruta, ...resto] = positionals;
  if (values.ayuda || !orden || !ruta) {
    console.log(AYUDA);
    return orden ? 1 : 0;
  }

  if (orden === 'validar') {
    const r = validarProyecto(JSON.parse(await readFile(ruta, 'utf8')));
    if (r.ok) {
      const { ancho, alto } = dimensiones(r.proyecto.ajustes);
      console.log(`✓ ${r.proyecto.nombre}: ${r.proyecto.escenas.length} escenas, ${ancho}×${alto}, ${r.proyecto.ajustes.fps} fps`);
      return 0;
    }
    console.error(`✗ El proyecto no es válido:\n- ${r.errores.join('\n- ')}`);
    return 1;
  }

  const cargado = await cargarProyecto(ruta);
  if (values.formato) {
    if (!(FORMATO_IDS as readonly string[]).includes(values.formato) || values.formato === 'libre') {
      throw new Error(`Formato desconocido "${values.formato}". Usa uno de: ${FORMATO_IDS.join(', ')}`);
    }
    cargado.proyecto = conFormato(cargado.proyecto, values.formato as Formato);
  }
  const { entorno, faltantes } = await cargarRecursos(cargado);
  if (faltantes.length) console.warn(`Aviso: faltan archivos: ${faltantes.join(', ')}`);
  const esc = preparar(cargado.proyecto);

  if (orden === 'cuadro') {
    const tiempos = (resto[0] ?? '0').split(',').map(Number);
    const dir = path.resolve(values.dir ?? '.');
    await mkdir(dir, { recursive: true });
    for (const t of tiempos) {
      const archivo = path.join(dir, `cuadro_${t.toFixed(2)}.png`);
      await writeFile(archivo, await pngCuadro(esc, t, entorno));
      console.log(archivo);
    }
    return 0;
  }

  if (orden === 'render') {
    const salida = path.resolve(resto[0] ?? rutaPorDefecto(cargado.proyecto, cargado.base));
    const inicio = Date.now();
    let ultimo = -1;
    const r = await exportarMP4(esc, entorno, cargado.base, salida, {
      desde: values.desde ? Number(values.desde) : undefined,
      hasta: values.hasta ? Number(values.hasta) : undefined,
      progreso: (h, total) => {
        const pct = Math.floor((h / total) * 100);
        if (pct !== ultimo && pct % 10 === 0) { ultimo = pct; process.stderr.write(`\r${pct}% (${h}/${total} cuadros)`); }
      },
    });
    process.stderr.write('\n');
    console.log(`✓ ${r.salida} · ${r.cuadros} cuadros · ${r.segundos.toFixed(2)} s · ${((Date.now() - inicio) / 1000).toFixed(1)} s de render`);
    return 0;
  }

  console.error(`Orden desconocida "${orden}".\n\n${AYUDA}`);
  return 1;
}

principal(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof ErrorProyecto ? e.message : `Error: ${(e as Error).message}`);
    process.exit(1);
  },
);
