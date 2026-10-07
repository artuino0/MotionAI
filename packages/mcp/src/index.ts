import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Estudio } from '@motionai/estudio';
import { INSTRUCCIONES, registrarHerramientas, type Sesion } from './herramientas.js';

export { registrarHerramientas, INSTRUCCIONES, type Sesion } from './herramientas.js';

export async function crearServidor(op: { proyecto?: string; carpetaProyectos: string }): Promise<{ server: McpServer; sesion: Sesion }> {
  const sesion: Sesion = { carpetaProyectos: op.carpetaProyectos };
  if (op.proyecto) sesion.estudio = await Estudio.abrir(op.proyecto);
  const server = new McpServer({ name: 'motionai', version: '0.1.0' }, { instructions: INSTRUCCIONES });
  registrarHerramientas(server, sesion);
  return { server, sesion };
}
export { lanzarAgente, argumentosClaude, configuracionMcp, leerRenglon, type EventoAgente, type OpcionesAgente } from './agente.js';
