import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Estudio, armarFrases, encontrarWhisper, tramosDeVoz, transcribir } from '../src/index.js';

const RAIZ = path.resolve(import.meta.dirname, '../../..');
const VOZ = path.join(RAIZ, 'referencia/flow-sites/recursos/voz_sites.mp3');

describe('frases de la voz', () => {
  it('reparte las palabras en los tramos y une los fragmentos cortos o con coma', () => {
    const tramos = [{ inicio: 0, fin: 1.2 }, { inicio: 1.6, fin: 3 }, { inicio: 3.5, fin: 6 }, { inicio: 6.4, fin: 6.8 }, { inicio: 7.1, fin: 9 }];
    const p = (texto: string, inicio: number) => ({ texto, inicio, fin: inicio + 0.3 });
    const palabras = [
      p('¿Tienes', 0.1), p('web,', 0.8), p('pero', 1.7), p('nadie?', 2.5),
      p('Con', 3.6), p('Flow', 4.2), p('todo', 5.5), p('cambia.', 5.6),
      p('Flow,', 6.45), p('tu', 7.2), p('negocio.', 8.5),
    ];
    const f = armarFrases(palabras, tramos, 0.25);
    expect(f.map((x) => x.texto)).toEqual(['¿Tienes web, pero nadie?', 'Con Flow todo cambia.', 'Flow, tu negocio.']);
    expect(f[0]).toMatchObject({ inicio: 0.25, fin: 3.25 });
    expect(f[2]).toMatchObject({ inicio: 6.65, fin: 9.25 });
  });

  it('regresa a su frase la palabra que cierra la oración anterior', () => {
    const tramos = [{ inicio: 0, fin: 2 }, { inicio: 2.5, fin: 5 }];
    const p = (texto: string, inicio: number) => ({ texto, inicio, fin: inicio + 0.2 });
    const f = armarFrases([p('se', 0.5), p('envían', 1), p('a', 1.4), p('tu', 1.7), p('panel.', 2.3), p('Cuando', 2.8), p('alguien', 3.5)], tramos);
    expect(f.map((x) => x.texto)).toEqual(['se envían a tu panel.', 'Cuando alguien']);
  });
});

// Con whisper instalado (MOTIONAI_WHISPER y MOTIONAI_WHISPER_MODELO), se prueba con la voz real de Flow Sites.
const whisper = encontrarWhisper();
describe.skipIf(!whisper)('transcripción con whisper.cpp', () => {
  it('reproduce los cortes de frase del video de Flow Sites', async () => {
    const pen = JSON.parse(readFileSync(path.join(RAIZ, 'referencia/flow-sites/FlowSites.pen'), 'utf8'));
    const meta = pen.children[0].metadata as { offset: number; frases: [number, number, string][] };
    const [tramos, { palabras, idioma }] = await Promise.all([tramosDeVoz(VOZ), transcribir(VOZ, whisper!)]);
    expect(idioma).toBe('es');
    const frases = armarFrases(palabras, tramos, meta.offset);
    expect(frases).toHaveLength(meta.frases.length);
    frases.forEach((f, i) => {
      expect(f.inicio).toBeCloseTo(meta.frases[i]![0], 1);
      expect(f.fin).toBeCloseTo(meta.frases[i]![1], 1);
    });
    expect(frases[0]!.texto).toMatch(/página web.*nadie la actualiza/i);
    expect(frases[3]!.texto).toMatch(/datos.*panel\.$/i);
    expect(frases[8]!.texto).toMatch(/tu negocio en un solo flujo/i);
  }, 120_000);

  it('la herramienta voz transcribe al cargar', async () => {
    const e = await Estudio.crear({ carpeta: path.join(await mkdtemp(path.join(os.tmpdir(), 'voz-')), 'p'), nombre: 'Voz', duracion: 30 });
    const r = await e.audio({ archivo: VOZ, inicio: 0.25 });
    expect(r.ok).toBe(true);
    expect(r.transcripcion).toBe('whisper');
    expect(e.proyecto().frases).toHaveLength(9);
  }, 120_000);
});
