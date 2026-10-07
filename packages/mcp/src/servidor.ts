#!/usr/bin/env -S npx tsx
/**
 * Servidor MCP de MotionAI por stdio.
 *
 *   motionai-mcp [--proyecto ruta/proyecto.json] [--carpeta carpeta-de-proyectos] [--socket ruta]
 *
 * También lee MOTIONAI_PROYECTO, MOTIONAI_CARPETA y MOTIONAI_SOCKET. Con socket, atiende las herramientas
 * en la app abierta. Sin proyecto, Claude puede crear uno con nuevo_proyecto.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { crearServidor } from './index.js';

const { values } = parseArgs({
  options: { proyecto: { type: 'string' }, carpeta: { type: 'string' }, socket: { type: 'string' } },
});

const { server } = await crearServidor({
  socket: values.socket ?? process.env.MOTIONAI_SOCKET,
  proyecto: values.proyecto ?? process.env.MOTIONAI_PROYECTO,
  carpetaProyectos: path.resolve(values.carpeta ?? process.env.MOTIONAI_CARPETA ?? path.join(process.cwd(), 'proyectos')),
});
await server.connect(new StdioServerTransport());
