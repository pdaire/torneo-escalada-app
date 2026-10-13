import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// La configuración web de Firebase es pública: la seguridad está en firestore.rules.
const firebaseConfig = {
  apiKey: "AIzaSyCHnGqbljxgxaOhcvu3E_LJ1gFbkWy3Y6g",
  authDomain: "torneo-escalada-app.firebaseapp.com",
  projectId: "torneo-escalada-app",
  storageBucket: "torneo-escalada-app.firebasestorage.app",
  messagingSenderId: "766624450650",
  appId: "1:766624450650:web:9ce24969ef5cc729e33063"
};

// `npm run demo:local` usa el emulador de Firestore con la competencia demo,
// sin tocar la base real.
const emulador = import.meta.env.VITE_EMULADOR === '1';

const app = initializeApp(emulador ? { ...firebaseConfig, projectId: "demo-torneo" } : firebaseConfig);

// Caché offline compartida entre pestañas: la tablet sigue anotando sin red
// y sincroniza al volver la conexión.
export const db = initializeFirestore(app, {
  localCache: emulador
    ? memoryLocalCache()
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
if (emulador) connectFirestoreEmulator(db, "127.0.0.1", 8080);
export const auth = getAuth(app);
