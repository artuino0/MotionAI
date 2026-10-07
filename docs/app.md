# La app de escritorio

Electron con la interfaz en Vue 3 y Pinia. La distribución sigue el montaje que ya se usaba en Flow (monitor, línea de tiempo, inspector, vistas de las apps), con el panel de Notas cambiado por el chat.

```bash
pnpm app          # construye y abre la app
pnpm fase3        # prueba de cierre: maneja la app con Playwright y Claude real (salida/fase3/)
```

## Pantallas

- **Inicio:** revisa que Claude Code esté instalado y con sesión (`claude --version`, `claude auth status`) y, si falta algo, dice qué hacer. Crea proyectos (nombre, formato, duración, fps) y abre recientes o cualquier `proyecto.json`. Los proyectos nuevos van a `Documentos/MotionAI/` (o `MOTIONAI_CARPETA`).
- **Barra:** nombre, formato, duración, escenas, piezas, versión, Ajustes de proyecto y Exportar MP4 con barra de progreso.
- **Medios (izquierda):** escenas con miniatura, árbol de piezas por escena, biblioteca de componentes y frases de la voz.
- **Monitor (centro):** reproducción en vivo con el mismo motor del MP4, audio sincronizado, saltos de escena y vistas «Como en TikTok / Reels / Facebook», que simulan la interfaz de cada app y sombrean lo que tapa. Un clic sobre una pieza la selecciona y la agrega al mensaje.
- **Chat (derecha):** conversación con Claude en streaming. Muestra qué herramienta está usando, cuántos cambios rechazó el validador, la versión que dejó cada respuesta y un botón para deshacerla. Los chips de lo que tocaste viajan con el mensaje.
- **Inspector:** datos de la pieza seleccionada o del proyecto. Solo lectura.
- **Historial:** todas las versiones con lo que cambió; volver a una también queda como versión.
- **Línea de tiempo (abajo):** pistas de Texto (frases), Piezas (de cuándo a cuándo se ve cada una), Principal (escenas con miniaturas) y Audio. Arrastrar en la regla mueve el cabezal; un clic en un clip lo agrega al mensaje. No se arrastran ni se recortan clips.
- **Ajustes de proyecto:** formato, fps, duración, plataformas, subtítulos, audio y exportación. Es el único lugar con campos editables; lo que se guarda pasa por los mismos validadores que los cambios de Claude.

## Cómo se conecta con Claude

```
Interfaz (Vue) ──IPC── Proceso principal ──┬── Estudio (documento, reglas, versiones, render)
                                           ├── socket local ◄── servidor MCP ◄── Claude Code (claude -p)
                                           └── lanza Claude Code por proyecto (--resume)
```

1. El proceso principal abre el proyecto en un `Estudio` y lo sirve por un socket local (`/tmp/motionai-<pid>.sock`, o un named pipe en Windows).
2. Al enviar un mensaje lanza `claude -p` con `--tools ""` (sin archivos, terminal ni web), el servidor MCP de la app y `--resume` con la sesión del proyecto (guardada en `.motionai/chat.json`).
3. Claude Code arranca el servidor MCP con el Node de Electron (`ELECTRON_RUN_AS_NODE`); el servidor le pasa cada herramienta a la app por el socket.
4. Cada cambio aplicado avisa a la interfaz, que redibuja el monitor y la línea de tiempo al instante. `leer_estado` incluye el segundo que ve el usuario, su selección y las referencias del mensaje.
5. En la app, Claude no puede crear ni abrir otros proyectos: eso lo decide el usuario.

## Archivos del proyecto

```
mi-proyecto/
  proyecto.json          el documento
  recursos/              fuentes, imágenes, voz y música
  exportados/            los MP4
  .motionai/historial.db versiones (SQLite)
  .motionai/chat.json    conversación y sesión de Claude Code
```
