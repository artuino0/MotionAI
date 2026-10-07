> **En MotionAI:** este paquete es material de referencia y de prueba para la fase 4 (rehacer Flow Sites en la app y compararlo con `referencia/flow_sites_tiktok.mp4`). No es la fuente de la verdad del producto: ver `docs/PLAN.md`. Nota: la voz dice «se envían a tu panel» y «le envía un correo», mientras que las frases del `.pen` dicen «aparecen solitos en tu lista de clientes» y «le llega un correo».

# Paquete · Flow Sites (video TikTok de 29.6 s)

Todo lo necesario para volver a renderizar, revisar o modificar el comercial «Flow Sites» con el motor de papel recortado.

## Contenido

```
FlowSites.pen          Campaña + 6 escenas + los 28 componentes que usan (JSON, se abre en Pencil)
recursos/              voz_sites.mp3 (ElevenLabs), grano.png y los 3 fondos verticales
motor/                 Motor completo (Python + pycairo) y generador del montaje HTML
referencia/            flow_sites_tiktok.mp4 (resultado final) y montaje_flow_sites.html (previo interactivo)
```

## Requisitos

Linux o macOS (en Windows, WSL) con Python 3.10+ y ffmpeg.

```bash
cd motor && bash setup.sh      # instala pycairo, numpy, opencv, shapely, cairosvg, fonttools, pillow
                               # y crea las fuentes NunitoBlack / NunitoBold. Debe imprimir «motor listo».
```

`setup.sh` descarga la fuente Nunito de GitHub; si no hay red, instala Nunito Black y Bold a mano con esos nombres de familia.

## Comandos (desde la carpeta del paquete)

```bash
# video final 1080×1920, 24 fps, con voz (~10 min)
python3 motor/pen2video.py FlowSites.pen "Flow Sites" final.mp4

# cuadros sueltos para revisar (segundos separados por coma)
python3 motor/pen2video.py FlowSites.pen "Flow Sites" --cuadros 9.5,22.8 --dir cuadros/

# montaje HTML (editor tipo CapCut: monitor, línea de tiempo, vistas de TikTok/Reels/Facebook, notas por clic)
python3 motor/preview.py FlowSites.pen "Flow Sites" montaje.html
```

Las rutas `recursos/...` del .pen son relativas al archivo: corre los comandos con `FlowSites.pen` y `recursos/` en la misma carpeta.

## Cómo está armada la campaña

- **Frame «Campaña · Flow Sites»** con `metadata`: `type: campana`, `audio: recursos/voz_sites.mp3`, `offset: 0.25`, `duracion: 29.6`, `formato: tiktok`, `frases: [[inicio, fin, texto], …]` (9 frases, tiempos sacados de las pausas del audio) y `sin_subtitulo: [9]` (la última frase va en un letrero, no en subtítulo).
- **6 frames «Escena NN · …»** de 1080 × 1920 con `metadata: {type: escena, campana, inicio, fin, desat?}`: Problema (colores apagados), Conectada, Datos, Agenda, Dominio y Cierre.
- **Cada pieza** es una instancia (`ref`) de un componente, con su animación en `metadata`:
  - `entra`: `pop | cae | sube | desliza-izq | desliza-der | crece | dibuja` (dibuja = se revela de izquierda a derecha)
  - `en`: segundo o referencia a frase (`'f3+0.8'` = 0.8 s después de que empieza la frase 3), `dur`
  - `sale`, `sale_en`: salida (`pop | cae | corta`)
  - `escala`: agranda la pieza desde su esquina
  - `bg`, `fg`: cambian los colores de una etiqueta (ej. el letrero coral del cierre)
  - `descendants`: textos sobrescritos (ej. el módulo «Prospectos» es el componente «Módulo · Clientes» con otro texto)
- **Conexión** (escena 2): actor `conexion` con `p0`, `p1` (relativos al nodo), `bolitas` y `periodo`: la línea se tiende y las bolitas viajan por ella.
- **Fondos**: el componente de fondo tiene `metadata.type: fondo` y el motor dibuja el papel tapiz con sus colores (`base`, `stripe`, `dot`); el PNG solo sirve para verlo en Pencil.

## Reglas de la marca (no romper)

- La marca es **Flow** (nunca FlowERP). Cierre: «Flow» con su fuente + letrero coral «tu negocio en un solo flujo».
- Prueba gratis de **15 días**.
- Chattito (no aparece en este video) no tiene manos, no se usa el estado o.O y no se presenta como asistente que responde preguntas.
- No prometer lo que no existe: recordatorios por WhatsApp, cobro en línea, editor de arrastrar y soltar, testimonios o cifras de clientes.
- Nada importante en la zona de botones de TikTok (x > 940) ni en la descripción (y > 1560).
- Tono de papel fijo por pieza; el «hervor» de contornos cambia cada 3 cuadros a 12 fps y se exporta a 24 fps.

## Archivos del motor que importan aquí

| Archivo | Para qué |
| --- | --- |
| `papercut_style.py` | Motor de papel: cortes, filo, grano, sombras, paleta, personajes |
| `pen2video.py` | Lee el .pen y renderiza la campaña (animaciones, subtítulos, voz) |
| `sites.py` | Utilería de Sites: página vieja, página Flow, formulario, lista de clientes, agenda, cita, correo |
| `build_sites.py` | Script que generó esta campaña dentro de la biblioteca completa (referencia) |
| `preview.py` + `preview_template.html` | Montaje HTML |
| `props.py`, `temporada.py`, `chattito_tiktok.py`, `flowcore_tiktok.py` | Resto de la utilería y personajes de la biblioteca |
| `iconos/` | Íconos lucide que usan algunos componentes |
