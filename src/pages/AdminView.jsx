import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { BOULDERS, COMPETIDORES } from '../data/ordenAbsolutaDamas';
import './admin.css';
import {
  competenciaRef,
  competenciasCol,
  competidoresCol,
  docsConId,
  etapasCol,
  slug,
  sumarMinutos,
  turnosCol,
} from '../utils/competicion';

const INICIOS_EJEMPLO = {
  M1: '15:15',
  M2: '15:31',
  M3: '15:47',
  M4: '16:03',
};

export default function AdminView() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [competencias, setCompetencias] = useState([]);
  const [competenciaId, setCompetenciaId] = useState('');
  const [etapas, setEtapas] = useState([]);
  const [competidores, setCompetidores] = useState([]);
  const [turnos, setTurnos] = useState([]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    document.body.classList.add('admin-mode');
    return () => document.body.classList.remove('admin-mode');
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    return onSnapshot(competenciasCol(db), (snapshot) => {
      const lista = docsConId(snapshot).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setCompetencias(lista);
      setCompetenciaId((actual) => actual || lista.find((item) => item.activa)?.id || lista[0]?.id || '');
    });
  }, [user]);

  useEffect(() => {
    if (!user || !competenciaId) return undefined;
    const unsubEtapas = onSnapshot(etapasCol(db, competenciaId), (snapshot) => setEtapas(docsConId(snapshot)));
    const unsubCompetidores = onSnapshot(competidoresCol(db, competenciaId), (snapshot) => {
      setCompetidores(docsConId(snapshot).sort((a, b) => Number(a.dorsal) - Number(b.dorsal)));
    });
    const unsubTurnos = onSnapshot(turnosCol(db, competenciaId), (snapshot) => setTurnos(docsConId(snapshot)));
    return () => {
      unsubEtapas();
      unsubCompetidores();
      unsubTurnos();
    };
  }, [user, competenciaId]);

  const ejecutar = async (accion) => {
    try {
      await accion();
      setError('');
    } catch (err) {
      setError(err.code === 'permission-denied'
        ? 'Firestore rechazó la escritura. Actualiza las reglas con el archivo firestore.rules.'
        : err.message);
    }
  };

  const crearCompetencia = (evento) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const nombre = String(datos.get('nombre')).trim();
    const id = `${slug(nombre)}-${Date.now().toString(36)}`;
    ejecutar(async () => {
      await setDoc(competenciaRef(db, id), {
        nombre,
        fecha: datos.get('fecha'),
        activa: competencias.length === 0,
        creadaEn: serverTimestamp(),
      });
      setCompetenciaId(id);
    });
  };

  const activarCompetencia = (id) => ejecutar(async () => {
    const batch = writeBatch(db);
    competencias.forEach((item) => batch.update(competenciaRef(db, item.id), { activa: item.id === id }));
    await batch.commit();
  });

  const crearEtapa = (evento) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const nombre = String(datos.get('nombre')).trim();
    const boulders = String(datos.get('boulders')).split(',').map((item) => item.trim()).filter(Boolean);
    const id = `${slug(nombre)}-${Date.now().toString(36)}`;
    ejecutar(async () => {
      await setDoc(doc(etapasCol(db, competenciaId), id), {
        nombre,
        tipo: datos.get('tipo'),
        boulders,
        duracionTurno: Number(datos.get('duracion')) || 4,
        activa: etapas.length === 0,
        asignaciones: {},
      });
    });
  };

  const activarEtapa = (id) => ejecutar(async () => {
    const batch = writeBatch(db);
    etapas.forEach((item) => batch.update(doc(etapasCol(db, competenciaId), item.id), { activa: item.id === id }));
    await batch.commit();
  });

  const agregarCompetidor = (evento) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const dorsal = String(datos.get('dorsal')).trim();
    const nombre = String(datos.get('nombre')).trim();
    const categoria = String(datos.get('categoria')).trim();
    const id = `${slug(categoria)}-${dorsal}`;
    ejecutar(async () => {
      await setDoc(doc(competidoresCol(db, competenciaId), id), {
        dorsal,
        nombre,
        categoria,
        categoriaId: slug(categoria),
      });
    });
  };

  const importarCsv = (texto) => ejecutar(async () => {
    const batch = writeBatch(db);
    texto.split('\n').map((linea) => linea.trim()).filter(Boolean).forEach((linea) => {
      if (/dorsal/i.test(linea) && /nombre/i.test(linea)) return;
      const [dorsal, nombre, categoria] = linea.split(/[,;]/).map((item) => item.trim());
      if (!dorsal || !nombre || !categoria) return;
      const id = `${slug(categoria)}-${dorsal}`;
      batch.set(doc(competidoresCol(db, competenciaId), id), {
        dorsal,
        nombre,
        categoria,
        categoriaId: slug(categoria),
      });
    });
    await batch.commit();
  });

  const generarOrden = (evento) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const etapaId = datos.get('etapaId');
    const categoriaId = datos.get('categoriaId');
    const boulderId = datos.get('boulderId');
    const horaInicio = datos.get('hora');
    const intervalo = Number(datos.get('intervalo')) || 4;
    const lista = competidores.filter((item) => item.categoriaId === categoriaId);
    const existentes = turnos.filter((item) => item.etapaId === etapaId && item.boulderId === boulderId && item.categoriaId === categoriaId);
    ejecutar(async () => {
      const batch = writeBatch(db);
      existentes.forEach((item) => batch.delete(doc(turnosCol(db, competenciaId), item.id)));
      lista.forEach((competidor, index) => {
        batch.set(doc(turnosCol(db, competenciaId)), {
          etapaId,
          categoriaId,
          boulderId,
          competidorId: competidor.id,
          orden: index + 1,
          horaProgramada: sumarMinutos(horaInicio, index * intervalo),
        });
      });
      await batch.commit();
    });
  };

  const moverTurno = (turno, direccion) => {
    const grupo = turnos
      .filter((item) => item.etapaId === turno.etapaId && item.boulderId === turno.boulderId && item.categoriaId === turno.categoriaId)
      .sort((a, b) => a.orden - b.orden);
    const index = grupo.findIndex((item) => item.id === turno.id);
    const vecino = grupo[index + direccion];
    if (!vecino) return;
    ejecutar(async () => {
      const batch = writeBatch(db);
      batch.update(doc(turnosCol(db, competenciaId), turno.id), { orden: vecino.orden });
      batch.update(doc(turnosCol(db, competenciaId), vecino.id), { orden: turno.orden });
      await batch.commit();
    });
  };

  const asignarJuez = (evento) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const etapa = etapas.find((item) => item.id === datos.get('etapaId'));
    ejecutar(async () => {
      await setDoc(doc(etapasCol(db, competenciaId), etapa.id), {
        asignaciones: { ...(etapa.asignaciones || {}), [datos.get('email')]: datos.get('boulderId') },
      }, { merge: true });
    });
  };

  const importarEjemplo = () => ejecutar(async () => {
    const id = 'baguales-2026';
    const batch = writeBatch(db);
    batch.set(competenciaRef(db, id), {
      nombre: 'Baguales 2026',
      fecha: '2026-10-04',
      activa: true,
      creadaEn: serverTimestamp(),
    });
    competencias.filter((item) => item.id !== id).forEach((item) => batch.update(competenciaRef(db, item.id), { activa: false }));
    batch.set(doc(etapasCol(db, id), 'final'), {
      nombre: 'Final',
      tipo: 'final',
      boulders: BOULDERS,
      duracionTurno: 4,
      activa: true,
      asignaciones: {},
    });
    COMPETIDORES.forEach((competidor) => {
      batch.set(doc(competidoresCol(db, id), competidor.id), {
        dorsal: competidor.dorsal,
        nombre: competidor.nombre,
        categoria: competidor.categoria,
        categoriaId: competidor.categoriaId,
      });
    });
    BOULDERS.forEach((boulderId) => {
      COMPETIDORES.forEach((competidor, index) => {
        batch.set(doc(turnosCol(db, id), `${boulderId}-${competidor.id}`), {
          etapaId: 'final',
          categoriaId: competidor.categoriaId,
          boulderId,
          competidorId: competidor.id,
          orden: index + 1,
          horaProgramada: sumarMinutos(INICIOS_EJEMPLO[boulderId], index * 4),
        });
      });
    });
    await batch.commit();
    setCompetenciaId(id);
  });

  if (!user) {
    return (
      <main className="admin">
        <h1>Administrar competencia</h1>
        <form className="admin-login" onSubmit={(evento) => {
          evento.preventDefault();
          signInWithEmailAndPassword(auth, email, pin).catch(() => setError('Credenciales incorrectas.'));
        }}>
          <input type="email" placeholder="Correo" value={email} onChange={(evento) => setEmail(evento.target.value)} required />
          <input type="password" placeholder="PIN" value={pin} onChange={(evento) => setPin(evento.target.value)} required />
          <button className="admin-btn">Ingresar</button>
        </form>
        {error && <p className="admin-error">{error}</p>}
      </main>
    );
  }

  const categorias = [...new Map(competidores.map((item) => [item.categoriaId, item.categoria])).entries()];
  const etapaActiva = etapas.find((item) => item.activa);
  const turnosVisibles = turnos
    .slice()
    .sort((a, b) => a.orden - b.orden || a.boulderId.localeCompare(b.boulderId));

  return (
    <main className="admin">
      <div className="admin-header">
        <h1>Administrar</h1>
        <div className="admin-header-actions">
          <Link className="admin-link" to="/juez">Vista del juez</Link>
          <button onClick={() => signOut(auth)} className="admin-btn-secondary">Salir</button>
        </div>
      </div>
      {error && <p className="admin-error">{error}</p>}

      <section className="admin-section">
        <h2>Competencia</h2>
        <button onClick={importarEjemplo} className="admin-btn">Cargar ejemplo Baguales 2026</button>
        <form onSubmit={crearCompetencia} className="admin-row">
          <input name="nombre" placeholder="Nombre" required />
          <input name="fecha" type="date" required />
          <button className="admin-btn">Crear</button>
        </form>
        {competencias.map((item) => (
          <div key={item.id} className="admin-row">
            <button
              onClick={() => setCompetenciaId(item.id)}
              className={item.id === competenciaId ? 'admin-btn-secondary is-selected' : 'admin-btn-secondary'}
            >
              {item.nombre} {item.activa ? '· activa' : ''}
            </button>
            {!item.activa && <button onClick={() => activarCompetencia(item.id)} className="admin-btn-secondary">Activar</button>}
          </div>
        ))}
      </section>

      {competenciaId && (
        <>
          <section className="admin-section">
            <h2>Etapas</h2>
            <form onSubmit={crearEtapa} className="admin-row">
              <input name="nombre" placeholder="Qualis, semi o final" required />
              <select name="tipo">
                <option value="qualis">Qualis</option>
                <option value="semi">Semifinal</option>
                <option value="final">Final</option>
              </select>
              <input name="boulders" defaultValue="M1, M2, M3, M4" />
              <input name="duracion" type="number" min="1" defaultValue="4" className="admin-field-narrow" />
              <button className="admin-btn">Agregar</button>
            </form>
            {etapas.map((item) => (
              <div key={item.id} className="admin-row">
                <strong>{item.nombre}</strong>
                <span className="admin-meta">{item.boulders?.join(', ')}</span>
                {item.activa ? <span>Activa</span> : <button onClick={() => activarEtapa(item.id)} className="admin-btn-secondary">Activar</button>}
              </div>
            ))}
          </section>

          <section className="admin-section">
            <h2>Competidores</h2>
            <form onSubmit={agregarCompetidor} className="admin-row">
              <input name="dorsal" placeholder="Dorsal" className="admin-field-narrow" required />
              <input name="nombre" placeholder="Nombre" required />
              <input name="categoria" placeholder="Categoría" required />
              <button className="admin-btn">Agregar</button>
            </form>
            <CsvImport onImportar={importarCsv} />
            {competidores.map((item) => (
              <div key={item.id} className="admin-row">
                <span className="admin-list-item">#{item.dorsal} {item.nombre} · {item.categoria}</span>
                <button onClick={() => ejecutar(() => deleteDoc(doc(competidoresCol(db, competenciaId), item.id)))} className="admin-btn-secondary">Quitar</button>
              </div>
            ))}
          </section>

          <section className="admin-section">
            <h2>Orden de paso</h2>
            <form onSubmit={generarOrden} className="admin-row">
              <select name="etapaId" required>
                {etapas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
              <select name="categoriaId" required>
                {categorias.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
              </select>
              <select name="boulderId" required>
                {(etapaActiva?.boulders || BOULDERS).map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <input name="hora" type="time" defaultValue="15:15" required />
              <input name="intervalo" type="number" min="1" defaultValue={etapaActiva?.duracionTurno || 4} className="admin-field-narrow" />
              <button className="admin-btn">Generar</button>
            </form>
            {turnosVisibles.map((turno) => {
              const competidor = competidores.find((item) => item.id === turno.competidorId);
              return (
                <div key={turno.id} className="admin-row">
                  <span className="admin-list-item">{turno.boulderId} · {turno.orden}. {turno.horaProgramada} · #{competidor?.dorsal} {competidor?.nombre}</span>
                  <button onClick={() => moverTurno(turno, -1)} className="admin-btn-secondary">Subir</button>
                  <button onClick={() => moverTurno(turno, 1)} className="admin-btn-secondary">Bajar</button>
                </div>
              );
            })}
          </section>

          <section className="admin-section">
            <h2>Asignar juez a un bloque</h2>
            <form onSubmit={asignarJuez} className="admin-row">
              <select name="etapaId" required>
                {etapas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
              <input name="email" type="email" placeholder="Correo del juez" required />
              <select name="boulderId" required>
                {(etapaActiva?.boulders || BOULDERS).map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <button className="admin-btn">Asignar</button>
            </form>
            {etapas.flatMap((etapaItem) => Object.entries(etapaItem.asignaciones || {}).map(([correo, boulder]) => (
              <p key={`${etapaItem.id}-${correo}`} className="admin-list-item">{etapaItem.nombre}: {correo} → {boulder}</p>
            )))}
          </section>
        </>
      )}
    </main>
  );
}

function CsvImport({ onImportar }) {
  const [texto, setTexto] = useState('');
  return (
    <div className="admin-stack">
      <textarea
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder={'dorsal,nombre,categoria\n9,Gabriela Sandoval,Absoluta Damas'}
        rows={4}
      />
      <button onClick={() => onImportar(texto)} className="admin-btn-secondary" style={{ alignSelf: 'flex-start' }}>Importar CSV</button>
    </div>
  );
}
