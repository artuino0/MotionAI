# Servidor MCP

El servidor MCP es la única puerta de Claude al documento. Corre por stdio, abre un proyecto (o crea uno) y expone las herramientas de abajo. Cada cambio se valida contra el esquema, el motor y las reglas antes de guardarse, y queda como una versión en `.motionai/historial.db` junto al proyecto.

## Conectarlo

Desde la raíz del repositorio (después de `pnpm install`):

```bash
pnpm mcp --carpeta ~/MotionAI/proyectos            # proyectos nuevos van aquí
pnpm mcp --proyecto ~/MotionAI/proyectos/cafe-luna/proyecto.json
```

**Claude Code** (terminal), solo con las herramientas de la app:

```bash
claude --mcp-config '{"mcpServers":{"motionai":{"command":"pnpm","args":["--dir","/ruta/a/MotionAI","-s","mcp","--carpeta","/ruta/a/proyectos"]}}}' \
  --strict-mcp-config --tools "" --allowedTools mcp__motionai
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "motionai": {
      "command": "pnpm",
      "args": ["--dir", "/ruta/a/MotionAI", "-s", "mcp", "--carpeta", "/ruta/a/proyectos"]
    }
  }
}
```

Para ver el resultado mientras Claude trabaja: `pnpm visor` y abre `http://localhost:5173/?proyecto=…`, o pídele a Claude que exporte.

## Herramientas

| Herramienta | Qué hace |
| --- | --- |
| `leer_skill` | Guías: `inicio` (cómo trabajar), `diseno` (principios de motion y recetas), `documento` (formato), `fuentes` |
| `leer_estado` | Proyecto abierto, versión, formato, escenas; tiempo, selección y referencias cuando la app esté conectada |
| `leer_proyecto` | Resumen legible, el JSON completo, o una pieza por id |
| `nuevo_proyecto` | Proyecto vacío con formato y duración |
| `abrir_proyecto` | Abre un proyecto existente |
| `ajustes_proyecto` | Cambia ajustes (formato, fps, subtítulos, audio, exportación…) |
| `crear_pieza` | Diseña un componente con primitivas y lo guarda en la biblioteca |
| `agregar_pieza` | Pone una primitiva, un grupo o una instancia en una escena |
| `cambiar` | Lote de cambios por id a piezas, escenas o componentes; mezcla la animación por partes; cambia capas |
| `quitar_pieza` | Saca piezas o componentes sin usar |
| `buscar_biblioteca` | Componentes por texto o tipo |
| `escenas` | Crear, quitar, partir y mover cortes |
| `voz` | Carga voz o música; con voz detecta los tramos con habla por pausas y pone las frases |
| `ver_cuadro` | Hoja de 1 a 6 cuadros reducidos, con zonas tapadas y piezas resaltadas si se pide |
| `exportar` | MP4 con el mismo motor del previo |
| `versiones` | Lista el historial o vuelve a una versión |

Cambios contra el plan: `importar` (SVG y `.pen`) llega en la fase 4 con los importadores; `abrir_proyecto` y `versiones` se agregaron para usar el servidor sin la app.

## Reglas que revisa

Las reglas se revisan con el motor: se recorre el video cada 0.2 s midiendo dónde queda cada pieza. Un cambio se rechaza solo por errores que ese cambio provoca; los que ya existían se reportan como aviso.

| Regla | Tipo | Qué revisa |
| --- | --- | --- |
| `zona-tapada` | Error | Un texto en reposo, o un subtítulo, debajo de la interfaz de una plataforma activa (solo 9:16) |
| `fuera-del-lienzo` | Error | Un texto en reposo que se sale del lienzo |
| `escenas` | Error / aviso | Escenas encimadas (error); huecos sin escena (aviso) |
| `texto-chico` | Aviso | Un texto que se ve de menos de 28 px en un lienzo de 1080 |
| `subtitulo-encima` | Aviso | Un subtítulo que tapa un texto |
| `subtitulo-duplicado` | Aviso | Una frase que ya está escrita en un letrero (sugiere `subtitulo: false`) |
| `nunca-se-ve` | Aviso | Una pieza que entra después de que su escena terminó |

«En reposo» quiere decir que ni la pieza ni sus contenedores están entrando o saliendo: un texto puede cruzar una zona mientras se desliza.

## Lanzar Claude desde la app

`lanzarAgente` (en `packages/mcp/src/agente.ts`) es el puente que usará la app: lanza `claude -p` con el servidor MCP, `--tools ""` (sin archivos, terminal ni web) y `--allowedTools mcp__motionai`, continúa la sesión del proyecto con `--resume` y traduce la salida en streaming a eventos (`inicio`, `texto`, `herramienta`, `resultado`, `fin`).

La prueba de cierre de la fase 2 lo usa: `pnpm fase2 ["brief"]` deja el proyecto, el MP4, una hoja de cuadros y la bitácora de lo que hizo Claude en `salida/fase2/`.
