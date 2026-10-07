# Motor HyperFrames: el video en HTML

Cuando el proyecto usa el motor `hyperframes` (`leer_estado` lo dice), el video es una página HTML que tú escribes en `composicion/index.html` con tus herramientas de archivos (Read, Write, Edit). La app la muestra en vivo, la revisa y la renderiza cuadro por cuadro en Chrome sin ventana. Tienes toda la web: CSS, SVG, máscaras, filtros, degradados, tipografía, 3D con CSS.

Las herramientas de piezas (`crear_pieza`, `agregar_pieza`, `cambiar`, `quitar_pieza`, `escenas`, `importar`) no aplican aquí. Sí usas `leer_estado`, `ajustes_proyecto`, `voz`, `ver_cuadro`, `revisar`, `exportar` y `versiones`. Cada vez que llamas una herramienta, la app guarda una versión con lo que cambiaste en los archivos.

## Estructura

```html
<div id="root" data-composition-id="main" data-no-timeline data-start="0" data-duration="15" data-width="1080" data-height="1920">
  <section class="clip escena" data-start="0" data-duration="4">…</section>  <!-- las escenas llevan class="escena": así aparecen en la app -->
  <section class="clip escena" data-start="4" data-duration="5">…</section>
  <audio src="assets/voz.mp3" data-start="0.25" data-duration="29.07"></audio>
</div>
```

- La raíz ya existe: no le quites `data-composition-id`, `data-no-timeline` ni `data-width`/`data-height` (deben ser el tamaño del lienzo: 1080×1920 en 9:16, 1920×1080 en 16:9, 1080×1080 en 1:1, 1080×1350 en 4:5). `data-duration` de la raíz es la duración del video: si la cambias, cambia también `duracion` con `ajustes_proyecto`.
- **Escenas:** un elemento con `class="clip"`, `data-start` y `data-duration` (segundos) solo se ve en ese tramo. Dale `position: absolute; inset: 0` para que ocupe el lienzo.
- Todo con posiciones absolutas en píxeles del lienzo; nada depende del tamaño de la ventana.
- Imágenes, SVG y audio van en `composicion/assets/`. Un SVG puedes escribirlo en línea.

## Animación

Usa **WAAPI** (`element.animate`) en un `<script>` al final del `<body>`. El renderizador las pausa y las lleva a cada cuadro, así que todo debe poder saltar a cualquier segundo:

```js
const $ = (s) => document.querySelector(s);
// delay en milisegundos DESDE EL INICIO DEL VIDEO (no desde la escena). fill: 'both' siempre.
$('#titulo').animate(
  [{ opacity: 0, transform: 'translateY(60px)' }, { opacity: 1, transform: 'none' }],
  { duration: 500, delay: 4200, fill: 'both', easing: 'cubic-bezier(.2,.8,.2,1)' },
);
```

- Varias animaciones en el mismo elemento se combinan con `composite: 'add'`, o anima un contenedor y su hijo por separado.
- Ciclos: `iterations: Infinity` o un número, con `direction: 'alternate'`.
- **No uses GSAP** (su licencia no permite usarlo en esta app), ni bibliotecas de internet: el video se renderiza sin red. No uses `setTimeout`, `requestAnimationFrame`, `Date.now()` ni `Math.random()` sin semilla: el cuadro de un segundo debe salir siempre igual.
- Curvas: `cubic-bezier(.2,.8,.2,1)` para entradas suaves, `cubic-bezier(.34,1.56,.64,1)` para entradas con rebote, `cubic-bezier(.4,0,1,1)` para salidas.

## Fuentes

`assets/fuentes/fuentes.css` ya trae las fuentes del catálogo (`leer_skill("fuentes")`) y está enlazado en el `<head>`: usa `font-family: "Nunito"` con `font-weight` 400, 700 o 900 (Poppins 400, 600, 800; Bebas Neue 400). No uses fuentes de internet.

## Voz y subtítulos

`voz` copia el audio a `assets/`, lo transcribe y te da las frases con sus tiempos. Agrega el `<audio>` que te indica y escribe los subtítulos tú, uno por frase, con `class="clip"` y los tiempos de la frase. Ponlos donde no los tapen las plataformas (en 9:16, el bloque centrado alrededor del 70 % del alto, de no más de 72 % del ancho), con buen contraste (texto oscuro en tarjeta clara o texto claro con contorno).

## Zonas de las plataformas

En 9:16 TikTok y Reels tapan la columna derecha (x > 87 %, entre 35 % y 81 % del alto), la franja de arriba (8 %) y la de abajo (19 %). Deja los textos en reposo dentro de x 6–84 % y y 9–78 %. `revisar` mide los textos y te dice cuál queda tapado, fuera del lienzo o muy chico (menos de 28 px).

## Cómo trabajar

1. `leer_estado`; lee `composicion/index.html`.
2. Plan corto: escenas con tiempos, paleta (3 a 5 colores) y fuentes.
3. Escribe la composición completa con Write, escena por escena si es larga.
4. `ver_cuadro` con 2 o 3 segundos de cada escena (a media entrada y en reposo) y corrige.
5. `revisar` y arregla todos los errores.
6. Si el usuario lo pide, `exportar`.

Los principios de `leer_skill("diseno")` (mensaje, ritmo, composición, color, movimiento) valen igual aquí.
