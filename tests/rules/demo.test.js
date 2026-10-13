import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { cargarDemo } from '../../src/data/cargarDemo';
import { DEMO_ID, generarDemo } from '../../src/data/demo';
import { guardarResultado } from '../../src/utils/resultado';
import { anonimo, cerrar, denegado, limpiar, permitido, sinReglas, usuario } from './emulador';

const ADMIN = 'admin@club.cl';

beforeEach(async () => {
  await limpiar();
  const db = sinReglas();
  await setDoc(doc(db, `admins/${ADMIN}`), {});
  await setDoc(doc(db, 'competencias/otra'), { nombre: 'Otra', activa: true });
});
afterEach(cerrar);
afterAll(limpiar);

async function resultadosDemo() {
  const snap = await getDocs(query(collection(anonimo(), 'resultados'), where('competenciaId', '==', DEMO_ID)));
  return snap.docs.map((item) => item.data());
}

describe('competencia demo', () => {
  it('el admin la carga a través de las reglas y queda activa', async () => {
    await permitido(cargarDemo(usuario(ADMIN), ADMIN, [{ id: 'otra', activa: true }]));
    const publico = anonimo();
    expect((await getDoc(doc(publico, `competencias/${DEMO_ID}`))).data().activa).toBe(true);
    expect((await getDoc(doc(publico, 'competencias/otra'))).data().activa).toBe(false);
    const final = (await getDoc(doc(publico, `competencias/${DEMO_ID}/etapas/final`))).data();
    expect(final.categoriasCerradas).toHaveLength(5);
    expect((await getDoc(doc(publico, `competencias/${DEMO_ID}/etapas/clasificatoria`))).data().estado).toBe('cerrada');
    expect((await getDoc(doc(publico, `competencias/${DEMO_ID}/etapas/semifinal`))).data().estado).toBe('cerrada');
    expect(final.estado).toBe('abierta');
    expect(final.etapaPreviaId).toBe('semifinal');
    expect(await resultadosDemo()).toHaveLength(generarDemo().resultados.length);
  });

  it('el juez demo anota en Mujeres Adultas pero no en una categoría finalizada', async () => {
    await cargarDemo(usuario(ADMIN), ADMIN, []);
    const juez = usuario('pdaire+juez1@gmail.com');
    // La última en salir de Mujeres Adultas todavía no tiene resultados en la final.
    const pendientes = generarDemo().turnos.filter((t) => t.etapaId === 'final' && t.categoriaId === 'mujeres-adultas' && t.orden === 6);
    const enCurso = { competenciaId: DEMO_ID, etapaId: 'final', competidorId: pendientes[0].competidorId, boulderId: 'W1' };
    await permitido(guardarResultado(juez, enCurso, { intentos: 1, zonaEnIntento: null, topEnIntento: null, version: 1 }, 'intento', 'pdaire+juez1@gmail.com'));
    const cerrada = generarDemo().turnos.find((t) => t.etapaId === 'final' && t.categoriaId === 'hombres-adultos' && t.boulderId === 'M1');
    const claveCerrada = { competenciaId: DEMO_ID, etapaId: 'final', competidorId: cerrada.competidorId, boulderId: 'M1' };
    await denegado(guardarResultado(juez, claveCerrada, { intentos: 9, zonaEnIntento: null, topEnIntento: null, version: 2 }, 'edicion', 'pdaire+juez1@gmail.com'));
  });

  it('se puede recargar: reinicia lo anotado durante la demo', async () => {
    await cargarDemo(usuario(ADMIN), ADMIN, []);
    const pendiente = generarDemo().turnos.find((t) => t.etapaId === 'final' && t.categoriaId === 'mujeres-adultas' && t.orden === 6);
    const clave = { competenciaId: DEMO_ID, etapaId: 'final', competidorId: pendiente.competidorId, boulderId: 'W1' };
    await guardarResultado(usuario(ADMIN), clave, { intentos: 1, zonaEnIntento: 1, topEnIntento: 1, version: 1 }, 'top', ADMIN);
    await permitido(cargarDemo(usuario(ADMIN), ADMIN, []));
    const anotado = (await resultadosDemo()).find((r) => r.competidorId === pendiente.competidorId && r.boulderId === 'W1' && r.etapaId === 'final');
    expect(anotado).toMatchObject({ intentos: 0, topEnIntento: null, version: 2 });
  });

  it('una carga cortada a medias se completa al volver a cargar', async () => {
    await cargarDemo(usuario(ADMIN), ADMIN, []);
    // Simula una carga que se cortó antes de terminar: faltan resultados de la final
    // y las etapas quedaron abiertas.
    const db = sinReglas();
    const faltantes = (await getDocs(query(collection(db, 'resultados'), where('competenciaId', '==', DEMO_ID), where('etapaId', '==', 'final'))))
      .docs.filter((item) => item.id.includes('mujeres-adultas') || item.id.includes('hombres-adultos'));
    // El resultado y su historial van en el mismo batch: si el batch no llegó, no existe ninguno.
    await Promise.all(faltantes.flatMap((item) => [deleteDoc(item.ref), deleteDoc(doc(item.ref, 'historial', 'v1'))]));
    for (const etapa of ['clasificatoria', 'semifinal', 'final']) {
      await setDoc(doc(db, `competencias/${DEMO_ID}/etapas/${etapa}`), { estado: 'abierta', categoriasCerradas: [] }, { merge: true });
    }

    await permitido(cargarDemo(usuario(ADMIN), ADMIN, []));
    expect(await resultadosDemo()).toHaveLength(generarDemo().resultados.length);
    const publico = anonimo();
    expect((await getDoc(doc(publico, `competencias/${DEMO_ID}/etapas/semifinal`))).data().estado).toBe('cerrada');
    expect((await getDoc(doc(publico, `competencias/${DEMO_ID}/etapas/final`))).data().categoriasCerradas).toHaveLength(5);
  });

  it('alguien que no es admin no puede cargarla', async () => {
    await denegado(cargarDemo(usuario('pdaire+juez1@gmail.com'), 'pdaire+juez1@gmail.com', []));
  });
});
