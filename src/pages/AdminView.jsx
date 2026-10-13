import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteDoc, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { BOULDERS, COMPETIDORES } from '../data/ordenAbsolutaDamas';
import { useEsAdmin, useUsuario } from '../hooks/useSesion';
import { resultadosColRef } from '../utils/resultado';
import { ordenDeSalida, rankingPorCategoria } from '../utils/ranking';
import './admin.css';
import {
  competenciaRef,
  competenciasCol,
  competidoresCol,
  docsConId,
  etapasCol,
  miembroRef,
  miembrosCol,
  normalizarCorreo,
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

const ROLES = {
  juez: 'Juez',
  juez_jefe: 'Juez jefe',
  delegado: 'Delegado',
};

export default function AdminView() {
  const { user, correo, cargando: cargandoSesion } = useUsuario();
  const { esAdmin, cargando: cargandoAdmin } = useEsAdmin(user);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [competencias, setCompetencias] = useState([]);
  const [competenciaId, setCompetenciaId] = useState('');
  const [etapas, setEtapas] = useState([]);
  const [competidores, setCompetidores] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [etapaOrdenId, setEtapaOrdenId] = useState('');
  const [origenOrden, setOrigenOrden] = useState('categoria');
  const [asignacion, setAsignacion] = useState({ correo: '', etapaId: '' });

  useEffect(() => {
    document.body.classList.add('admin-mode');
    return () => document.body.classList.remove('admin-mode');
  }, []);

  useEffect(() => {
    if (!esAdmin) return undefined;
    return onSnapshot(competenciasCol(db), (snapshot) => {
      const lista = docsConId(snapshot).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setCompetencias(lista);
      setCompetenciaId((actual) => actual || lista.find((item) => item.activa)?.id || lista[0]?.id || '');
    });
  }, [esAdmin]);

  useEffect(() => {
    if (!esAdmin || !competenciaId) return undefined;
    const unsubEtapas = onSnapshot(etapasCol(db, competenciaId), (snapshot) => setEtapas(docsConId(snapshot)));
    const unsubCompetidores = onSnapshot(competidoresCol(db, competenciaId), (snapshot) => {
      setCompetidores(docsConId(snapshot).sort((a, b) => Number(a.dorsal) - Number(b.dorsal)));
    });
    const unsubTurnos = onSnapshot(turnosCol(db, competenciaId), (snapshot) => setTurnos(docsConId(snapshot)));
    const unsubMiembros = onSnapshot(miembrosCol(db, competenciaId), (snapshot) => {
      setMiembros(docsConId(snapshot).sort((a, b) => a.id.localeCompare(b.id)));
    });
    return () => {
      unsubEtapas();
      unsubCompetidores();
      unsubTurnos();
      unsubMiembros();
    };
  }, [esAdmin, competenciaId]);

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
        estado: 'abierta',
        etapaPreviaId: datos.get('etapaPreviaId') || null,
      });
    });
  };

  const activarEtapa = (id) => ejecutar(async () => {
    const batch = writeBatch(db);
    etapas.forEach((item) => batch.update(doc(etapasCol(db, competenciaId), item.id), { activa: item.id === id }));
    await batch.commit();
  });

  const cambiarEstadoEtapa = (etapa) => {
    const cerrar = etapa.estado !== 'cerrada';
    const pregunta = cerrar
      ? `¿Cerrar ${etapa.nombre}? Los jueces ya no podrán modificar resultados.`
      : `¿Reabrir ${etapa.nombre}? Los jueces podrán volver a modificar resultados.`;
    if (!window.confirm(pregunta)) return;
    ejecutar(() => updateDoc(doc(etapasCol(db, competenciaId), etapa.id), { estado: cerrar ? 'cerrada' : 'abierta' }));
  };

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

  // Una competidora con resultados no se borra: dejaría resultados huérfanos
  // y cambiaría el ranking. Sin resultados, se borran también sus turnos.
  const quitarCompetidor = (competidor) => ejecutar(async () => {
    const conResultados = await getDocs(query(
      resultadosColRef(db),
      where('competenciaId', '==', competenciaId),
      where('competidorId', '==', competidor.id),
      limit(1),
    ));
    if (!conResultados.empty) {
      throw new Error(`#${competidor.dorsal} ${competidor.nombre} ya tiene resultados y no se puede quitar.`);
    }
    if (!window.confirm(`¿Quitar a #${competidor.dorsal} ${competidor.nombre} y sus turnos?`)) return;
    const batch = writeBatch(db);
    turnos
      .filter((turno) => turno.competidorId === competidor.id)
      .forEach((turno) => batch.delete(doc(turnosCol(db, competenciaId), turno.id)));
    batch.delete(doc(competidoresCol(db, competenciaId), competidor.id));
    await batch.commit();
  });

  const clasificadasDeEtapaPrevia = async (etapa, categoriaId, cupos) => {
    const snapshot = await getDocs(query(
      resultadosColRef(db),
      where('competenciaId', '==', competenciaId),
      where('etapaId', '==', etapa.etapaPreviaId),
    ));
    const grupos = rankingPorCategoria({
      competidores,
      turnos,
      resultados: snapshot.docs.map((item) => item.data()),
      etapaId: etapa.etapaPreviaId,
    });
    const grupo = grupos.find((item) => item.categoriaId === categoriaId);
    return ordenDeSalida(grupo?.filas || [], cupos).map((fila) => competidores.find((item) => item.id === fila.id));
  };

  const generarOrden = (evento) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const etapa = etapas.find((item) => item.id === datos.get('etapaId'));
    const categoriaId = datos.get('categoriaId');
    const boulderIds = datos.get('boulderId') === '*' ? etapa.boulders : [datos.get('boulderId')];
    const horaInicio = datos.get('hora');
    const intervalo = Number(datos.get('intervalo')) || 4;
    const cupos = Number(datos.get('cupos')) || 0;
    ejecutar(async () => {
      const lista = origenOrden === 'previa'
        ? await clasificadasDeEtapaPrevia(etapa, categoriaId, cupos)
        : competidores.filter((item) => item.categoriaId === categoriaId);
      if (!lista.length) throw new Error('No hay competidoras para generar el orden.');
      const batch = writeBatch(db);
      boulderIds.forEach((boulderId, indiceBloque) => {
        turnos
          .filter((item) => item.etapaId === etapa.id && item.boulderId === boulderId && item.categoriaId === categoriaId)
          .forEach((item) => batch.delete(doc(turnosCol(db, competenciaId), item.id)));
        // Con todos los bloques, cada bloque arranca un turno después del anterior.
        const inicio = sumarMinutos(horaInicio, indiceBloque * intervalo);
        lista.forEach((competidor, index) => {
          batch.set(doc(turnosCol(db, competenciaId)), {
            etapaId: etapa.id,
            categoriaId,
            boulderId,
            competidorId: competidor.id,
            orden: index + 1,
            horaProgramada: sumarMinutos(inicio, index * intervalo),
          });
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

  const agregarMiembro = (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const correoMiembro = normalizarCorreo(datos.get('email'));
    const existente = miembros.find((item) => item.id === correoMiembro);
    ejecutar(async () => {
      await setDoc(miembroRef(db, competenciaId, correoMiembro), {
        rol: datos.get('rol'),
        nombre: String(datos.get('nombre') || '').trim(),
        club: String(datos.get('club') || '').trim(),
        asignaciones: existente?.asignaciones || {},
      });
      formulario.reset();
    });
  };

  const quitarMiembro = (miembro) => {
    if (!window.confirm(`¿Quitar a ${miembro.id} de esta competencia?`)) return;
    ejecutar(() => deleteDoc(miembroRef(db, competenciaId, miembro.id)));
  };

  const asignarBloques = (evento) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const miembro = miembros.find((item) => item.id === asignacion.correo);
    const etapaId = asignacion.etapaId;
    if (!miembro || !etapaId) return;
    ejecutar(() => updateDoc(miembroRef(db, competenciaId, miembro.id), {
      asignaciones: { ...(miembro.asignaciones || {}), [etapaId]: datos.getAll('boulders') },
    }));
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
      estado: 'abierta',
      etapaPreviaId: null,
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

  if (cargandoSesion || (user && cargandoAdmin)) {
    return <main className="admin"><p>Cargando…</p></main>;
  }

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

  if (!esAdmin) {
    return (
      <main className="admin">
        <h1>Sin acceso de administración</h1>
        <p>{correo} no está en la lista de administradores.</p>
        <div className="admin-row">
          <Link className="admin-link" to="/juez">Ir a la vista del juez</Link>
          <button onClick={() => signOut(auth)} className="admin-btn-secondary">Salir</button>
        </div>
      </main>
    );
  }

  const categorias = [...new Map(competidores.map((item) => [item.categoriaId, item.categoria])).entries()];
  const etapaOrden = etapas.find((item) => item.id === etapaOrdenId) || etapas.find((item) => item.activa) || etapas[0];
  const etapaAsignacion = etapas.find((item) => item.id === asignacion.etapaId);
  const miembroAsignacion = miembros.find((item) => item.id === asignacion.correo);
  const jueces = miembros.filter((item) => item.rol === 'juez');
  const nombreEtapa = (id) => etapas.find((item) => item.id === id)?.nombre || id;
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
        {import.meta.env.DEV && (
          <button onClick={importarEjemplo} className="admin-btn">Cargar ejemplo Baguales 2026</button>
        )}
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
              <select name="etapaPreviaId" defaultValue="" title="Desempata con la posición en esa etapa y permite generar el orden con sus clasificadas">
                <option value="">Sin etapa previa</option>
                {etapas.map((item) => <option key={item.id} value={item.id}>Después de {item.nombre}</option>)}
              </select>
              <button className="admin-btn">Agregar</button>
            </form>
            {etapas.map((item) => (
              <div key={item.id} className="admin-row">
                <strong>{item.nombre}</strong>
                <span className="admin-meta">
                  {item.boulders?.join(', ')}
                  {item.etapaPreviaId ? ` · después de ${nombreEtapa(item.etapaPreviaId)}` : ''}
                  {item.estado === 'cerrada' ? ' · cerrada' : ''}
                </span>
                {item.activa ? <span>Activa</span> : <button onClick={() => activarEtapa(item.id)} className="admin-btn-secondary">Activar</button>}
                <button onClick={() => cambiarEstadoEtapa(item)} className="admin-btn-secondary">
                  {item.estado === 'cerrada' ? 'Reabrir' : 'Cerrar'}
                </button>
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
            <p className="admin-meta">Con el mismo dorsal y categoría se corrige el nombre: el tablero lo toma de aquí.</p>
            <CsvImport onImportar={importarCsv} />
            {competidores.map((item) => (
              <div key={item.id} className="admin-row">
                <span className="admin-list-item">#{item.dorsal} {item.nombre} · {item.categoria}</span>
                <button onClick={() => quitarCompetidor(item)} className="admin-btn-secondary">Quitar</button>
              </div>
            ))}
          </section>

          <section className="admin-section">
            <h2>Orden de paso</h2>
            {etapas.length > 0 && (
              <form onSubmit={generarOrden} className="admin-row">
                <select name="etapaId" value={etapaOrden?.id || ''} onChange={(evento) => setEtapaOrdenId(evento.target.value)} required>
                  {etapas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
                <select name="categoriaId" required>
                  {categorias.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                </select>
                <select name="boulderId" required>
                  <option value="*">Todos los bloques</option>
                  {(etapaOrden?.boulders || []).map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <select value={origenOrden} onChange={(evento) => setOrigenOrden(evento.target.value)}>
                  <option value="categoria">Toda la categoría</option>
                  {etapaOrden?.etapaPreviaId && (
                    <option value="previa">Clasificadas de {nombreEtapa(etapaOrden.etapaPreviaId)}</option>
                  )}
                </select>
                {origenOrden === 'previa' && etapaOrden?.etapaPreviaId && (
                  <input name="cupos" type="number" min="1" defaultValue="6" title="Cupos" className="admin-field-narrow" required />
                )}
                <input name="hora" type="time" defaultValue="15:15" required />
                <input name="intervalo" type="number" min="1" defaultValue={etapaOrden?.duracionTurno || 4} className="admin-field-narrow" />
                <button className="admin-btn">Generar</button>
              </form>
            )}
            {origenOrden === 'previa' && (
              <p className="admin-meta">Toma las primeras de la etapa previa (con empates) y las ordena al revés del ranking: la mejor sale última.</p>
            )}
            {turnosVisibles.map((turno) => {
              const competidor = competidores.find((item) => item.id === turno.competidorId);
              return (
                <div key={turno.id} className="admin-row">
                  <span className="admin-list-item">{nombreEtapa(turno.etapaId)} · {turno.boulderId} · {turno.orden}. {turno.horaProgramada} · #{competidor?.dorsal} {competidor?.nombre}</span>
                  <button onClick={() => moverTurno(turno, -1)} className="admin-btn-secondary">Subir</button>
                  <button onClick={() => moverTurno(turno, 1)} className="admin-btn-secondary">Bajar</button>
                </div>
              );
            })}
          </section>

          <section className="admin-section">
            <h2>Jueces y delegados</h2>
            <p className="admin-meta">
              El rol vale solo para esta competencia. La cuenta se crea en Firebase Authentication con el mismo correo.
              El juez jefe anota en todos los bloques y resuelve apelaciones.
            </p>
            <form onSubmit={agregarMiembro} className="admin-row">
              <input name="email" type="email" placeholder="Correo" required />
              <select name="rol" defaultValue="juez">
                {Object.entries(ROLES).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
              </select>
              <input name="nombre" placeholder="Nombre" />
              <input name="club" placeholder="Club (delegados)" />
              <button className="admin-btn">Guardar</button>
            </form>
            {miembros.map((item) => (
              <div key={item.id} className="admin-row">
                <span className="admin-list-item">
                  {item.id} · {ROLES[item.rol] || item.rol}
                  {item.nombre ? ` · ${item.nombre}` : ''}
                  {item.club ? ` · ${item.club}` : ''}
                  {item.rol === 'juez' && Object.entries(item.asignaciones || {})
                    .filter(([, bloques]) => bloques.length)
                    .map(([etapaId, bloques]) => ` · ${nombreEtapa(etapaId)}: ${bloques.join(', ')}`)
                    .join('')}
                </span>
                <button onClick={() => quitarMiembro(item)} className="admin-btn-secondary">Quitar</button>
              </div>
            ))}

            <h3>Asignar bloques a un juez</h3>
            <form onSubmit={asignarBloques} className="admin-row">
              <select value={asignacion.correo} onChange={(evento) => setAsignacion((prev) => ({ ...prev, correo: evento.target.value }))} required>
                <option value="">Juez</option>
                {jueces.map((item) => <option key={item.id} value={item.id}>{item.nombre || item.id}</option>)}
              </select>
              <select value={asignacion.etapaId} onChange={(evento) => setAsignacion((prev) => ({ ...prev, etapaId: evento.target.value }))} required>
                <option value="">Etapa</option>
                {etapas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
              {etapaAsignacion && miembroAsignacion && (
                <span key={`${miembroAsignacion.id}-${etapaAsignacion.id}`} className="admin-row">
                  {etapaAsignacion.boulders.map((id) => (
                    <label key={id}>
                      <input
                        type="checkbox"
                        name="boulders"
                        value={id}
                        defaultChecked={(miembroAsignacion.asignaciones?.[etapaAsignacion.id] || []).includes(id)}
                      /> {id}
                    </label>
                  ))}
                </span>
              )}
              <button className="admin-btn" disabled={!etapaAsignacion || !miembroAsignacion}>Asignar</button>
            </form>
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
