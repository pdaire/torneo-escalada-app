import { collection, doc } from 'firebase/firestore';
import { decimasBoulder } from './score';

export function idResultado({ competenciaId, etapaId, competidorId, boulderId }) {
  return [competenciaId, etapaId, competidorId, boulderId].join('__');
}

export function resultadoDocRef(db, clave) {
  return doc(db, 'resultados', idResultado(clave));
}

export function resultadosColRef(db) {
  return collection(db, 'resultados');
}

export function resultadoVacio() {
  return { intentos: 0, zonaEnIntento: null, topEnIntento: null };
}

export function leerResultado(data) {
  if (!data) return resultadoVacio();
  return {
    intentos: data.intentos ?? 0,
    zonaEnIntento: data.zonaEnIntento ?? null,
    topEnIntento: data.topEnIntento ?? null,
  };
}

// El top implica zona. Si no había zona, queda en el mismo intento.
export function prepararResultado(resultado) {
  const next = {
    intentos: resultado.intentos,
    zonaEnIntento: resultado.zonaEnIntento,
    topEnIntento: resultado.topEnIntento,
  };
  if (next.topEnIntento != null && next.zonaEnIntento == null) {
    next.zonaEnIntento = next.topEnIntento;
  }
  return next;
}

export function validarResultado({ intentos, zonaEnIntento, topEnIntento }) {
  if (!Number.isInteger(intentos) || intentos < 0) {
    return 'Los intentos totales tienen que ser un número entero, cero o más.';
  }
  if (zonaEnIntento != null && (!Number.isInteger(zonaEnIntento) || zonaEnIntento < 1 || zonaEnIntento > intentos)) {
    return 'La zona tiene que caer en un intento entre 1 y el total.';
  }
  if (topEnIntento != null && (!Number.isInteger(topEnIntento) || topEnIntento < 1 || topEnIntento > intentos)) {
    return 'El top tiene que caer en un intento entre 1 y el total.';
  }
  if (topEnIntento != null && zonaEnIntento != null && zonaEnIntento > topEnIntento) {
    return 'La zona no puede quedar en un intento posterior al top.';
  }
  return '';
}

export function rankingFromResultados(docs) {
  const agrupado = {};

  docs.forEach((dato) => {
    if (!dato.competidorId) return;
    if (!agrupado[dato.competidorId]) {
      agrupado[dato.competidorId] = {
        id: dato.competidorId,
        nombre: dato.nombre,
        dorsal: dato.dorsal,
        categoria: dato.categoria,
        boulders: {},
      };
    }
    agrupado[dato.competidorId].boulders[dato.boulderId] = {
      zonaEnIntento: dato.zonaEnIntento ?? null,
      topEnIntento: dato.topEnIntento ?? null,
    };
  });

  return Object.values(agrupado).map((comp) => {
    const decimas = Object.values(comp.boulders)
      .reduce((total, boulder) => total + decimasBoulder(boulder), 0);
    return { ...comp, decimas };
  });
}
