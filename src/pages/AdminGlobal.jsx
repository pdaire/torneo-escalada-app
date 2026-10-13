import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { cargarDemo } from '../data/cargarDemo';
import { DEMO_DELEGADO, DEMO_JUEZ, demoPrincipal } from '../data/demo';
import { demoPrimavera } from '../data/demoPrimavera';
import { BOULDERS, COMPETIDORES } from '../data/ordenAbsolutaDamas';
import { useEsAdmin, useUsuario } from '../hooks/useSesion';
import {
  competenciaRef,
  competenciasCol,
  competidoresCol,
  docsConId,
  etapasCol,
  miembroRef,
  normalizarCorreo,
  rutas,
  slug,
  sumarMinutos,
  turnosCol,
  validarSlug,
} from '../utils/competicion';
import './admin.css';

const DEMOS = [
  { crear: demoPrincipal, boton: 'Demo completa (3 rondas)' },
  { crear: demoPrimavera, boton: 'Demo Primavera - El Muro' },
];

const INICIOS_EJEMPLO = { M1: '15:15', M2: '15:31', M3: '15:47', M4: '16:03' };

// En la demo local (emuladores) se puede entrar también con correo y clave.
const CON_CLAVE = import.meta.env.VITE_EMULADOR === '1';

function mensajeGoogle(error) {
  if (error?.code === 'auth/admin-restricted-operation') {
    return 'Firebase no permite crear cuentas nuevas. La primera vez, activa el registro en Authentication → Settings → User actions, entra con Google y vuelve a desactivarlo.';
  }
  if (error?.code === 'auth/operation-not-allowed') {
    return 'El inicio de sesión con Google no está activado. Actívalo en Authentication → Sign-in method → Google.';
  }
  if (error?.code === 'auth/unauthorized-domain') {
    return `Este dominio no está autorizado. Agrégalo en Authentication → Settings → Authorized domains: ${window.location.hostname}`;
  }
  return `No se pudo entrar con Google (${error?.code || error?.message}).`;
}

// Administración de la plataforma: todas las competencias. Solo para cuentas en `admins`.
// Cada competencia se administra en /:competenciaId/admin, por ti o por sus organizadores.
export default function AdminGlobal() {
  const { user, correo, cargando: cargandoSesion } = useUsuario();
  const { esAdmin, faltaGoogle, cargando: cargandoAdmin } = useEsAdmin(user);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [competencias, setCompetencias] = useState([]);
  const [nombre, setNombre] = useState('');
  const [slugElegido, setSlugElegido] = useState('');
  const [progresoDemo, setProgresoDemo] = useState('');

  useEffect(() => {
    document.body.classList.add('admin-mode');
    return () => document.body.classList.remove('admin-mode');
  }, []);

  useEffect(() => {
    if (!esAdmin) return undefined;
    return onSnapshot(competenciasCol(db), (snapshot) => {
      setCompetencias(docsConId(snapshot).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || a.nombre.localeCompare(b.nombre)));
    });
  }, [esAdmin]);

  const entrarConGoogle = async () => {
    setError('');
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, proveedor);
    } catch (err) {
      if (err.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, proveedor);
        return;
      }
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      setError(mensajeGoogle(err));
    }
  };

  const ejecutar = async (accion) => {
    try {
      await accion();
      setError('');
    } catch (err) {
      setError(err.code === 'permission-denied'
        ? 'Firestore rechazó la escritura. Revisa que tu cuenta sea administradora y que las reglas estén publicadas.'
        : err.message);
    }
  };

  const slugSugerido = nombre.trim() ? slug(nombre) : '';
  const slugFinal = slugElegido || slugSugerido;

  const crearCompetencia = (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const errorSlug = validarSlug(slugFinal, competencias.map((item) => item.id));
    if (errorSlug) {
      setError(errorSlug);
      return;
    }
    const organizador = normalizarCorreo(datos.get('organizador'));
    ejecutar(async () => {
      const batch = writeBatch(db);
      batch.set(competenciaRef(db, slugFinal), {
        nombre: nombre.trim(),
        fecha: datos.get('fecha'),
        club: String(datos.get('club') || '').trim(),
        lugar: String(datos.get('lugar') || '').trim(),
        activa: false,
        creadaEn: serverTimestamp(),
      });
      if (organizador) {
        batch.set(miembroRef(db, slugFinal, organizador), { rol: 'organizador', nombre: '', club: String(datos.get('club') || '').trim(), asignaciones: {} });
      }
      await batch.commit();
      setMensaje(`Competencia creada en /${slugFinal}. Queda oculta de la portada hasta que la publiques.`);
      formulario.reset();
      setNombre('');
      setSlugElegido('');
    });
  };

  const cambiarPortada = (competencia) => ejecutar(() => updateDoc(competenciaRef(db, competencia.id), { activa: !competencia.activa }));

  const cargarCompetenciaDemo = (crear) => {
    const demo = crear();
    const pregunta = `¿Cargar "${demo.nombre}" en /${demo.id} y publicarla en la portada? Si ya existe, se reinicia: se pierden los resultados anotados en ella.`;
    if (!window.confirm(pregunta)) return;
    setProgresoDemo('Empezando…');
    ejecutar(async () => {
      try {
        await cargarDemo(db, correo, setProgresoDemo, demo);
      } catch (err) {
        throw new Error(`La demo quedó a medias (${err.code || err.message}). Vuelve a cargarla para completarla.`);
      }
      setMensaje(`Demo cargada en /${demo.id}.`);
    }).finally(() => setProgresoDemo(''));
  };

  // Ejemplo de desarrollo: la final de Absoluta Damas de Baguales 2026.
  const importarEjemplo = () => ejecutar(async () => {
    const id = 'baguales-2026';
    const batch = writeBatch(db);
    batch.set(competenciaRef(db, id), { nombre: 'Baguales 2026', fecha: '2026-10-04', activa: true, creadaEn: serverTimestamp() });
    batch.set(doc(etapasCol(db, id), 'final'), {
      nombre: 'Final', tipo: 'final', formato: 'wc', boulders: BOULDERS, duracionTurno: 4,
      activa: true, estado: 'abierta', categoriasCerradas: [], etapaPreviaId: null,
    });
    COMPETIDORES.forEach((competidor) => {
      batch.set(doc(competidoresCol(db, id), competidor.id), {
        dorsal: competidor.dorsal, nombre: competidor.nombre, categoria: competidor.categoria, categoriaId: competidor.categoriaId,
      });
    });
    BOULDERS.forEach((boulderId) => {
      COMPETIDORES.forEach((competidor, index) => {
        batch.set(doc(turnosCol(db, id), `${boulderId}-${competidor.id}`), {
          etapaId: 'final', categoriaId: competidor.categoriaId, boulderId, competidorId: competidor.id,
          orden: index + 1, horaProgramada: sumarMinutos(INICIOS_EJEMPLO[boulderId], index * 4),
        });
      });
    });
    await batch.commit();
  });

  if (cargandoSesion || (user && cargandoAdmin)) {
    return <main className="admin"><p>Cargando…</p></main>;
  }

  if (!user) {
    return (
      <main className="admin">
        <h1>Administración de la plataforma</h1>
        <div className="admin-login">
          <button onClick={entrarConGoogle} className="admin-btn">Entrar con Google</button>
        </div>
        <p className="admin-meta">
          Solo para el administrador de la plataforma. Si organizas una competencia, entra a su dirección: <code>/nombre-de-la-competencia/admin</code>.
        </p>
        {CON_CLAVE && (
          <form className="admin-login" onSubmit={(evento) => {
            evento.preventDefault();
            signInWithEmailAndPassword(auth, email, pin).catch(() => setError('Credenciales incorrectas.'));
          }}>
            <span className="admin-meta">Demo local:</span>
            <input type="email" placeholder="Correo" value={email} onChange={(evento) => setEmail(evento.target.value)} required />
            <input type="password" placeholder="Clave" value={pin} onChange={(evento) => setPin(evento.target.value)} required />
            <button className="admin-btn-secondary">Ingresar con clave</button>
          </form>
        )}
        {error && <p className="admin-error">{error}</p>}
      </main>
    );
  }

  if (faltaGoogle) {
    return (
      <main className="admin">
        <h1>Entra con Google</h1>
        <p>{correo} es administrador de la plataforma, pero entró con correo y clave. Para administrar la plataforma hay que entrar con la cuenta de Google de ese correo.</p>
        <div className="admin-row">
          <button onClick={async () => { await signOut(auth); await entrarConGoogle(); }} className="admin-btn">Salir y entrar con Google</button>
        </div>
        {error && <p className="admin-error">{error}</p>}
      </main>
    );
  }

  if (!esAdmin) {
    return (
      <main className="admin">
        <h1>Sin acceso de administración</h1>
        <p>{correo} no administra la plataforma. Si organizas una competencia, entra a su dirección: <code>/nombre-de-la-competencia/admin</code>.</p>
        <div className="admin-row">
          <Link className="admin-link" to="/">Ver competencias</Link>
          <button onClick={() => signOut(auth)} className="admin-btn-secondary">Salir</button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin">
      <div className="admin-header">
        <h1>Competencias</h1>
        <div className="admin-header-actions">
          <Link className="admin-link" to="/">Portada</Link>
          <button onClick={() => signOut(auth)} className="admin-btn-secondary">Salir</button>
        </div>
      </div>
      {error && <p className="admin-error">{error}</p>}
      {mensaje && <p className="admin-meta"><strong>{mensaje}</strong></p>}

      <section className="admin-section">
        <h2>Nueva competencia</h2>
        <form onSubmit={crearCompetencia} className="admin-stack">
          <div className="admin-row">
            <label>Nombre <input value={nombre} onChange={(evento) => setNombre(evento.target.value)} placeholder="Copa Chile 2026" required /></label>
            <label>
              Dirección
              <span className="admin-meta"> /</span>
              <input value={slugFinal} onChange={(evento) => setSlugElegido(evento.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="copa-chile-2026" required />
            </label>
            <label>Fecha <input name="fecha" type="date" required /></label>
          </div>
          <div className="admin-row">
            <label>Club organizador <input name="club" placeholder="Club de escalada" /></label>
            <label>Lugar <input name="lugar" placeholder="Gimnasio, ciudad" /></label>
            <label>Correo del organizador <input name="organizador" type="email" placeholder="opcional" /></label>
            <button className="admin-btn">Crear</button>
          </div>
          <p className="admin-meta">
            La dirección no se puede cambiar después: es la URL de la competencia (/{slugFinal || 'copa-chile-2026'}, /{slugFinal || 'copa-chile-2026'}/juez…).
            El organizador administra solo esta competencia en /{slugFinal || 'copa-chile-2026'}/admin; su cuenta se crea en Firebase Authentication.
          </p>
        </form>
      </section>

      <section className="admin-section">
        <h2>Todas las competencias</h2>
        {competencias.length === 0 && <p className="admin-meta">Todavía no hay competencias.</p>}
        {competencias.map((item) => (
          <div key={item.id} className="admin-row">
            <span className="admin-list-item">
              <strong>{item.nombre}</strong> · /{item.id}
              {item.fecha ? ` · ${item.fecha}` : ''}
              {item.club ? ` · ${item.club}` : ''}
              {item.activa ? ' · en portada' : ' · oculta'}
            </span>
            <Link className="admin-link" to={rutas.admin(item.id)}>Administrar</Link>
            <Link className="admin-link" to={rutas.tablero(item.id)}>Tablero</Link>
            <button onClick={() => cambiarPortada(item)} className="admin-btn-secondary">
              {item.activa ? 'Quitar de la portada' : 'Publicar en la portada'}
            </button>
          </div>
        ))}
      </section>

      <section className="admin-section">
        <h2>Demos</h2>
        <div className="admin-row">
          {progresoDemo
            ? <button disabled className="admin-btn">{progresoDemo}</button>
            : DEMOS.map((item) => (
              <button key={item.boton} onClick={() => cargarCompetenciaDemo(item.crear)} className="admin-btn">{item.boton}</button>
            ))}
          {progresoDemo && <strong>No cierres ni recargues esta pestaña hasta que termine.</strong>}
          {import.meta.env.DEV && (
            <button onClick={importarEjemplo} className="admin-btn-secondary">Cargar ejemplo Baguales 2026</button>
          )}
        </div>
        <p className="admin-meta">
          Cargar una demo la reinicia y la publica en la portada. <strong>Completa</strong> (/demo): seis categorías, clasificatoria en
          ronda americana, semifinal y final con Mujeres Adultas en curso. <strong>Primavera - El Muro</strong> (/primavera-el-muro):
          una categoría General, 20 competidores, ronda americana en curso. Juez: {DEMO_JUEZ}. Delegado: {DEMO_DELEGADO}.
          Tu cuenta queda como juez jefe.
        </p>
      </section>
    </main>
  );
}
