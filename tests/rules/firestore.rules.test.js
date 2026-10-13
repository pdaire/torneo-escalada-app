import { afterAll, afterEach, beforeEach, describe, it } from 'vitest';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { guardarResultado } from '../../src/utils/resultado';
import { anonimo, cerrar, denegado, limpiar, permitido, sinReglas, usuario } from './emulador';

const C = 'copa';
const clave = { competenciaId: C, etapaId: 'final', competidorId: 'damas-1', boulderId: 'M1' };
const idRes = 'copa__final__damas-1__M1';
const marcador = (version, extra = {}) => ({ intentos: 1, zonaEnIntento: null, topEnIntento: null, version, ...extra });

async function sembrar() {
  const db = sinReglas();
  await setDoc(doc(db, 'admins/admin@club.cl'), {});
  await setDoc(doc(db, `competencias/${C}`), { nombre: 'Copa', activa: true });
  await setDoc(doc(db, `competencias/${C}/etapas/final`), { nombre: 'Final', boulders: ['M1', 'M2'], activa: true, estado: 'abierta' });
  await setDoc(doc(db, `competencias/${C}/etapas/qualis`), { nombre: 'Qualis', boulders: ['M1'], activa: false, estado: 'cerrada' });
  await setDoc(doc(db, `competencias/${C}/competidores/damas-1`), { dorsal: '1', nombre: 'Ana', categoria: 'Damas', categoriaId: 'damas' });
  await setDoc(doc(db, `competencias/${C}/miembros/juez@club.cl`), { rol: 'juez', asignaciones: { final: ['M1'] } });
  await setDoc(doc(db, `competencias/${C}/miembros/jefe@club.cl`), { rol: 'juez_jefe', asignaciones: {} });
  await setDoc(doc(db, `competencias/${C}/miembros/delegado@club.cl`), { rol: 'delegado', club: 'Club A' });
  await setDoc(doc(db, `competencias/${C}/miembros/otro@club.cl`), { rol: 'delegado', club: 'Club B' });
  // En otra competencia, el delegado es juez.
  await setDoc(doc(db, 'competencias/liga'), { nombre: 'Liga', activa: false });
  await setDoc(doc(db, 'competencias/liga/miembros/delegado@club.cl'), { rol: 'juez_jefe' });
}

beforeEach(async () => {
  await limpiar();
  await sembrar();
});
afterEach(cerrar);
afterAll(limpiar);

describe('configuración', () => {
  it('el público lee, solo el admin escribe', async () => {
    await permitido(getDoc(doc(anonimo(), `competencias/${C}`)));
    await denegado(setDoc(doc(anonimo(), `competencias/${C}`), { nombre: 'x' }));
    await denegado(setDoc(doc(usuario('juez@club.cl'), `competencias/${C}/competidores/x`), { nombre: 'x' }));
    await denegado(setDoc(doc(usuario('cualquiera@gmail.com'), `competencias/${C}`), { nombre: 'x' }));
    await permitido(updateDoc(doc(usuario('admin@club.cl'), `competencias/${C}/etapas/final`), { estado: 'cerrada' }));
  });

  it('miembros: el admin los gestiona, cada uno lee solo el suyo', async () => {
    await permitido(getDoc(doc(usuario('juez@club.cl'), `competencias/${C}/miembros/juez@club.cl`)));
    await denegado(getDoc(doc(usuario('juez@club.cl'), `competencias/${C}/miembros/jefe@club.cl`)));
    await denegado(setDoc(doc(usuario('juez@club.cl'), `competencias/${C}/miembros/juez@club.cl`), { rol: 'juez_jefe' }));
    await permitido(setDoc(doc(usuario('admin@club.cl'), `competencias/${C}/miembros/nuevo@club.cl`), { rol: 'juez', asignaciones: {} }));
    await denegado(setDoc(doc(usuario('admin@club.cl'), `competencias/${C}/miembros/Nuevo@club.cl`), { rol: 'juez' }));
    await denegado(setDoc(doc(usuario('admin@club.cl'), `competencias/${C}/miembros/x@club.cl`), { rol: 'rey' }));
  });

  it('nadie escribe admins ni las colecciones viejas', async () => {
    await denegado(setDoc(doc(usuario('admin@club.cl'), 'admins/otro@club.cl'), {}));
    await denegado(setDoc(doc(usuario('juez@club.cl'), 'intentos/x'), { a: 1 }));
    await denegado(getDocs(collection(usuario('juez@club.cl'), 'apelaciones')));
  });
});

describe('resultados', () => {
  it('el juez anota en su bloque asignado, con historial', async () => {
    await permitido(guardarResultado(usuario('juez@club.cl'), clave, marcador(1), 'intento', 'juez@club.cl'));
    await permitido(guardarResultado(usuario('juez@club.cl'), clave, marcador(2, { intentos: 2, zonaEnIntento: 2 }), 'zona', 'juez@club.cl'));
    await permitido(getDoc(doc(usuario('juez@club.cl'), `resultados/${idRes}/historial/v2`)));
    await denegado(getDoc(doc(anonimo(), `resultados/${idRes}/historial/v2`)));
  });

  it('el juez no anota en un bloque que no tiene asignado; el juez jefe sí', async () => {
    const m2 = { ...clave, boulderId: 'M2' };
    await denegado(guardarResultado(usuario('juez@club.cl'), m2, marcador(1), 'intento', 'juez@club.cl'));
    await permitido(guardarResultado(usuario('jefe@club.cl'), m2, marcador(1), 'intento', 'jefe@club.cl'));
  });

  it('delegados, desconocidos y anónimos no anotan', async () => {
    await denegado(guardarResultado(usuario('delegado@club.cl'), clave, marcador(1), 'intento', 'delegado@club.cl'));
    await denegado(guardarResultado(usuario('cualquiera@gmail.com'), clave, marcador(1), 'intento', 'cualquiera@gmail.com'));
    await denegado(guardarResultado(anonimo(), clave, marcador(1), 'intento', ''));
  });

  it('rechaza una versión vieja (escritura offline atrasada)', async () => {
    await permitido(guardarResultado(usuario('juez@club.cl'), clave, marcador(1), 'intento', 'juez@club.cl'));
    await permitido(guardarResultado(usuario('jefe@club.cl'), clave, marcador(2, { intentos: 3 }), 'edicion', 'jefe@club.cl'));
    await denegado(guardarResultado(usuario('juez@club.cl'), clave, marcador(2, { intentos: 2 }), 'intento', 'juez@club.cl'));
  });

  it('rechaza marcadores inválidos, autor falso e id incoherente', async () => {
    const juez = usuario('juez@club.cl');
    await denegado(guardarResultado(juez, clave, marcador(1, { intentos: -1 }), 'intento', 'juez@club.cl'));
    await denegado(guardarResultado(juez, clave, marcador(1, { zonaEnIntento: 3, topEnIntento: 2, intentos: 3 }), 'top', 'juez@club.cl'));
    await denegado(guardarResultado(juez, clave, marcador(1, { topEnIntento: 1 }), 'top', 'juez@club.cl'));
    await denegado(guardarResultado(juez, clave, marcador(1), 'intento', 'jefe@club.cl'));
    await denegado(setDoc(doc(juez, 'resultados/otro-id'), {
      ...clave, intentos: 1, zonaEnIntento: null, topEnIntento: null, version: 1, actualizadoPor: 'juez@club.cl', actualizadoEn: serverTimestamp(),
    }));
  });

  it('no se anota en una etapa cerrada ni con una competidora inexistente', async () => {
    await denegado(guardarResultado(usuario('jefe@club.cl'), { ...clave, etapaId: 'qualis' }, marcador(1), 'intento', 'jefe@club.cl'));
    await denegado(guardarResultado(usuario('jefe@club.cl'), { ...clave, competidorId: 'fantasma' }, marcador(1), 'intento', 'jefe@club.cl'));
  });

  it('no se anota en una categoría finalizada', async () => {
    await setDoc(doc(sinReglas(), `competencias/${C}/etapas/final`), {
      nombre: 'Final', boulders: ['M1', 'M2'], activa: true, estado: 'abierta', categoriasCerradas: ['damas'],
    });
    await denegado(guardarResultado(usuario('jefe@club.cl'), clave, marcador(1), 'intento', 'jefe@club.cl'));
  });

  it('el historial no se edita ni se escribe suelto', async () => {
    const juez = usuario('juez@club.cl');
    await permitido(guardarResultado(juez, clave, marcador(1), 'intento', 'juez@club.cl'));
    await denegado(updateDoc(doc(juez, `resultados/${idRes}/historial/v1`), { intentos: 9 }));
    await denegado(deleteDoc(doc(juez, `resultados/${idRes}/historial/v1`)));
    await denegado(setDoc(doc(juez, `resultados/${idRes}/historial/v7`), {
      version: 7, accion: 'intento', intentos: 1, zonaEnIntento: null, topEnIntento: null, autor: 'juez@club.cl', en: serverTimestamp(),
    }));
  });

  it('el público lee resultados', async () => {
    await permitido(guardarResultado(usuario('juez@club.cl'), clave, marcador(1), 'intento', 'juez@club.cl'));
    await permitido(getDocs(query(collection(anonimo(), 'resultados'), where('competenciaId', '==', C), where('etapaId', '==', 'final'))));
  });
});

describe('apelaciones', () => {
  const nueva = (correo, extra = {}) => ({
    tipo: 'general',
    estado: 'en_evaluacion',
    argumento: 'La lluvia afectó la segunda mitad.',
    etapaId: 'final',
    etapaNombre: 'Final',
    competidorId: null,
    competidorNombre: null,
    dorsal: null,
    boulderId: null,
    resultadoActual: null,
    autorUid: `uid-${correo}`,
    autorEmail: correo,
    creadaEn: serverTimestamp(),
    ...extra,
  });
  const col = (db) => collection(db, `competencias/${C}/apelaciones`);

  it('solo un delegado de la competencia presenta, con su propio correo', async () => {
    await permitido(addDoc(col(usuario('delegado@club.cl')), nueva('delegado@club.cl')));
    await denegado(addDoc(col(usuario('juez@club.cl')), nueva('juez@club.cl')));
    await denegado(addDoc(col(usuario('delegado@club.cl')), nueva('delegado@club.cl', { autorEmail: 'otro@club.cl' })));
    await denegado(addDoc(col(usuario('delegado@club.cl')), nueva('delegado@club.cl', { estado: 'aceptada' })));
    await denegado(addDoc(col(usuario('delegado@club.cl')), nueva('delegado@club.cl', { argumento: 'corto' })));
  });

  it('un delegado lee solo las suyas; los jueces leen todas', async () => {
    await permitido(addDoc(col(usuario('delegado@club.cl')), nueva('delegado@club.cl')));
    await permitido(getDocs(query(col(usuario('delegado@club.cl')), where('autorUid', '==', 'uid-delegado@club.cl'))));
    await denegado(getDocs(col(usuario('otro@club.cl'))));
    await permitido(getDocs(query(col(usuario('juez@club.cl')), where('etapaId', '==', 'final'), where('estado', '==', 'en_evaluacion'))));
    await denegado(getDocs(col(anonimo())));
  });

  it('solo el juez jefe resuelve', async () => {
    const ref = await addDoc(col(usuario('delegado@club.cl')), nueva('delegado@club.cl'));
    const resolucion = (correo) => ({ estado: 'aceptada', resueltaPor: correo, resueltaEn: serverTimestamp() });
    await denegado(updateDoc(doc(usuario('delegado@club.cl'), ref.path), resolucion('delegado@club.cl')));
    await denegado(updateDoc(doc(usuario('juez@club.cl'), ref.path), resolucion('juez@club.cl')));
    await denegado(updateDoc(doc(usuario('jefe@club.cl'), ref.path), resolucion('otro@club.cl')));
    await permitido(updateDoc(doc(usuario('jefe@club.cl'), ref.path), resolucion('jefe@club.cl')));
  });

  it('el autor edita su borrador, pero no cambia el autor ni edita uno enviado', async () => {
    const delegado = usuario('delegado@club.cl');
    const borrador = await addDoc(col(delegado), nueva('delegado@club.cl', { estado: 'borrador' }));
    await permitido(updateDoc(doc(delegado, borrador.path), { argumento: 'Texto corregido y más largo.' }));
    await denegado(updateDoc(doc(delegado, borrador.path), { autorUid: 'uid-otro@club.cl' }));
    await denegado(updateDoc(doc(usuario('otro@club.cl'), borrador.path), { argumento: 'Lo cambia otro delegado.' }));
    await permitido(updateDoc(doc(delegado, borrador.path), { estado: 'en_evaluacion' }));
    await denegado(updateDoc(doc(delegado, borrador.path), { argumento: 'Ya fue enviada a evaluación.' }));
  });

  it('el mismo correo tiene otro rol en otra competencia', async () => {
    const db = usuario('delegado@club.cl');
    const batch = writeBatch(db);
    batch.set(doc(db, 'competencias/liga/apelaciones/x'), nueva('delegado@club.cl'));
    await denegado(batch.commit());
  });
});
