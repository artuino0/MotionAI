import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { PuertoLocal, crearServidor, puertoRemoto, servirPuerto } from '../src/index.js';
import { argumentosClaude, registrarHerramientas, INSTRUCCIONES } from '../src/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

async function conectar(remoto = false) {
  const carpeta = await mkdtemp(path.join(os.tmpdir(), 'mcp-'));
  let server: McpServer;
  if (remoto) {
    // Como en la app: el proyecto vive en otro proceso y el servidor MCP le habla por un socket.
    const local = new PuertoLocal(carpeta);
    const { ruta } = await servirPuerto(local, path.join(carpeta, 'app.sock'));
    server = new McpServer({ name: 'motionai', version: '0' }, { instructions: INSTRUCCIONES });
    registrarHerramientas(server, puertoRemoto(ruta));
  } else {
    server = (await crearServidor({ carpetaProyectos: carpeta })).server;
  }
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'prueba', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const llamar = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args });
    const content = r.content as { type: string; text?: string; data?: string }[];
    return { error: !!r.isError, texto: content.filter((c) => c.type === 'text').map((c) => c.text).join('\n'), content };
  };
  return { client, llamar, carpeta };
}

describe('servidor MCP', () => {
  it('expone las herramientas del plan', async () => {
    const { client } = await conectar();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'abrir_proyecto', 'agregar_pieza', 'ajustes_proyecto', 'buscar_biblioteca', 'cambiar', 'crear_pieza', 'escenas',
      'exportar', 'importar', 'leer_estado', 'leer_proyecto', 'leer_skill', 'nuevo_proyecto', 'quitar_pieza', 'revisar', 'ver_cuadro', 'versiones', 'voz',
    ]);
    expect(client.getInstructions()).toMatch(/leer_skill/);
  });

  it.each([false, true])('flujo completo (por socket: %s): crear, agregar, rechazar, cambiar, ver y exportar', async (remoto) => {
    const { llamar, carpeta } = await conectar(remoto);
    expect((await llamar('leer_estado')).texto).toMatch(/No hay proyecto/);
    expect((await llamar('agregar_pieza', { pieza: { id: 'a', tipo: 'rect' } })).error).toBe(true);
    expect((await llamar('leer_skill', { tema: 'inicio' })).texto).toMatch(/Cómo trabajar/);
    expect((await llamar('leer_skill', { tema: 'documento' })).texto).toMatch(/El documento de MotionAI/);
    expect((await llamar('leer_skill', { tema: 'fuentes' })).texto).toMatch(/Bebas Neue/);

    const nuevo = await llamar('nuevo_proyecto', { nombre: 'Café Luna', duracion: 3, formato: '1:1' });
    expect(nuevo.error).toBe(false);
    expect(nuevo.texto).toContain(path.join(carpeta, 'cafe-luna'));

    const malo = await llamar('agregar_pieza', { pieza: { id: 't', tipo: 'texto', texto: 'Hola', tamano: 80 } });
    expect(malo.error).toBe(true);
    expect(malo.texto).toMatch(/pieza\.fuente/);

    const bien = await llamar('agregar_pieza', {
      pieza: { id: 't', tipo: 'texto', texto: 'Hola', fuente: 'Caveat', tamano: 120, x: '50%', y: '50%', ancla: 'centro', animacion: { entra: { tipo: 'pop', en: 0.2 } } },
    });
    expect(bien.texto).toMatch(/✓ Versión 2/);
    expect((await llamar('cambiar', { cambios: [{ id: 't', relleno: '#6B3E26' }] })).texto).toMatch(/Versión 3/);
    expect((await llamar('leer_proyecto')).texto).toMatch(/- t \(texto "Hola" Caveat 120px\)/);
    expect((await llamar('leer_proyecto', { id: 't' })).texto).toMatch(/"relleno": "#6B3E26"/);

    const vista = await llamar('ver_cuadro', { tiempos: [0.5, 2] });
    expect(vista.content[0]!.type).toBe('image');
    expect(Buffer.from(vista.content[0]!.data!, 'base64').subarray(1, 4).toString()).toBe('PNG');

    const exp = await llamar('exportar', {});
    expect(exp.texto).toMatch(/✓ Exporté .*cafe_luna\.mp4 · 90 cuadros/);
    expect((await llamar('versiones')).texto).toMatch(/^3 · .* cambiar/);
  }, 60_000);
});

describe('lanzar Claude', () => {
  it('pasa el modelo y el esfuerzo solo si se eligen', () => {
    const base = { mensaje: 'hola', carpetaProyectos: '/tmp' };
    const con = argumentosClaude({ ...base, modelo: 'opus', esfuerzo: 'high' }, '/tmp/mcp.json');
    expect(con.slice(con.indexOf('--model'), con.indexOf('--model') + 2)).toEqual(['--model', 'opus']);
    expect(con.slice(con.indexOf('--effort'), con.indexOf('--effort') + 2)).toEqual(['--effort', 'high']);
    const archivos = argumentosClaude({ ...base, archivos: true }, '/tmp/mcp.json');
    expect(archivos.slice(archivos.indexOf('--tools'), archivos.indexOf('--tools') + 2)).toEqual(['--tools', 'Read,Write,Edit,Glob,Grep']);
    expect(archivos).toContain('acceptEdits');
    expect(con.slice(con.indexOf('--tools'), con.indexOf('--tools') + 2)).toEqual(['--tools', '']);
    const sin = argumentosClaude(base, '/tmp/mcp.json');
    expect(sin).not.toContain('--model');
    expect(sin).not.toContain('--effort');
  });
});

describe('exportar sin bloquear', () => {
  it('devuelve el avance mientras exporta y el resultado una sola vez', async () => {
    const carpeta = await mkdtemp(path.join(os.tmpdir(), 'mcp-exp-'));
    const p = new PuertoLocal(carpeta);
    await p.nuevo({ nombre: 'Corto', duracion: 1 });
    const primero = await p.exportarEnFondo({}, 0);
    expect(primero.estado).toBe('en-curso');
    let e = primero;
    for (let i = 0; i < 60 && e.estado === 'en-curso'; i++) e = await p.exportarEnFondo({}, 1000);
    expect(e.estado).toBe('listo');
    if (e.estado === 'listo') expect(e.resultado.segundos).toBe(1);
    // Entregado el resultado, la siguiente llamada empieza otra exportación.
    expect((await p.exportarEnFondo({}, 0)).estado).toBe('en-curso');
  }, 90_000);
});

