/**
 * Puntuación de búlder (IFSC 2025)
 * Por bloque:
 * - Top en el intento N: 25 - 0.1 × (N - 1)
 * - Zona en el intento N, sin top: 10 - 0.1 × (N - 1)
 * - Sin zona ni top: 0
 * El puntaje de la ronda es la suma de los bloques.
 *
 * Se calcula en décimas enteras para evitar errores de coma flotante.
 */

const TOP_DECIMAS = 250;
const ZONA_DECIMAS = 100;

export function decimasBoulder({ topEnIntento, zonaEnIntento } = {}) {
  if (topEnIntento != null) return Math.max(0, TOP_DECIMAS - (topEnIntento - 1));
  if (zonaEnIntento != null) return Math.max(0, ZONA_DECIMAS - (zonaEnIntento - 1));
  return 0;
}

export function formatearPuntos(decimas) {
  return (decimas / 10).toFixed(1);
}

export const sortScore = (a, b) => b.decimas - a.decimas;
