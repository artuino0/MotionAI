type Ctx = CanvasRenderingContext2D;

export function fuenteCss(f: { fuente: string; tamano: number; peso?: number }): string {
  return `${f.peso ?? 400} ${f.tamano}px "${f.fuente}"`;
}

/** Parte un texto en renglones que no pasen de `anchoMax`, con la fuente ya puesta en el contexto. */
export function renglones(ctx: Ctx, texto: string, anchoMax?: number): string[] {
  const out: string[] = [];
  for (const parrafo of texto.split('\n')) {
    if (anchoMax === undefined) { out.push(parrafo); continue; }
    const palabras = parrafo.split(/ +/).filter(Boolean);
    if (!palabras.length) { out.push(''); continue; }
    let linea = palabras[0]!;
    for (const p of palabras.slice(1)) {
      const prueba = `${linea} ${p}`;
      if (ctx.measureText(prueba).width <= anchoMax) linea = prueba;
      else { out.push(linea); linea = p; }
    }
    out.push(linea);
  }
  return out;
}

const desfases = new Map<string, number>();

/**
 * Cuánto bajar la línea base desde el centro del renglón, con la fuente ya puesta en el contexto.
 * Se usa la línea base alfabética con las métricas de la fuente en vez de `textBaseline = 'middle'`,
 * porque el navegador y skia-canvas no ponen «middle» en el mismo lugar.
 */
export function bajadaDesdeCentro(ctx: Ctx): number {
  const clave = ctx.font;
  let d = desfases.get(clave);
  if (d === undefined) {
    const m = ctx.measureText('H');
    d = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
    desfases.set(clave, d);
  }
  return d;
}
