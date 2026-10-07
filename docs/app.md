# La app de escritorio

Electron con la interfaz en Vue 3 y Pinia, en español y en inglés (selector ES/EN en Inicio y en la barra; Claude responde en el idioma de la interfaz). La distribución sigue el montaje que ya se usaba en Flow (monitor, línea de tiempo, inspector, vistas de las apps), con el panel de Notas cambiado por el chat. El contexto de producto para diseño está en [`packages/app/PRODUCT.md`](../packages/app/PRODUCT.md).

```bash
pnpm app          # construye y abre la app
pnpm fase3        # prueba de cierre: maneja la app con Playwright y Claude real (salida/fase3/)
```

## Pantallas

- **Inicio:** revisa que Claude Code esté instalado y con sesión (`claude --version`, `claude auth status`) y, si falta algo, dice qué hacer. Crea proyectos (nombre, formato, duración y, si quieres, el brief, que se manda a Claude al abrir) y abre recientes o cualquier `proyecto.json`. Los proyectos nuevos van a `Documentos/MotionAI/` (o `MOTIONAI_CARPETA`).
- **Barra:** nombre, resumen (formato, duración, escenas; abre los ajustes), versión (abre el historial), idioma, ayuda, Ajustes y Exportar MP4 con barra de progreso. Exportar espera a que haya video y a que Claude termine; al terminar queda un aviso con Reproducir y Mostrar en carpeta.
- **Medios (izquierda):** escenas con miniatura, árbol de piezas por escena, biblioteca de componentes y frases de la voz. En Frases, «Cargar voz…» elige un audio y lo transcribe en la computadora (frases y subtítulos listos en segundos); «Cargar música…» agrega la música. Si la voz dura más que el video, avisa.
- **Monitor (centro):** reproducción en vivo con el mismo motor del MP4, audio sincronizado, saltos de escena y vistas «Como en TikTok / Reels / Facebook», que simulan la interfaz de cada app y rayan lo que tapa. Un clic sobre una pieza la selecciona y la agrega al mensaje. Mientras Claude trabaja, el monitor lo sigue: va a la escena que cambia, marca la pieza en ámbar y avisa «Claude está cambiando: …» (deja de seguirlo si el usuario mueve el cabezal). El primer video se reproduce solo al terminar.
- **Chat (derecha):** conversación con Claude en streaming, con ejemplos de brief cuando está vacío. Muestra qué está haciendo Claude en palabras («Agregando una pieza…»), cuántas cosas ajustó para cumplir las reglas, la versión que dejó cada respuesta, «Ver resultado» y Deshacer. Los chips de lo que señalaste viajan con el mensaje, con el nombre de la pieza, su escena y el segundo.
- **Inspector:** datos de la pieza seleccionada o del proyecto. Solo lectura.
- **Historial:** todas las versiones con lo que cambió; volver a una también queda como versión.
- **Línea de tiempo (abajo, plegable):** pistas de Voz (frases), Piezas (de cuándo a cuándo se ve cada una, con leyenda de colores), Escenas (con miniatura) y Música. Arrastrar en la regla mueve el cabezal; Ctrl+rueda hace zoom; un clic en una pieza la agrega al mensaje. No se arrastran ni se recortan clips.
- **Ajustes de proyecto:** formato, fps, duración, plataformas, subtítulos, audio y exportación (calidad Alta, Equilibrada o Archivo chico; lo técnico en «Opciones avanzadas»). Es el único lugar con campos editables; lo que se guarda pasa por los mismos validadores que los cambios de Claude. Avisa antes de descartar cambios sin guardar.

## Atajos

Espacio reproduce o pausa; ←/→ un cuadro (con Shift, un segundo); ↑/↓ escena anterior o siguiente; Inicio/Fin; J/K/L; Ctrl+Z y Ctrl+Shift+Z deshacen y rehacen versiones; Ctrl+E exporta; Ctrl+, abre los ajustes; Esc quita la selección o cierra; ? muestra la hoja de atajos y un glosario.

En la interfaz las piezas se llaman por lo que se ve (su texto, la pieza reusable de la que son copia, o su tipo); los ids solo aparecen en «Detalles técnicos» del inspector.

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
