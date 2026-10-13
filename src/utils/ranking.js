import { decimasBoulder } from './score';

function compararPrevia(a, b) {
  if (a.previa === b.previa) return 0;
  if (a.previa == null) return 1;
  if (b.previa == null) return -1;
  return a.previa - b.previa;
}

function compararDorsal(a, b) {
  const numerica = Number(a.dorsal) - Number(b.dorsal);
  return (Number.isNaN(numerica) ? 0 : numerica) || String(a.nombre).localeCompare(String(b.nombre));
}

// Ordena por puntaje. Un empate se rompe con la posición en la etapa previa
// (countback). Si sigue empatado, se comparte la posición.
export function ordenarFilas(filas) {
  const ordenadas = filas.slice().sort((a, b) => (
    b.decimas - a.decimas || compararPrevia(a, b) || compararDorsal(a, b)
  ));
  let posicion = 0;
  return ordenadas.map((fila, index) => {
    const anterior = ordenadas[index - 1];
    if (!anterior || anterior.decimas !== fila.decimas || compararPrevia(anterior, fila) !== 0) {
      posicion = index + 1;
    }
    return { ...fila, posicion };
  });
}

// Ranking de una etapa separado por categoría.
// Participan quienes tienen turno en la etapa o algún resultado en ella.
// Si la etapa no tiene turnos, participan todas las competidoras.
export function rankingPorCategoria({ competidores, turnos, resultados, etapaId, posicionesPrevias = new Map() }) {
  const enTurnos = new Set(turnos.filter((t) => t.etapaId === etapaId).map((t) => t.competidorId));
  const resultadosEtapa = resultados.filter((r) => r.etapaId === etapaId);
  const conResultado = new Set(resultadosEtapa.map((r) => r.competidorId));
  const participantes = enTurnos.size
    ? competidores.filter((c) => enTurnos.has(c.id) || conResultado.has(c.id))
    : competidores;

  const bouldersPorCompetidor = {};
  resultadosEtapa.forEach((r) => {
    bouldersPorCompetidor[r.competidorId] ||= {};
    bouldersPorCompetidor[r.competidorId][r.boulderId] = {
      zonaEnIntento: r.zonaEnIntento ?? null,
      topEnIntento: r.topEnIntento ?? null,
    };
  });

  const grupos = new Map();
  participantes.forEach((competidor) => {
    const categoriaId = competidor.categoriaId || 'sin-categoria';
    if (!grupos.has(categoriaId)) {
      grupos.set(categoriaId, { categoriaId, categoria: competidor.categoria || 'Sin categoría', filas: [] });
    }
    const boulders = bouldersPorCompetidor[competidor.id] || {};
    grupos.get(categoriaId).filas.push({
      id: competidor.id,
      nombre: competidor.nombre,
      dorsal: competidor.dorsal,
      categoria: competidor.categoria,
      categoriaId,
      boulders,
      decimas: Object.values(boulders).reduce((total, b) => total + decimasBoulder(b), 0),
      previa: posicionesPrevias.get(competidor.id) ?? null,
    });
  });

  return [...grupos.values()]
    .sort((a, b) => a.categoria.localeCompare(b.categoria))
    .map((grupo) => ({ ...grupo, filas: ordenarFilas(grupo.filas) }));
}

export function posicionesDeRanking(grupos) {
  const posiciones = new Map();
  grupos.forEach((grupo) => grupo.filas.forEach((fila) => posiciones.set(fila.id, fila.posicion)));
  return posiciones;
}

// Clasificadas a la etapa siguiente: las primeras `cupos` de la categoría (con empates incluidos).
// El orden de salida es inverso al ranking: la mejor clasificada sale última.
export function ordenDeSalida(filas, cupos) {
  return filas.filter((fila) => fila.posicion <= cupos).reverse();
}
