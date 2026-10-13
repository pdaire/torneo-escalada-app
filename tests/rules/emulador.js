// Clientes del SDK conectados al emulador de Firestore, cada uno con una identidad simulada.
// Reemplaza a @firebase/rules-unit-testing, que todavía no soporta firebase 13.
import { deleteApp, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, terminate } from 'firebase/firestore';

export const PROYECTO = 'demo-torneo';
const [HOST, PUERTO] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const apps = [];

function cliente(nombre, token) {
  const app = initializeApp({ projectId: PROYECTO }, `${nombre}-${apps.length}`);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, Number(PUERTO), token ? { mockUserToken: token } : {});
  apps.push({ app, db });
  return db;
}

export function anonimo() {
  return cliente('anonimo');
}

// Cuenta de correo y clave: el correo no viene verificado.
export function usuario(correo) {
  return cliente(correo, { sub: `uid-${correo}`, email: correo });
}

// Cuenta que entra con Google: el correo viene verificado.
export function usuarioGoogle(correo) {
  return cliente(`${correo}-google`, { sub: `uid-google-${correo}`, email: correo, email_verified: true });
}

// Ignora las reglas: sirve para preparar datos.
export function sinReglas() {
  return cliente('owner', 'owner');
}

export async function limpiar() {
  await fetch(`http://${HOST}:${PUERTO}/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: 'DELETE' });
}

export async function cerrar() {
  await Promise.all(apps.splice(0).map(async ({ app, db }) => {
    await terminate(db);
    await deleteApp(app);
  }));
}

export async function permitido(promesa) {
  await promesa;
}

export async function denegado(promesa) {
  try {
    await promesa;
  } catch (error) {
    if (error.code === 'permission-denied') return;
    throw error;
  }
  throw new Error('Se esperaba permiso denegado');
}
