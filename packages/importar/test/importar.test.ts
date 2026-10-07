import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validarProyecto } from '@motionai/documento';
import { aplanar, leerTrazado, limitesTrazado } from '@motionai/motor';
import { campanaDePen, campanasDePen, colorCss, componenteDeSvg, componentesDePen, leerPen } from '../src/index.js';

const PEN = path.resolve(import.meta.dirname, '../../../referencia/flow-sites/FlowSites.pen');

describe('colores CSS', () => {
  it('lee hex, rgb, hsl y nombres', () => {
    expect(colorCss('#abc')).toBe('#AABBCC');
    expect(colorCss('rgb(255, 0, 0)')).toBe('#FF0000');
    expect(colorCss('rgba(0,0,0,0.5)')).toBe('#00000080');
    expect(colorCss('hsl(120, 100%, 50%)')).toBe('#00FF00');
    expect(colorCss('tomato')).toBe('#FF6347');
    expect(colorCss('red', 0.5)).toBe('#FF000080');
    expect(colorCss('none')).toBeUndefined();
  });
});

describe('SVG', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 100 50">
    <style>.c { fill: #ff7a66 } #b { stroke: navy; stroke-width: 2 }</style>
    <defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></linearGradient></defs>
    <g transform="translate(10 10)">
      <rect class="c" x="0" y="0" width="20" height="10" rx="2"/>
      <circle id="b" cx="50" cy="20" r="10" fill="url(#g)"/>
      <path d="M0 40 L20 40" stroke="black" stroke-linecap="round" fill="none" transform="scale(2)"/>
      <text x="50" y="45" font-family="Montserrat" font-size="10" text-anchor="middle">Hola</text>
    </g>
    <mask id="m"/>
  </svg>`;

  it('convierte figuras, estilos, transformaciones, degradados y texto', () => {
    const { componente, avisos } = componenteDeSvg(svg, { id: 'dibujo', nombre: 'Dibujo', fuentes: ['Nunito', 'Montserrat'] });
    const raiz = componente.raiz as { ancho: number; alto: number; hijos: Record<string, any>[] };
    expect([raiz.ancho, raiz.alto]).toEqual([100, 50]);
    expect(raiz.hijos.map((h) => h.tipo)).toEqual(['trazo', 'trazo', 'trazo', 'texto']);
    const [rect, circulo, linea, texto] = raiz.hijos;
    expect(rect!.relleno).toBe('#FF7A66');
    // translate(10 10) del grupo y -10 -10 del viewBox se cancelan.
    expect(limitesTrazado(aplanar(leerTrazado(rect!.d)))).toEqual([0, 0, 20, 10]);
    expect(circulo!.relleno.tipo).toBe('lineal');
    expect([circulo!.relleno.de, circulo!.relleno.a]).toEqual([[40, 10], [60, 10]]);
    expect(circulo!.contorno).toMatchObject({ color: '#000080', ancho: 2 });
    expect(linea!.relleno).toBeUndefined();
    expect(linea!.contorno).toMatchObject({ ancho: 2, extremo: 'redondo' });
    expect(limitesTrazado(aplanar(leerTrazado(linea!.d)))).toEqual([0, 80, 40, 80]);
    expect(texto).toMatchObject({ texto: 'Hola', fuente: 'Montserrat', tamano: 10, x: 50, ancla: 'centro' });
    expect(avisos).toEqual([]);
  });

  it('avisa lo que no trae y rechaza lo que no es SVG', () => {
    const { avisos } = componenteDeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5" filter="url(#f)"/><text font-family="Comic Sans">x</text></svg>', {
      id: 'x', nombre: 'x', fuentes: ['Nunito'],
    });
    expect(avisos.join(' ')).toMatch(/filtros/);
    expect(avisos.join(' ')).toMatch(/Comic Sans/);
    expect(() => componenteDeSvg('<html/>', { id: 'x', nombre: 'x' })).toThrow(/SVG/);
  });
});

describe('.pen de Flow Sites', () => {
  const pen = leerPen(readFileSync(PEN, 'utf8'));

  it('trae las 28 piezas reusables y las imágenes que usan', () => {
    const r = componentesDePen(pen);
    expect(r.componentes).toHaveLength(28);
    expect(r.recursos).toContain('recursos/fondo_rosa_vertical.png');
    expect(r.recursos).not.toContain('recursos/grano.png');
    const solo = componentesDePen(pen, ['2xapvZ']);
    expect(solo.componentes.map((c) => c.id)).toEqual(['2xapvZ']);
  });

  it('trae la campaña con escenas, frases, voz y animación, y el proyecto es válido', () => {
    expect(campanasDePen(pen)).toEqual(['Flow Sites']);
    const c = campanaDePen(pen);
    expect(c).toMatchObject({ nombre: 'Flow Sites', formato: '9:16', duracion: 29.6, voz: { archivo: 'recursos/voz_sites.mp3', inicio: 0.25 } });
    expect(c.escenas).toHaveLength(6);
    expect(c.frases).toHaveLength(9);
    expect(c.frases[8]!.subtitulo).toBe(false);
    const etiqueta = c.escenas[0]!.hijos.find((h) => h.id === 'rqytHs') as Record<string, any>;
    expect(etiqueta.animacion.entra).toEqual({ tipo: 'pop', en: 'f2+1.3', dur: 0.3 });
    expect(etiqueta.rotacion).toBe(-3);
    expect(etiqueta.cambios.QGa2rb.texto).toBe('Mensajes perdidos');
    const r = validarProyecto({
      formato: 'motionai', version: 1, nombre: c.nombre, ajustes: { formato: c.formato, duracion: c.duracion },
      fuentes: [400, 700, 800, 900].map((peso) => ({ familia: 'Nunito', archivo: `n${peso}.ttf`, peso })), frases: c.frases, biblioteca: c.componentes, escenas: c.escenas,
    });
    expect(r.ok ? [] : r.errores).toEqual([]);
  });
});
