import { describe, expect, it } from 'vitest';
import { leerProyecto, type Nodo } from '@motionai/documento';
import { aplanar, estado, leerColor, leerTrazado, limitesTrazado, preparar, suavizar, escenaEn, totalCuadros } from '../src/index.js';

describe('curvas', () => {
  it('empiezan en 0 y terminan en 1', () => {
    for (const c of ['lineal', 'entrada', 'salida', 'entrada-salida', 'rebote', 'elastico', 'golpe'] as const) {
      expect(suavizar(c, 0)).toBeCloseTo(0, 5);
      expect(suavizar(c, 1)).toBeCloseTo(1, 5);
    }
  });
  it('cubic-bezier como en CSS', () => {
    expect(suavizar([0, 0, 1, 1], 0.3)).toBeCloseTo(0.3, 4);
    expect(suavizar([0.25, 0.1, 0.25, 1], 0.5)).toBeCloseTo(0.8024, 3); // «ease» de CSS
  });
  it('rebote se pasa de 1', () => {
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => suavizar('rebote', i / 49)))).toBeGreaterThan(1);
  });
});

describe('trazados SVG', () => {
  it('lee comandos relativos, H/V y cierres', () => {
    const c = leerTrazado('m10 10 h20 v20 h-20 z');
    expect(c.map((k) => k.c).join('')).toBe('MLLLZ');
    expect(limitesTrazado(aplanar(c))).toEqual([10, 10, 30, 30]);
  });
  it('repite el comando cuando siguen números', () => {
    const c = leerTrazado('M0 0 L10 0 10 10 0 10Z');
    expect(c.filter((k) => k.c === 'L')).toHaveLength(3);
  });
  it('convierte arcos en curvas', () => {
    const c = leerTrazado('M0 50 A50 50 0 0 1 100 50');
    expect(c.slice(1).every((k) => k.c === 'C')).toBe(true);
    const [x0, y0, x1] = limitesTrazado(aplanar(c));
    expect(x0).toBeCloseTo(0, 1);
    expect(x1).toBeCloseTo(100, 1);
    expect(y0).toBeCloseTo(0, 0); // medio círculo hacia arriba
  });
  it('mide el largo', () => {
    expect(aplanar(leerTrazado('M0 0 L30 0 L30 40')).largo).toBeCloseTo(70);
  });
  it('avisa de trazados mal escritos', () => {
    expect(() => leerTrazado('10 10')).toThrow();
  });
});

const proyecto = (hijos: Nodo[], extra: Record<string, unknown> = {}) =>
  leerProyecto({
    formato: 'motionai', version: 1, nombre: 'P',
    frases: [{ inicio: 1, fin: 2, texto: 'uno' }],
    escenas: [{ id: 'e1', inicio: 0, fin: 4, hijos }, { id: 'e2', inicio: 4, fin: 6, hijos: [] }],
    ...extra,
  });
const medio = { contenedor: { ancho: 1080, alto: 1920 }, lienzo: { ancho: 1080, alto: 1920 } };

describe('animación', () => {
  it('interpola keyframes y colores', () => {
    const esc = preparar(proyecto([{
      id: 'r', tipo: 'rect', ancho: 10, alto: 10, x: '50%',
      animacion: { pistas: {
        y: [{ t: 0, v: 0 }, { t: 2, v: 100, curva: 'lineal' }],
        relleno: [{ t: 0, v: '#000000' }, { t: 2, v: '#FFFFFF', curva: 'lineal' }],
      } },
    }]));
    const np = esc.escenas[0]!.hijos[0]!;
    const s = estado(np, 1, medio);
    expect(s.x).toBe(540);
    expect(s.y).toBeCloseTo(50);
    expect(s.relleno![0]).toBeCloseTo(127.5);
    expect(estado(np, 5, medio).y).toBe(100);
  });

  it('oculta antes de entrar y después de salir', () => {
    const esc = preparar(proyecto([{
      id: 'r', tipo: 'rect', ancho: 10, alto: 10,
      animacion: { entra: { tipo: 'pop', en: 'f1' }, sale: { tipo: 'desaparece', en: 3, dur: 0.5 } },
    }]));
    const np = esc.escenas[0]!.hijos[0]!;
    expect(estado(np, 0.9, medio).visible).toBe(false);
    expect(estado(np, 1.1, medio).visible).toBe(true);
    expect(estado(np, 1.1, medio).escalaX).toBeLessThan(1);
    expect(estado(np, 2, medio).escalaX).toBe(1);
    expect(estado(np, 3.25, medio).opacidad).toBeLessThan(1);
    expect(estado(np, 3.5, medio).visible).toBe(false);
  });

  it('dibuja el contorno de un trazo y escribe un texto', () => {
    const esc = preparar(proyecto([
      { id: 'l', tipo: 'trazo', d: 'M0 0 L10 0', contorno: { color: '#000000', ancho: 2 }, animacion: { entra: { tipo: 'dibuja', en: 0, dur: 1, curva: 'lineal' } } },
      { id: 't', tipo: 'texto', texto: 'hola', fuente: 'X', tamano: 10, animacion: { entra: { tipo: 'escribe', en: 0, dur: 1 } } },
    ], { fuentes: [{ familia: 'X', archivo: 'x.ttf' }] }));
    const [l, t] = esc.escenas[0]!.hijos;
    expect(estado(l!, 0.25, medio).trazo).toBeCloseTo(0.25);
    expect(estado(t!, 0.5, medio).caracteres).toBeCloseTo(0.5);
  });

  it('los tiempos dentro de un componente cuentan desde que aparece la instancia', () => {
    const esc = preparar(proyecto(
      [{ id: 'i', tipo: 'instancia', componente: 'c', animacion: { entra: { tipo: 'aparece', en: 2 } } }],
      { biblioteca: [{ id: 'c', nombre: 'C', raiz: { id: 'r', tipo: 'rect', ancho: 1, alto: 1, animacion: { entra: { tipo: 'aparece', en: 0.5 } } } }] },
    ));
    const hijo = esc.escenas[0]!.hijos[0]!.hijos[0]!;
    expect(hijo.entra!.en).toBe(2.5);
  });

  it('aplica los cambios de una instancia', () => {
    const esc = preparar(proyecto(
      [{ id: 'i', tipo: 'instancia', componente: 'c', cambios: { r: { relleno: '#FF0000' } } }],
      { biblioteca: [{ id: 'c', nombre: 'C', raiz: { id: 'r', tipo: 'rect', ancho: 1, alto: 1, relleno: '#000000' } }] },
    ));
    const r = esc.escenas[0]!.hijos[0]!.hijos[0]!.nodo;
    expect(r.tipo === 'rect' && r.relleno).toBe('#FF0000');
  });

  it('ciclos se suman a la posición', () => {
    const esc = preparar(proyecto([{ id: 'r', tipo: 'rect', ancho: 1, alto: 1, y: 100, animacion: { ciclos: [{ tipo: 'flota', amplitud: 10, periodo: 4 }] } }]));
    expect(estado(esc.escenas[0]!.hijos[0]!, 1, medio).y).toBeCloseTo(110);
  });
});

describe('escenario', () => {
  it('encuentra la escena y cuenta los cuadros', () => {
    const esc = preparar(proyecto([]));
    expect(escenaEn(esc, 3.99)!.escena.id).toBe('e1');
    expect(escenaEn(esc, 4)!.escena.id).toBe('e2');
    expect(escenaEn(esc, 6)!.escena.id).toBe('e2');
    expect(totalCuadros(esc)).toBe(180);
  });
  it('lee colores con alfa', () => {
    expect(leerColor('#FF000080')).toEqual([255, 0, 0, 128 / 255]);
    expect(leerColor('#0F0')).toEqual([0, 255, 0, 1]);
  });
});
