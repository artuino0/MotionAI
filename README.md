# MotionAI

App de escritorio para hacer motion graphics pidiéndoselos a Claude en un chat. La app pone el lienzo, el motor de render y las herramientas (MCP); la inteligencia la pone el Claude Code del usuario, con su propia suscripción.

- [Plan del producto](docs/PLAN.md): ese plan, el esquema del documento y el contrato de las herramientas son la fuente de la verdad.
- [El documento](docs/documento.md): formato de los proyectos.
- [Servidor MCP](docs/mcp.md): herramientas, reglas y cómo conectarlo a Claude.
- [La app](docs/app.md): pantallas y cómo se conecta con Claude.

## Estado

- Fase 1 (motor y documento) lista: esquema del documento con ajustes de proyecto, motor de render con primitivas, keyframes y estilo plano, exportación a MP4 en Node y un visor en el navegador.
- Fase 2 (herramientas MCP) lista: servidor MCP con 16 herramientas, validadores de reglas, historial de versiones en SQLite, catálogo de fuentes libres y el puente que lanza Claude Code solo con las herramientas de la app.
- Fase 3 (app) lista: app de escritorio en Electron con monitor en vivo, línea de tiempo, chat con Claude Code, inspector, historial de versiones, ajustes de proyecto y exportación. Claude edita el mismo documento que ve el usuario a través de un socket local.
- Fase 4 en curso: voz con whisper.cpp lista (transcripción local en frases con los tiempos de las pausas) e importadores de SVG y `.pen` listos (Flow Sites entra completo: escenas, animación, frases, voz y sus 28 piezas). Siguen el estilo de papel recortado y los kits de marca.

## Paquetes

| Paquete | Qué hace |
| --- | --- |
| `packages/documento` | Esquema del proyecto (zod), ajustes, formatos, tiempos y zonas tapadas por plataforma |
| `packages/motor` | Motor de render sobre Canvas 2D; corre igual en el navegador y en Node |
| `packages/render` | Render en Node con skia-canvas, exportación a MP4 con ffmpeg y la línea de comandos |
| `packages/visor` | Visor web para reproducir un proyecto (Vite) |
| `packages/estudio` | Proyecto abierto: aplica cambios validados, reglas de redes, versiones, fuentes, vistas y voz |
| `packages/importar` | Importadores de SVG y `.pen` (piezas o campañas completas) |
| `packages/mcp` | Servidor MCP por stdio (solo o conectado a la app por socket), guías para Claude y el lanzador de Claude Code |
| `packages/app` | App de escritorio: Electron, Vue 3 y Pinia |

## Requisitos

Node 22, pnpm 10 y ffmpeg con libx264 (y libx265 para H.265).

```bash
pnpm install
```

## Comandos

```bash
pnpm motionai validar ejemplos/demo/proyecto.json
pnpm motionai cuadro  ejemplos/demo/proyecto.json 2.5,6 --dir salida/cuadros [--formato 16:9]
pnpm motionai render  ejemplos/demo/proyecto.json salida/demo.mp4 [--formato 16:9] [--desde 0 --hasta 3]

pnpm visor        # abre http://localhost:5173/?proyecto=/ejemplos/demo/proyecto.json
pnpm test         # pruebas unitarias
pnpm typecheck
pnpm paridad      # prueba de cierre de la fase 1: navegador vs Node vs MP4, en 9:16 y 16:9
pnpm mcp --carpeta proyectos   # servidor MCP por stdio (ver docs/mcp.md)
pnpm fase2 ["brief"]           # prueba de cierre de la fase 2: Claude hace un video desde un brief
pnpm app                       # construye y abre la app de escritorio
pnpm fase3 ["brief"]           # prueba de cierre de la fase 3: maneja la app con Playwright y Claude real
```

`pnpm paridad` necesita Chromium: usa `/opt/pw-browsers/chromium` si existe, la variable `CHROMIUM`, o el que instala `pnpm exec playwright-core install chromium`. Deja el reporte y las imágenes de diferencias en `salida/paridad/`.
