// Exportación de resultados a Excel. Arma las hojas como datos (filas de celdas);
// la escritura del .xlsx la hace write-excel-file al descargar (ver exportarExcel).
import { ordenarEtapas, rankingConDesempate } from './ranking';
import { FORMATOS, esAmericana, puntosDeBloque, reglasAmericana } from './score';

const ENCABEZADO = { fontWeight: 'bold', backgroundColor: '#E5E7EB' };
const ESTADOS_APELACION = { borrador: 'Borrador', en_evaluacion: 'En evaluación', aceptada: 'Aceptada', rechazada: 'Rechazada' };

function encabezado(titulos) {
  return titulos.map((titulo) => ({ value: titulo, ...ENCABEZADO }));
}

// Firestore entrega Timestamps; los tests, Date.
function aFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === 'function') return valor.toDate();
  return null;
}

function celdaFecha(valor) {
  const fecha = aFecha(valor);
  return fecha ? { value: fecha, type: Date, format: 'dd/mm/yyyy hh:mm' } : null;
}

function numeroDorsal(dorsal) {
  const numero = Number(dorsal);
  return Number.isFinite(numero) && String(dorsal).trim() !== '' ? numero : dorsal;
}

// Puntaje en la unidad que ve la gente: World Climbing en puntos con un decimal.
function celdaPuntaje(etapa, valor) {
  return esAmericana(etapa)
    ? { value: valor, type: Number }
    : { value: valor / 10, type: Number, format: '0.0' };
}

// Excel limita los nombres de hoja a 31 caracteres y prohíbe [ ] : * ? / \
function nombresDeHoja(nombres) {
  const usados = new Set();
  return nombres.map((nombre) => {
    const base = String(nombre).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Hoja';
    let candidato = base;
    for (let n = 2; usados.has(candidato.toLowerCase()); n += 1) {
      candidato = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
    }
    usados.add(candidato.toLowerCase());
    return candidato;
  });
}

// Texto de un bloque en la hoja de la etapa.
// World Climbing: "T3 z1", "z2" o vacío. Americana: "✓2" (encadenó en el 2.º intento), "✗5" o vacío.
function textoBloque(etapa, marca) {
  if (!marca || ((marca.intentos ?? 0) === 0 && marca.zonaEnIntento == null && marca.topEnIntento == null)) return null;
  if (esAmericana(etapa)) return marca.topEnIntento != null ? `✓${marca.topEnIntento}` : `✗${marca.intentos}`;
  if (marca.topEnIntento != null) return `T${marca.topEnIntento} z${marca.zonaEnIntento ?? marca.topEnIntento}`;
  if (marca.zonaEnIntento != null) return `z${marca.zonaEnIntento}`;
  return `✗${marca.intentos}`;
}

function hojaEtapa(etapa, grupos) {
  const americana = esAmericana(etapa);
  const bloques = etapa.boulders || [];
  const titulos = americana
    ? ['Categoría', 'Pos', 'Dorsal', 'Nombre', 'Puntaje', 'Tops', `Suman (${reglasAmericana(etapa).mejoresBloques} mejores)`, ...bloques]
    : ['Categoría', 'Pos', 'Dorsal', 'Nombre', ...bloques, 'Puntaje', 'Desempate (pos. etapa previa)'];
  const filas = grupos.flatMap((grupo) => grupo.filas.map((fila) => {
    const base = [grupo.categoria, fila.posicion, numeroDorsal(fila.dorsal), fila.nombre];
    const porBloque = bloques.map((id) => textoBloque(etapa, fila.boulders[id]));
    if (americana) {
      const suman = fila.cuentan.map((id) => `${id} (${puntosDeBloque(etapa, id, fila.boulders[id])})`).join(', ');
      return [...base, celdaPuntaje(etapa, fila.puntaje), fila.tops, suman || null, ...porBloque];
    }
    return [...base, ...porBloque, celdaPuntaje(etapa, fila.puntaje), fila.previa ?? null];
  }));
  const anchos = americana
    ? [18, 6, 8, 26, 9, 6, 34, ...bloques.map(() => 6)]
    : [18, 6, 8, 26, ...bloques.map(() => 8), 9, 14];
  return {
    data: [encabezado(titulos), ...filas],
    columns: anchos.map((width) => ({ width })),
    stickyRowsCount: 1,
    stickyColumnsCount: 4,
  };
}

export function construirLibro({ competencia, etapas, competidores, turnos, resultados, apelaciones = [], generado = new Date() }) {
  const ordenadas = ordenarEtapas(etapas);
  const porId = new Map(competidores.map((c) => [c.id, c]));
  const rankings = new Map(ordenadas.map((etapa) => [etapa.id, rankingConDesempate({ etapa, etapas, competidores, turnos, resultados })]));
  const nombres = nombresDeHoja(['Resumen', ...ordenadas.map((e) => e.nombre), 'Resultados', 'Competidores', 'Apelaciones']);
  const [nombreResumen, ...resto] = nombres;
  const nombresEtapas = resto.slice(0, ordenadas.length);
  const [nombreResultados, nombreCompetidores, nombreApelaciones] = resto.slice(ordenadas.length);

  const resumen = {
    sheet: nombreResumen,
    data: [
      [{ value: competencia.nombre, fontWeight: 'bold', fontSize: 14 }],
      ['Dirección', `/${competencia.id}`],
      ['Fecha', competencia.fecha || null],
      ['Club', competencia.club || null],
      ['Lugar', competencia.lugar || null],
      ['Exportado', celdaFecha(generado)],
      [],
      encabezado(['Etapa', 'Formato', 'Estado', 'Participantes', 'Resultados anotados', 'Hoja']),
      ...ordenadas.map((etapa, index) => [
        etapa.nombre,
        FORMATOS[etapa.formato || 'wc'] || etapa.formato,
        `${etapa.estado === 'cerrada' ? 'Cerrada' : 'Abierta'}${etapa.activa ? ' (activa)' : ''}`,
        rankings.get(etapa.id).reduce((total, grupo) => total + grupo.filas.length, 0),
        resultados.filter((r) => r.etapaId === etapa.id && ((r.intentos ?? 0) > 0 || r.topEnIntento != null || r.zonaEnIntento != null)).length,
        nombresEtapas[index],
      ]),
    ],
    columns: [22, 22, 18, 14, 20, 22].map((width) => ({ width })),
  };

  const hojasEtapas = ordenadas.map((etapa, index) => ({ sheet: nombresEtapas[index], ...hojaEtapa(etapa, rankings.get(etapa.id)) }));

  // Detalle: una fila por competidora y bloque con algo anotado.
  const etapasPorId = new Map(ordenadas.map((etapa) => [etapa.id, etapa]));
  const filasResultados = resultados
    .filter((r) => etapasPorId.has(r.etapaId) && ((r.intentos ?? 0) > 0 || r.topEnIntento != null || r.zonaEnIntento != null))
    .map((r) => {
      const etapa = etapasPorId.get(r.etapaId);
      const competidor = porId.get(r.competidorId);
      const fila = rankings.get(etapa.id).flatMap((g) => g.filas).find((f) => f.id === r.competidorId);
      const marca = { intentos: r.intentos ?? 0, zonaEnIntento: r.zonaEnIntento ?? null, topEnIntento: r.topEnIntento ?? null };
      const puntos = puntosDeBloque(etapa, r.boulderId, marca);
      return {
        orden: [ordenadas.indexOf(etapa), competidor?.categoria || '', Number(competidor?.dorsal) || 0, r.boulderId],
        celdas: [
          etapa.nombre,
          competidor?.categoria || null,
          numeroDorsal(competidor?.dorsal ?? ''),
          competidor?.nombre || r.competidorId,
          r.boulderId,
          marca.intentos,
          esAmericana(etapa) ? null : marca.zonaEnIntento,
          marca.topEnIntento,
          esAmericana(etapa) ? { value: puntos, type: Number } : { value: puntos / 10, type: Number, format: '0.0' },
          esAmericana(etapa) ? (fila?.cuentan.includes(r.boulderId) ? 'Sí' : 'No') : null,
          r.actualizadoPor || null,
          celdaFecha(r.actualizadoEn),
        ],
      };
    })
    .sort((a, b) => a.orden[0] - b.orden[0] || a.orden[1].localeCompare(b.orden[1]) || a.orden[2] - b.orden[2]
      || a.orden[3].localeCompare(b.orden[3], undefined, { numeric: true }))
    .map((fila) => fila.celdas);
  const hojaResultados = {
    sheet: nombreResultados,
    data: [
      encabezado(['Etapa', 'Categoría', 'Dorsal', 'Nombre', 'Bloque', 'Intentos', 'Zona (intento)', 'Top (intento)', 'Puntos', 'Suma al total', 'Anotado por', 'Última modificación']),
      ...filasResultados,
    ],
    columns: [16, 18, 8, 26, 8, 9, 13, 12, 8, 12, 28, 18].map((width) => ({ width })),
    stickyRowsCount: 1,
  };

  const hojaCompetidores = {
    sheet: nombreCompetidores,
    data: [
      encabezado(['Dorsal', 'Nombre', 'Categoría']),
      ...competidores
        .slice()
        .sort((a, b) => String(a.categoria).localeCompare(String(b.categoria)) || (Number(a.dorsal) - Number(b.dorsal)) || String(a.nombre).localeCompare(String(b.nombre)))
        .map((c) => [numeroDorsal(c.dorsal), c.nombre, c.categoria]),
    ],
    columns: [8, 30, 20].map((width) => ({ width })),
    stickyRowsCount: 1,
  };

  const hojas = [resumen, ...hojasEtapas, hojaResultados, hojaCompetidores];
  if (apelaciones.length) {
    const nombreEtapa = (id) => etapasPorId.get(id)?.nombre || id;
    hojas.push({
      sheet: nombreApelaciones,
      data: [
        encabezado(['Presentada', 'Etapa', 'Tipo', 'Estado', 'Dorsal', 'Competidora', 'Bloque', 'Argumento', 'Presentada por', 'Resuelta por', 'Resuelta']),
        ...apelaciones
          .slice()
          .sort((a, b) => (aFecha(a.creadaEn)?.getTime() || 0) - (aFecha(b.creadaEn)?.getTime() || 0))
          .map((a) => [
            celdaFecha(a.creadaEn),
            nombreEtapa(a.etapaId),
            a.tipo === 'resultado' ? 'Resultado' : 'General',
            ESTADOS_APELACION[a.estado] || a.estado,
            a.dorsal ? numeroDorsal(a.dorsal) : null,
            a.competidorNombre || null,
            a.boulderId || null,
            a.argumento,
            a.autorEmail || null,
            a.resueltaPor || null,
            celdaFecha(a.resueltaEn),
          ]),
      ],
      columns: [18, 16, 11, 14, 8, 24, 8, 60, 28, 28, 18].map((width) => ({ width })),
      stickyRowsCount: 1,
    });
  }
  return hojas;
}

export function nombreArchivo(competencia, generado = new Date()) {
  return `${competencia.id}-resultados-${generado.toLocaleDateString('en-CA')}.xlsx`;
}
