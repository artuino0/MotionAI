import { describe, expect, it } from 'vitest';
import { conFormato, dimensiones, duracionDe, leerProyecto, resolverTiempo, validarProyecto, zonasTapadas } from '../src/index.js';

const minimo = (extra: Record<string, unknown> = {}) => ({
  formato: 'motionai',
  version: 1,
  nombre: 'Prueba',
  escenas: [{ id: 'e1', inicio: 0, fin: 2, hijos: [] }],
  ...extra,
});

describe('tiempos', () => {
  const ctx = { frases: [{ inicio: 1, fin: 2.5 }, { inicio: 3, fin: 4 }], escena: { inicio: 10, fin: 14 } };
  it('resuelve segundos, frases y escena', () => {
    expect(resolverTiempo(1.5, ctx)).toBe(1.5);
    expect(resolverTiempo('f2', ctx)).toBe(3);
    expect(resolverTiempo('f1+0.8', ctx)).toBeCloseTo(1.8);
    expect(resolverTiempo('f1.fin-0.5', ctx)).toBe(2);
    expect(resolverTiempo('escena+1', ctx)).toBe(11);
    expect(resolverTiempo('escena.fin', ctx)).toBe(14);
  });
  it('avisa si la frase no existe', () => {
    expect(() => resolverTiempo('f3', ctx)).toThrow(/frase 3/);
  });
});

describe('proyecto', () => {
  it('llena los ajustes por defecto', () => {
    const p = leerProyecto(minimo());
    expect(p.ajustes.formato).toBe('9:16');
    expect(p.ajustes.fps).toBe(30);
    expect(p.ajustes.subtitulos.maxRenglones).toBe(3);
    expect(p.ajustes.exportar.codec).toBe('h264');
    expect(dimensiones(p.ajustes)).toEqual({ ancho: 1080, alto: 1920 });
    expect(duracionDe(p)).toBe(2);
  });

  it('cambia de formato sin tocar el contenido', () => {
    const p = conFormato(leerProyecto(minimo()), '16:9');
    expect(dimensiones(p.ajustes)).toEqual({ ancho: 1920, alto: 1080 });
  });

  it('pide ancho y alto en formato libre', () => {
    const r = validarProyecto(minimo({ ajustes: { formato: 'libre' } }));
    expect(r.ok).toBe(false);
    const r2 = validarProyecto(minimo({ ajustes: { formato: 'libre', ancho: 800, alto: 600 } }));
    expect(r2.ok && dimensiones(r2.proyecto.ajustes)).toEqual({ ancho: 800, alto: 600 });
  });

  it('rechaza ids repetidos, componentes y fuentes que no existen', () => {
    const r = validarProyecto(
      minimo({
        escenas: [
          {
            id: 'e1', inicio: 0, fin: 2,
            hijos: [
              { id: 'a', tipo: 'rect', ancho: 10, alto: 10 },
              { id: 'a', tipo: 'instancia', componente: 'nada' },
              { id: 'b', tipo: 'texto', texto: 'hola', fuente: 'Falsa', tamano: 20 },
            ],
          },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores.join('\n')).toMatch(/"a" está repetido/);
      expect(r.errores.join('\n')).toMatch(/componente "nada"/);
      expect(r.errores.join('\n')).toMatch(/fuente "Falsa"/);
    }
  });

  it('rechaza campos desconocidos y colores mal escritos', () => {
    const r = validarProyecto(minimo({ escenas: [{ id: 'e1', inicio: 0, fin: 2, hijos: [{ id: 'a', tipo: 'rect', ancho: 1, alto: 1, relleno: 'rojo' }] }] }));
    expect(r.ok).toBe(false);
    const r2 = validarProyecto(minimo({ escenas: [{ id: 'e1', inicio: 0, fin: 2, hijos: [{ id: 'a', tipo: 'rect', ancho: 1, alto: 1, colorr: '#fff' }] }] }));
    expect(r2.ok).toBe(false);
  });

  it('el ejemplo del repositorio es válido', async () => {
    const { readFile } = await import('node:fs/promises');
    const datos = JSON.parse(await readFile(new URL('../../../ejemplos/demo/proyecto.json', import.meta.url), 'utf8'));
    const r = validarProyecto(datos);
    expect(r.ok ? [] : r.errores).toEqual([]);
  });
});

describe('zonas tapadas', () => {
  it('solo aplican en 9:16', () => {
    expect(zonasTapadas('tiktok', '9:16').length).toBeGreaterThan(0);
    expect(zonasTapadas('tiktok', '16:9')).toEqual([]);
  });
});
