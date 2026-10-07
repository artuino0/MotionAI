# Plan · Estudio de motion con IA

Oct 7, 2026 · @Arturo Munoz · revisión 2

## Resumen

Una app de escritorio para que cualquier persona haga motion graphics pidiéndoselos a Claude en un chat. Es para creadores, agencias y negocios que necesitan videos cortos para redes sin saber animar. La app pone el lienzo, el motor de render y las herramientas; la inteligencia la pone el Claude Code del usuario, con su propia suscripción. Es el mismo modelo de pen.dev: la app no trae IA ni cobra tokens.

- **Qué hace:** Claude crea el video completo desde una idea: diseña las piezas, las anima, arma las escenas y lo exporta. La app lo muestra en vivo (monitor, línea de tiempo, inspector y vistas de TikTok, Reels y Facebook).
- **Qué no hace:** no deja mover, escribir ni arrastrar piezas a mano. Los cambios al contenido pasan por el chat.
- **Costo de IA:** cero aparte. Cada usuario usa su Claude Pro o Max.
- **Nombre de trabajo:** MotionAI (el del repositorio), por definir.

## Qué cambió en esta revisión

La primera versión del plan estaba escrita alrededor de una forma de trabajar: piezas dibujadas en Pencil, guardadas en un `.pen`, con el estilo de papel recortado y las reglas de Flow. Eso es un caso de uso, no el producto.

| Antes | Ahora |
| --- | --- |
| El documento es un `.pen` | El documento es un formato propio y abierto; `.pen` es un importador opcional |
| Las piezas se diseñan fuera; Claude no inventa piezas | Claude crea las piezas desde cero con primitivas vectoriales; importar `.pen` o SVG es una opción más |
| El motor de papel recortado es el motor | El motor es genérico; papel recortado es uno de varios estilos |
| La fase 1 es igualar el motor de Python | La fase 1 es el motor genérico; igualar el papel recortado es una prueba de un estilo |
| Las reglas de Flow vienen en la tabla de reglas | Las reglas de marca viven en kits opcionales; Flow es un kit de ejemplo |

## La fuente de la verdad

La fuente de la verdad del producto es **este plan, el esquema del documento y el contrato de las herramientas MCP**. Nada más.

- **Flow** es el primer proyecto de prueba. Sirve para comprobar que el producto aguanta un caso real, no para decidir cómo funciona.
- **El motor de Python** (pycairo, papel recortado) es la referencia visual del estilo de papel recortado. No define la arquitectura, el formato ni el modelo de animación.
- **Pencil y `.pen`** son una integración: quien ya diseña ahí puede traer sus piezas. Nadie necesita Pencil para usar la app.

Si una decisión del producto solo se justifica por cómo se trabaja hoy en Flow, se descarta o se mueve al kit de Flow.

## Cómo lo hace pen.dev y qué tomamos

pen.dev no tiene IA propia: le pide al usuario instalar Claude Code y autenticarse con `claude`, y le da a ese agente herramientas por MCP para mover su lienzo. Copiamos ese modelo de conexión; el formato y el motor son nuestros.

| Pieza de pen.dev | Cómo funciona allá | Qué hacemos aquí |
| --- | --- | --- |
| Formato `.pen` | JSON con esquema abierto | Formato propio en JSON con esquema abierto, pensado para animación; importa `.pen` |
| Lienzo | App web con render propio en WebGL | App web con el motor de render en Canvas 2D |
| Shell | App de escritorio y extensión de VS Code | App de escritorio (Electron) |
| Puente con la app | MCP por stdio que habla con la app abierta por socket local o named pipe | Igual: MCP por stdio + canal local hacia la app |
| Herramientas | `get_app_state`, `execute`, `get_style`, `read_skill`… | Herramientas de motion propias (sección de herramientas) |
| Agente | Claude Code o Codex del usuario, con su sesión | Claude Code del usuario, con su suscripción |
| Chat | Compositor dentro de la app, o desde el agente externo | Chat dentro de la app; también desde Claude Desktop o la terminal |

Fuente: [Pencil · AI integration](https://docs.pencil.dev/ai-integration), [pen.dev](https://www.pen.dev/).

## Principios

1. **Claude crea, no solo acomoda.** Con las herramientas de la app, Claude puede hacer un video completo sin ningún archivo previo: formas, textos, personajes simples, gráficas y su animación. Importar piezas hechas fuera es opcional.
2. **La suscripción, no la API.** La app nunca guarda llaves ni llama a la API. Lanza el Claude Code instalado del usuario, que ya tiene su sesión iniciada.
3. **Cero edición manual del contenido.** La interfaz muestra, selecciona y conversa. Hacer clic en una pieza la agrega al mensaje como referencia; no la mueve. Los ajustes de proyecto son la excepción (ver «Ajustes de proyecto»).
4. **Claude solo usa nuestras herramientas.** Se le lanza con las herramientas de archivos y terminal bloqueadas, así no puede tocar el documento por fuera.
5. **Comandos, no reescrituras.** Cada herramienta es un cambio chico y validado. Cada respuesta del chat queda como una versión; deshacer es volver a la anterior.
6. **Un solo motor.** El mismo código dibuja el previo en vivo y el MP4 final. Lo que ves es lo que sale.
7. **Local primero.** Todo corre en la computadora del usuario: documento, render, voz y exportación. Sin servidor ni costo de operación.
8. **Nada atado a una marca ni a un estilo.** Estilos, kits de marca e importadores son módulos. El núcleo no sabe de Flow, de Pencil ni de papel recortado.
9. **La marca se defiende en código, cuando hay marca.** Si un proyecto carga un kit, sus reglas viven en la skill que lee Claude y en validadores que rechazan un cambio que las rompa. Sin kit, solo aplican las reglas generales de redes.

## Arquitectura

```
┌───────────────────────── App de escritorio (Electron) ─────────────────────────┐
│                                                                                │
│  Interfaz (Vue)                    Proceso principal (Node)                    │
│  ┌──────────────────────┐          ┌───────────────────────────────────────┐   │
│  │ Monitor · Timeline   │  IPC     │ Documento + historial (SQLite)        │   │
│  │ Chat · Ajustes       │◄────────►│ Motor de render (Canvas 2D)           │   │
│  │ Motor en el navegador│          │ Exportación (skia-canvas + ffmpeg)    │   │
│  └──────────────────────┘          │ Lanzador de Claude Code               │   │
│                                    │ Canal local ◄──┐                      │   │
│                                    └────────────────┼──────────────────────┘   │
└─────────────────────────────────────────────────────┼──────────────────────────┘
                                                      │ socket / named pipe
                       Claude Code del usuario ── MCP (stdio) ── servidor MCP de la app
```

La interfaz no habla con la IA: le pide al proceso principal, que lanza Claude Code con las herramientas de la app. Claude solo cambia el documento a través del MCP, y el motor vuelve a dibujar al instante.

## Stack

Todo en TypeScript, salvo ffmpeg y Whisper, que se llaman como programas.

| Capa | Tecnología | Por qué |
| --- | --- | --- |
| App de escritorio | Electron | Trae Node: lanza Claude Code, corre el MCP y skia-canvas sin piezas extra |
| Interfaz | Vue 3 + Pinia + Vite | Stack conocido; el montaje HTML actual sirve de punto de partida |
| Motor de render | TypeScript sobre la API Canvas 2D | Corre igual en el navegador y en Node |
| Render del MP4 | skia-canvas (Node) + ffmpeg | Misma API Canvas que el navegador: mismo resultado |
| Puente con la IA | Claude Code CLI (`claude -p`, stream-json) | Usa la sesión y la suscripción del usuario |
| Herramientas | MCP SDK de TypeScript + zod | Esquemas tipados y validados |
| Documento | JSON propio con esquema zod + historial en SQLite | Archivo portátil; versiones y deshacer locales |
| Voz | ffmpeg (pausas) + whisper.cpp local | Frases con tiempos exactos, sin pagar API |
| Importadores | SVG primero; `.pen` después; Lottie si hace falta | Opcionales: traen piezas hechas en otro lado |
| Empaquetado | electron-builder (Windows primero) | Un instalador; Mac después |

## El documento

Un proyecto es un archivo JSON con esquema abierto y versionado, y una carpeta `recursos/` a su lado (voz, música, imágenes, fuentes).

- **Proyecto:** ajustes (formato, fps, audio, exportación), kit de marca opcional y estilo por defecto.
- **Escenas:** cada una con su inicio y fin en la línea de tiempo y sus capas.
- **Piezas:** árbol de nodos con primitivas vectoriales: rectángulo, elipse, trazo (path SVG), texto, imagen y grupo. Cada nodo tiene transformación, relleno, contorno, opacidad y máscara.
- **Componentes:** piezas guardadas en la biblioteca del proyecto para reusarlas, con nombre, tipo, tamaño, ancla y una nota de movimiento. Las crea Claude o llegan por un importador.
- **Animación:** pistas de keyframes por propiedad (posición, escala, rotación, opacidad, color, recorte de trazo, texto) con curvas de suavizado. Los movimientos comunes (`pop`, `cae`, `sube`, `desliza`, `crece`, `dibuja`, salida por corte) son atajos que se expanden a keyframes.
- **Tiempo:** segundos o referencias a marcas de la voz (por ejemplo `f3+0.8`: 0.8 s después de que empieza la frase 3), así un cambio de voz no rompe la animación.
- **Piezas procedurales:** piezas con comportamiento propio y parámetros: confeti, conexión con bolitas que viajan, contador de números, gráfica que se dibuja, texto que se escribe. Viven en el motor y Claude solo elige parámetros.
- **Estilo:** cómo se dibuja todo lo anterior. Plano (vector limpio) es el estilo base; papel recortado (cortes, filo, grano, sombras, contornos que «hierven») es el primer estilo extra. Un estilo no cambia el documento, solo el render.

## Ajustes de proyecto

Como en cualquier editor de video. Se pueden cambiar desde un panel de ajustes o pedírselos a Claude (`ajustes_proyecto`). Son la única excepción a la regla de cero edición manual, porque son configuración, no contenido.

| Grupo | Ajustes |
| --- | --- |
| Formato | Presets: TikTok / Reels / Shorts 9:16 (1080×1920), Feed 4:5 (1080×1350), Cuadrado 1:1 (1080×1080), Horizontal 16:9 (1920×1080) y tamaño libre |
| Tiempo | Fps de exportación (24, 25, 30, 60), fps de la animación del estilo (por ejemplo el hervor del papel a 12), duración |
| Plataformas | Qué zonas seguras se revisan: TikTok, Reels, Facebook, Shorts |
| Estilo | Estilo por defecto, fondo por defecto, kit de marca (o ninguno) |
| Subtítulos | Activados o no, máximo de renglones, posición, tamaño y fuente |
| Audio | Voz, música, volumen de cada una, desfase de la voz, fundido al final |
| Exportar | Códec (H.264 o H.265), calidad o bitrate, carpeta de salida y nombre de archivo |

Cambiar el formato no deforma el video: las piezas guardan su posición relativa a un ancla y los validadores avisan de lo que quedó fuera de la zona segura.

## Herramientas MCP

Pocas herramientas y bien acotadas, como hace pen.dev. Claude no puede escribir el archivo directo: todo pasa por aquí y se valida.

| Herramienta | Qué hace | Entrada principal |
| --- | --- | --- |
| `leer_estado` | Proyecto abierto, escena y tiempo actuales, selección y referencias del mensaje | — |
| `leer_skill` | Cómo trabajar en la app, guía de motion y, si hay kit, las reglas de la marca | tema |
| `leer_proyecto` | Ajustes, escenas, frases y piezas con su animación | — |
| `ajustes_proyecto` | Cambia formato, fps, audio, subtítulos o exportación | ajustes |
| `crear_pieza` | Crea una pieza desde cero con primitivas vectoriales; opcionalmente la guarda como componente | árbol de nodos, nombre |
| `buscar_biblioteca` | Componentes y piezas procedurales disponibles por nombre o tipo | texto, tipo |
| `importar` | Trae piezas de un SVG o un `.pen` a la biblioteca | archivo |
| `agregar_pieza` | Pone un componente o pieza procedural en una escena, con su animación | componente, escena, posición, animación |
| `cambiar` | Lote de cambios a piezas: posición, escala, texto, color, keyframes, tiempos | lista de cambios por id |
| `quitar_pieza` | Saca una pieza de la escena | id |
| `escenas` | Crear, partir, unir o mover cortes de escena | operación, tiempos |
| `voz` | Carga el audio, detecta frases y tiempos, decide cuáles no llevan subtítulo | archivo, opciones |
| `ver_cuadro` | Imagen del cuadro renderizado, para que Claude revise su trabajo | escena, segundo |
| `nuevo_proyecto` | Proyecto vacío con formato, estilo y kit opcional | nombre, formato |
| `exportar` | Manda a hacer el MP4 final y avisa cuando termina | opciones |

Cada herramienta responde qué cambió y en qué versión quedó. Si un cambio rompe una regla (por ejemplo, un texto en la zona de botones de TikTok), se rechaza con el motivo y Claude lo corrige.

## Flujo de una petición

1. El usuario escribe en el chat; los chips de las piezas o tiempos que tocó viajan con el mensaje.
2. La app manda el mensaje a la sesión de Claude Code del proyecto (`--resume`), así Claude recuerda lo que ya hizo.
3. Claude lee el estado y, si hace falta, la skill y la biblioteca.
4. Claude crea o cambia piezas con las herramientas.
5. Cada cambio pasa por los validadores; si rompe una regla, se rechaza con el motivo y Claude corrige.
6. El motor redibuja en vivo; si el cambio es visual, Claude revisa un cuadro con `ver_cuadro`.

La respuesta queda guardada como una versión con el mensaje que la provocó.

## Biblioteca, kits y versiones

- **Biblioteca del proyecto:** componentes que creó Claude o que se importaron. Claude busca ahí antes de crear algo nuevo, para que el video sea consistente.
- **Kits de marca (opcionales):** paleta, fuentes, componentes y reglas de una marca. Se pueden reusar entre proyectos. Un proyecto sin kit funciona igual.
- **Estilos:** plano y papel recortado al inicio. Cada estilo es un módulo del motor.
- **Versiones:** cada respuesta del chat guarda un parche con lo que cambió, quién lo pidió (el mensaje) y la versión anterior. Se puede volver a cualquier punto o comparar dos versiones.

## Interfaz

- **Inicio:** proyectos recientes y botón de nuevo proyecto (pide formato y, si se quiere, estilo y kit). Al abrir por primera vez revisa que Claude Code esté instalado y con sesión; si no, explica el paso de `claude`.
- **Medios (izquierda):** escenas, piezas y frases del proyecto; pestaña de biblioteca.
- **Monitor (centro):** reproducción en vivo, vistas de TikTok, Reels y Facebook, y selección por clic con el recuadro y el nombre de la pieza.
- **Chat (derecha):** conversación con Claude en streaming. Un clic en una pieza o en un clip agrega un chip con su nombre, tiempo y punto. Se ve qué herramienta está usando Claude y la versión que dejó cada respuesta.
- **Línea de tiempo (abajo):** pistas de texto, piezas, principal, voz y música. Solo para ver y elegir.
- **Ajustes de proyecto:** el panel de la sección anterior.
- **Historial:** lista de versiones con el mensaje que las provocó; volver a una es un clic.
- **Exportar:** botón que se lo pide a Claude, o directo, con la barra de progreso del MP4.

Fuera de los ajustes de proyecto, no hay arrastrar, redimensionar ni campos editables.

## Reglas y validación

La app trae las reglas generales de redes. Cada kit de marca puede agregar las suyas. Las reglas viven dos veces: en la skill que Claude lee al empezar y en validadores que revisan cada cambio. La skill guía; el validador decide.

**Reglas generales (siempre):**

| Regla | Dónde se aplica |
| --- | --- |
| Nada importante en las zonas de botones y descripción de cada plataforma | Validador por formato (TikTok, Reels, Facebook, Shorts) |
| Subtítulos de hasta N renglones y sin duplicar un letrero | Motor + validador |
| Texto legible: tamaño mínimo y contraste contra el fondo | Validador |
| Todo dentro del lienzo al cambiar de formato | Validador |

**Ejemplo de kit: Flow** (solo aplica a proyectos que cargan ese kit):

| Regla | Dónde se aplica |
| --- | --- |
| La marca es Flow; cierre con «Flow, tu negocio en un solo flujo» | Skill del kit + aviso si la última escena no lo trae |
| Chattito sin manos, sin el estado o.O, solo movimientos oficiales | El kit solo ofrece esos estados |
| No prometer lo que no existe: Chattito que responde, WhatsApp, cobro en línea, testimonios, cifras | Skill del kit + revisión de textos |
| Prueba gratis de 15 días | Skill del kit + revisión de textos |
| Temporadas con respeto: sin escudo ni bandera oficiales | Kit + skill |

## Fases

| Fase | Qué se construye | Prueba de cierre |
| --- | --- | --- |
| 1 · Motor y documento | Esquema del documento con ajustes de proyecto, motor de render con primitivas, keyframes y estilo plano, exportación a MP4 en Node | Un proyecto escrito a mano en JSON se ve igual en el navegador y en el MP4, en 9:16 y en 16:9 |
| 2 · Herramientas MCP | Servidor MCP con las herramientas y los validadores; se usa desde Claude Desktop o la terminal | Claude crea desde cero un video de 15 s a partir de un brief de texto, sin ningún archivo previo |
| 3 · App | Electron con monitor, línea de tiempo, chat, ajustes de proyecto e historial | El mismo video se hace desde el chat de la app y se exporta |
| 4 · Voz, estilos e importadores | whisper.cpp, estilo de papel recortado, importadores SVG y `.pen`, kits de marca | Flow Sites se rehace en la app y se parece al video de referencia (comparación visual por SSIM con umbral) |
| 5 · Instalador | electron-builder y GitHub Actions para Windows | Instalador que corre en una máquina Windows limpia |

La fase 1 va primero porque todo depende de ella. Desde la fase 2 ya sirve en el día a día, usando Claude Desktop como chat. El caso de Flow llega en la fase 4 como prueba de que el producto aguanta un proyecto real con estilo y marca, no como punto de partida.

## Arranque: validación de IAs instaladas

Como pen.dev, la app no trae IA: al abrirse revisa qué agentes tiene el usuario y no deja trabajar hasta que haya uno listo.

1. Busca `claude` (Claude Code) y `codex` (Codex CLI) en el equipo.
2. Revisa que la versión sea la mínima soportada y que tenga sesión iniciada.
3. Si falta, muestra los pasos: instalar, correr `claude` una vez para iniciar sesión y volver a la app.
4. Si hay más de uno, el usuario elige cuál usar por proyecto. Claude Code va primero; Codex después.

## Cómo se desarrolla: en la nube

La app es de escritorio, pero se construye en sesiones de Claude en la nube, sin depender de una computadora prendida.

| Qué | Dónde | Cómo |
| --- | --- | --- |
| Código y revisiones | Repositorio en GitHub | Commits y PRs desde la sesión en la nube |
| Motor en TypeScript | Nube | Pruebas de cuadros contra imágenes de referencia propias |
| Estilo de papel recortado | Nube | Comparado contra el motor de Python y el video de Flow Sites |
| Interfaz y app Electron | Nube | Pruebas con navegador y Electron sin pantalla |
| Herramientas MCP | Nube | Pruebas automáticas con un agente simulado |
| Instalador de Windows | GitHub Actions (máquina Windows) | Se genera en cada versión |
| Conexión real con Claude Code | Computadora del usuario | Necesita su sesión iniciada; se valida con cada versión de prueba |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Anthropic cambia las reglas de uso de la suscripción en apps (ya pasó en abril y mayo de 2026; hoy está en pausa) | Alto | El agente queda detrás de una capa de proveedor: Claude Code hoy, Codex o llave de API si hiciera falta. Siempre queda el MCP conectado a Claude Desktop |
| Lo que Claude crea desde cero se ve genérico o pobre | Alto | Skill de motion con principios de diseño y animación, `ver_cuadro` para que revise su trabajo, piezas procedurales de buena calidad y biblioteca que crece por proyecto |
| El producto se queda atado a un flujo o a una marca | Alto | Núcleo sin marcas ni estilos; kits, estilos e importadores como módulos; Flow solo como caso de prueba |
| El estilo de papel recortado no se parece al de Python | Medio | Comparación visual por SSIM en la fase 4; el generador aleatorio se porta para que el hervor coincida con la misma semilla |
| El previo en vivo no llega al fps del proyecto | Medio | Cada pieza se pre-dibuja por variante del estilo; solo se acomoda por cuadro |
| Claude Code cambia su salida de streaming entre versiones | Medio | Versión mínima comprobada al iniciar y un adaptador único para leer la salida |
| Claude intenta tocar archivos por fuera | Medio | Se lanza solo con las herramientas de la app permitidas |
| Cada respuesta tarda por usar `ver_cuadro` | Bajo | Imágenes chicas y solo cuando el cambio es visual |
| Windows: rutas, ffmpeg y whisper.cpp | Bajo | Binarios incluidos en el instalador |

## Decisiones para validar

- [ ] **Formato propio** como documento, con `.pen` y SVG solo como importadores.
- [ ] **Claude crea las piezas** desde primitivas; importar es opcional.
- [ ] **Estilo plano como base** y papel recortado como primer estilo extra.
- [ ] **Ajustes de proyecto editables a mano**, como única excepción a la regla de cero edición manual.
- [ ] **Electron** como app de escritorio (frente a Tauri, más ligera pero con Node aparte, o una web local en el navegador).
- [ ] **Claude Code CLI** como único agente al inicio; Codex después, solo si se necesita.
- [ ] **Voz en la app con whisper.cpp local** para sacar las frases con tiempos exactos.
- [ ] **Windows primero**, Mac después. Se desarrolla en la nube con GitHub; el instalador sale de GitHub Actions.
- [ ] **Nombre** de la app, independiente de cualquier marca.
