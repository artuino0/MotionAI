import type { Formato, Plataforma } from './ajustes.js';

/** Zona del lienzo que tapa la interfaz de una plataforma. Fracciones del ancho y alto del lienzo. */
export interface ZonaTapada {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  motivo: string;
}

/**
 * Zonas tapadas en video vertical 9:16. Son aproximadas: se ajustan cuando cambie la interfaz de cada app.
 * Referencia para TikTok: botones a la derecha de x = 940 y descripción debajo de y = 1560 en 1080×1920.
 */
const VERTICAL: Record<Plataforma, ZonaTapada[]> = {
  tiktok: [
    { x: 0, y: 0, ancho: 1, alto: 0.07, motivo: 'pestañas de TikTok' },
    { x: 0.87, y: 0.35, ancho: 0.13, alto: 0.4625, motivo: 'botones de TikTok' },
    { x: 0, y: 0.8125, ancho: 1, alto: 0.1875, motivo: 'descripción de TikTok' },
  ],
  reels: [
    { x: 0, y: 0, ancho: 1, alto: 0.07, motivo: 'encabezado de Reels' },
    { x: 0.88, y: 0.45, ancho: 0.12, alto: 0.35, motivo: 'botones de Reels' },
    { x: 0, y: 0.8, ancho: 1, alto: 0.2, motivo: 'descripción de Reels' },
  ],
  facebook: [
    { x: 0, y: 0, ancho: 1, alto: 0.06, motivo: 'encabezado de Facebook' },
    { x: 0.87, y: 0.4, ancho: 0.13, alto: 0.38, motivo: 'botones de Facebook' },
    { x: 0, y: 0.78, ancho: 1, alto: 0.22, motivo: 'descripción de Facebook' },
  ],
  shorts: [
    { x: 0, y: 0, ancho: 1, alto: 0.06, motivo: 'encabezado de Shorts' },
    { x: 0.86, y: 0.45, ancho: 0.14, alto: 0.35, motivo: 'botones de Shorts' },
    { x: 0, y: 0.8, ancho: 1, alto: 0.2, motivo: 'descripción de Shorts' },
  ],
};

/** Zonas tapadas de una plataforma para un formato. Fuera de 9:16 no se revisan por ahora. */
export function zonasTapadas(plataforma: Plataforma, formato: Formato): ZonaTapada[] {
  return formato === '9:16' ? VERTICAL[plataforma] : [];
}
