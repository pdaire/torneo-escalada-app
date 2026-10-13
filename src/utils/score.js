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

/**
 * Ronda americana
 * Bloques numerados por dificultad (B1 el más fácil). Sin zonas: solo cuenta encadenar.
 * - Los puntos de cada bloque según el intento salen de la tabla de la etapa
 *   (`tablaPuntos`: { B1: [10, 8, 6, 4, 2], … }), que definen los organizadores.
 *   Una etapa sin tabla usa la fórmula base + incremento × (N - 1) - descuento × (k - 1).
 * - Máximo de intentos por bloque (5): después ya no puntúa.
 * - El total es la suma de los mejores bloques (5).
 */

export const FORMATOS = {
  wc: 'World Climbing',
  americana: 'Ronda americana',
};

export const AMERICANA_POR_DEFECTO = {
  puntajeBase: 10,
  incrementoPorBloque: 2,
  descuentoPorIntento: 2,
  maxIntentos: 5,
  mejoresBloques: 5,
};

export function esAmericana(etapa) {
  return etapa?.formato === 'americana';
}

export function reglasAmericana(etapa) {
  const reglas = Object.fromEntries(Object.entries(AMERICANA_POR_DEFECTO)
    .map(([clave, valor]) => [clave, Number.isFinite(etapa?.[clave]) ? etapa[clave] : valor]));
  if (etapa?.tablaPuntos && !Number.isFinite(etapa.maxIntentos)) {
    reglas.maxIntentos = Math.max(0, ...Object.values(etapa.tablaPuntos).map((puntos) => puntos.length));
  }
  return reglas;
}

// Puntos de encadenar el bloque en el intento `intento` (sin importar si ya pasó).
export function puntosAmericana(etapa, boulderId, intento) {
  const reglas = reglasAmericana(etapa);
  if (intento < 1 || intento > reglas.maxIntentos) return 0;
  if (etapa?.tablaPuntos) return etapa.tablaPuntos[boulderId]?.[intento - 1] ?? 0;
  const numero = (etapa?.boulders || []).indexOf(boulderId) + 1;
  if (numero < 1) return 0;
  return Math.max(0, reglas.puntajeBase + (reglas.incrementoPorBloque * (numero - 1)) - (reglas.descuentoPorIntento * (intento - 1)));
}

// Puntos de un bloque en la unidad de su formato (décimas en World Climbing).
export function puntosDeBloque(etapa, boulderId, marca = {}) {
  if (!esAmericana(etapa)) return decimasBoulder(marca);
  return marca.topEnIntento == null ? 0 : puntosAmericana(etapa, boulderId, marca.topEnIntento);
}

// Puntaje de la etapa a partir de los bloques { boulderId: marca }.
// `cuentan`: bloques que suman (en la americana, solo los mejores).
export function puntajeDeEtapa(etapa, boulders) {
  const puntos = Object.entries(boulders).map(([boulderId, marca]) => ({ boulderId, puntos: puntosDeBloque(etapa, boulderId, marca) }));
  if (!esAmericana(etapa)) {
    return { puntaje: puntos.reduce((total, b) => total + b.puntos, 0), cuentan: puntos.map((b) => b.boulderId) };
  }
  const mejores = puntos
    .filter((b) => b.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.boulderId.localeCompare(b.boulderId, undefined, { numeric: true }))
    .slice(0, reglasAmericana(etapa).mejoresBloques);
  return { puntaje: mejores.reduce((total, b) => total + b.puntos, 0), cuentan: mejores.map((b) => b.boulderId) };
}

export function formatearPuntaje(etapa, puntaje) {
  return esAmericana(etapa) ? String(puntaje) : formatearPuntos(puntaje);
}
