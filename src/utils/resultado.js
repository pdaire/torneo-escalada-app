import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';

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
  return { intentos: 0, zonaEnIntento: null, topEnIntento: null, version: 0 };
}

export function leerResultado(data) {
  if (!data) return resultadoVacio();
  return {
    intentos: data.intentos ?? 0,
    zonaEnIntento: data.zonaEnIntento ?? null,
    topEnIntento: data.topEnIntento ?? null,
    version: data.version ?? 0,
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

// Escribe el resultado y su entrada de historial en un solo batch.
// `marcador.version` tiene que ser la versión anterior + 1: las reglas rechazan
// una escritura basada en un estado viejo.
export function guardarResultado(db, clave, marcador, accion, autor) {
  const ref = resultadoDocRef(db, clave);
  const batch = writeBatch(db);
  batch.set(ref, {
    competenciaId: clave.competenciaId,
    etapaId: clave.etapaId,
    competidorId: clave.competidorId,
    boulderId: clave.boulderId,
    intentos: marcador.intentos,
    zonaEnIntento: marcador.zonaEnIntento,
    topEnIntento: marcador.topEnIntento,
    version: marcador.version,
    actualizadoPor: autor,
    actualizadoEn: serverTimestamp(),
  });
  batch.set(doc(ref, 'historial', `v${marcador.version}`), {
    version: marcador.version,
    accion,
    intentos: marcador.intentos,
    zonaEnIntento: marcador.zonaEnIntento,
    topEnIntento: marcador.topEnIntento,
    autor,
    en: serverTimestamp(),
  });
  return batch.commit();
}
