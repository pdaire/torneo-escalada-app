import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { cargarDemo } from '../data/cargarDemo';
import { DEMO_DELEGADO, DEMO_JUEZ, demoPrincipal } from '../data/demo';
import { demoPrimavera } from '../data/demoPrimavera';
import { PLANTILLAS, mensajeParaOrganizador, plantilla } from '../data/plantillas';
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
  const [editandoSlug, setEditandoSlug] = useState(false);
  const [plantillaId, setPlantillaId] = useState('americana');
  const [creada, setCreada] = useState(null);
  const [copiado, setCopiado] = useState('');
  // Fecha local de hoy (AAAA-MM-DD), para marcar las competencias que ya pasaron.
  const [hoy] = useState(() => new Date().toLocaleDateString('en-CA'));
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
  const errorSlug = slugFinal ? validarSlug(slugFinal, competencias.map((item) => item.id)) : '';
  const origen = window.location.origin;

  const crearCompetencia = (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    if (errorSlug || !slugFinal) {
      setError(errorSlug || 'Escribe el nombre de la competencia.');
      return;
    }
    const organizador = normalizarCorreo(datos.get('organizador'));
    const club = String(datos.get('club') || '').trim();
    const competencia = {
      nombre: nombre.trim(),
      fecha: datos.get('fecha'),
      club,
      lugar: String(datos.get('lugar') || '').trim(),
      activa: false,
    };
    const etapas = plantilla(plantillaId).etapas();
    ejecutar(async () => {
      // Competencia, etapas de la plantilla y organizador en un solo batch.
      const batch = writeBatch(db);
      batch.set(competenciaRef(db, slugFinal), { ...competencia, creadaEn: serverTimestamp() });
      etapas.forEach(({ id, ...etapa }) => batch.set(doc(etapasCol(db, slugFinal), id), etapa));
      if (organizador) {
        batch.set(miembroRef(db, slugFinal, organizador), { rol: 'organizador', nombre: '', club, asignaciones: {} });
      }
      await batch.commit();
      setCreada({ id: slugFinal, ...competencia, organizador, etapas: etapas.length });
      setMensaje('');
      formulario.reset();
      setNombre('');
      setSlugElegido('');
      setEditandoSlug(false);
    });
  };

  const copiar = async (texto, clave) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin permiso para el portapapeles: copia con una selección temporal.
      const area = document.createElement('textarea');
      area.value = texto;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopiado(clave);
    setTimeout(() => setCopiado((actual) => (actual === clave ? '' : actual)), 2000);
  };

  const cambiarPortada = (competencia) => ejecutar(async () => {
    await updateDoc(competenciaRef(db, competencia.id), { activa: !competencia.activa });
    if (creada?.id === competencia.id) setCreada((actual) => ({ ...actual, activa: !competencia.activa }));
  });

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

      {creada && (
        <section className="admin-section admin-exito">
          <div className="admin-row" style={{ justifyContent: 'space-between' }}>
            <h2>✓ {creada.nombre} creada</h2>
            <button onClick={() => setCreada(null)} className="admin-btn-secondary">Cerrar</button>
          </div>
          <p className="admin-meta">
            {creada.etapas ? `Con ${creada.etapas} ${creada.etapas === 1 ? 'etapa' : 'etapas'} de la plantilla. ` : 'Sin etapas: se arman en su admin. '}
            {creada.organizador
              ? `Organizador: ${creada.organizador}. Si todavía no tiene cuenta, créala en Firebase → Authentication → Users con ese correo.`
              : 'Sin organizador: puedes agregarlo después en su admin, en Jueces y delegados.'}
          </p>
          {[
            ['Admin del club', `${origen}${rutas.admin(creada.id)}`],
            ['Jueces', `${origen}${rutas.juez(creada.id)}`],
            ['Delegados', `${origen}${rutas.delegado(creada.id)}`],
            ['Tablero público', `${origen}${rutas.tablero(creada.id)}`],
          ].map(([texto, url]) => (
            <div key={url} className="admin-row admin-enlace">
              <span className="admin-enlace-nombre">{texto}</span>
              <code>{url}</code>
              <button onClick={() => copiar(url, url)} className="admin-btn-secondary">{copiado === url ? 'Copiado' : 'Copiar'}</button>
            </div>
          ))}
          <div className="admin-row">
            <button
              onClick={() => copiar(mensajeParaOrganizador({ origen, competencia: creada, correoOrganizador: creada.organizador }), 'mensaje')}
              className="admin-btn">
              {copiado === 'mensaje' ? 'Mensaje copiado' : 'Copiar mensaje para el organizador'}
            </button>
            <Link className="admin-link" to={rutas.admin(creada.id)}>Abrir su admin</Link>
            <button onClick={() => cambiarPortada(creada)} className="admin-btn-secondary">
              {creada.activa ? 'Quitar de la portada' : 'Publicar en la portada'}
            </button>
          </div>
        </section>
      )}

      <section className="admin-section">
        <h2>Nueva competencia</h2>
        <form onSubmit={crearCompetencia} className="admin-stack">
          <label className="admin-campo">
            Nombre
            <input value={nombre} onChange={(evento) => setNombre(evento.target.value)} placeholder="Copa Chile 2026" required />
          </label>
          {slugFinal && (
            <div className="admin-direccion">
              {editandoSlug ? (
                <label className="admin-row">
                  <span className="admin-meta">{origen}/</span>
                  <input
                    value={slugFinal}
                    onChange={(evento) => setSlugElegido(evento.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    aria-label="Dirección de la competencia"
                    autoFocus
                  />
                </label>
              ) : (
                <span className="admin-meta">{origen}/<strong>{slugFinal}</strong></span>
              )}
              <span className={errorSlug ? 'admin-estado-error' : 'admin-estado-ok'}>{errorSlug || '✓ disponible'}</span>
              {!editandoSlug && <button type="button" onClick={() => setEditandoSlug(true)} className="admin-boton-texto">cambiar dirección</button>}
              <span className="admin-meta">La dirección no se puede cambiar después de crear la competencia.</span>
            </div>
          )}
          <div className="admin-row">
            <label className="admin-campo">Fecha <input name="fecha" type="date" required /></label>
            <label className="admin-campo">Club organizador <input name="club" placeholder="Club Vertical" /></label>
            <label className="admin-campo">Lugar <input name="lugar" placeholder="Gimnasio, ciudad" /></label>
          </div>

          <fieldset className="admin-plantillas">
            <legend>Formato</legend>
            {PLANTILLAS.map((item) => (
              <label key={item.id} className={item.id === plantillaId ? 'admin-plantilla elegida' : 'admin-plantilla'}>
                <input type="radio" name="plantilla" checked={item.id === plantillaId} onChange={() => setPlantillaId(item.id)} />
                <span>
                  <strong>{item.nombre}</strong>
                  <span className="admin-meta">{item.descripcion}</span>
                </span>
              </label>
            ))}
            <span className="admin-meta">Todo se puede ajustar después en el admin de la competencia.</span>
          </fieldset>

          <label className="admin-campo">
            Organizador (opcional)
            <input name="organizador" type="email" placeholder="organizador@club.cl" />
            <span className="admin-meta">
              Administrará solo esta competencia. Su cuenta (correo y clave) se crea aparte en Firebase → Authentication → Users.
            </span>
          </label>
          <div className="admin-row">
            <button className="admin-btn" disabled={!slugFinal || Boolean(errorSlug)}>Crear competencia</button>
          </div>
        </form>
      </section>

      <section className="admin-section">
        <h2>Competencias</h2>
        {competencias.length === 0 && <p className="admin-meta">Todavía no hay competencias.</p>}
        {competencias.map((item) => {
          const estado = item.activa ? 'portada' : (item.fecha && item.fecha < hoy ? 'pasada' : 'oculta');
          const etiqueta = { portada: '● En portada', oculta: '○ Oculta', pasada: '○ Pasada' }[estado];
          return (
            <div key={item.id} className="admin-tarjeta">
              <div>
                <span className={`admin-estado admin-estado-${estado}`}>{etiqueta}</span>
                <strong>{item.nombre}</strong>
                <span className="admin-meta">
                  {[item.fecha, item.club, item.lugar].filter(Boolean).join(' · ')} · /{item.id}
                </span>
              </div>
              <div className="admin-row">
                <Link className="admin-link" to={rutas.admin(item.id)}>Admin</Link>
                <Link className="admin-link" to={rutas.tablero(item.id)}>Tablero</Link>
                <button onClick={() => cambiarPortada(item)} className="admin-btn-secondary">
                  {item.activa ? 'Quitar de la portada' : 'Publicar en la portada'}
                </button>
              </div>
            </div>
          );
        })}
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
