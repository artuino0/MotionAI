export type RGBA = [r: number, g: number, b: number, a: number];

/** `#RGB`, `#RRGGBB` o `#RRGGBBAA` a componentes de 0 a 255 (alfa de 0 a 1). */
export function leerColor(hex: string): RGBA {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}

export function mezclarColor(a: RGBA, b: RGBA, u: number): RGBA {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
}

export function colorCss(c: RGBA): string {
  const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
  return c[3] >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${+c[3].toFixed(4)})`;
}
