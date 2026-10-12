import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  TORNEO_ID,
  leerResultado,
  prepararResultado,
  resultadoDocRef,
  resultadoVacio,
  validarResultado,
} from '../utils/resultado';
import { BOULDERS, COMPETIDORES, buscarPorDorsal, turnosDe } from '../data/ordenAbsolutaDamas';

const COMPETIDORES_POR_ID = Object.fromEntries(COMPETIDORES.map((competidor) => [competidor.id, competidor]));

function leerPreferencia(clave, valorInicial) {
  try {
    return localStorage.getItem(clave) || valorInicial;
  } catch {
    return valorInicial;
  }
}

const botonBase = {
  border: 'none',
  borderRadius: '12px',
  fontWeight: 'bold',
  touchAction: 'manipulation',
};

export default function JuezView() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  const [boulderId, setBoulderId] = useState(() => leerPreferencia('juez.boulder', 'M1'));
  const [turnoIndex, setTurnoIndex] = useState(() => Number(leerPreferencia(`juez.turno.${leerPreferencia('juez.boulder', 'M1')}`, '0')) || 0);
  const [competidorId, setCompetidorId] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [dorsalBusqueda, setDorsalBusqueda] = useState('');
  const [score, setScore] = useState(resultadoVacio());
  const [listo, setListo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(resultadoVacio());
  const [errorEdicion, setErrorEdicion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const scoreRef = useRef(resultadoVacio());
  const escriturasPendientes = useRef(0);
  const colaEscritura = useRef(Promise.resolve());
  const docActivo = useRef('');
  const escribiendoDoc = useRef('');
  const turnos = turnosDe(boulderId);
  const turnoSeguro = Math.min(turnoIndex, turnos.length - 1);
  const programada = turnos[turnoSeguro].competidor;
  const competidor = (competidorId && turnos.find((turno) => turno.competidor.id === competidorId)?.competidor)
    || COMPETIDORES_POR_ID[competidorId]
    || programada;
  const contextoRef = useRef({ competidor, boulderId });
  contextoRef.current = { competidor, boulderId };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuarioActual) => {
      setUser(usuarioActual);
      if (!usuarioActual) setListo(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.body.classList.add('kiosk-mode');
    return () => document.body.classList.remove('kiosk-mode');
  }, []);

  useEffect(() => {
    if (!user || !competidor) return undefined;
    const docId = `${competidor.id}_${boulderId}`;
    docActivo.current = docId;
    const vacio = resultadoVacio();
    scoreRef.current = vacio;
    setScore(vacio);
    setListo(false);
    setEditando(false);
    const unsubscribe = onSnapshot(resultadoDocRef(db, competidor.id, boulderId), (snap) => {
      if (docActivo.current !== docId) return;
      if (escriturasPendientes.current > 0 && escribiendoDoc.current === docId) return;
      const next = leerResultado(snap.data());
      scoreRef.current = next;
      setScore(next);
      setListo(true);
    }, (error) => {
      console.error('Error al leer el resultado:', error);
      setListo(true);
      alert('No se pudo leer el resultado. Revisa tu conexión.');
    });
    return () => unsubscribe();
  }, [user, competidor.id, boulderId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, pin);
      setErrorLogin('');
    } catch (error) {
      setErrorLogin('Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  const persistir = async (next, competidorActual, boulderActual) => {
    await setDoc(resultadoDocRef(db, competidorActual.id, boulderActual), {
      torneoId: TORNEO_ID,
      competidorId: competidorActual.id,
      nombre: competidorActual.nombre,
      dorsal: competidorActual.dorsal,
      categoria: competidorActual.categoria,
      categoriaId: competidorActual.categoriaId,
      boulderId: boulderActual,
      intentos: next.intentos,
      zonaEnIntento: next.zonaEnIntento,
      topEnIntento: next.topEnIntento,
      actualizadoPor: user.email,
      actualizadoEn: serverTimestamp(),
    });
  };

  const encolarEscritura = (next, competidorActual, boulderActual) => {
    const docId = `${competidorActual.id}_${boulderActual}`;
    escribiendoDoc.current = docId;
    escriturasPendientes.current += 1;
    colaEscritura.current = colaEscritura.current
      .then(() => persistir(next, competidorActual, boulderActual))
      .catch((error) => {
        console.error('Error al guardar:', error);
        alert('Error al guardar. Revisa tu conexión.');
      })
      .finally(() => {
        escriturasPendientes.current -= 1;
      });
  };

  const aplicar = (mutator) => {
    const { competidor: competidorActual, boulderId: boulderActual } = contextoRef.current;
    const next = mutator({ ...scoreRef.current });
    scoreRef.current = next;
    setScore(next);
    encolarEscritura(next, competidorActual, boulderActual);
  };

  const sumarIntento = () => {
    if (scoreRef.current.topEnIntento != null) return;
    aplicar((actual) => ({ ...actual, intentos: actual.intentos + 1 }));
  };

  const marcarZona = () => {
    const actual = scoreRef.current;
    if (actual.zonaEnIntento != null || actual.topEnIntento != null || actual.intentos < 1) return;
    aplicar((prev) => ({ ...prev, zonaEnIntento: prev.intentos }));
  };

  const marcarTop = () => {
    const actual = scoreRef.current;
    if (actual.topEnIntento != null || actual.intentos < 1) return;
    aplicar((prev) => ({
      ...prev,
      topEnIntento: prev.intentos,
      zonaEnIntento: prev.zonaEnIntento ?? prev.intentos,
    }));
  };

  const abrirEdicion = () => {
    setBorrador({ ...scoreRef.current });
    setErrorEdicion('');
    setEditando(true);
  };

  const cambiarBorrador = (campo, delta) => {
    setBorrador((prev) => {
      const next = { ...prev };
      if (campo === 'intentos') {
        next.intentos = Math.max(0, prev.intentos + delta);
        return next;
      }
      if (delta > 0) {
        const valor = prev[campo] ?? 0;
        if (valor >= prev.intentos) return prev;
        next[campo] = valor + 1;
        return next;
      }
      if (prev[campo] == null || prev[campo] <= 1) {
        next[campo] = null;
        return next;
      }
      next[campo] = prev[campo] - 1;
      return next;
    });
    setErrorEdicion('');
  };

  const guardarEdicion = async () => {
    const preparado = prepararResultado(borrador);
    const error = validarResultado(preparado);
    if (error) {
      setErrorEdicion(error);
      return;
    }
    const { competidor: competidorActual, boulderId: boulderActual } = contextoRef.current;
    setGuardando(true);
    scoreRef.current = preparado;
    setScore(preparado);
    setBorrador(preparado);
    escribiendoDoc.current = `${competidorActual.id}_${boulderActual}`;
    escriturasPendientes.current += 1;
    colaEscritura.current = colaEscritura.current
      .then(() => persistir(preparado, competidorActual, boulderActual))
      .then(() => setEditando(false))
      .catch((error) => {
        console.error('Error al guardar la corrección:', error);
        setErrorEdicion('No se pudo guardar. Revisa tu conexión.');
      })
      .finally(() => {
        escriturasPendientes.current -= 1;
        setGuardando(false);
      });
  };

  const elegirBoulder = (id) => {
    const indiceGuardado = Number(leerPreferencia(`juez.turno.${id}`, '0'));
    const indice = Number.isInteger(indiceGuardado) ? indiceGuardado : 0;
    localStorage.setItem('juez.boulder', id);
    setBoulderId(id);
    setTurnoIndex(indice);
    setCompetidorId(null);
    setBuscando(false);
    setDorsalBusqueda('');
  };

  const fijarTurno = (indice) => {
    const acotado = Math.max(0, Math.min(indice, turnos.length - 1));
    localStorage.setItem(`juez.turno.${boulderId}`, String(acotado));
    setTurnoIndex(acotado);
    setCompetidorId(turnos[acotado].competidor.id);
    setBuscando(false);
    setDorsalBusqueda('');
  };

  const elegirCompetidor = (id) => {
    setCompetidorId(id);
    setBuscando(false);
    setDorsalBusqueda('');
  };

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

  const hayTop = score.topEnIntento != null;
  const hayZona = score.zonaEnIntento != null;
  const puedeMarcar = score.intentos >= 1 && !hayTop;

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', minHeight: '100svh', color: '#111', backgroundColor: '#fff', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {BOULDERS.map((id) => (
          <button
            key={id}
            onClick={() => elegirBoulder(id)}
            style={{ flex: 1, padding: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold', borderRadius: '8px', border: 'none', backgroundColor: id === boulderId ? '#111' : '#e0e0e0', color: id === boulderId ? '#fff' : '#111' }}>
            {id}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f0f0', padding: '1rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
        <div>
          <h4 style={{ margin: 0, color: '#666' }}>{competidor.categoria} · {turnos[turnoSeguro].hora} · {user.email}</h4>
          <h2 style={{ margin: '5px 0 0 0', fontSize: '2rem', color: '#111' }}>#{competidor.dorsal} {competidor.nombre}</h2>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#111' }}>
            {competidor.id === programada.id ? `Turno ${turnos[turnoSeguro].orden} de ${turnos.length}` : `Fuera de orden · programada #${programada.dorsal} ${programada.nombre}`}
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '3rem', color: '#111' }}>{score.intentos}</h1>
          <p style={{ margin: 0, color: '#111' }}>Intentos</p>
        </div>
      </div>

      {!editando && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button onClick={() => fijarTurno(turnoSeguro - 1)} disabled={turnoSeguro === 0} style={{ padding: '0.9rem', fontSize: '1rem', border: 'none', borderRadius: '8px', backgroundColor: '#e0e0e0' }}>Anterior</button>
          <button onClick={() => { setBuscando((abierto) => !abierto); setDorsalBusqueda(''); }} style={{ flex: 1, padding: '0.9rem', fontSize: '1rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', backgroundColor: '#fff3cd' }}>Buscar dorsal</button>
          <button onClick={() => fijarTurno(turnoSeguro + 1)} disabled={turnoSeguro === turnos.length - 1} style={{ padding: '0.9rem', fontSize: '1rem', border: 'none', borderRadius: '8px', backgroundColor: '#111', color: '#fff' }}>Siguiente</button>
        </div>
      )}

      {buscando && !editando && (
        <BuscadorDorsal
          dorsal={dorsalBusqueda}
          onDorsal={setDorsalBusqueda}
          onElegir={elegirCompetidor}
        />
      )}

      {!buscando && !editando && competidor.id !== programada.id && (
        <button onClick={() => elegirCompetidor(programada.id)} style={{ marginBottom: '0.75rem', padding: '0.8rem', border: 'none', borderRadius: '8px', backgroundColor: '#d4edda', fontWeight: 'bold' }}>
          Volver al orden: #{programada.dorsal} {programada.nombre}
        </button>
      )}

      {!buscando && !editando && (
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginBottom: '0.75rem' }}>
          {turnos.slice(turnoSeguro + 1).map((turno) => (
            <button
              key={turno.competidor.id}
              onClick={() => fijarTurno(turno.orden - 1)}
              style={{ flex: '0 0 auto', padding: '0.55rem 0.7rem', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', fontWeight: 'bold' }}>
              #{turno.competidor.dorsal} {turno.hora}
            </button>
          ))}
        </div>
      )}

      {!listo && <p style={{ textAlign: 'center' }}>Cargando resultado...</p>}

      {listo && !editando && !buscando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
          <button
            onClick={sumarIntento}
            disabled={hayTop}
            style={{ ...botonBase, flexGrow: 1, fontSize: '2.5rem', backgroundColor: hayTop ? '#ccc' : '#e0e0e0' }}>
            + INTENTO
          </button>

          <div style={{ display: 'flex', gap: '1rem', flexGrow: 1.5 }}>
            <button
              onClick={marcarZona}
              disabled={hayZona || !puedeMarcar}
              style={{ ...botonBase, flexGrow: 1, fontSize: '2.5rem', backgroundColor: hayZona ? '#ffc107' : '#fff3cd', border: hayZona ? '4px solid #d39e00' : '2px solid #ffc107' }}>
              {hayZona ? (
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                  <span>ZONA ✅</span>
                  <span style={{ fontSize: '1.5rem' }}>Intento {score.zonaEnIntento}</span>
                </span>
              ) : 'MARCAR ZONA'}
            </button>

            <button
              onClick={marcarTop}
              disabled={!puedeMarcar}
              style={{ ...botonBase, flexGrow: 1, fontSize: '2.5rem', backgroundColor: hayTop ? '#28a745' : '#d4edda', border: hayTop ? '4px solid #1e7e34' : '2px solid #28a745' }}>
              {hayTop ? (
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                  <span>TOP ✅</span>
                  <span style={{ fontSize: '1.5rem' }}>Intento {score.topEnIntento}</span>
                </span>
              ) : 'MARCAR TOP'}
            </button>
          </div>
        </div>
      )}

      {listo && editando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
          <Stepper etiqueta="Intentos totales" valor={borrador.intentos} onMenos={() => cambiarBorrador('intentos', -1)} onMas={() => cambiarBorrador('intentos', 1)} />
          <Stepper etiqueta="Zona en el intento" valor={borrador.zonaEnIntento} vacio="Sin zona" onMenos={() => cambiarBorrador('zonaEnIntento', -1)} onMas={() => cambiarBorrador('zonaEnIntento', 1)} />
          <Stepper etiqueta="Top en el intento" valor={borrador.topEnIntento} vacio="Sin top" onMenos={() => cambiarBorrador('topEnIntento', -1)} onMas={() => cambiarBorrador('topEnIntento', 1)} />
          {errorEdicion && <p style={{ margin: 0, color: '#dc3545', fontWeight: 'bold' }}>{errorEdicion}</p>}
          <p style={{ margin: 0, color: '#666' }}>Si marcas top sin zona, la zona queda en el mismo intento.</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem' }}>
        <button onClick={() => signOut(auth)} style={{ padding: '1rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '8px' }}>Cerrar Sesión</button>
        {editando ? (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setEditando(false)} style={{ padding: '1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem' }}>Cancelar</button>
            <button onClick={guardarEdicion} disabled={guardando} style={{ padding: '1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem' }}>
              {guardando ? 'Guardando...' : 'Actualizar'}
            </button>
          </div>
        ) : (
          <button onClick={abrirEdicion} disabled={!listo} style={{ padding: '1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem' }}>Editar</button>
        )}
      </div>
    </div>
  );
}

function BuscadorDorsal({ dorsal, onDorsal, onElegir }) {
  const coincidencias = buscarPorDorsal(dorsal);
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <input
        inputMode="numeric"
        autoFocus
        placeholder="Número de dorsal"
        value={dorsal}
        onChange={(event) => onDorsal(event.target.value.replace(/\D/g, ''))}
        style={{ width: '100%', boxSizing: 'border-box', padding: '1rem', fontSize: '2rem', textAlign: 'center', borderRadius: '8px', border: '2px solid #111' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
        {coincidencias.map((competidor) => (
          <button
            key={competidor.id}
            onClick={() => onElegir(competidor.id)}
            style={{ padding: '1rem', fontSize: '1.4rem', fontWeight: 'bold', textAlign: 'left', borderRadius: '8px', border: 'none', backgroundColor: '#f0f0f0' }}>
            #{competidor.dorsal} {competidor.nombre}
          </button>
        ))}
        {dorsal && coincidencias.length === 0 && <p style={{ margin: 0, color: '#dc3545' }}>No hay una competidora con ese dorsal.</p>}
      </div>
    </div>
  );
}

function Stepper({ etiqueta, valor, vacio = '0', onMenos, onMas }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', backgroundColor: '#f7f7f7', borderRadius: '12px', padding: '1rem' }}>
      <span style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{etiqueta}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button onClick={onMenos} style={{ width: '64px', height: '64px', fontSize: '2rem', borderRadius: '12px', border: 'none', backgroundColor: '#e0e0e0' }}>−</button>
        <span style={{ minWidth: '7rem', textAlign: 'center', fontSize: '1.8rem', fontWeight: 'bold' }}>{valor == null ? vacio : valor}</span>
        <button onClick={onMas} style={{ width: '64px', height: '64px', fontSize: '2rem', borderRadius: '12px', border: 'none', backgroundColor: '#e0e0e0' }}>+</button>
      </div>
    </div>
  );
}
