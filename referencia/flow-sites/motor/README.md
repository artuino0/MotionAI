# Motor de papel de Flow

Convierte FlowPublicidad.pen en videos con estilo de papel recortado.

    bash setup.sh                                   # una vez por entorno
    python3 preview.py ../FlowPublicidad.pen "Campaña" previo.html     # editor de montaje (HTML); --reusar solo rearma la página
    python3 pen2video.py ../FlowPublicidad.pen "Campaña" final.mp4     # video final 1080×1920
    python3 build_flowpublicidad.py salida.pen                         # regenera la biblioteca (necesita MotionGraphics.pen)

Archivos clave: papercut_style.py (motor), chattito_tiktok.py (Chattito oficial), recorder.py y pen_builder.py
(motor → vectores de Pencil), props.py (utilería), pen2video.py (traductor), preview.py + preview_template.html (previo).

Temporadas (Muertos, Halloween, Buen Fin, Navidad, Reyes, 14 feb, 10 mayo, 16 sep): `python3 build_temporada.py FlowPublicidad.pen nuevo.pen ../recursos [muertos,navidad,...]`
agrega o reemplaza los frames 07–14 y «Maestros · Temporada · …» sin tocar lo demás. Piezas en temporada.py; Chattito acepta `acc`
('cempasuchil' | 'bruja' | 'etiqueta_oferta' | 'santa' | 'corona' | 'corazones' | 'flor' | 'charro'). En una escena, `"escala": 2.4` en la metadata de la pieza la agranda.
