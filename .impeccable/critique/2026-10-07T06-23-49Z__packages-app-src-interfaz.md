---
target: la interfaz de la app
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/home/user/MotionAI/packages/app/src/interfaz"
timestamp: 2026-10-07T06-23-49Z
slug: packages-app-src-interfaz
closed: true
---
Method: dual-agent (A: revisión de diseño · B: detector + navegador)

## Design Health Score
| # | Heurística | Puntos | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | El monitor se queda en 00:00 (cuadro vacío) mientras Claude construye; "Usó N herramientas" en pasado mientras sigue trabajando |
| 2 | Lenguaje del usuario | 2 | Ids internos (e4-cta-texto), nombres de herramientas (leer_skill) y jerga (CRF, px en 1080, Black) |
| 3 | Control y libertad | 3 | Hay Deshacer y Detener; falta Ctrl+Z, Escape no cierra Ajustes, el fondo del modal descarta cambios |
| 4 | Consistencia | 3 | Pista "Texto" solo tiene frases; confirm() nativo junto a modales propios |
| 5 | Prevención de errores | 2 | Exportar activo mientras Claude cambia; "←" cierra a media respuesta; navegar agrega chips sin querer |
| 6 | Reconocer vs recordar | 2 | El ciclo de señalar usa ids; botones de transporte solo con glifos |
| 7 | Flexibilidad | 2 | Pocos atajos (sin Ctrl+Z, J/K/L, Inicio/Fin, exportar) |
| 8 | Estética y minimalismo | 3 | Sobria; ruido en chips mono de la barra, miniaturas repetidas, colores de clip sin leyenda |
| 9 | Recuperación de errores | 2 | Errores crudos sobre el monitor; avisos de error desaparecen en 4.5 s; errores de Ajustes fuera de vista |
| 10 | Ayuda | 2 | Buenas pistas en línea; sin ayuda ni atajos ni guía de primer proyecto |
| **Total** | | **23/40** | **Aceptable** |

## Priority Issues
- [P1] El monitor no muestra el trabajo mientras Claude construye (Monitor.vue, tiendas/estudio.ts). Fix: seguir a Claude al cuadro en reposo de la escena que cambió, marcar la pieza cambiada, al terminar dejar un cuadro con contenido y avisar en la barra del monitor. Comando: animate / delight.
- [P1] Ids internos y nombres de herramientas en toda la interfaz (chips, etiqueta del lienzo, clips, árbol de piezas, inspector, historial, lista de herramientas). Fix: nombres humanos para piezas, verbos para herramientas, inspector curado, ids solo en detalles técnicos. Comando: clarify.
- [P1] Sin capa de idiomas aunque inglés es requisito; plurales rotos ("1 rechazos"), fechas fijas es-MX, confirm() nativo. Fix: i18n con plurales, fechas por idioma, lang dinámico, diálogo propio. Comando: harden.
- [P1] Acciones de alto riesgo con pocas barreras y retroalimentación que desaparece (exportar a media respuesta, cerrar a media respuesta, fondo del modal, Escape, avisos de error temporales, Deshacer del turno 1 sin consecuencia clara). Comando: harden.
- [P2] La primera pantalla del principiante esconde lo que debe hacer: Exportar es lo más brillante en un proyecto vacío; el chat es una caja de 3 renglones abajo a la derecha. Fix: estado "sin turnos" con redactor grande y ejemplos clicables; Exportar secundario hasta que haya video. Comando: onboard.

## Detector
CLI: 3 avisos (side-tab Avisos.vue:17 e Inicio.vue:111; layout-transition Barra.vue:42). Navegador (CSP omitido solo en la prueba): low-contrast en placeholders 3.9:1 (Chat, Ajustes, Inicio); thin-border-wide-shadow en el modal (dudoso); tiny-text 11 px en rutas. Falso positivo: dark-glow (color del propio detector). Accesibilidad: sin ARIA, piezas y listas no alcanzables con teclado, sin aria-live en el chat, outline: none en campos.

## Persona Red Flags
- Jordan (primera vez): Crear proyecto parece desactivado sin razón; monitor en blanco un minuto; "1 rechazos corregidos" en amarillo parece error; chip con id.
- Alex (editor): sin Ctrl+Z ni atajos de editor; Escape no cierra Ajustes; navegar agrega chips; Volver muta sin previsualizar.
- Sam (teclado/lector): no puede señalar piezas con teclado; sin roles de pestaña, aria-live ni foco visible en campos; contraste bajo en clips de frase y textos 11 px.
