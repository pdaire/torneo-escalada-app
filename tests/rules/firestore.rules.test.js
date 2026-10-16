import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { guardarResultado } from '../../src/utils/resultado';
import { anonimo, cerrar, denegado, limpiar, permitido, sinReglas, usuario, usuarioGoogle } from './emulador';

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
    await permitido(updateDoc(doc(usuarioGoogle('admin@club.cl'), `competencias/${C}/etapas/final`), { estado: 'cerrada' }));
  });

  it('miembros: el admin los gestiona, cada uno lee solo el suyo', async () => {
    await permitido(getDoc(doc(usuario('juez@club.cl'), `competencias/${C}/miembros/juez@club.cl`)));
    await denegado(getDoc(doc(usuario('juez@club.cl'), `competencias/${C}/miembros/jefe@club.cl`)));
    await denegado(setDoc(doc(usuario('juez@club.cl'), `competencias/${C}/miembros/juez@club.cl`), { rol: 'juez_jefe' }));
    await permitido(setDoc(doc(usuarioGoogle('admin@club.cl'), `competencias/${C}/miembros/nuevo@club.cl`), { rol: 'juez', asignaciones: {} }));
    await denegado(setDoc(doc(usuarioGoogle('admin@club.cl'), `competencias/${C}/miembros/Nuevo@club.cl`), { rol: 'juez' }));
    await denegado(setDoc(doc(usuarioGoogle('admin@club.cl'), `competencias/${C}/miembros/x@club.cl`), { rol: 'rey' }));
  });

  it('el organizador administra solo su competencia y no la publica en la portada', async () => {
    const db = sinReglas();
    await setDoc(doc(db, `competencias/${C}/miembros/org@club.cl`), { rol: 'organizador' });
    await setDoc(doc(db, 'competencias/ajena'), { nombre: 'Ajena', activa: true });
    const org = usuario('org@club.cl');
    await permitido(setDoc(doc(org, `competencias/${C}/competidores/nueva`), { dorsal: '9', nombre: 'Nueva', categoria: 'Damas', categoriaId: 'damas' }));
    await permitido(updateDoc(doc(org, `competencias/${C}/etapas/final`), { estado: 'cerrada' }));
    await permitido(setDoc(doc(org, `competencias/${C}/miembros/otrojuez@club.cl`), { rol: 'juez', asignaciones: {} }));
    await permitido(getDocs(collection(org, `competencias/${C}/miembros`)));
    await permitido(updateDoc(doc(org, `competencias/${C}`), { nombre: 'Copa renombrada' }));
    await denegado(updateDoc(doc(org, `competencias/${C}`), { activa: false }));
    await denegado(setDoc(doc(org, 'competencias/nueva-copa'), { nombre: 'Nueva' }));
    await denegado(setDoc(doc(org, 'competencias/ajena/competidores/x'), { nombre: 'x' }));
    await denegado(getDocs(collection(org, 'competencias/ajena/miembros')));
    // No es juez: no anota resultados.
    await denegado(guardarResultado(org, clave, marcador(1), 'intento', 'org@club.cl'));
  });

  it('un juez no administra ni se cambia el rol', async () => {
    await denegado(setDoc(doc(usuario('juez@club.cl'), `competencias/${C}/miembros/juez@club.cl`), { rol: 'organizador' }));
    await denegado(getDocs(collection(usuario('juez@club.cl'), `competencias/${C}/miembros`)));
  });

  it('el super admin crea una competencia con sus etapas y su organizador en un batch', async () => {
    const { plantilla } = await import('../../src/data/plantillas');
    const db = usuarioGoogle('admin@club.cl');
    const batch = writeBatch(db);
    batch.set(doc(db, 'competencias/copa-nueva'), { nombre: 'Copa nueva', fecha: '2026-11-15', club: 'Club', lugar: '', activa: false, creadaEn: serverTimestamp() });
    plantilla('americana-final').etapas().forEach(({ id, ...etapa }) => batch.set(doc(db, `competencias/copa-nueva/etapas/${id}`), etapa));
    batch.set(doc(db, 'competencias/copa-nueva/miembros/org@club.cl'), { rol: 'organizador', nombre: '', club: 'Club', asignaciones: {} });
    await permitido(batch.commit());
    // El organizador ya puede administrarla.
    await permitido(setDoc(doc(usuario('org@club.cl'), 'competencias/copa-nueva/competidores/general-1'), { dorsal: '1', nombre: 'Ana', categoria: 'General', categoriaId: 'general' }));
  });

  it('el super admin tiene que entrar con Google: con correo y clave no es admin', async () => {
    await permitido(setDoc(doc(usuarioGoogle('admin@club.cl'), 'competencias/nueva-copa'), { nombre: 'Nueva', activa: false }));
    await denegado(setDoc(doc(usuario('admin@club.cl'), 'competencias/otra-copa'), { nombre: 'Otra', activa: false }));
    await denegado(updateDoc(doc(usuario('admin@club.cl'), `competencias/${C}`), { activa: false }));
  });

  it('nadie escribe admins ni las colecciones viejas', async () => {
    await denegado(setDoc(doc(usuarioGoogle('admin@club.cl'), 'admins/otro@club.cl'), {}));
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

  it('ronda americana: máximo de intentos y top en el último intento', async () => {
    await setDoc(doc(sinReglas(), `competencias/${C}/etapas/final`), {
      nombre: 'Final', boulders: ['M1', 'M2'], activa: true, estado: 'abierta', formato: 'americana', maxIntentos: 5,
    });
    const jefe = usuario('jefe@club.cl');
    await denegado(guardarResultado(jefe, clave, marcador(1, { intentos: 6 }), 'intento', 'jefe@club.cl'));
    await denegado(guardarResultado(jefe, clave, marcador(1, { intentos: 3, zonaEnIntento: 2, topEnIntento: 2 }), 'top', 'jefe@club.cl'));
    await permitido(guardarResultado(jefe, clave, marcador(1, { intentos: 5 }), 'intento', 'jefe@club.cl'));
    await permitido(guardarResultado(jefe, clave, marcador(2, { intentos: 5, zonaEnIntento: 5, topEnIntento: 5 }), 'top', 'jefe@club.cl'));
  });

  it('ronda americana por sector: A1 y B1 son bloques distintos y el juez del sector A solo anota en A', async () => {
    const { plantilla } = await import('../../src/data/plantillas');
    const [{ id, ...etapa }] = plantilla('americana-sectores').etapas();
    const db = sinReglas();
    await setDoc(doc(db, `competencias/${C}/etapas/${id}`), etapa);
    await setDoc(doc(db, `competencias/${C}/miembros/sectora@club.cl`), { rol: 'juez', asignaciones: { [id]: etapa.sectores.A } });
    const juez = usuario('sectora@club.cl');
    const claveBloque = (boulderId) => ({ competenciaId: C, etapaId: id, competidorId: 'damas-1', boulderId });
    const top = { intentos: 1, zonaEnIntento: 1, topEnIntento: 1, version: 1 };
    await permitido(guardarResultado(juez, claveBloque('A1'), top, 'top', 'sectora@club.cl'));
    await denegado(guardarResultado(juez, claveBloque('B1'), top, 'top', 'sectora@club.cl'));
    // A1 quedó anotado y B1 sigue sin resultado: son documentos distintos.
    expect((await getDoc(doc(anonimo(), `resultados/${C}__${id}__damas-1__A1`))).exists()).toBe(true);
    expect((await getDoc(doc(anonimo(), `resultados/${C}__${id}__damas-1__B1`))).exists()).toBe(false);
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

  it('nadie borra resultados, ni el admin', async () => {
    await permitido(guardarResultado(usuario('juez@club.cl'), clave, marcador(1), 'intento', 'juez@club.cl'));
    await denegado(deleteDoc(doc(usuarioGoogle('admin@club.cl'), `resultados/${idRes}`)));
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
