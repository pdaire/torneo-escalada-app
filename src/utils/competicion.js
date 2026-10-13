import { collection, doc } from 'firebase/firestore';

export function competenciasCol(db) {
  return collection(db, 'competencias');
}

export function competenciaRef(db, competenciaId) {
  return doc(db, 'competencias', competenciaId);
}

export function etapasCol(db, competenciaId) {
  return collection(db, 'competencias', competenciaId, 'etapas');
}

export function competidoresCol(db, competenciaId) {
  return collection(db, 'competencias', competenciaId, 'competidores');
}

export function turnosCol(db, competenciaId) {
  return collection(db, 'competencias', competenciaId, 'turnos');
}

export function miembrosCol(db, competenciaId) {
  return collection(db, 'competencias', competenciaId, 'miembros');
}

export function miembroRef(db, competenciaId, correo) {
  return doc(db, 'competencias', competenciaId, 'miembros', normalizarCorreo(correo));
}

export function apelacionesCol(db, competenciaId) {
  return collection(db, 'competencias', competenciaId, 'apelaciones');
}

export function adminRef(db, correo) {
  return doc(db, 'admins', normalizarCorreo(correo));
}

export function normalizarCorreo(correo) {
  return String(correo || '').trim().toLowerCase();
}

export function slug(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

export function sumarMinutos(hora, minutos) {
  const [horas, mins] = hora.split(':').map(Number);
  const total = (horas * 60) + mins + minutos;
  const horasFinales = Math.floor(total / 60) % 24;
  return `${String(horasFinales).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function docsConId(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
