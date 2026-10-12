import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function JuezView() {
  // Estados para el inicio de sesión
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Estados para el competidor actual (Datos simulados por ahora)
  const [competidorActual] = useState({ id: "comp_123", nombre: "Martina Gómez", dorsal: "42", categoria: "Sub-15 Damas" });
  
  // Estados del puntaje en vivo
  const [intentos, setIntentos] = useState(0);
  const [zonaAlcanzada, setZonaAlcanzada] = useState(false);
  const [topAlcanzado, setTopAlcanzado] = useState(false);
  const [intentoZona, setIntentoZona] = useState(null);
  const [intentoTop, setIntentoTop] = useState(null);

  // Escuchar si hay un usuario logueado
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuarioActual) => {
      setUser(usuarioActual);
    });
    return () => unsubscribe();
  }, []);

  // La plantilla de Vite limita el ancho de #root. En el kiosco la pantalla tiene que ocupar la tablet entera.
  useEffect(() => {
    document.body.classList.add('kiosk-mode');
    return () => document.body.classList.remove('kiosk-mode');
  }, []);

  // Función para iniciar sesión
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, pin);
      setErrorLogin('');
    } catch (error) {
      setErrorLogin('Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  // Función principal: Guardar en la base de datos
  const registrarAccion = async (tipoAccion) => {
    // 1. Calculamos los nuevos valores según el botón que presionó
    let nuevosIntentos = intentos;
    let nuevaZona = zonaAlcanzada;
    let nuevoTop = topAlcanzado;
    let nuevoIntentoZona = intentoZona;
    let nuevoIntentoTop = intentoTop;

    if (tipoAccion === 'INTENTO') nuevosIntentos += 1;
    if (tipoAccion === 'ZONA') {
        if (!zonaAlcanzada) {
          nuevosIntentos += 1; // La zona consume un intento si es la primera vez
          nuevoIntentoZona = nuevosIntentos;
        }
        nuevaZona = true;
    }
    if (tipoAccion === 'TOP') {
        if (!topAlcanzado) {
          nuevosIntentos += 1; // El top consume un intento si es la primera vez
          nuevoIntentoTop = nuevosIntentos;
          if (!zonaAlcanzada) nuevoIntentoZona = nuevosIntentos; // El top implica zona en el mismo intento
        }
        nuevaZona = true; // Si hace top, implícitamente hizo zona
        nuevoTop = true;
    }

    // 2. Actualizamos la pantalla del juez al instante
    setIntentos(nuevosIntentos);
    setZonaAlcanzada(nuevaZona);
    setTopAlcanzado(nuevoTop);
    setIntentoZona(nuevoIntentoZona);
    setIntentoTop(nuevoIntentoTop);

    // 3. Enviamos el registro a Firebase
    try {
      await addDoc(collection(db, 'intentos'), {
        torneo_id: 'torneo_actual',
        boulder_id: 'W1', // Esto luego vendrá del perfil del juez
        competidor_id: competidorActual.id,
        nombre_competidor: competidorActual.nombre,
        juez_email: user.email,
        accion: tipoAccion,
        intentos_acumulados: nuevosIntentos,
        zona: nuevaZona,
        top: nuevoTop,
        intento_zona: nuevoIntentoZona,
        intento_top: nuevoIntentoTop,
        timestamp: serverTimestamp()
      });
      console.log("Acción guardada con éxito:", tipoAccion);
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar. Revisa tu conexión.");
    }
  };

  const resetearTurno = () => {
    // Esto se usa cuando el competidor termina y viene el siguiente
    setIntentos(0);
    setZonaAlcanzada(false);
    setTopAlcanzado(false);
    setIntentoZona(null);
    setIntentoTop(null);
  };

  // --- PANTALLA DE LOGIN ---
  if (!user) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center', color: '#111', backgroundColor: '#fff', minHeight: '100svh', boxSizing: 'border-box' }}>
        <h2>Acceso Jueces</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '300px', margin: '0 auto' }}>
          <input type="email" placeholder="Correo asignado (ej: w1@tuclub.com)" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '1rem', fontSize: '1.2rem' }} required />
          <input type="password" placeholder="PIN de acceso" value={pin} onChange={(e) => setPin(e.target.value)} style={{ padding: '1rem', fontSize: '1.2rem' }} required />
          <button type="submit" style={{ padding: '1rem', fontSize: '1.2rem', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '8px' }}>Ingresar</button>
        </form>
        {errorLogin && <p style={{ color: 'red' }}>{errorLogin}</p>}
      </div>
    );
  }

  // --- PANTALLA DEL KIOSCO (EL JUEZ TRABAJANDO) ---
  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', height: '95vh', color: '#111', backgroundColor: '#fff', boxSizing: 'border-box' }}>
      
      {/* Cabecera (Info del Juez y Competidor) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f0f0', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, color: '#666' }}>Bloque W1 - {user.email}</h4>
          <h2 style={{ margin: '5px 0 0 0', fontSize: '2rem', color: '#111' }}>#{competidorActual.dorsal} {competidorActual.nombre}</h2>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#111' }}>{competidorActual.categoria}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '3rem', color: '#111' }}>{intentos}</h1>
            <p style={{ margin: 0, color: '#111' }}>Intentos</p>
        </div>
      </div>

      {/* Botonera Gigante */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
        <button 
          onClick={() => registrarAccion('INTENTO')}
          disabled={topAlcanzado}
          style={{ flexGrow: 1, fontSize: '2.5rem', backgroundColor: topAlcanzado ? '#ccc' : '#e0e0e0', border: 'none', borderRadius: '12px', fontWeight: 'bold', touchAction: 'manipulation' }}>
          + INTENTO
        </button>

        <div style={{ display: 'flex', gap: '1rem', flexGrow: 1.5 }}>
          <button 
            onClick={() => registrarAccion('ZONA')}
            disabled={zonaAlcanzada || topAlcanzado}
            style={{ flexGrow: 1, fontSize: '2.5rem', backgroundColor: zonaAlcanzada ? '#ffc107' : '#fff3cd', border: zonaAlcanzada ? '4px solid #d39e00' : '2px solid #ffc107', borderRadius: '12px', fontWeight: 'bold', touchAction: 'manipulation' }}>
            {zonaAlcanzada ? (
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                <span>ZONA ✅</span>
                <span style={{ fontSize: '1.5rem' }}>Intento {intentoZona}</span>
              </span>
            ) : 'MARCAR ZONA'}
          </button>

          <button 
            onClick={() => registrarAccion('TOP')}
            disabled={topAlcanzado}
            style={{ flexGrow: 1, fontSize: '2.5rem', backgroundColor: topAlcanzado ? '#28a745' : '#d4edda', border: topAlcanzado ? '4px solid #1e7e34' : '2px solid #28a745', borderRadius: '12px', fontWeight: 'bold', touchAction: 'manipulation' }}>
            {topAlcanzado ? (
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                <span>TOP ✅</span>
                <span style={{ fontSize: '1.5rem' }}>Intento {intentoTop}</span>
              </span>
            ) : 'MARCAR TOP'}
          </button>
        </div>
      </div>

      {/* Barra inferior de control */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button onClick={() => signOut(auth)} style={{ padding: '1rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '8px' }}>Cerrar Sesión</button>
        <button onClick={resetearTurno} style={{ padding: '1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem' }}>Siguiente Competidor ➡️</button>
      </div>

    </div>
  );
}
