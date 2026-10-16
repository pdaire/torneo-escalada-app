// Tabla de puntos de una ronda americana: cuántos puntos da cada bloque según el
// intento en que se encadenó. La definen los organizadores; no tiene que seguir
// ninguna fórmula. Se guarda en la etapa como { B1: [10, 8, 6, 4, 2], B2: [...] }.

// Lee una tabla pegada desde una planilla. Una fila por bloque:
//   bloque, puntos al 1.er intento, al 2.º, …
// Acepta comas, punto y coma o tabulaciones, y un encabezado opcional.
// El bloque puede ser "12" o "B12". El máximo de intentos es la fila más larga.
export function parsearTablaPuntos(texto) {
  const filas = String(texto || '')
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => linea.split(/[\t,;]/).map((celda) => celda.trim()));
  if (!filas.length) return { error: 'Pega al menos una fila: bloque y puntos por intento.' };

  const esBloque = (celda) => /^B?\d+$/i.test(celda);
  const datos = esBloque(filas[0][0]) ? filas : filas.slice(1);
  if (!datos.length) return { error: 'La tabla solo tiene encabezado.' };

  const tabla = {};
  const boulders = [];
  for (const [indice, fila] of datos.entries()) {
    const [celdaBloque, ...celdas] = fila;
    const numeroFila = indice + (datos === filas ? 1 : 2);
    if (!esBloque(celdaBloque)) return { error: `Fila ${numeroFila}: "${celdaBloque}" no es un bloque. Usa 12 o B12.` };
    const id = `B${celdaBloque.replace(/^B/i, '')}`;
    if (tabla[id]) return { error: `El bloque ${id} aparece dos veces.` };
    const valores = celdas.filter((celda, posicion) => celda !== '' || celdas.slice(posicion).some(Boolean));
    const puntos = valores.map((celda) => Number(celda.replace(',', '.')));
    if (!puntos.length) return { error: `Fila ${numeroFila}: el bloque ${id} no tiene puntos.` };
    if (puntos.some((valor) => !Number.isFinite(valor) || valor < 0)) {
      return { error: `Fila ${numeroFila}: los puntos del bloque ${id} tienen que ser números, cero o más.` };
    }
    tabla[id] = puntos;
    boulders.push(id);
  }
  const maxIntentos = Math.max(...Object.values(tabla).map((puntos) => puntos.length));
  return { tabla, boulders, maxIntentos };
}

// Atajo para la cartilla clásica: bloque N, intento k → base + incremento × (N − 1) − descuento × (k − 1).
export function generarTablaPuntos({ cantidad, puntajeBase, incrementoPorBloque, descuentoPorIntento, maxIntentos }) {
  const tabla = {};
  const boulders = [];
  for (let numero = 1; numero <= cantidad; numero += 1) {
    const id = `B${numero}`;
    boulders.push(id);
    tabla[id] = Array.from({ length: maxIntentos }, (_, intento) => (
      Math.max(0, puntajeBase + (incrementoPorBloque * (numero - 1)) - (descuentoPorIntento * intento))
    ));
  }
  return { tabla, boulders, maxIntentos };
}

// La tabla como CSV, para editarla o copiarla a una planilla.
export function tablaACsv(boulders = [], tabla = {}) {
  const intentos = Math.max(0, ...boulders.map((id) => (tabla[id] || []).length));
  const encabezado = ['Bloque', ...Array.from({ length: intentos }, (_, i) => `Intento ${i + 1}`)].join(',');
  return [encabezado, ...boulders.map((id) => [id.replace(/^B/, ''), ...(tabla[id] || [])].join(','))].join('\n');
}

// ---- Numeración por sector ----
// Cada sector numera sus bloques desde 1 (A1…A7, B1…B7). Cada bloque tiene su propia
// fila de puntos: A1 y B1 pueden valer distinto. La tabla define también los sectores.

const NOMBRE_SECTOR = /^[A-Za-z][A-Za-z0-9]{0,11}$/;

// Id del bloque: el nombre del sector y el número (A + 3 → "A3"). Si el nombre del
// sector termina en dígito, se separa con guion (S1 + 3 → "S1-3").
export function idBloqueSector(sector, numero) {
  const nombre = String(sector).toUpperCase();
  return /\d$/.test(nombre) ? `${nombre}-${numero}` : `${nombre}${numero}`;
}

// Una fila por bloque: sector, número, puntos al 1.er intento, al 2.º, …
export function parsearTablaPorSector(texto) {
  const filas = String(texto || '')
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => linea.split(/[\t,;]/).map((celda) => celda.trim()));
  if (!filas.length) return { error: 'Pega al menos una fila: sector, bloque y puntos por intento.' };

  // La primera fila es encabezado si su segunda columna no es un número de bloque
  // (por ejemplo "Sector, Bloque, Intento 1…" o "Sector, Bloque, 1, 2, 3").
  const conEncabezado = !/^\d+$/.test(filas[0][1] || '');
  const datos = conEncabezado ? filas.slice(1) : filas;
  if (!datos.length) return { error: 'La tabla solo tiene encabezado.' };

  const tabla = {};
  const boulders = [];
  const sectores = {};
  for (const [indice, fila] of datos.entries()) {
    const numeroFila = indice + (conEncabezado ? 2 : 1);
    const [sector, numero, ...celdas] = fila;
    if (!NOMBRE_SECTOR.test(sector || '')) {
      return { error: `Fila ${numeroFila}: "${sector}" no es un nombre de sector. Usa letras y números, sin espacios (A, B, Norte).` };
    }
    if (!/^\d+$/.test(numero || '') || Number(numero) < 1) {
      return { error: `Fila ${numeroFila}: "${numero}" no es un número de bloque.` };
    }
    const nombre = sector.toUpperCase();
    const id = idBloqueSector(nombre, Number(numero));
    if (tabla[id]) return { error: `El bloque ${nombre} ${Number(numero)} aparece dos veces.` };
    const valores = celdas.filter((celda, posicion) => celda !== '' || celdas.slice(posicion).some(Boolean));
    const puntos = valores.map((celda) => Number(celda.replace(',', '.')));
    if (!puntos.length) return { error: `Fila ${numeroFila}: el bloque ${id} no tiene puntos.` };
    if (puntos.some((valor) => !Number.isFinite(valor) || valor < 0)) {
      return { error: `Fila ${numeroFila}: los puntos del bloque ${id} tienen que ser números, cero o más.` };
    }
    tabla[id] = puntos;
    boulders.push(id);
    (sectores[nombre] ||= []).push(id);
  }
  const maxIntentos = Math.max(...Object.values(tabla).map((puntos) => puntos.length));
  return { tabla, boulders, maxIntentos, sectores };
}

// Atajo: la misma fórmula en cada sector (después se puede editar bloque por bloque).
export function generarTablaPorSector({ sectores, bloquesPorSector, puntajeBase, incrementoPorBloque, descuentoPorIntento, maxIntentos }) {
  const tabla = {};
  const boulders = [];
  const resultado = {};
  sectores.forEach((sector) => {
    const nombre = sector.toUpperCase();
    resultado[nombre] = [];
    for (let numero = 1; numero <= bloquesPorSector; numero += 1) {
      const id = idBloqueSector(nombre, numero);
      boulders.push(id);
      resultado[nombre].push(id);
      tabla[id] = Array.from({ length: maxIntentos }, (_, intento) => (
        Math.max(0, puntajeBase + (incrementoPorBloque * (numero - 1)) - (descuentoPorIntento * intento))
      ));
    }
  });
  return { tabla, boulders, maxIntentos, sectores: resultado };
}

export function tablaPorSectorACsv(sectores = {}, tabla = {}) {
  const ids = Object.values(sectores).flat();
  const intentos = Math.max(0, ...ids.map((id) => (tabla[id] || []).length));
  const encabezado = ['Sector', 'Bloque', ...Array.from({ length: intentos }, (_, i) => `Intento ${i + 1}`)].join(',');
  const filas = Object.entries(sectores).flatMap(([sector, idsSector]) => idsSector.map((id) => {
    const numero = id.slice(sector.length).replace(/^-/, '');
    return [sector, numero, ...(tabla[id] || [])].join(',');
  }));
  return [encabezado, ...filas].join('\n');
}
