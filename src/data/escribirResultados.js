import { getDocs, query, where, writeBatch } from 'firebase/firestore';
import { agregarResultado, idResultado, resultadosColRef } from '../utils/resultado';

// Escribe muchos resultados a la vez (demos y simulaciones), a través de las reglas.
// - Parte de la versión vigente de cada resultado: las reglas exigen versión + 1.
// - Un resultado existente que no está en `resultados` se deja en cero (los resultados
//   no se pueden borrar). Con `etapaId`, solo se miran los de esa etapa.
// - Batches por competidora y etapa de hasta 8 resultados: las reglas pueden leer
//   como máximo 20 documentos por batch (miembro, etapa, competidora y cada resultado).
export async function escribirResultados(db, competenciaId, resultados, autor, { etapaId = null, onProgreso = () => {} } = {}) {
  const filtros = [where('competenciaId', '==', competenciaId)];
  if (etapaId) filtros.push(where('etapaId', '==', etapaId));
  const existentes = await getDocs(query(resultadosColRef(db), ...filtros));
  const versiones = new Map(existentes.docs.map((item) => [item.id, item.data().version ?? 0]));
  const porId = new Map();
  existentes.docs.forEach((item) => {
    const data = item.data();
    if ((data.intentos ?? 0) === 0 && data.topEnIntento == null && data.zonaEnIntento == null) return;
    porId.set(item.id, {
      etapaId: data.etapaId, competidorId: data.competidorId, boulderId: data.boulderId,
      intentos: 0, zonaEnIntento: null, topEnIntento: null,
    });
  });
  resultados.forEach((item) => porId.set(idResultado({ competenciaId, ...item }), item));

  const grupos = new Map();
  porId.forEach((item, id) => {
    const base = `${item.etapaId}/${item.competidorId}`;
    let parte = 0;
    while ((grupos.get(`${base}/${parte}`) || []).length >= 8) parte += 1;
    const grupo = `${base}/${parte}`;
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push([id, item]);
  });
  const escrituras = [...grupos.values()].map((items) => () => {
    const lote = writeBatch(db);
    items.forEach(([id, item]) => agregarResultado(
      lote,
      db,
      { competenciaId, etapaId: item.etapaId, competidorId: item.competidorId, boulderId: item.boulderId },
      {
        intentos: item.intentos,
        zonaEnIntento: item.zonaEnIntento,
        topEnIntento: item.topEnIntento,
        version: (versiones.get(id) ?? 0) + 1,
      },
      'edicion',
      autor,
    ));
    return lote.commit();
  });
  for (let inicio = 0; inicio < escrituras.length; inicio += 20) {
    onProgreso(`Escribiendo resultados: ${inicio} de ${escrituras.length}…`);
    await Promise.all(escrituras.slice(inicio, inicio + 20).map((escribir) => escribir()));
  }
  return porId.size;
}
