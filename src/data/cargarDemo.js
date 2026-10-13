import { doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { competenciaRef, competidoresCol, etapasCol, miembroRef, turnosCol } from '../utils/competicion';
import { guardarResultado, idResultado, resultadosColRef } from '../utils/resultado';
import { DEMO_DELEGADO, DEMO_ID, DEMO_JUEZ, ETAPAS, generarDemo } from './demo';

// Carga o reinicia la competencia demo y la deja activa.
// Escribe con la sesión del admin, que queda como juez jefe de la demo: así los
// resultados pasan por las mismas reglas que en una competencia real.
export async function cargarDemo(db, correoAdmin, competencias) {
  const { competidores, turnos, resultados, categoriasCerradasFinal } = generarDemo();
  const C = DEMO_ID;

  // 1. Competencia, etapas abiertas y miembros.
  const config = writeBatch(db);
  config.set(competenciaRef(db, C), { nombre: 'Competencia demo', fecha: new Date().toISOString().slice(0, 10), activa: true });
  competencias
    .filter((item) => item.id !== C && item.activa)
    .forEach((item) => config.update(competenciaRef(db, item.id), { activa: false }));
  Object.values(ETAPAS).forEach(({ inicio: _inicio, ...etapa }) => {
    config.set(doc(etapasCol(db, C), etapa.id), {
      ...etapa,
      activa: etapa.id === 'final',
      estado: 'abierta',
      categoriasCerradas: [],
    });
  });
  config.set(miembroRef(db, C, DEMO_JUEZ), {
    rol: 'juez', nombre: 'Juez demo', club: '',
    asignaciones: { final: ETAPAS.final.boulders },
  });
  config.set(miembroRef(db, C, DEMO_DELEGADO), { rol: 'delegado', nombre: 'Delegado demo', club: 'Club Demo', asignaciones: {} });
  if (correoAdmin !== DEMO_JUEZ && correoAdmin !== DEMO_DELEGADO) {
    config.set(miembroRef(db, C, correoAdmin), { rol: 'juez_jefe', nombre: 'Admin', club: '', asignaciones: {} });
  }
  await config.commit();

  // 2. Competidoras y orden de paso (ids fijos: recargar la demo los sobrescribe).
  const plantel = writeBatch(db);
  competidores.forEach(({ id, ...competidor }) => plantel.set(doc(competidoresCol(db, C), id), competidor));
  await plantel.commit();
  for (let inicio = 0; inicio < turnos.length; inicio += 400) {
    const lote = writeBatch(db);
    turnos.slice(inicio, inicio + 400).forEach(({ id, ...turno }) => lote.set(doc(turnosCol(db, C), id), turno));
    await lote.commit();
  }

  // 3. Resultados. Las reglas exigen versión + 1, así que se parte de la versión vigente.
  // Un resultado que quedó de una demo anterior y no está en la nueva se deja en cero.
  const existentes = await getDocs(query(resultadosColRef(db), where('competenciaId', '==', C)));
  const versiones = new Map(existentes.docs.map((item) => [item.id, item.data()]));
  const porId = new Map();
  versiones.forEach((data, id) => porId.set(id, {
    etapaId: data.etapaId, competidorId: data.competidorId, boulderId: data.boulderId,
    intentos: 0, zonaEnIntento: null, topEnIntento: null,
  }));
  resultados.forEach((item) => porId.set(idResultado({ competenciaId: C, ...item }), item));

  const escrituras = [...porId.entries()].map(([id, item]) => () => guardarResultado(
    db,
    { competenciaId: C, etapaId: item.etapaId, competidorId: item.competidorId, boulderId: item.boulderId },
    {
      intentos: item.intentos,
      zonaEnIntento: item.zonaEnIntento,
      topEnIntento: item.topEnIntento,
      version: (versiones.get(id)?.version ?? 0) + 1,
    },
    'edicion',
    correoAdmin,
  ));
  for (let inicio = 0; inicio < escrituras.length; inicio += 25) {
    await Promise.all(escrituras.slice(inicio, inicio + 25).map((escribir) => escribir()));
  }

  // 4. Clasificatoria cerrada; en la final, todas las categorías cerradas menos la que está en curso.
  await updateDoc(doc(etapasCol(db, C), 'clasificatoria'), { estado: 'cerrada' });
  await updateDoc(doc(etapasCol(db, C), 'final'), { categoriasCerradas: categoriasCerradasFinal });
}
