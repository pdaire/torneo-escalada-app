import { doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { competenciaRef, competidoresCol, etapasCol, miembroRef, turnosCol } from '../utils/competicion';
import { agregarResultado, idResultado, resultadosColRef } from '../utils/resultado';
import { DEMO_DELEGADO, DEMO_JUEZ, demoPrincipal } from './demo';

// Carga o reinicia una competencia demo (la principal por defecto) y la publica en la portada.
// Escribe con la sesión del admin, que queda como juez jefe de la demo: así los
// resultados pasan por las mismas reglas que en una competencia real.
// Si se corta a medias, volver a cargarla la completa: parte de las versiones vigentes.
export async function cargarDemo(db, correoAdmin, onProgreso = () => {}, demo = demoPrincipal()) {
  const { competidores, turnos, resultados, etapasCerradas, categoriasCerradas } = demo;
  const C = demo.id;

  // 1. Competencia, etapas abiertas y miembros.
  onProgreso('Configurando la competencia…');
  const config = writeBatch(db);
  config.set(competenciaRef(db, C), { nombre: demo.nombre, fecha: new Date().toISOString().slice(0, 10), activa: true });
  demo.etapas.forEach((etapa) => {
    config.set(doc(etapasCol(db, C), etapa.id), {
      ...etapa,
      activa: etapa.id === demo.etapaActiva,
      estado: 'abierta',
      categoriasCerradas: [],
    });
  });
  config.set(miembroRef(db, C, DEMO_JUEZ), {
    rol: 'juez', nombre: 'Juez demo', club: '',
    asignaciones: demo.asignacionesJuez,
  });
  config.set(miembroRef(db, C, DEMO_DELEGADO), { rol: 'delegado', nombre: 'Delegado demo', club: 'Club Demo', asignaciones: {} });
  if (correoAdmin !== DEMO_JUEZ && correoAdmin !== DEMO_DELEGADO) {
    config.set(miembroRef(db, C, correoAdmin), { rol: 'juez_jefe', nombre: 'Admin', club: '', asignaciones: {} });
  }
  await config.commit();

  // 2. Competidoras y orden de paso (ids fijos: recargar la demo los sobrescribe).
  // Los turnos de una versión anterior de la demo que ya no existen se borran.
  onProgreso(turnos.length ? 'Cargando competidoras y orden de paso…' : 'Cargando competidoras…');
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

  // Batches por competidora y etapa, de hasta 8 resultados: las reglas pueden leer
  // como máximo 20 documentos por batch (miembro, etapa, competidora y cada resultado).
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
    onProgreso(`Cargando resultados: ${inicio} de ${escrituras.length}…`);
    await Promise.all(escrituras.slice(inicio, inicio + 20).map((escribir) => escribir()));
  }
  onProgreso('Cerrando etapas…');

  // 4. Cierra las rondas terminadas y las categorías finalizadas.
  await Promise.all([
    ...etapasCerradas.map((id) => updateDoc(doc(etapasCol(db, C), id), { estado: 'cerrada' })),
    ...Object.entries(categoriasCerradas).map(([id, cerradas]) => updateDoc(doc(etapasCol(db, C), id), { categoriasCerradas: cerradas })),
  ]);
}
