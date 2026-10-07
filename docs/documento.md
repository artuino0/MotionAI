# El documento de MotionAI

Un proyecto es un archivo JSON con una carpeta `recursos/` a su lado. El esquema vive en `packages/documento` (zod) y es la referencia exacta; este texto lo explica. El ejemplo completo está en [`ejemplos/demo/proyecto.json`](../ejemplos/demo/proyecto.json).

```json
{
  "formato": "motionai",
  "version": 1,
  "nombre": "Mi video",
  "ajustes": { "formato": "9:16", "fps": 30 },
  "fuentes": [{ "familia": "Nunito", "archivo": "recursos/fuentes/Nunito_900Black.ttf", "peso": 900 }],
  "frases": [{ "inicio": 0.4, "fin": 2.9, "texto": "Pídele a Claude un video." }],
  "biblioteca": [],
  "escenas": [{ "id": "e1", "inicio": 0, "fin": 3, "fondo": "#FFF4E6", "hijos": [] }]
}
```

## Ajustes de proyecto

Todos tienen valor por defecto; solo se escriben los que cambian.

| Ajuste | Por defecto | Qué es |
| --- | --- | --- |
| `formato` | `9:16` | `9:16` (1080×1920), `4:5` (1080×1350), `1:1` (1080×1080), `16:9` (1920×1080) o `libre` con `ancho` y `alto` |
| `fps` | `30` | 24, 25, 30 o 60 |
| `fpsEstilo` | `12` | Cuadros por segundo de la animación propia de un estilo (el hervor del papel); el estilo plano no la usa |
| `duracion` | fin de la última escena | Segundos |
| `plataformas` | `["tiktok", "reels"]` | Qué zonas tapadas se revisan: `tiktok`, `reels`, `facebook`, `shorts` |
| `estilo` | `plano` | Cómo se dibuja todo: `plano` (vector limpio) o `papel` (papel recortado, ver abajo) |
| `fondo` | `#FFFFFF` | Color cuando una escena no trae fondo |
| `kit` | `null` | Kit de marca, o ninguno |
| `subtitulos` | activados, 3 renglones, posición 0.7, tamaño 64, peso 800, blanco con contorno oscuro | `posicion` es el centro del bloque como fracción del alto; `tamano` es para un lienzo de 1080 de lado corto y se ajusta al formato; `fondo` `{ color, margen, radio }` pone una tarjeta detrás del texto (con papel, de papel) en lugar del contorno |
| `audio` | sin audio, fundido final de 0.5 s | `voz` y `musica`: `{ archivo, volumen, inicio }` |
| `exportar` | H.264, calidad 18, carpeta `exportados` | `codec` (`h264` o `h265`), `calidad` (CRF: menos es mejor), `carpeta`, `nombreArchivo` |

## Estilo papel recortado

Un estilo no cambia el documento, solo cómo se dibuja. Con `"estilo": "papel"`:

- Cada figura rellena (`rect`, `elipse`, `trazo`) es un recorte: bordes irregulares que «hierven» (cambian cada 3 cuadros del estilo), un filo blanco de papel rasgado debajo, sombra suave en tres capas, un tono un poco distinto por pieza y grano de papel encima. El fondo de la escena también lleva grano.
- La animación avanza a `fpsEstilo` cuadros por segundo (12 por defecto), como stop motion; el MP4 sigue a los fps del proyecto.
- Los textos, las imágenes y los colores transparentes (menos de 50 % de opacidad: vidrio, brillos) quedan limpios.
- Todo sale de un azar con semilla (el id de la pieza y el número de hervor): el previo y el MP4 son iguales.

## Tiempo

Todos los tiempos son segundos del proyecto, o una marca:

- `"f3"`, `"f3+0.8"`, `"f3.fin-0.2"`: inicio o fin de la frase 3 (empiezan en 1), con un desfase.
- `"escena"`, `"escena+1"`, `"escena.fin-0.5"`: inicio o fin de la escena de la pieza.

Las marcas de frase hacen que la animación siga a la voz si la voz cambia. Las `frases` tienen `inicio`, `fin`, `texto` y `subtitulo: false` si no llevan subtítulo (por ejemplo, porque ya van en un letrero).

## Escenas

Cada escena tiene `id`, `inicio`, `fin`, `fondo` opcional (color o degradado) y sus piezas en `hijos`. Las piezas se dibujan en orden: la primera queda abajo.

## Piezas

Todas las piezas tienen `id` (único en el proyecto) y estas propiedades opcionales:

| Propiedad | Qué es |
| --- | --- |
| `x`, `y` | Posición en píxeles o porcentaje del contenedor (`"50%"`). El contenedor de una pieza de escena es el lienzo; dentro de un grupo, el grupo |
| `ancla` | Punto de la pieza que va en (x, y) y sobre el que gira y escala: `arriba-izq`, `arriba`, `arriba-der`, `izq`, `centro`, `der`, `abajo-izq`, `abajo`, `abajo-der`, o `[x, y]` en píxeles de la pieza. Por defecto la esquina de arriba a la izquierda |
| `escala`, `escalaX`, `escalaY` | 1 es tamaño normal |
| `rotacion` | Grados |
| `opacidad` | De 0 a 1 |
| `visible` | `false` para esconderla |
| `sombra` | `{ color, desenfoque, x, y }` |
| `animacion` | Ver abajo |
| `papel` | Solo con el estilo `papel`: `false` dibuja la pieza limpia (en un grupo o instancia, todo lo que tiene dentro), o `{ sombra, filo, grano, temblor }` para apagar partes; `temblor` multiplica lo irregular del corte (0 a 4) |

Usar porcentajes y anclas hace que la composición se acomode al cambiar de formato.

| Tipo | Propiedades propias |
| --- | --- |
| `rect` | `ancho`, `alto` (píxeles o porcentaje), `radio`, `relleno`, `contorno` |
| `elipse` | `ancho`, `alto`, `relleno`, `contorno` |
| `trazo` | `d` (trazado SVG: M, L, H, V, C, S, Q, T, A, Z, absolutos o relativos), `relleno`, `contorno`, `reglaRelleno` |
| `texto` | `texto` (`\n` para cambiar de renglón), `fuente` (familia declarada en `fuentes`), `tamano`, `peso`, `relleno` (color), `contorno`, `alineacion` (`izq`, `centro`, `der`), `anchoMax` (parte en renglones), `interlineado` (1.2) |
| `imagen` | `archivo` (en `recursos/`), `ancho`, `alto` |
| `grupo` | `hijos`, y opcionales `ancho`, `alto` (contenedor para porcentajes) y `recortar` |
| `instancia` | `componente` (id en la biblioteca) y `cambios` por id de pieza: `{ texto, relleno, contorno, visible }` |

- **Color:** `#RGB`, `#RRGGBB` o `#RRGGBBAA`.
- **Relleno:** un color o un degradado `{ tipo: "lineal", de: [x, y], a: [x, y], paradas: [[0, "#…"], [1, "#…"]] }` o `{ tipo: "radial", de: [x, y], radio, paradas }`.
- **Contorno:** `{ color, ancho, union: "redonda" | "recta" | "biselada", extremo: "redondo" | "plano" | "cuadrado", guiones: [largo, hueco] }`.

## Animación

```json
"animacion": {
  "entra": { "tipo": "pop", "en": "f2+0.3", "dur": 0.4 },
  "sale": { "tipo": "desaparece", "en": 5.5 },
  "pistas": {
    "rotacion": [{ "t": 3, "v": 0 }, { "t": 3.4, "v": -6, "curva": "rebote" }],
    "relleno": [{ "t": 4, "v": "#FF7A66" }, { "t": 4.5, "v": "#EDB43E" }]
  },
  "ciclos": [{ "tipo": "flota", "amplitud": 10, "periodo": 2.4 }]
}
```

- **Entradas:** `aparece`, `pop`, `crece`, `cae`, `sube`, `desliza-izq` (entra por la izquierda), `desliza-der`, `dibuja` (traza el contorno; sin contorno, revela de izquierda a derecha), `escribe` (letra por letra). Antes de entrar la pieza no se ve.
- **Salidas:** `desaparece`, `pop`, `encoge`, `cae`, `sube`, `desliza-izq`, `desliza-der`, `corta`. Después de salir la pieza no se ve.
- **Pistas (keyframes):** `x`, `y`, `escala`, `escalaX`, `escalaY`, `rotacion`, `opacidad`, `relleno` y `contorno` (colores), `trazo` (qué parte del contorno se dibuja, 0 a 1), `revelar` (qué parte se ve de izquierda a derecha), `caracteres` (qué parte del texto se ve). La `curva` de un keyframe dice cómo se llega a él desde el anterior.
- **Curvas:** `lineal`, `entrada`, `salida`, `entrada-salida` (por defecto), `rebote` (se pasa un poco), `elastico`, `golpe` (rebota contra el piso), o `[x1, y1, x2, y2]` como `cubic-bezier` de CSS.
- **Ciclos:** `flota` (sube y baja, en píxeles), `late` (crece y regresa, fracción de escala), `mece` (gira de lado a lado, grados), `gira` (vueltas completas). Empiezan cuando termina la entrada, o en `desde`, y acaban en `hasta`.
- Las entradas, salidas y ciclos se combinan con las pistas: no las reemplazan.

## Biblioteca

Un componente es una pieza guardada para reusarla: `{ id, nombre, tipo, nota, raiz }`. Una `instancia` lo pone en una escena y puede cambiarle textos y colores. Dentro de un componente, los tiempos en segundos cuentan desde que aparece la instancia (su `entra.en`, o el inicio de la escena), así una animación interna se reusa sin recalcular tiempos.
