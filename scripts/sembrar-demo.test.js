// Carga las competencias demo en los emuladores. Lo usa `npm run demo:local`.
// Crea las cuentas demo en el emulador de Authentication y carga la demo como
// un admin, a través de las reglas, igual que el botón de /admin.
import { it } from 'vitest';
import { doc, setDoc } from 'firebase/firestore';
import { cargarDemo } from '../src/data/cargarDemo';
import { DEMO_DELEGADO, DEMO_JUEZ } from '../src/data/demo';
import { demoPrimavera } from '../src/data/demoPrimavera';
import { cerrar, limpiar, PROYECTO, sinReglas, usuario } from '../tests/rules/emulador';

const ADMIN = 'admin@demo.local';
const CLAVE = 'demo1234';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

async function crearCuenta(email) {
  const respuesta = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: CLAVE }),
  });
  if (!respuesta.ok) throw new Error(`No se pudo crear ${email}: ${await respuesta.text()}`);
}

it('carga la competencia demo', async () => {
  await limpiar();
  await fetch(`http://${AUTH}/emulator/v1/projects/${PROYECTO}/accounts`, { method: 'DELETE' });
  await Promise.all([ADMIN, DEMO_JUEZ, DEMO_DELEGADO].map(crearCuenta));
  await setDoc(doc(sinReglas(), `admins/${ADMIN}`), {});
  // Primero la chica; la principal queda como competencia activa.
  await cargarDemo(usuario(ADMIN), ADMIN, [], () => {}, demoPrimavera());
  await cargarDemo(usuario(ADMIN), ADMIN, [{ id: 'primavera-el-muro', activa: true }]);
  await cerrar();
  console.log(`\nCuentas demo (clave ${CLAVE}): ${ADMIN} (admin y juez jefe), ${DEMO_JUEZ}, ${DEMO_DELEGADO}\n`);
}, 60000);
