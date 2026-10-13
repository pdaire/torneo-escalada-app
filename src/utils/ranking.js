import { puntajeDeEtapa, puntosDeBloque } from './score';

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
    b.puntaje - a.puntaje || compararPrevia(a, b) || compararDorsal(a, b)
  ));
  let posicion = 0;
  return ordenadas.map((fila, index) => {
    const anterior = ordenadas[index - 1];
    if (!anterior || anterior.puntaje !== fila.puntaje || compararPrevia(anterior, fila) !== 0) {
      posicion = index + 1;
    }
    return { ...fila, posicion };
  });
}

// Ranking de una etapa separado por categoría.
// Participan quienes tienen turno en la etapa o algún resultado en ella.
// Si la etapa no tiene turnos (por ejemplo, una ronda americana), participan todas.
// `puntaje` va en la unidad del formato de la etapa (ver puntajeDeEtapa);
// sin `etapa`, se puntúa como World Climbing.
export function rankingPorCategoria({ competidores, turnos, resultados, etapa, etapaId = etapa?.id, posicionesPrevias = new Map() }) {
  const etapaPuntaje = etapa || { id: etapaId };
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
      intentos: r.intentos ?? 0,
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
    const { puntaje, cuentan } = puntajeDeEtapa(etapaPuntaje, boulders);
    grupos.get(categoriaId).filas.push({
      id: competidor.id,
      nombre: competidor.nombre,
      dorsal: competidor.dorsal,
      categoria: competidor.categoria,
      categoriaId,
      boulders,
      puntaje,
      cuentan,
      tops: Object.values(boulders).filter((b) => b.topEnIntento != null).length,
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

// Bloques que usa una categoría en la etapa: los que tienen turnos para ella,
// en el orden de la etapa. Sin turnos, todos los de la etapa.
export function bloquesDeCategoria(etapa, turnos, categoriaId) {
  const todos = etapa?.boulders || [];
  const usados = new Set(turnos
    .filter((t) => t.etapaId === etapa?.id && t.categoriaId === categoriaId)
    .map((t) => t.boulderId));
  if (!usados.size) return todos;
  return [...todos.filter((id) => usados.has(id)), ...[...usados].filter((id) => !todos.includes(id))];
}

// 'finalizada' si la etapa o la categoría están cerradas; 'en_curso' solo en la etapa
// activa; null en una etapa que no está activa ni cerrada (pendiente o sin cerrar).
export function estadoCategoria(etapa, categoriaId) {
  if (etapa?.estado === 'cerrada' || etapa?.categoriasCerradas?.includes(categoriaId)) return 'finalizada';
  return etapa?.activa ? 'en_curso' : null;
}

// Etapas en orden de competencia: primero las que no tienen etapa previa,
// después cada una detrás de su etapa previa.
export function ordenarEtapas(etapas) {
  const porId = new Map(etapas.map((etapa) => [etapa.id, etapa]));
  const profundidad = (etapa) => {
    let nivel = 0;
    let actual = etapa;
    const vistas = new Set();
    while (actual?.etapaPreviaId && porId.has(actual.etapaPreviaId) && !vistas.has(actual.id)) {
      vistas.add(actual.id);
      actual = porId.get(actual.etapaPreviaId);
      nivel += 1;
    }
    return nivel;
  };
  return etapas.slice().sort((a, b) => profundidad(a) - profundidad(b) || String(a.nombre).localeCompare(String(b.nombre)));
}

// Ranking de una etapa con desempate por la etapa previa.
// `resultados` puede traer resultados de varias etapas; `etapas` sirve para
// puntuar la etapa previa con su propio formato.
export function rankingConDesempate({ etapa, etapas = [], competidores, turnos, resultados }) {
  const previa = etapa.etapaPreviaId
    ? etapas.find((item) => item.id === etapa.etapaPreviaId) || { id: etapa.etapaPreviaId }
    : null;
  const posicionesPrevias = previa
    ? posicionesDeRanking(rankingPorCategoria({ competidores, turnos, resultados, etapa: previa }))
    : new Map();
  return rankingPorCategoria({ competidores, turnos, resultados, etapa, posicionesPrevias });
}

// Todo lo de una competidora en la competencia, etapa por etapa.
export function detalleCompetidor({ competidorId, etapas, competidores, turnos, resultados }) {
  return ordenarEtapas(etapas).flatMap((etapa) => {
    const grupos = rankingConDesempate({ etapa, etapas, competidores, turnos, resultados });
    const grupo = grupos.find((item) => item.filas.some((fila) => fila.id === competidorId));
    if (!grupo) return [];
    const fila = grupo.filas.find((item) => item.id === competidorId);
    const bloques = bloquesDeCategoria(etapa, turnos, grupo.categoriaId).map((boulderId) => {
      const resultado = resultados.find((r) => (
        r.etapaId === etapa.id && r.competidorId === competidorId && r.boulderId === boulderId
      ));
      const turno = turnos.find((t) => (
        t.etapaId === etapa.id && t.competidorId === competidorId && t.boulderId === boulderId
      ));
      const marcador = {
        intentos: resultado?.intentos ?? 0,
        zonaEnIntento: resultado?.zonaEnIntento ?? null,
        topEnIntento: resultado?.topEnIntento ?? null,
      };
      return {
        boulderId,
        ...marcador,
        puntos: puntosDeBloque(etapa, boulderId, marcador),
        cuenta: fila.cuentan.includes(boulderId),
        horaProgramada: turno?.horaProgramada || null,
        pendiente: !resultado || resultado.intentos === 0,
      };
    });
    return [{
      etapa,
      posicion: fila.posicion,
      puntaje: fila.puntaje,
      tops: fila.tops,
      totalCategoria: grupo.filas.length,
      categoriaId: grupo.categoriaId,
      estado: estadoCategoria(etapa, grupo.categoriaId),
      bloques,
    }];
  });
}

// Categorías que escalan un bloque en la etapa, según los turnos.
// Las que siguen en curso van primero; después, por nombre.
export function categoriasDeBloque(etapa, turnos, competidores, boulderId) {
  const nombres = new Map(competidores.map((c) => [c.categoriaId, c.categoria]));
  const ids = new Set(turnos
    .filter((t) => t.etapaId === etapa?.id && t.boulderId === boulderId)
    .map((t) => t.categoriaId));
  return [...ids]
    .map((categoriaId) => ({
      categoriaId,
      categoria: nombres.get(categoriaId) || categoriaId,
      finalizada: estadoCategoria(etapa, categoriaId) === 'finalizada',
    }))
    .sort((a, b) => Number(a.finalizada) - Number(b.finalizada) || a.categoria.localeCompare(b.categoria));
}

// Firma de lo que muestra el tablero: el puntaje y los tops de cada fila (`id`) y la
// zona y el top de cada celda (`id/bloque`). Un intento sin zona ni top no cambia nada visible.
export function firmasDeRanking(grupos) {
  const firmas = new Map();
  grupos.forEach((grupo) => grupo.filas.forEach((fila) => {
    firmas.set(fila.id, `${fila.puntaje}|${fila.tops}`);
    Object.entries(fila.boulders).forEach(([boulderId, marca]) => {
      if (marca.zonaEnIntento == null && marca.topEnIntento == null) return;
      firmas.set(`${fila.id}/${boulderId}`, `${marca.zonaEnIntento}|${marca.topEnIntento}`);
    });
  }));
  return firmas;
}

// Claves cuya firma cambió, apareció o desapareció entre dos momentos.
export function cambiosEntre(antes, despues) {
  const claves = new Set([...antes.keys(), ...despues.keys()]);
  return [...claves].filter((clave) => antes.get(clave) !== despues.get(clave));
}

// Firma de lo que muestra la ficha de una competidora: posición y puntaje de cada
// etapa (`etapaId`) y cada bloque con sus intentos (`etapaId/bloque`).
export function firmasDeFicha(detalle) {
  const firmas = new Map();
  detalle.forEach((item) => {
    firmas.set(item.etapa.id, `${item.posicion}|${item.puntaje}|${item.tops}`);
    item.bloques.forEach((bloque) => {
      firmas.set(`${item.etapa.id}/${bloque.boulderId}`, `${bloque.intentos}|${bloque.zonaEnIntento}|${bloque.topEnIntento}|${bloque.cuenta}`);
    });
  });
  return firmas;
}
