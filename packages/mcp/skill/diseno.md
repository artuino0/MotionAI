# Diseño de motion para redes

## Mensaje y ritmo

- **Un mensaje por escena.** Escenas de 2 a 4 segundos; el gancho va en el primer segundo y medio.
- **Pocas palabras.** Máximo unas 8 palabras en pantalla a la vez. Si hay voz, el texto en pantalla resume, no repite.
- **Siempre se mueve algo.** Cuando todo ya entró, deja un ciclo suave (`flota`, `late`, `mece`) en una o dos piezas para que la escena no se congele.
- **Escalona las entradas.** Las piezas de un grupo entran una tras otra con 0.1 a 0.25 s de diferencia, no todas juntas.
- **Termina limpio.** Antes de un corte, deja la escena en reposo al menos 0.6 s para que se lea. Salidas solo cuando ayudan; un corte seco también funciona.
- **Cierre.** Marca o idea final con llamado a la acción, sostenido al menos 1.5 s.

## Composición

- **Jerarquía clara:** un titular grande (90 a 140 px en un lienzo de 1080 de ancho), textos de apoyo de 44 a 64 px, nunca menos de 32 px.
- **Márgenes:** deja al menos 8 % libre en los bordes. En 9:16 respeta las zonas tapadas: nada importante a la derecha de x = 940 en la mitad de abajo, ni debajo de y = 1550. Arriba deja libres los primeros 140 px.
- **Centra el peso visual** en el tercio medio del lienzo vertical. Las piezas decorativas pueden salirse del borde; los textos no.
- **Agrupa.** Una tarjeta con ícono y texto es un `grupo` (o un componente): se mueve como una sola pieza.
- **Fondo con intención:** un color sólido o un degradado suave, más una o dos formas grandes y tenues que den profundidad.

## Color

- Paleta de 3 a 5 colores: fondo, texto, primario, acento y un neutro. Repítela en todo el video.
- Texto oscuro sobre fondo claro o al revés; nunca texto de color medio sobre fondo de color medio.
- El acento se usa poco: lo que debe mirar la gente primero.

## Movimiento

- **Curvas:** entradas con `salida` (suave) o `rebote` (con energía); salidas con `entrada`. `lineal` solo para trazos que se dibujan, escritura y giros continuos.
- **Duraciones:** entradas de 0.3 a 0.6 s; nada importante dura menos de 1.5 s en pantalla.
- **Entradas según la pieza:** titulares `sube` o `pop`; tarjetas `desliza-izq` / `desliza-der` o `pop`; íconos y líneas `dibuja`; mensajes de chat `escribe`; cosas que caen en su lugar `cae`; fondos y manchas `crece` o `aparece`.
- **Keyframes** para todo lo demás: una flecha que avanza (`x`), una barra que crece (`escalaY` con `ancla: "abajo"`), un color que cambia (`relleno`), un giro de énfasis (`rotacion` con `rebote`).

## Recetas con primitivas

- **Tarjeta:** `rect` con `radio` 28–40, relleno claro y `sombra` `{ "color": "#00000022", "desenfoque": 30, "y": 12 }`.
- **Ícono de palomita:** `elipse` de color + `trazo` `"M 30 52 L 46 68 L 74 38"` con `contorno` blanco de 10–14 px, `extremo` y `union` redondos, entrada `dibuja`.
- **Burbuja de chat:** `trazo` con esquinas redondeadas y una colita, más un `texto` que entra con `escribe`.
- **Gráfica de barras:** varios `rect` con `ancla: "abajo"` y pista `escalaY` de 0 a 1, escalonados.
- **Línea de tendencia:** `trazo` con `contorno` grueso y entrada `dibuja`, más una `elipse` al final que hace `pop`.
- **Destello:** `trazo` de estrella de cuatro puntas `"M 0 -40 L 10 -10 L 40 0 L 10 10 L 0 40 L -10 10 L -40 0 L -10 -10 Z"` con ciclo `gira`.
- **Etiqueta o letrero:** `grupo` con `rect` de `radio` igual a la mitad del alto y un `texto` centrado; un poco de `rotacion` (-3 a 3) le da vida.
- **Persona simple:** cabeza (`elipse`), cuerpo (`rect` con radio grande) y una sonrisa (`trazo` con `contorno`), agrupados; un `mece` leve los hace sentir vivos.

## Estilo papel recortado

Si el usuario pide un look hecho a mano, de papel, collage o stop motion, pon `estilo: "papel"` con `ajustes_proyecto`. El motor hace el resto (bordes rasgados que se mueven, filo blanco, sombra, grano, movimiento a 12 cuadros); tú diseñas igual que en plano, con estas diferencias:

- **Cada figura es un pedazo de papel** con su sombra. No hagas formas tapando con el color del fondo (una luna con un círculo encima): se nota el recorte. Dibuja la silueta con un `trazo`.
- **Piezas por capas:** un personaje o un objeto se arma con pocas figuras grandes encimadas (cara, pelo, ropa), no con muchas chiquitas.
- **Colores sólidos y apagados** (pasteles, crema, coral, verde menta, azul petróleo). Los degradados y transparencias rompen la ilusión; la transparencia se dibuja limpia, sin papel.
- **Fondos de pared:** un `fondo` de escena claro y rayas (`rect` altos) o puntos de otro tono, con `papel: { sombra: false }`.
- **Pantallas y gráficas** que deben verse nítidas: `papel: false` en su grupo.
- **Subtítulos:** tarjeta de papel crema con texto oscuro, `subtitulos: { color: "#3A2E30", fondo: { color: "#FFFBF3" } }`.
- **Movimiento:** como va a 12 cuadros, prefiere entradas `pop`, `cae` y `sube` de 0.35 a 0.5 s y ciclos lentos; los movimientos muy cortos se pierden.

