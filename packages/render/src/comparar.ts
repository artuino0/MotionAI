/** Comparación de cuadros RGBA del mismo tamaño. */

export interface Comparacion {
  /** Parecido estructural medio (SSIM) en escala de grises, ventanas de 8×8. 1 es idéntico. */
  ssim: number;
  /** Relación señal-ruido en dB sobre RGB. Infinito si son idénticos. */
  psnr: number;
  /** Fracción de pixeles con algún canal que difiere en más de 32. */
  distintos: number;
}

const gris = (p: Uint8Array | Buffer, ancho: number, alto: number) => {
  const g = new Float64Array(ancho * alto);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * p[j]! + 0.587 * p[j + 1]! + 0.114 * p[j + 2]!;
  return g;
};

export function compararCuadros(a: Uint8Array | Buffer, b: Uint8Array | Buffer, ancho: number, alto: number): Comparacion {
  if (a.length !== b.length || a.length !== ancho * alto * 4) throw new Error('Los cuadros no tienen el mismo tamaño');
  let se = 0, distintos = 0;
  for (let i = 0; i < a.length; i += 4) {
    let m = 0;
    for (let c = 0; c < 3; c++) {
      const d = a[i + c]! - b[i + c]!;
      se += d * d;
      if (Math.abs(d) > m) m = Math.abs(d);
    }
    if (m > 32) distintos++;
  }
  const mse = se / ((a.length / 4) * 3);
  const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);

  const ga = gris(a, ancho, alto), gb = gris(b, ancho, alto);
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, V = 8;
  let suma = 0, n = 0;
  for (let y = 0; y + V <= alto; y += V) {
    for (let x = 0; x + V <= ancho; x += V) {
      let ma = 0, mb = 0;
      for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) { const k = (y + j) * ancho + x + i; ma += ga[k]!; mb += gb[k]!; }
      ma /= V * V; mb /= V * V;
      let va = 0, vb = 0, cov = 0;
      for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
        const k = (y + j) * ancho + x + i;
        const da = ga[k]! - ma, db = gb[k]! - mb;
        va += da * da; vb += db * db; cov += da * db;
      }
      const N = V * V - 1;
      va /= N; vb /= N; cov /= N;
      suma += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      n++;
    }
  }
  return { ssim: suma / n, psnr, distintos: distintos / (a.length / 4) };
}

/** Imagen de diferencias: gris tenue donde coinciden, rojo donde difieren. */
export function mapaDiferencias(a: Uint8Array | Buffer, b: Uint8Array | Buffer): Uint8ClampedArray {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!));
    const g = 0.299 * a[i]! + 0.587 * a[i + 1]! + 0.114 * a[i + 2]!;
    const base = 200 + g * 0.2;
    out[i] = d > 8 ? 255 : base;
    out[i + 1] = d > 8 ? Math.max(0, 200 - d * 3) : base;
    out[i + 2] = d > 8 ? Math.max(0, 200 - d * 3) : base;
    out[i + 3] = 255;
  }
  return out;
}
