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

// Palabras que no pueden ser el nombre de una competencia en la URL:
// son rutas de la app o archivos publicados.
const RESERVADAS = new Set(['admin', 'juez', 'delegado', 'competidor', 'assets', 'index.html', 'sw-juez.js', 'favicon.svg', 'icons.svg']);

// El id de una competencia es su nombre en la URL: /copa-chile/juez.
// Valida el slug elegido al crear la competencia; devuelve '' si sirve.
export function validarSlug(valor, existentes = []) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(valor)) {
    return 'Usa solo minúsculas, números y guiones, sin guion al inicio ni al final. Ejemplo: copa-chile-2026.';
  }
  if (valor.length < 3 || valor.length > 60) return 'El nombre en la URL tiene que tener entre 3 y 60 caracteres.';
  if (RESERVADAS.has(valor) || valor.startsWith('juez')) return `"${valor}" está reservado por la app. Elige otro.`;
  if (existentes.includes(valor)) return `Ya existe una competencia con la dirección /${valor}.`;
  return '';
}

// Rutas de una competencia.
export const rutas = {
  tablero: (c, parametros) => `/${c}${parametros ? `?${new URLSearchParams(parametros)}` : ''}`,
  competidor: (c, id) => `/${c}/competidor/${id}`,
  juez: (c) => `/${c}/juez`,
  delegado: (c) => `/${c}/delegado`,
  admin: (c) => `/${c}/admin`,
};
