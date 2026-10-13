// Carga la competencia demo en el emulador de Firestore. Lo usa `npm run demo:local`.
// Escribe como un admin de prueba, a través de las reglas, igual que el botón de /admin.
import { it } from 'vitest';
import { doc, setDoc } from 'firebase/firestore';
import { cargarDemo } from '../src/data/cargarDemo';
import { cerrar, limpiar, sinReglas, usuario } from '../tests/rules/emulador';

it('carga la competencia demo', async () => {
  await limpiar();
  await setDoc(doc(sinReglas(), 'admins/admin@demo.local'), {});
  await cargarDemo(usuario('admin@demo.local'), 'admin@demo.local', []);
  await cerrar();
}, 60000);
