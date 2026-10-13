import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import {
  guardarResultado,
  idResultado,
  leerResultado,
  prepararResultado,
  resultadoDocRef,
  resultadoVacio,
  validarResultado,
} from '../utils/resultado';
import { apelacionesCol } from '../utils/competicion';
import { useEtapaActiva } from '../hooks/useEtapaActiva';
import { useMiembro, useUsuario } from '../hooks/useSesion';

function leerPreferencia(clave, valorInicial) {
  try {
    return localStorage.getItem(clave) || valorInicial;
  } catch {
    return valorInicial;
  }
}

function guardarPreferencia(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento local: la preferencia dura solo esta sesión.
  }
}

const botonBase = {
  border: 'none',
  borderRadius: '12px',
  fontWeight: 'bold',
  touchAction: 'manipulation',
  color: '#111',
  whiteSpace: 'normal',
  minWidth: 0,
};

const pantallaSimple = { padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center', color: '#111', backgroundColor: '#fff', minHeight: '100svh', boxSizing: 'border-box' };

function mensajeErrorEscritura(error) {
  if (error?.code === 'permission-denied') {
    return 'No se guardó: otro dispositivo cambió este resultado, la etapa o la categoría está cerrada, o no tienes este bloque asignado. Se muestra el valor vigente.';
  }
  return 'Error al guardar. Revisa tu conexión.';
}

export default function JuezView() {
  const { user, correo, cargando: cargandoSesion } = useUsuario();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  const { competencia, etapa, competidores, turnos: turnosCrudos, cargando, error: errorConfig } = useEtapaActiva();
  const { miembro, cargando: cargandoMiembro } = useMiembro(user, competencia?.id);
  const [boulderId, setBoulderId] = useState('');
  const [turnoIndex, setTurnoIndex] = useState(0);
  const [competidorId, setCompetidorId] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [dorsalBusqueda, setDorsalBusqueda] = useState('');
  const [score, setScore] = useState(resultadoVacio());
  const [listo, setListo] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(resultadoVacio());
  const [errorEdicion, setErrorEdicion] = useState('');
  const [revisandoApelaciones, setRevisandoApelaciones] = useState(false);

  const scoreRef = useRef(resultadoVacio());
  const docActivo = useRef('');
  const esJuez = miembro?.rol === 'juez' || miembro?.rol === 'juez_jefe';
  const esJuezJefe = miembro?.rol === 'juez_jefe';
  const etapaCerrada = etapa?.estado === 'cerrada';
  const asignados = miembro?.asignaciones?.[etapa?.id] || [];
  const boulders = (etapa?.boulders || []).filter((id) => esJuezJefe || asignados.includes(id));
  const competidoresPorId = Object.fromEntries(competidores.map((item) => [item.id, item]));
  const turnos = turnosCrudos
    .filter((turno) => etapa && turno.etapaId === etapa.id && turno.boulderId === boulderId && competidoresPorId[turno.competidorId])
    .sort((a, b) => a.orden - b.orden)
    .map((turno) => ({ ...turno, hora: turno.horaProgramada, competidor: competidoresPorId[turno.competidorId] }));
  const turnoSeguro = turnos.length ? Math.min(turnoIndex, turnos.length - 1) : 0;
  const programada = turnos[turnoSeguro]?.competidor;
  const competidor = competidoresPorId[competidorId] || programada || null;
  const contextoRef = useRef({});
  contextoRef.current = { competidor, boulderId, competenciaId: competencia?.id, etapaId: etapa?.id };
  const bouldersClave = boulders.join(',');

  useEffect(() => {
    if (!etapa) return;
    const preferido = leerPreferencia(`juez.boulder.${etapa.id}`, '');
    setBoulderId(boulders.includes(preferido) ? preferido : (boulders[0] || ''));
  }, [etapa?.id, bouldersClave]);

  useEffect(() => {
    if (!etapa || !boulderId) return;
    const guardado = Number(leerPreferencia(`juez.turno.${etapa.id}.${boulderId}`, '0'));
    setTurnoIndex(Number.isInteger(guardado) ? guardado : 0);
    setCompetidorId(null);
  }, [etapa?.id, boulderId]);

  useEffect(() => {
    document.body.classList.add('kiosk-mode');
    return () => document.body.classList.remove('kiosk-mode');
  }, []);

  useEffect(() => {
    if (!user || !esJuez || !competidor || !competencia || !etapa || !boulderId) return undefined;
    const clave = { competenciaId: competencia.id, etapaId: etapa.id, competidorId: competidor.id, boulderId };
    const docId = idResultado(clave);
    docActivo.current = docId;
    const vacio = resultadoVacio();
    scoreRef.current = vacio;
    setScore(vacio);
    setListo(false);
    setEditando(false);
    setAviso('');
    let primera = true;
    const unsubscribe = onSnapshot(resultadoDocRef(db, clave), { includeMetadataChanges: true }, (snap) => {
      if (docActivo.current !== docId) return;
      setPendiente(snap.metadata.hasPendingWrites);
      // Mientras hay escrituras propias en cola, el estado local ya va adelante:
      // un snapshot intermedio haría retroceder el marcador. Si el servidor
      // rechaza una escritura, llega un snapshot sin pendientes con el valor vigente.
      if (!primera && snap.metadata.hasPendingWrites) return;
      primera = false;
      const next = leerResultado(snap.data());
      scoreRef.current = next;
      setScore(next);
      setListo(true);
    }, (error) => {
      console.error('Error al leer el resultado:', error);
      setListo(true);
      setAviso('No se pudo leer el resultado. Revisa tu conexión.');
    });
    return () => unsubscribe();
  }, [user, esJuez, competidor?.id, boulderId, competencia?.id, etapa?.id]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, pin);
      setErrorLogin('');
    } catch {
      setErrorLogin('Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  // La escritura se aplica al instante en la caché local (también sin red).
  // No se espera al servidor: Firestore envía las escrituras en orden.
  const escribir = (next, accion) => {
    const contexto = contextoRef.current;
    const clave = {
      competenciaId: contexto.competenciaId,
      etapaId: contexto.etapaId,
      competidorId: contexto.competidor.id,
      boulderId: contexto.boulderId,
    };
    const marcador = { ...next, version: scoreRef.current.version + 1 };
    scoreRef.current = marcador;
    setScore(marcador);
    setAviso('');
    guardarResultado(db, clave, marcador, accion, correo).catch((error) => {
      console.error('Error al guardar:', error);
      if (docActivo.current === idResultado(clave)) setAviso(mensajeErrorEscritura(error));
    });
  };

  const sumarIntento = () => {
    const actual = scoreRef.current;
    if (actual.topEnIntento != null) return;
    escribir({ ...actual, intentos: actual.intentos + 1 }, 'intento');
  };

  const marcarZona = () => {
    const actual = scoreRef.current;
    if (actual.zonaEnIntento != null || actual.topEnIntento != null || actual.intentos < 1) return;
    escribir({ ...actual, zonaEnIntento: actual.intentos }, 'zona');
  };

  const marcarTop = () => {
    const actual = scoreRef.current;
    if (actual.topEnIntento != null || actual.intentos < 1) return;
    escribir({
      ...actual,
      topEnIntento: actual.intentos,
      zonaEnIntento: actual.zonaEnIntento ?? actual.intentos,
    }, 'top');
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

  const guardarEdicion = () => {
    const preparado = prepararResultado(borrador);
    const error = validarResultado(preparado);
    if (error) {
      setErrorEdicion(error);
      return;
    }
    escribir(preparado, 'edicion');
    setEditando(false);
  };

  const elegirBoulder = (id) => {
    const indiceGuardado = Number(leerPreferencia(`juez.turno.${etapa.id}.${id}`, '0'));
    guardarPreferencia(`juez.boulder.${etapa.id}`, id);
    setBoulderId(id);
    setTurnoIndex(Number.isInteger(indiceGuardado) ? indiceGuardado : 0);
    setCompetidorId(null);
    setBuscando(false);
    setDorsalBusqueda('');
  };

  const fijarTurno = (indice) => {
    if (!turnos.length) return;
    const acotado = Math.max(0, Math.min(indice, turnos.length - 1));
    guardarPreferencia(`juez.turno.${etapa.id}.${boulderId}`, String(acotado));
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

  if (cargandoSesion) {
    return <main style={pantallaSimple}>Cargando...</main>;
  }

  if (!user) {
    return (
      <div style={pantallaSimple}>
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

  if (cargando || (competencia && cargandoMiembro)) {
    return <main style={pantallaSimple}>Cargando competencia...</main>;
  }

  if (!etapa) {
    return (
      <main style={pantallaSimple}>
        <h2>No hay una etapa activa</h2>
        <p>Carga la competencia, las competidoras y el orden de paso antes de puntuar.</p>
        <Link to="/admin">Ir a administrar</Link>
        {errorConfig && <p>{errorConfig}</p>}
      </main>
    );
  }

  if (!esJuez) {
    return (
      <main style={pantallaSimple}>
        <h2>Tu cuenta no es juez en {competencia.nombre}</h2>
        <p>{correo}</p>
        <p>Pide a la organización que te agregue como juez en esta competencia.</p>
        <button onClick={() => signOut(auth)} style={{ padding: '1rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '8px' }}>Cerrar sesión</button>
      </main>
    );
  }

  if (!boulders.length) {
    return (
      <main style={pantallaSimple}>
        <h2>No tienes bloques asignados en {etapa.nombre}</h2>
        <p>Pide a la organización que te asigne uno o más bloques.</p>
        <button onClick={() => signOut(auth)} style={{ padding: '1rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '8px' }}>Cerrar sesión</button>
      </main>
    );
  }

  const hayTop = score.topEnIntento != null;
  const hayZona = score.zonaEnIntento != null;
  const categoriaCerrada = Boolean(competidor && etapa.categoriasCerradas?.includes(competidor.categoriaId));
  const bloqueado = etapaCerrada || categoriaCerrada;
  const puedeMarcar = score.intentos >= 1 && !hayTop && !bloqueado;

  return (
    <div style={{ width: '100%', maxWidth: '100%', padding: '1rem', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', minHeight: '100svh', color: '#111', backgroundColor: '#fff', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {boulders.map((id) => (
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
          <h4 style={{ margin: 0, color: '#666' }}>{etapa.nombre} · {competencia.nombre} · {correo}{esJuezJefe ? ' · juez jefe' : ''}</h4>
          {competidor ? (
            <>
              <h2 style={{ margin: '5px 0 0 0', fontSize: '2rem', color: '#111' }}>#{competidor.dorsal} {competidor.nombre}</h2>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#111' }}>
                {programada && competidor.id === programada.id
                  ? `Turno ${turnos[turnoSeguro].orden} de ${turnos.length} · ${turnos[turnoSeguro].hora}`
                  : `Fuera de orden${programada ? ` · programada #${programada.dorsal} ${programada.nombre}` : ''}`}
              </p>
            </>
          ) : (
            <h2 style={{ margin: '5px 0 0 0', fontSize: '1.4rem', color: '#111' }}>Este bloque no tiene orden de paso. Busca por dorsal.</h2>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '3rem', color: '#111' }}>{score.intentos}</h1>
          <p style={{ margin: 0, color: '#111' }}>Intentos</p>
        </div>
      </div>

      {!editando && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button onClick={() => fijarTurno(turnoSeguro - 1)} disabled={turnoSeguro === 0} style={{ padding: '0.9rem', fontSize: '1rem', border: 'none', borderRadius: '8px', backgroundColor: '#e0e0e0', color: '#111' }}>Anterior</button>
          <button onClick={() => { setBuscando((abierto) => !abierto); setDorsalBusqueda(''); }} style={{ flex: 1, padding: '0.9rem', fontSize: '1rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', backgroundColor: '#fff3cd' }}>Buscar dorsal</button>
          <button onClick={() => fijarTurno(turnoSeguro + 1)} disabled={!turnos.length || turnoSeguro === turnos.length - 1} style={{ padding: '0.9rem', fontSize: '1rem', border: 'none', borderRadius: '8px', backgroundColor: '#111', color: '#fff' }}>Siguiente</button>
        </div>
      )}

      {buscando && !editando && (
        <BuscadorDorsal
          dorsal={dorsalBusqueda}
          competidores={competidores}
          onDorsal={setDorsalBusqueda}
          onElegir={elegirCompetidor}
        />
      )}

      {!buscando && !editando && competidor && programada && competidor.id !== programada.id && (
        <button onClick={() => elegirCompetidor(programada.id)} style={{ marginBottom: '0.75rem', padding: '0.8rem', border: 'none', borderRadius: '8px', backgroundColor: '#d4edda', fontWeight: 'bold' }}>
          Volver al orden: #{programada.dorsal} {programada.nombre}
        </button>
      )}

      {!buscando && !editando && turnos.length > turnoSeguro + 1 && (
        <div style={{ marginBottom: '0.75rem', minWidth: 0, maxWidth: '100%' }}>
          <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Después en este bloque</p>
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', minWidth: 0, maxWidth: '100%' }}>
            {turnos.slice(turnoSeguro + 1).map((turno) => (
              <button
                key={turno.id}
                onClick={() => fijarTurno(turno.orden - 1)}
                style={{ flex: '0 0 auto', padding: '0.55rem 0.7rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: '#f4f4f4', color: '#111', fontWeight: 'bold' }}>
                #{turno.competidor.dorsal} {turno.competidor.nombre} · {turno.hora}
              </button>
            ))}
          </div>
        </div>
      )}

      {etapaCerrada && <p style={{ margin: '0 0 0.75rem', padding: '0.75rem', borderRadius: '8px', backgroundColor: '#f8d7da', fontWeight: 'bold' }}>La etapa está cerrada. Los resultados ya no se pueden modificar.</p>}
      {!etapaCerrada && categoriaCerrada && <p style={{ margin: '0 0 0.75rem', padding: '0.75rem', borderRadius: '8px', backgroundColor: '#f8d7da', fontWeight: 'bold' }}>{competidor.categoria} ya está finalizada. Sus resultados no se pueden modificar.</p>}
      {aviso && <p style={{ margin: '0 0 0.75rem', padding: '0.75rem', borderRadius: '8px', backgroundColor: '#fff3cd', fontWeight: 'bold' }}>{aviso}</p>}
      {pendiente && <p style={{ margin: '0 0 0.75rem', color: '#666' }}>Guardado en la tablet. Pendiente de sincronizar…</p>}
      {!listo && <p style={{ textAlign: 'center' }}>Cargando resultado...</p>}

      {revisandoApelaciones && (
        <ApelacionesJuez competenciaId={competencia.id} etapaId={etapa.id} juezEmail={correo} puedeResolver={esJuezJefe} />
      )}

      {listo && competidor && !editando && !buscando && !revisandoApelaciones && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
          <button
            onClick={sumarIntento}
            disabled={hayTop || bloqueado}
            style={{ ...botonBase, flexGrow: 1, fontSize: '2.5rem', backgroundColor: hayTop || bloqueado ? '#ccc' : '#e0e0e0' }}>
            + INTENTO
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.75rem', flexGrow: 1.5 }}>
            <button
              onClick={marcarZona}
              disabled={hayZona || !puedeMarcar}
              style={{ ...botonBase, width: '100%', fontSize: '1.6rem', padding: '1.25rem 0.4rem', backgroundColor: hayZona ? '#ffc107' : '#fff3cd', border: hayZona ? '4px solid #d39e00' : '2px solid #ffc107' }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05 }}>
                <span>{hayZona ? 'ZONA ✅' : 'MARCAR'}</span>
                <span style={{ fontSize: '0.85em' }}>{hayZona ? `Intento ${score.zonaEnIntento}` : 'ZONA'}</span>
              </span>
            </button>

            <button
              onClick={marcarTop}
              disabled={!puedeMarcar}
              style={{ ...botonBase, width: '100%', fontSize: '1.6rem', padding: '1.25rem 0.4rem', backgroundColor: hayTop ? '#28a745' : '#d4edda', border: hayTop ? '4px solid #1e7e34' : '2px solid #28a745', color: hayTop ? '#fff' : '#111' }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05 }}>
                <span>{hayTop ? 'TOP ✅' : 'MARCAR'}</span>
                <span style={{ fontSize: '0.85em' }}>{hayTop ? `Intento ${score.topEnIntento}` : 'TOP'}</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {listo && editando && !revisandoApelaciones && (
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
            <button onClick={guardarEdicion} style={{ padding: '1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem' }}>
              Actualizar
            </button>
          </div>
        ) : (
          <button onClick={abrirEdicion} disabled={!listo || !competidor || bloqueado} style={{ padding: '1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem' }}>Editar</button>
        )}
        <button onClick={() => setRevisandoApelaciones((abierta) => !abierta)} style={{ padding: '1rem', backgroundColor: revisandoApelaciones ? '#111' : '#fff', color: revisandoApelaciones ? '#fff' : '#111', border: '1px solid #111', borderRadius: '8px' }}>
          {revisandoApelaciones ? 'Volver a puntuar' : 'Apelaciones'}
        </button>
        <Link to="/admin" style={{ alignSelf: 'center' }}>Administrar</Link>
      </div>
    </div>
  );
}

function ApelacionesJuez({ competenciaId, etapaId, juezEmail, puedeResolver }) {
  const [apelaciones, setApelaciones] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const consulta = query(
      apelacionesCol(db, competenciaId),
      where('etapaId', '==', etapaId),
      where('estado', '==', 'en_evaluacion'),
    );
    return onSnapshot(consulta, (snapshot) => {
      setApelaciones(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, () => setError('No se pudieron leer las apelaciones.'));
  }, [competenciaId, etapaId]);

  const resolver = async (id, estado) => {
    setError('');
    try {
      await updateDoc(doc(apelacionesCol(db, competenciaId), id), {
        estado,
        resueltaPor: juezEmail,
        resueltaEn: serverTimestamp(),
      });
    } catch {
      setError('No se pudo resolver la apelación.');
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 style={{ margin: 0, color: '#111' }}>Apelaciones en evaluación</h2>
      <p style={{ margin: 0, color: '#555' }}>
        {puedeResolver
          ? 'Aceptar o rechazar no cambia el marcador. Si aceptas una corrección, anótala con Editar.'
          : 'Solo el juez jefe puede aceptar o rechazar apelaciones.'}
      </p>
      {error && <p style={{ margin: 0, color: '#dc3545', fontWeight: 'bold' }}>{error}</p>}
      {apelaciones.length === 0 && <p style={{ margin: 0 }}>No hay apelaciones en evaluación.</p>}
      {apelaciones.map((item) => (
        <article key={item.id} style={{ backgroundColor: '#f7f7f7', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <strong>{item.tipo === 'resultado' ? `#${item.dorsal} ${item.competidorNombre} · ${item.boulderId}` : 'Situación general'}</strong>
          <p style={{ margin: 0 }}>{item.argumento}</p>
          {puedeResolver && <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => resolver(item.id, 'aceptada')} style={{ padding: '0.8rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#28a745', color: '#fff', fontWeight: 'bold' }}>Aceptar</button>
            <button onClick={() => resolver(item.id, 'rechazada')} style={{ padding: '0.8rem 1rem', border: 'none', borderRadius: '8px', backgroundColor: '#dc3545', color: '#fff', fontWeight: 'bold' }}>Rechazar</button>
          </div>}
        </article>
      ))}
    </section>
  );
}

function BuscadorDorsal({ dorsal, competidores, onDorsal, onElegir }) {
  const consulta = dorsal.trim();
  const coincidencias = consulta
    ? competidores.filter((competidor) => String(competidor.dorsal).startsWith(consulta))
    : [];
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
