import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Estudio, tramosDeVoz } from '../src/index.js';

const temp = () => mkdtemp(path.join(os.tmpdir(), 'estudio-'));
const nuevo = async (extra: Partial<Parameters<typeof Estudio.crear>[0]> = {}) =>
  Estudio.crear({ carpeta: path.join(await temp(), 'p'), nombre: 'Prueba', duracion: 6, ...extra });

const titulo = (extra: Record<string, unknown> = {}) => ({
  id: 'titulo', tipo: 'texto' as const, texto: 'Hola mundo', fuente: 'Montserrat', peso: 900, tamano: 100,
  x: '50%' as const, y: '40%' as const, ancla: 'centro' as const, ...extra,
});

describe('Estudio', () => {
  it('crea un proyecto y guarda versiones', async () => {
    const e = await nuevo();
    expect(e.version).toBe(1);
    expect(existsSync(e.ruta)).toBe(true);
    const r = await e.agregarPieza({ pieza: titulo() });
    expect(r.ok).toBe(true);
    expect(r.version).toBe(2);
    expect(r.mensaje).toMatch(/Agregué la fuente Montserrat/);
    expect(existsSync(path.join(e.base, 'recursos/fuentes/Montserrat_900Black.ttf'))).toBe(true);
    const disco = JSON.parse(await readFile(e.ruta, 'utf8'));
    expect(disco.escenas[0].hijos[0].id).toBe('titulo');
    expect(e.versiones().map((v) => v.herramienta)).toEqual(['agregar_pieza', 'abrir_proyecto']);
  });

  it('rechaza un texto bajo los botones de TikTok y no cambia el documento', async () => {
    const e = await nuevo();
    const r = await e.agregarPieza({ pieza: titulo({ x: 1000, y: 1200 }) });
    expect(r.ok).toBe(false);
    expect(r.errores!.join('\n')).toMatch(/botones de TikTok/);
    expect(e.version).toBe(1);
    expect(e.documento.escenas[0]!.hijos).toEqual([]);
  });

  it('rechaza textos que se salen del lienzo, pero no mientras entran', async () => {
    const e = await nuevo();
    expect((await e.agregarPieza({ pieza: titulo({ x: -200 }) })).errores?.join()).toMatch(/se sale del lienzo/);
    const r = await e.agregarPieza({ pieza: titulo({ animacion: { entra: { tipo: 'desliza-izq', en: 1 } } }) });
    expect(r.ok).toBe(true);
  });

  it('rechaza piezas mal escritas con el motivo', async () => {
    const e = await nuevo();
    const r = await e.agregarPieza({ pieza: titulo({ fuente: 'Comic Sans' }) });
    expect(r.ok).toBe(false);
    expect(r.errores!.join('\n')).toMatch(/Fuentes disponibles: Nunito/);
    const r2 = await e.agregarPieza({ pieza: { id: 'x', tipo: 'trazo', d: 'M 0 0 L 10' } as never });
    expect(r2.ok).toBe(false);
  });

  it('cambia propiedades y mezcla la animación por partes', async () => {
    const e = await nuevo();
    await e.agregarPieza({ pieza: titulo({ animacion: { entra: { tipo: 'pop', en: 0.5 }, ciclos: [{ tipo: 'flota' }] } }) });
    const r = await e.cambiar([{ id: 'titulo', relleno: '#FF0000', animacion: { sale: { tipo: 'desaparece', en: 5 }, pistas: { rotacion: [{ t: 1, v: 0 }, { t: 2, v: 5 }] } } }]);
    expect(r.ok).toBe(true);
    const n = e.documento.escenas[0]!.hijos[0]!;
    expect(n.tipo === 'texto' && n.relleno).toBe('#FF0000');
    expect(n.animacion!.entra!.tipo).toBe('pop');
    expect(n.animacion!.sale!.tipo).toBe('desaparece');
    expect(n.animacion!.ciclos).toHaveLength(1);
    await e.cambiar([{ id: 'titulo', relleno: null, animacion: { ciclos: null } }]);
    const m = e.documento.escenas[0]!.hijos[0]!;
    expect('relleno' in m).toBe(false);
    expect(m.animacion!.ciclos).toBeUndefined();
  });

  it('mueve capas y avisa de ids que no existen', async () => {
    const e = await nuevo();
    await e.agregarPieza({ pieza: { id: 'a', tipo: 'rect', ancho: 10, alto: 10 } });
    await e.agregarPieza({ pieza: { id: 'b', tipo: 'rect', ancho: 10, alto: 10 } });
    await e.cambiar([{ id: 'b', capa: 'fondo' }]);
    expect(e.documento.escenas[0]!.hijos.map((n) => n.id)).toEqual(['b', 'a']);
    const r = await e.cambiar([{ id: 'nada', x: 1 }]);
    expect(r.errores![0]).toMatch(/"nada"/);
  });

  it('componentes, instancias y quitar', async () => {
    const e = await nuevo();
    const r = await e.crearPieza({
      id: 'chip', nombre: 'Chip', tipo: 'etiqueta',
      raiz: { id: 'chip-g', tipo: 'grupo', ancho: 300, alto: 80, hijos: [
        { id: 'chip-fondo', tipo: 'rect', ancho: 300, alto: 80, radio: 40, relleno: '#222222' },
        { id: 'chip-texto', tipo: 'texto', texto: 'Hola', fuente: 'Poppins', tamano: 40, relleno: '#FFFFFF', x: 150, y: 40, ancla: 'centro' },
      ] },
    });
    expect(r.ok).toBe(true);
    expect((await e.agregarPieza({ pieza: { id: 'chip-1', tipo: 'instancia', componente: 'chip', x: '50%', y: '50%', ancla: 'centro', cambios: { 'chip-texto': { texto: 'Uno' } } } })).ok).toBe(true);
    expect(e.buscarBiblioteca('etiqueta')).toHaveLength(1);
    expect((await e.quitarPieza(['chip'])).errores![0]).toMatch(/se usa en chip-1/);
    expect((await e.quitarPieza(['chip-1', 'chip'])).ok).toBe(true);
  });

  it('operaciones de escena', async () => {
    const e = await nuevo();
    expect((await e.escenas({ operacion: 'partir', id: 'e1', en: 2, nuevo_id: 'e2' })).ok).toBe(true);
    expect((await e.escenas({ operacion: 'partir', id: 'e2', en: 4, nuevo_id: 'e3' })).ok).toBe(true);
    expect((await e.escenas({ operacion: 'mover_corte', id: 'e1', fin: 2.5 })).ok).toBe(true);
    expect(e.documento.escenas.map((x) => [x.id, x.inicio, x.fin])).toEqual([['e1', 0, 2.5], ['e2', 2.5, 4], ['e3', 4, 6]]);
    const r = await e.escenas({ operacion: 'crear', id: 'e4', inicio: 3, fin: 5 });
    expect(r.ok).toBe(false);
    expect(r.errores!.join()).toMatch(/encimar/);
    expect((await e.escenas({ operacion: 'quitar', id: 'e3' })).avisos!.join()).toMatch(/no hay escena/);
  });

  it('vuelve a una versión anterior', async () => {
    const e = await nuevo();
    await e.agregarPieza({ pieza: titulo() });
    await e.cambiar([{ id: 'titulo', texto: 'Adiós' }]);
    const r = await e.volverA(2);
    expect(r.ok).toBe(true);
    const n = e.documento.escenas[0]!.hijos[0]!;
    expect(n.tipo === 'texto' && n.texto).toBe('Hola mundo');
    expect(e.version).toBe(4);
  });

  it('relee el archivo si alguien lo editó a mano', async () => {
    const e = await nuevo();
    const doc = JSON.parse(await readFile(e.ruta, 'utf8'));
    doc.nombre = 'Editado';
    await new Promise((r) => setTimeout(r, 20));
    await writeFile(e.ruta, JSON.stringify(doc));
    await e.agregarPieza({ pieza: { id: 'a', tipo: 'rect', ancho: 10, alto: 10 } });
    expect(e.documento.nombre).toBe('Editado');
    expect(e.versiones().map((v) => v.herramienta)).toContain('externo');
  });

  it('avisa si un subtítulo repite un letrero', async () => {
    const e = await nuevo();
    await e.agregarPieza({ pieza: titulo({ texto: 'Tu negocio en un solo flujo', anchoMax: 800 }) });
    const r = await e.ajustes({ duracion: 6 });
    expect(r.ok).toBe(true);
    const doc = e.documento;
    const r2 = await e.aplicar('prueba', (d) => { d.frases = [{ inicio: 1, fin: 3, texto: 'Tu negocio en un solo flujo' }]; return 'frases'; });
    expect(r2.avisos?.join()).toMatch(/subtitulo: false/);
    void doc;
  });

  it('dibuja una hoja de cuadros', async () => {
    const e = await nuevo();
    await e.agregarPieza({ pieza: titulo() });
    const png = await e.verCuadro([0, 1, 2], { zonas: true, resaltar: ['titulo'] });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });

  it('carga voz y detecta tramos por pausas', async () => {
    const dir = await temp();
    const wav = path.join(dir, 'voz.wav');
    // 0.8 s de tono, 0.6 s de silencio, 0.8 s de tono
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=f=300:d=0.8', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono:d=0.6',
      '-f', 'lavfi', '-i', 'sine=f=300:d=0.8', '-filter_complex', '[0][1][2]concat=n=3:v=0:a=1', wav]);
    const tramos = await tramosDeVoz(wav);
    expect(tramos).toHaveLength(2);
    expect(tramos[0]!.inicio).toBeCloseTo(0, 1);
    expect(tramos[1]!.inicio).toBeCloseTo(1.4, 1);
    const e = await nuevo();
    const r = await e.audio({ archivo: wav, frases: [{ inicio: 0, fin: 0.8, texto: 'Uno dos' }] });
    expect(r.ok).toBe(true);
    expect(existsSync(path.join(e.base, 'recursos/voz.wav'))).toBe(true);
    expect(e.proyecto().ajustes.audio.voz!.archivo).toBe('recursos/voz.wav');
  });
});
