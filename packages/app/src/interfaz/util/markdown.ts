/** Markdown mínimo para las respuestas del chat: párrafos, listas, tablas, negritas y código. Escapa todo el HTML. */
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const enLinea = (s: string) =>
  escapar(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');

export function markdown(texto: string): string {
  const out: string[] = [];
  const lineas = texto.replace(/\r/g, '').split('\n');
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i]!;
    if (!l.trim()) { i++; continue; }
    if (/^\s*\|/.test(l)) {
      const filas: string[][] = [];
      while (i < lineas.length && /^\s*\|/.test(lineas[i]!)) {
        const celdas = lineas[i]!.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!celdas.every((c) => /^:?-+:?$/.test(c))) filas.push(celdas);
        i++;
      }
      const [cab, ...cuerpo] = filas;
      out.push(`<table><thead><tr>${cab!.map((c) => `<th>${enLinea(c)}</th>`).join('')}</tr></thead><tbody>${cuerpo.map((f) => `<tr>${f.map((c) => `<td>${enLinea(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordenada = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lineas.length && /^\s*([-*]|\d+\.)\s+/.test(lineas[i]!)) {
        items.push(`<li>${enLinea(lineas[i]!.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`);
        i++;
      }
      out.push(ordenada ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^#{1,4}\s/.test(l)) { out.push(`<p><strong>${enLinea(l.replace(/^#+\s/, ''))}</strong></p>`); i++; continue; }
    const parrafo: string[] = [];
    while (i < lineas.length && lineas[i]!.trim() && !/^\s*(\||[-*]\s|\d+\.\s|#)/.test(lineas[i]!)) parrafo.push(lineas[i++]!);
    out.push(`<p>${parrafo.map(enLinea).join('<br>')}</p>`);
  }
  return out.join('');
}
