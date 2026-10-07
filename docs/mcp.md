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
| `voz` | Carga voz o música; la voz se transcribe con whisper.cpp (local) y se arma en frases con los tiempos de las pausas |
| `importar` | Trae un SVG a la biblioteca, o de un `.pen` sus piezas reusables o una campaña completa |
| `revisar` | Revisa el video completo: zonas de las plataformas, textos fuera del lienzo o chicos y, con HyperFrames, la revisión de la composición |
| `ver_cuadro` | Hoja de 1 a 6 cuadros reducidos, con zonas tapadas y piezas resaltadas si se pide |
| `exportar` | MP4 con el mismo motor del previo |
| `versiones` | Lista el historial o vuelve a una versión |

Cambios contra el plan: `abrir_proyecto` y `versiones` se agregaron para usar el servidor sin la app.

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

## Transcripción de la voz

La voz se transcribe en la computadora con [whisper.cpp](https://github.com/ggml-org/whisper.cpp): sin API ni costo. Los cortes de frase salen de las pausas del audio (ffmpeg `silencedetect`) y el texto de whisper, palabra por palabra, se reparte entre esos tramos; los fragmentos cortos o que terminan en coma se unen al siguiente. Con la voz de Flow Sites salen las mismas 9 frases que el `.pen`, con los mismos tiempos.

El servidor busca whisper así: `MOTIONAI_WHISPER` (binario `whisper-cli`) y `MOTIONAI_WHISPER_MODELO` (`ggml-small.bin` o `ggml-base.bin`), o la carpeta `MOTIONAI_RECURSOS/whisper`. La app la incluye en `dist/recursos/whisper` (en desarrollo, `pnpm --filter @motionai/app construir` la copia si esas variables existen). Sin whisper, `voz` devuelve los tramos y Claude escribe el texto.

Para compilarlo (binario estático, sin librerías aparte):

```bash
git clone --depth 1 https://github.com/ggml-org/whisper.cpp && cd whisper.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF
cmake --build build -j --target whisper-cli
curl -L -o ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

## Importar SVG y `.pen`

Los importadores (`packages/importar`) son una puerta de entrada, no el centro: Claude crea las piezas desde cero con primitivas, y estos archivos solo sirven para traer dibujos que ya existen.

**SVG.** Cada SVG se vuelve un componente: un grupo del tamaño del `viewBox` con un trazo por figura (`path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `use`) y un texto por `<text>`. Las transformaciones se aplican a las coordenadas, los estilos salen de atributos, `style` y reglas simples de `<style>` (clase, etiqueta, id), y los degradados lineales y radiales pasan a degradados. Las fuentes que no están en el catálogo se cambian por la primera disponible. Máscaras, recortes, filtros, patrones e imágenes se omiten con un aviso.

**`.pen`** (Pencil). Por defecto se traen las piezas reusables a la biblioteca, con las que usan por dentro y las imágenes que necesitan (se copian a `recursos/`). Con `modo: "campana"` se trae una campaña completa: escenas con su animación (`entra`, `en`, `dur`, `sale`, marcas `f2+0.5`), frases, voz con su desfase, formato y duración; reemplaza las escenas del proyecto y queda como una versión, así que se puede volver. Los errores de reglas que trae el diseño original no rechazan la importación: quedan como avisos para corregirlos después.

Con Flow Sites salen las 6 escenas, las 9 frases, la voz a 0.25 s y los 28 componentes, y los cuadros coinciden con el MP4 original salvo lo que pertenece al estilo de Flow: los actores animados por código (persona, conexión, isotipo, confeti) llegan como dibujos fijos, las etiquetas conservan el papel del diseño aunque cambie su texto, la escena 1 no se desatura y el grano del papel se omite. Eso llega con el estilo de papel recortado y el kit de Flow.

## Motores

Cada proyecto elige con qué se escribe el video (`motor` en `proyecto.json`, o al crearlo con `nuevo_proyecto`):

- **`motionai`** (por defecto): piezas en el documento, con las herramientas de piezas.
- **`hyperframes`**: HTML y CSS con animaciones WAAPI en `composicion/index.html` ([HyperFrames](https://github.com/heygen-com/hyperframes), Apache 2.0). Claude edita los archivos con Read, Write y Edit, limitados a la carpeta del proyecto (`lanzarAgente` con `archivos: true`); las herramientas de piezas lo rechazan con una explicación. Antes de cada herramienta y al final de cada respuesta, la app guarda una versión con los archivos de texto de la composición, y `versiones` los restaura. `ver_cuadro` usa `hyperframes snapshot`, `exportar` usa `hyperframes render` y `revisar` junta `hyperframes check` con la medición de los textos en Chrome sin ventana (zonas de plataformas, fuera del lienzo, texto chico).

Para HyperFrames hace falta Chrome sin ventana: `MOTIONAI_CHROME`, `MOTIONAI_RECURSOS/chrome` o el de Playwright; si no hay, HyperFrames baja el suyo. Las composiciones no usan GSAP: su licencia prohíbe usarlo en herramientas para crear animaciones sin código.

