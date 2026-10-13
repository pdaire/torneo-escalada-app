import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useCompetencia } from '../hooks/useCompetencia';
import { rutas } from '../utils/competicion';
import NoExiste from '../components/NoExiste';
import { useResultadosEtapa } from '../hooks/useResultados';
import { useMiembro, useUsuario } from '../hooks/useSesion';
import { apelacionesCol } from '../utils/competicion';
import { bloquesDeCategoria } from '../utils/ranking';
import './delegado.css';

const ESTADOS = {
  borrador: 'Borrador',
  en_evaluacion: 'En evaluación',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};

function resumenResultado(resultado) {
  if (!resultado) return 'Sin resultado registrado';
  return [
    `${resultado.intentos ?? 0} intentos`,
    `zona: ${resultado.zonaEnIntento ?? '—'}`,
    `top: ${resultado.topEnIntento ?? '—'}`,
  ].join(' · ');
}

export default function DelegadoView() {
  const { user, correo, cargando: cargandoSesion } = useUsuario();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState('resultado');
  const [competidorId, setCompetidorId] = useState('');
  const [boulderId, setBoulderId] = useState('');
  const [argumento, setArgumento] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [apelaciones, setApelaciones] = useState([]);
  const { competenciaId } = useParams();
  const { competencia, etapa, competidores, turnos, cargando, noExiste } = useCompetencia(competenciaId);
  const { miembro, cargando: cargandoMiembro } = useMiembro(user, competencia?.id);
  const { resultados } = useResultadosEtapa(competencia?.id, etapa?.id);
  const esDelegado = miembro?.rol === 'delegado';

  useEffect(() => {
    document.body.classList.add('delegado-mode');
    return () => document.body.classList.remove('delegado-mode');
  }, []);

  useEffect(() => {
    if (!user || !competencia || !esDelegado) {
      return undefined;
    }
    // La consulta filtra por autor: las reglas no dejan leer apelaciones de otros delegados.
    const consulta = query(apelacionesCol(db, competencia.id), where('autorUid', '==', user.uid));
    return onSnapshot(consulta, (snapshot) => {
      setApelaciones(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (b.creadaEn?.seconds || 0) - (a.creadaEn?.seconds || 0)));
    }, () => setError('No se pudieron leer tus apelaciones.'));
  }, [user?.uid, competencia?.id, esDelegado]);

  const idsEnEtapa = useMemo(() => new Set(
    turnos.filter((turno) => turno.etapaId === etapa?.id).map((turno) => turno.competidorId),
  ), [turnos, etapa?.id]);
  const participantes = idsEnEtapa.size
    ? competidores.filter((item) => idsEnEtapa.has(item.id))
    : competidores;
  const competidorIdActivo = competidorId || participantes[0]?.id || '';
  const competidorSeleccionado = participantes.find((item) => item.id === competidorIdActivo);
  const boulders = bloquesDeCategoria(etapa, turnos, competidorSeleccionado?.categoriaId);
  const boulderIdActivo = boulders.includes(boulderId) ? boulderId : (boulders[0] || '');
  const resultadoActual = resultados.find((item) => (
    item.competidorId === competidorIdActivo && item.boulderId === boulderIdActivo
  ));

  const ingresar = async (evento) => {
    evento.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, pin);
      setError('');
    } catch {
      setError('Credenciales incorrectas.');
    }
  };

  const guardar = (estado) => async (evento) => {
    evento.preventDefault();
    const texto = argumento.trim();
    if (texto.length < 10) {
      setError('Explica el motivo de la apelación en al menos 10 caracteres.');
      return;
    }
    if (!competencia || !etapa) {
      setError('No hay una competencia y etapa activas.');
      return;
    }
    if (tipo === 'resultado' && (!competidorSeleccionado || !boulderIdActivo)) {
      setError('Elige la competidora y el bloque.');
      return;
    }

    setEnviando(true);
    setError('');
    setMensaje('');
    try {
      const detalle = tipo === 'resultado' ? {
        competidorId: competidorSeleccionado.id,
        competidorNombre: competidorSeleccionado.nombre,
        dorsal: competidorSeleccionado.dorsal,
        boulderId: boulderIdActivo,
        resultadoActual: resultadoActual ? {
          intentos: resultadoActual.intentos ?? 0,
          zonaEnIntento: resultadoActual.zonaEnIntento ?? null,
          topEnIntento: resultadoActual.topEnIntento ?? null,
        } : null,
      } : {
        competidorId: null,
        competidorNombre: null,
        dorsal: null,
        boulderId: null,
        resultadoActual: null,
      };
      const datos = {
        tipo,
        estado,
        argumento: texto,
        ...detalle,
      };
      if (editandoId) {
        await updateDoc(doc(apelacionesCol(db, competencia.id), editandoId), datos);
      } else {
        await addDoc(apelacionesCol(db, competencia.id), {
          ...datos,
          etapaId: etapa.id,
          etapaNombre: etapa.nombre,
          autorUid: user.uid,
          autorEmail: correo,
          creadaEn: serverTimestamp(),
        });
      }
      setArgumento('');
      setEditandoId(null);
      setMensaje(estado === 'borrador'
        ? 'Borrador guardado. Todavía no está en evaluación.'
        : 'Apelación enviada a evaluación. El resultado no cambia hasta que un juez la resuelva.');
    } catch (err) {
      setError(err.code === 'permission-denied'
        ? 'Firestore rechazó la apelación. Revisa que tu cuenta sea delegado en esta competencia.'
        : 'No se pudo guardar la apelación.');
    } finally {
      setEnviando(false);
    }
  };

  const enviarBorrador = async (id) => {
    setError('');
    setMensaje('');
    try {
      await updateDoc(doc(apelacionesCol(db, competencia.id), id), { estado: 'en_evaluacion' });
      setMensaje('Apelación enviada a evaluación.');
    } catch {
      setError('No se pudo enviar el borrador.');
    }
  };

  const cargarBorrador = (item) => {
    setEditandoId(item.id);
    setTipo(item.tipo);
    setCompetidorId(item.competidorId || '');
    setBoulderId(item.boulderId || '');
    setArgumento(item.argumento || '');
    setMensaje('');
    setError('');
  };

  if (noExiste) return <NoExiste competenciaId={competenciaId} />;

  if (cargandoSesion) {
    return <main className="delegado delegado-login"><p>Cargando…</p></main>;
  }

  if (!user) {
    return (
      <main className="delegado delegado-login">
        <h1>Acceso de delegados</h1>
        <p>Ingresa con el correo y PIN autorizados.</p>
        <form onSubmit={ingresar} className="delegado-form">
          <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>PIN<input type="password" value={pin} onChange={(e) => setPin(e.target.value)} required /></label>
          <button className="delegado-btn">Ingresar</button>
        </form>
        {error && <p className="delegado-error">{error}</p>}
      </main>
    );
  }

  if (cargando || (competencia && cargandoMiembro)) {
    return <main className="delegado delegado-login"><p>Cargando competencia…</p></main>;
  }

  if (!esDelegado) {
    return (
      <main className="delegado delegado-login">
        <h1>Tu cuenta no es delegado{competencia ? ` en ${competencia.nombre}` : ''}</h1>
        <p>{correo}</p>
        <p>Pide a la organización que te agregue como delegado de tu club.</p>
        <button className="delegado-btn-secondary" onClick={() => signOut(auth)}>Salir</button>
      </main>
    );
  }

  return (
    <main className="delegado">
      <header className="delegado-header">
        <div>
          <p className="delegado-kicker">Delegado{miembro.club ? ` · ${miembro.club}` : ''}</p>
          <h1>Presentar apelación</h1>
          <p>{competencia?.nombre || 'Cargando…'} · {etapa?.nombre || 'Sin etapa activa'}</p>
        </div>
        <div className="delegado-actions">
          <Link to={rutas.tablero(competenciaId)}>Tablero</Link>
          <button className="delegado-btn-secondary" onClick={() => signOut(auth)}>Salir</button>
        </div>
      </header>

      {error && <p className="delegado-error">{error}</p>}
      {mensaje && <p className="delegado-success">{mensaje}</p>}

      <form onSubmit={guardar('en_evaluacion')} className="delegado-card delegado-form">
        <fieldset className="delegado-tipos">
          <legend>Tipo de apelación</legend>
          <label><input type="radio" name="tipo" checked={tipo === 'resultado'} onChange={() => setTipo('resultado')} /> Resultado particular</label>
          <label><input type="radio" name="tipo" checked={tipo === 'general'} onChange={() => setTipo('general')} /> Situación general</label>
        </fieldset>

        {tipo === 'resultado' && (
          <>
            <div className="delegado-grid">
              <label>
                Competidora
                <select value={competidorIdActivo} onChange={(e) => setCompetidorId(e.target.value)} required>
                  {participantes.map((item) => <option key={item.id} value={item.id}>#{item.dorsal} {item.nombre}</option>)}
                </select>
              </label>
              <label>
                Bloque
                <select value={boulderIdActivo} onChange={(e) => setBoulderId(e.target.value)} required>
                  {boulders.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </label>
            </div>
            <p className="delegado-actual"><strong>Resultado actual:</strong> {resumenResultado(resultadoActual)}</p>
          </>
        )}

        <label>
          Argumento breve
          <textarea
            rows="5"
            maxLength="500"
            value={argumento}
            onChange={(e) => setArgumento(e.target.value)}
            placeholder={tipo === 'resultado'
              ? 'Ej.: La competidora #4 obtuvo zona en el 4.º intento, no en el 6.º.'
              : 'Ej.: La lluvia impidió condiciones aptas durante la segunda mitad de la competencia.'}
            required
          />
          <small>{argumento.length}/500</small>
        </label>
        <div className="delegado-botones">
          <button type="button" className="delegado-btn-secondary" onClick={guardar('borrador')} disabled={enviando || !competencia || !etapa}>
            Guardar borrador
          </button>
          <button className="delegado-btn" disabled={enviando || !competencia || !etapa}>
            {enviando ? 'Guardando…' : 'Enviar a evaluación'}
          </button>
          {editandoId && (
            <button type="button" className="delegado-btn-secondary" onClick={() => { setEditandoId(null); setArgumento(''); }}>
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <section className="delegado-card">
        <h2>Mis apelaciones</h2>
        {apelaciones.length === 0 && <p>Todavía no presentaste apelaciones.</p>}
        <div className="delegado-lista">
          {apelaciones.map((item) => (
            <article key={item.id} className="delegado-apelacion">
              <div>
                <strong>{item.tipo === 'resultado'
                  ? `#${item.dorsal} ${item.competidorNombre} · ${item.boulderId}`
                  : 'Situación general'}</strong>
                <p>{item.argumento}</p>
              </div>
              <div className="delegado-apelacion-acciones">
                <span className={`delegado-estado delegado-estado-${item.estado}`}>{ESTADOS[item.estado] || item.estado}</span>
                {item.estado === 'borrador' && (
                  <>
                    <button type="button" className="delegado-btn-secondary" onClick={() => cargarBorrador(item)}>Editar</button>
                    <button type="button" className="delegado-btn" onClick={() => enviarBorrador(item.id)}>Enviar a evaluación</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
