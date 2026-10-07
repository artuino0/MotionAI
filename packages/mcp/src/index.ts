import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { INSTRUCCIONES, registrarHerramientas } from './herramientas.js';
import { PuertoLocal, type PuertoEstudio } from './puerto.js';
import { puertoRemoto } from './rpc.js';

export { registrarHerramientas, INSTRUCCIONES } from './herramientas.js';
export * from './puerto.js';
export { servirPuerto, puertoRemoto, rutaSocket } from './rpc.js';
export { lanzarAgente, argumentosClaude, configuracionMcp, leerRenglon, revisarClaude, type EventoAgente, type OpcionesAgente, type EstadoClaude } from './agente.js';

/**
 * Servidor MCP. Con `socket`, cada herramienta se atiende en la app abierta; si no, el servidor
 * abre el proyecto por su cuenta (para Claude Desktop o la terminal sin la app).
 */
export async function crearServidor(op: { proyecto?: string; carpetaProyectos: string; socket?: string }): Promise<{ server: McpServer; puerto: PuertoEstudio }> {
  let puerto: PuertoEstudio;
  if (op.socket) puerto = puertoRemoto(op.socket);
  else {
    const local = new PuertoLocal(op.carpetaProyectos);
    if (op.proyecto) await local.abrir(op.proyecto);
    puerto = local;
  }
  const server = new McpServer({ name: 'motionai', version: '0.1.0' }, { instructions: INSTRUCCIONES });
  registrarHerramientas(server, puerto);
  return { server, puerto };
}
