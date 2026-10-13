import { doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { competenciaRef, competidoresCol, etapasCol, miembroRef, turnosCol } from '../utils/competicion';
import { agregarResultado, idResultado, resultadosColRef } from '../utils/resultado';
import { DEMO_DELEGADO, DEMO_ID, DEMO_JUEZ, ETAPA_ACTIVA, ETAPAS, generarDemo } from './demo';

// Carga o reinicia la competencia demo y la deja activa.
// Escribe con la sesión del admin, que queda como juez jefe de la demo: así los
// resultados pasan por las mismas reglas que en una competencia real.
export async function cargarDemo(db, correoAdmin, competencias) {
  const { competidores, turnos, resultados, etapasCerradas, categoriasCerradasFinal } = generarDemo();
  const C = DEMO_ID;

  // 1. Competencia, etapas abiertas y miembros.
  const config = writeBatch(db);
  config.set(competenciaRef(db, C), { nombre: 'Competencia demo', fecha: new Date().toISOString().slice(0, 10), activa: true });
  competencias
    .filter((item) => item.id !== C && item.activa)
    .forEach((item) => config.update(competenciaRef(db, item.id), { activa: false }));
  Object.values(ETAPAS).forEach((etapa) => {
    config.set(doc(etapasCol(db, C), etapa.id), {
      ...etapa,
      activa: etapa.id === ETAPA_ACTIVA,
      estado: 'abierta',
      categoriasCerradas: [],
    });
  });
  config.set(miembroRef(db, C, DEMO_JUEZ), {
    rol: 'juez', nombre: 'Juez demo', club: '',
    asignaciones: { [ETAPA_ACTIVA]: ETAPAS[ETAPA_ACTIVA].boulders },
  });
  config.set(miembroRef(db, C, DEMO_DELEGADO), { rol: 'delegado', nombre: 'Delegado demo', club: 'Club Demo', asignaciones: {} });
  if (correoAdmin !== DEMO_JUEZ && correoAdmin !== DEMO_DELEGADO) {
    config.set(miembroRef(db, C, correoAdmin), { rol: 'juez_jefe', nombre: 'Admin', club: '', asignaciones: {} });
  }
  await config.commit();

  // 2. Competidoras y orden de paso (ids fijos: recargar la demo los sobrescribe).
  // Los turnos de una versión anterior de la demo que ya no existen se borran.
  const plantel = writeBatch(db);
  competidores.forEach(({ id, ...competidor }) => plantel.set(doc(competidoresCol(db, C), id), competidor));
  await plantel.commit();
  const idsTurnos = new Set(turnos.map((item) => item.id));
  const turnosViejos = (await getDocs(turnosCol(db, C))).docs.filter((item) => !idsTurnos.has(item.id));
  const operacionesTurnos = [
    ...turnosViejos.map((item) => (lote) => lote.delete(item.ref)),
    ...turnos.map(({ id, ...turno }) => (lote) => lote.set(doc(turnosCol(db, C), id), turno)),
  ];
  for (let inicio = 0; inicio < operacionesTurnos.length; inicio += 450) {
    const lote = writeBatch(db);
    operacionesTurnos.slice(inicio, inicio + 450).forEach((operacion) => operacion(lote));
    await lote.commit();
  }

  // 3. Resultados. Las reglas exigen versión + 1, así que se parte de la versión vigente.
  // Un resultado que quedó de una demo anterior y no está en la nueva se deja en cero.
  const existentes = await getDocs(query(resultadosColRef(db), where('competenciaId', '==', C)));
  const versiones = new Map(existentes.docs.map((item) => [item.id, item.data().version ?? 0]));
  const porId = new Map();
  existentes.docs.forEach((item) => {
    const data = item.data();
    porId.set(item.id, {
      etapaId: data.etapaId, competidorId: data.competidorId, boulderId: data.boulderId,
      intentos: 0, zonaEnIntento: null, topEnIntento: null,
    });
  });
  resultados.forEach((item) => porId.set(idResultado({ competenciaId: C, ...item }), item));

  // Un batch por competidora y etapa: las reglas leen pocos documentos por batch.
  const grupos = new Map();
  porId.forEach((item, id) => {
    const grupo = `${item.etapaId}/${item.competidorId}`;
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push([id, item]);
  });
  const escrituras = [...grupos.values()].map((items) => () => {
    const lote = writeBatch(db);
    items.forEach(([id, item]) => agregarResultado(
      lote,
      db,
      { competenciaId: C, etapaId: item.etapaId, competidorId: item.competidorId, boulderId: item.boulderId },
      {
        intentos: item.intentos,
        zonaEnIntento: item.zonaEnIntento,
        topEnIntento: item.topEnIntento,
        version: (versiones.get(id) ?? 0) + 1,
      },
      'edicion',
      correoAdmin,
    ));
    return lote.commit();
  });
  for (let inicio = 0; inicio < escrituras.length; inicio += 20) {
    await Promise.all(escrituras.slice(inicio, inicio + 20).map((escribir) => escribir()));
  }

  // 4. Cierra las rondas terminadas; en la final, todas las categorías menos la que está en curso.
  await Promise.all(etapasCerradas.map((id) => updateDoc(doc(etapasCol(db, C), id), { estado: 'cerrada' })));
  await updateDoc(doc(etapasCol(db, C), ETAPA_ACTIVA), { categoriasCerradas: categoriasCerradasFinal });
}
