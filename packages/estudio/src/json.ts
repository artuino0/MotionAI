/** JSON legible para un documento que también se lee a mano: listas y objetos cortos van en un renglón. */
export function formatearJson(v: unknown, sangria = 0): string {
  const sp = '  '.repeat(sangria);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    const partes = v.map((x) => formatearJson(x, sangria + 1));
    const corto = `[${partes.join(', ')}]`;
    if (!corto.includes('\n') && corto.length < 110) return corto;
    return `[\n${partes.map((p) => `${sp}  ${p}`).join(',\n')}\n${sp}]`;
  }
  if (v && typeof v === 'object') {
    const entradas = Object.entries(v).filter(([, x]) => x !== undefined);
    if (!entradas.length) return '{}';
    const simples = entradas.every(([, x]) => x === null || typeof x !== 'object');
    if (simples) {
      const corto = `{ ${entradas.map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(', ')} }`;
      if (corto.length < 100) return corto;
    }
    return `{\n${entradas.map(([k, x]) => `${sp}  ${JSON.stringify(k)}: ${formatearJson(x, sangria + 1)}`).join(',\n')}\n${sp}}`;
  }
  return JSON.stringify(v);
}
