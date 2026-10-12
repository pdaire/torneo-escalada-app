// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCHnGqbljxgxaOhcvu3E_LJ1gFbkWy3Y6g",
  authDomain: "torneo-escalada-app.firebaseapp.com",
  projectId: "torneo-escalada-app",
  storageBucket: "torneo-escalada-app.firebasestorage.app",
  messagingSenderId: "766624450650",
  appId: "1:766624450650:web:9ce24969ef5cc729e33063"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exportamos la Base de Datos y la Autenticación para usarlas en otras pantallas
export const db = getFirestore(app);
export const auth = getAuth(app);

// Activar persistencia Offline
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Múltiples pestañas abiertas, persistencia offline solo funciona en una.");
    } else if (err.code == 'unimplemented') {
      console.warn("El navegador actual no soporta persistencia offline.");
    }
  });

  