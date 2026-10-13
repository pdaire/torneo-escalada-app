import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { adminRef, miembroRef, normalizarCorreo } from '../utils/competicion';

export function useUsuario() {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (actual) => {
    setUser(actual);
    setCargando(false);
  }), []);

  return { user, correo: normalizarCorreo(user?.email), cargando };
}

// Rol del usuario en una competencia: `competencias/{id}/miembros/{correo}`.
export function useMiembro(user, competenciaId) {
  const [estado, setEstado] = useState({ miembro: null, cargando: true, clave: '' });
  const clave = user && competenciaId ? `${competenciaId}/${user.email}` : '';

  useEffect(() => {
    if (!clave) return undefined;
    return onSnapshot(miembroRef(db, competenciaId, user.email), (snap) => {
      setEstado({ miembro: snap.exists() ? snap.data() : null, cargando: false, clave });
    }, () => setEstado({ miembro: null, cargando: false, clave }));
  }, [clave]);

  if (!clave) return { miembro: null, cargando: false };
  if (estado.clave !== clave) return { miembro: null, cargando: true };
  return { miembro: estado.miembro, cargando: estado.cargando };
}

// Super admin: su correo está en `admins` y está verificado (entró con Google).
// Igual que en las reglas, una cuenta de correo y clave con ese correo no cuenta.
export function useEsAdmin(user) {
  const [estado, setEstado] = useState({ esAdmin: false, cargando: true, correo: '' });
  const correo = normalizarCorreo(user?.email);

  useEffect(() => {
    if (!correo) return undefined;
    return onSnapshot(adminRef(db, correo), (snap) => {
      setEstado({ esAdmin: snap.exists(), cargando: false, correo });
    }, () => setEstado({ esAdmin: false, cargando: false, correo }));
  }, [correo]);

  if (!correo) return { esAdmin: false, cargando: false };
  if (estado.correo !== correo) return { esAdmin: false, cargando: true };
  return {
    esAdmin: estado.esAdmin && Boolean(user?.emailVerified),
    // Su correo está en `admins`, pero entró con correo y clave.
    faltaGoogle: estado.esAdmin && !user?.emailVerified,
    cargando: estado.cargando,
  };
}
