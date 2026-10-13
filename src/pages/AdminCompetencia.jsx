import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { arrayRemove, arrayUnion, deleteDoc, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useEsAdmin, useMiembro, useUsuario } from '../hooks/useSesion';
import { resultadosColRef } from '../utils/resultado';
import { ordenDeSalida, rankingPorCategoria } from '../utils/ranking';
import { AMERICANA_POR_DEFECTO, FORMATOS, esAmericana, puntosAmericana, reglasAmericana } from '../utils/score';
import { parsearSectores, textoDeSectores } from '../utils/sectores';
import { generarTablaPuntos, parsearTablaPuntos, tablaACsv } from '../utils/tablaPuntos';
import './admin.css';
import {
  competenciaRef,
  competidoresCol,
  docsConId,
  etapasCol,
  miembroRef,
  miembrosCol,
  normalizarCorreo,
  rutas,
  slug,
  sumarMinutos,
  turnosCol,
} from '../utils/competicion';

const ROLES = {
  organizador: 'Organizador',
  juez: 'Juez',
  juez_jefe: 'Juez jefe',
  delegado: 'Delegado',
};

// Administración de una competencia (/:competenciaId/admin): etapas, competidoras,
// orden de paso, jueces y delegados. Pueden entrar los admins de la plataforma y
// los organizadores de esta competencia.
export default function AdminCompetencia() {
  const { competenciaId } = useParams();
  const { user, correo, cargando: cargandoSesion } = useUsuario();
  const { esAdmin, cargando: cargandoAdmin } = useEsAdmin(user);
  const { miembro, cargando: cargandoMiembro } = useMiembro(user, competenciaId);
  const autorizado = esAdmin || miembro?.rol === 'organizador';
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [competencia, setCompetencia] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [competidores, setCompetidores] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [etapaOrdenId, setEtapaOrdenId] = useState('');
  const [origenOrden, setOrigenOrden] = useState('categoria');
  const [asignacion, setAsignacion] = useState({ correo: '', etapaId: '' });
  const [formatoNueva, setFormatoNueva] = useState('wc');
  const [origenTabla, setOrigenTabla] = useState('formula');
  const [tablaAbierta, setTablaAbierta] = useState(null);

  useEffect(() => {
    document.body.classList.add('admin-mode');
    return () => document.body.classList.remove('admin-mode');
  }, []);

  useEffect(() => {
    if (!autorizado) return undefined;
    const unsubCompetencia = onSnapshot(competenciaRef(db, competenciaId), (snap) => {
      setCompetencia(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    const unsubEtapas = onSnapshot(etapasCol(db, competenciaId), (snapshot) => setEtapas(docsConId(snapshot)));
    const unsubCompetidores = onSnapshot(competidoresCol(db, competenciaId), (snapshot) => {
      setCompetidores(docsConId(snapshot).sort((a, b) => Number(a.dorsal) - Number(b.dorsal)));
    });
    const unsubTurnos = onSnapshot(turnosCol(db, competenciaId), (snapshot) => setTurnos(docsConId(snapshot)));
    const unsubMiembros = onSnapshot(miembrosCol(db, competenciaId), (snapshot) => {
      setMiembros(docsConId(snapshot).sort((a, b) => a.id.localeCompare(b.id)));
    });
    return () => {
      unsubCompetencia();
      unsubEtapas();
      unsubCompetidores();
      unsubTurnos();
      unsubMiembros();
    };
  }, [autorizado, competenciaId]);

  const ejecutar = async (accion) => {
    try {
      await accion();
      setError('');
    } catch (err) {
      setError(err.code === 'permission-denied'
        ? 'Firestore rechazó la escritura. Revisa que tu cuenta administre esta competencia y que las reglas estén publicadas.'
        : err.message);
    }
  };

  const crearEtapa = (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const nombre = String(datos.get('nombre')).trim();
    const id = `${slug(nombre)}-${Date.now().toString(36)}`;
    const base = {
      nombre,
      tipo: datos.get('tipo'),
      formato: formatoNueva,
      activa: etapas.length === 0,
      estado: 'abierta',
      categoriasCerradas: [],
      etapaPreviaId: datos.get('etapaPreviaId') || null,
    };
    let etapa;
    if (formatoNueva === 'americana') {
      const numero = (clave) => {
        const valor = Number(datos.get(clave));
        return Number.isFinite(valor) && valor >= 0 ? valor : AMERICANA_POR_DEFECTO[clave];
      };
      const generada = origenTabla === 'csv'
        ? parsearTablaPuntos(datos.get('tablaCsv'))
        : generarTablaPuntos({
          cantidad: Number(datos.get('cantidad')) || 24,
          puntajeBase: numero('puntajeBase'),
          incrementoPorBloque: numero('incrementoPorBloque'),
          descuentoPorIntento: numero('descuentoPorIntento'),
          maxIntentos: Math.max(1, numero('maxIntentos')),
        });
      if (generada.error) {
        setError(`Tabla de puntos: ${generada.error}`);
        return;
      }
      const { sectores, error: errorSectores } = parsearSectores(datos.get('sectores'), generada.boulders);
      if (errorSectores) {
        setError(errorSectores);
        return;
      }
      etapa = {
        ...base,
        boulders: generada.boulders,
        tablaPuntos: generada.tabla,
        maxIntentos: generada.maxIntentos,
        mejoresBloques: Math.max(1, numero('mejoresBloques')),
        sectores,
      };
    } else {
      etapa = {
        ...base,
        boulders: String(datos.get('boulders')).split(',').map((item) => item.trim()).filter(Boolean),
        duracionTurno: Number(datos.get('duracion')) || 4,
      };
    }
    ejecutar(async () => {
      await setDoc(doc(etapasCol(db, competenciaId), id), etapa);
      formulario.reset();
      setFormatoNueva('wc');
    });
  };

  // Cambia la tabla de puntos de una etapa americana. Los puntajes se recalculan
  // al mostrarlos, así que el tablero refleja la tabla nueva de inmediato.
  const guardarTabla = (etapa, texto, mejores) => {
    const leida = parsearTablaPuntos(texto);
    if (leida.error) {
      setError(`Tabla de puntos: ${leida.error}`);
      return;
    }
    const quitados = (etapa.boulders || []).filter((id) => !leida.boulders.includes(id));
    const enSectores = quitados.filter((id) => Object.values(etapa.sectores || {}).some((ids) => ids.includes(id)));
    if (enSectores.length) {
      setError(`Quita primero de los sectores los bloques que ya no están en la tabla: ${enSectores.join(', ')}.`);
      return;
    }
    if (quitados.length && !window.confirm(`La tabla nueva no tiene ${quitados.join(', ')}. Si ya hay resultados en esos bloques, dejarán de sumar. ¿Seguir?`)) return;
    ejecutar(async () => {
      await updateDoc(doc(etapasCol(db, competenciaId), etapa.id), {
        boulders: leida.boulders,
        tablaPuntos: leida.tabla,
        maxIntentos: leida.maxIntentos,
        mejoresBloques: Math.max(1, Number(mejores) || reglasAmericana(etapa).mejoresBloques),
      });
      setTablaAbierta(null);
    });
  };

  const editarSectores = (etapa) => {
    const texto = window.prompt(
      `Sectores de ${etapa.nombre}. Ejemplo: A: 1, 8, 23, 32; B: 2, 9, 16`,
      textoDeSectores(etapa.sectores),
    );
    if (texto == null) return;
    const { sectores, error: errorSectores } = parsearSectores(texto, etapa.boulders || []);
    if (errorSectores) {
      setError(errorSectores);
      return;
    }
    ejecutar(() => updateDoc(doc(etapasCol(db, competenciaId), etapa.id), { sectores }));
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

  const cambiarCategoriaCerrada = (etapa, categoriaId, nombre) => {
    const cerrar = !(etapa.categoriasCerradas || []).includes(categoriaId);
    const pregunta = cerrar
      ? `¿Finalizar ${nombre} en ${etapa.nombre}? Los jueces ya no podrán modificar sus resultados.`
      : `¿Reabrir ${nombre} en ${etapa.nombre}?`;
    if (!window.confirm(pregunta)) return;
    ejecutar(() => updateDoc(doc(etapasCol(db, competenciaId), etapa.id), {
      categoriasCerradas: cerrar ? arrayUnion(categoriaId) : arrayRemove(categoriaId),
    }));
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
      etapa: etapas.find((item) => item.id === etapa.etapaPreviaId) || { id: etapa.etapaPreviaId },
    });
    const grupo = grupos.find((item) => item.categoriaId === categoriaId);
    return ordenDeSalida(grupo?.filas || [], cupos).map((fila) => competidores.find((item) => item.id === fila.id));
  };

  const generarOrden = (evento) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const etapa = etapas.find((item) => item.id === datos.get('etapaId'));
    const categoriaId = datos.get('categoriaId');
    const boulderIds = datos.getAll('boulderIds');
    const horaInicio = datos.get('hora');
    const intervalo = Number(datos.get('intervalo')) || 4;
    const cupos = Number(datos.get('cupos')) || 0;
    ejecutar(async () => {
      if (!boulderIds.length) throw new Error('Marca al menos un bloque.');
      const lista = origenOrden === 'previa'
        ? await clasificadasDeEtapaPrevia(etapa, categoriaId, cupos)
        : competidores.filter((item) => item.categoriaId === categoriaId);
      if (!lista.length) throw new Error('No hay competidoras para generar el orden.');
      const batch = writeBatch(db);
      boulderIds.forEach((boulderId, indiceBloque) => {
        turnos
          .filter((item) => item.etapaId === etapa.id && item.boulderId === boulderId && item.categoriaId === categoriaId)
          .forEach((item) => batch.delete(doc(turnosCol(db, competenciaId), item.id)));
        // Con varios bloques, cada bloque arranca un turno después del anterior.
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
    const etapa = etapas.find((item) => item.id === etapaId);
    const bloques = [
      ...datos.getAll('boulders'),
      ...datos.getAll('sectores').flatMap((nombre) => etapa?.sectores?.[nombre] || []),
    ];
    ejecutar(() => updateDoc(miembroRef(db, competenciaId, miembro.id), {
      asignaciones: { ...(miembro.asignaciones || {}), [etapaId]: [...new Set(bloques)] },
    }));
  };

  if (cargandoSesion || (user && (cargandoAdmin || cargandoMiembro))) {
    return <main className="admin"><p>Cargando…</p></main>;
  }

  if (!user) {
    return (
      <main className="admin">
        <h1>Administrar /{competenciaId}</h1>
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

  if (!autorizado) {
    return (
      <main className="admin">
        <h1>Sin acceso a /{competenciaId}</h1>
        <p>{correo} no es organizador de esta competencia.</p>
        <div className="admin-row">
          <Link className="admin-link" to={rutas.juez(competenciaId)}>Ir a la vista del juez</Link>
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

  const enlaces = [
    ['Tablero público', rutas.tablero(competenciaId)],
    ['Tablet del juez', rutas.juez(competenciaId)],
    ['Delegados', rutas.delegado(competenciaId)],
  ];

  return (
    <main className="admin">
      <div className="admin-header">
        <h1>{competencia?.nombre || competenciaId}</h1>
        <div className="admin-header-actions">
          {esAdmin && <Link className="admin-link" to="/admin">Todas las competencias</Link>}
          <button onClick={() => signOut(auth)} className="admin-btn-secondary">Salir</button>
        </div>
      </div>
      {error && <p className="admin-error">{error}</p>}

      <section className="admin-section">
        <h2>Direcciones para compartir</h2>
        {enlaces.map(([texto, ruta]) => (
          <div key={ruta} className="admin-row">
            <span className="admin-list-item">{texto}: <code>{window.location.origin}{ruta}</code></span>
            <Link className="admin-link" to={ruta}>Abrir</Link>
          </div>
        ))}
        <p className="admin-meta">
          {competencia?.activa ? 'Aparece en la portada.' : 'No aparece en la portada (la publica el administrador de la plataforma), pero las direcciones funcionan igual.'}
        </p>
      </section>

      {competenciaId && (
        <>
          <section className="admin-section">
            <h2>Etapas</h2>
            <form onSubmit={crearEtapa} className="admin-stack">
              <div className="admin-row">
                <input name="nombre" placeholder="Qualis, semi o final" required />
                <select name="tipo">
                  <option value="qualis">Qualis</option>
                  <option value="semi">Semifinal</option>
                  <option value="final">Final</option>
                </select>
                <select value={formatoNueva} onChange={(evento) => setFormatoNueva(evento.target.value)} title="Formato de puntuación">
                  {Object.entries(FORMATOS).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                </select>
                <select name="etapaPreviaId" defaultValue="" title="Desempata con la posición en esa etapa y permite generar el orden con sus clasificadas">
                  <option value="">Sin etapa previa</option>
                  {etapas.map((item) => <option key={item.id} value={item.id}>Después de {item.nombre}</option>)}
                </select>
              </div>
              {formatoNueva === 'wc' ? (
                <div className="admin-row">
                  <label>Bloques <input name="boulders" defaultValue="W1, W2, W3, W4, M1, M2, M3, M4" title="Cada categoría usa los que tengan turnos para ella." /></label>
                  <label>Minutos por turno <input name="duracion" type="number" min="1" defaultValue="4" className="admin-field-narrow" /></label>
                  <button className="admin-btn">Agregar</button>
                </div>
              ) : (
                <>
                  <div className="admin-row">
                    <span>Tabla de puntos:</span>
                    <label><input type="radio" checked={origenTabla === 'formula'} onChange={() => setOrigenTabla('formula')} /> Generar con fórmula</label>
                    <label><input type="radio" checked={origenTabla === 'csv'} onChange={() => setOrigenTabla('csv')} /> Pegar CSV</label>
                    <label>Bloques que suman <input name="mejoresBloques" type="number" min="1" defaultValue={AMERICANA_POR_DEFECTO.mejoresBloques} className="admin-field-narrow" /></label>
                  </div>
                  {origenTabla === 'formula' ? (
                    <div className="admin-row">
                      <label>Bloques <input name="cantidad" type="number" min="1" max="99" defaultValue="24" className="admin-field-narrow" /></label>
                      <label>B1 al 1.er intento <input name="puntajeBase" type="number" min="0" defaultValue={AMERICANA_POR_DEFECTO.puntajeBase} className="admin-field-narrow" /></label>
                      <label>+ por bloque <input name="incrementoPorBloque" type="number" min="0" defaultValue={AMERICANA_POR_DEFECTO.incrementoPorBloque} className="admin-field-narrow" /></label>
                      <label>− por intento <input name="descuentoPorIntento" type="number" min="0" defaultValue={AMERICANA_POR_DEFECTO.descuentoPorIntento} className="admin-field-narrow" /></label>
                      <label>Máx. intentos <input name="maxIntentos" type="number" min="1" defaultValue={AMERICANA_POR_DEFECTO.maxIntentos} className="admin-field-narrow" /></label>
                    </div>
                  ) : (
                    <div className="admin-stack">
                      <textarea
                        name="tablaCsv"
                        rows={8}
                        required
                        placeholder={'Bloque,Intento 1,Intento 2,Intento 3,Intento 4,Intento 5\n1,10,8,6,4,2\n2,12,10,8,6,4\n…'}
                      />
                      <p className="admin-meta">
                        Una fila por bloque: el número del bloque y los puntos al 1.er intento, al 2.º, etc. Se puede copiar desde una planilla
                        (columnas separadas por tabulación, coma o punto y coma). El encabezado es opcional. La cantidad de columnas define el máximo de intentos.
                      </p>
                    </div>
                  )}
                  <div className="admin-row">
                    <label style={{ flex: 1 }}>Sectores <input name="sectores" placeholder="A: 1, 8, 23, 32; B: 2, 9, 16" style={{ width: '100%' }} /></label>
                    <button className="admin-btn">Agregar</button>
                  </div>
                  <p className="admin-meta">
                    Todas las categorías escalan los mismos bloques. Suman los mejores bloques de cada competidora.
                    La fórmula es solo un atajo para la cartilla clásica (B1 vale 10, 8, 6, 4, 2 y cada bloque siguiente 2 más);
                    la tabla se puede revisar y editar después con <strong>Tabla de puntos</strong>. Los sectores agrupan los bloques que revisa cada juez.
                  </p>
                </>
              )}
            </form>
            {etapas.map((item) => (
              <div key={item.id} className="admin-stack">
              <div className="admin-row">
                <strong>{item.nombre}</strong>
                <span className="admin-meta">
                  {esAmericana(item)
                    ? `${FORMATOS.americana} · ${item.boulders?.length} bloques · suman ${reglasAmericana(item).mejoresBloques} · máx. ${reglasAmericana(item).maxIntentos} intentos${item.tablaPuntos ? '' : ' · tabla por fórmula'}`
                      + (Object.keys(item.sectores || {}).length ? ` · sectores ${textoDeSectores(item.sectores)}` : '')
                    : item.boulders?.join(', ')}
                  {item.etapaPreviaId ? ` · después de ${nombreEtapa(item.etapaPreviaId)}` : ''}
                  {item.estado === 'cerrada' ? ' · cerrada' : ''}
                </span>
                {item.activa ? <span>Activa</span> : <button onClick={() => activarEtapa(item.id)} className="admin-btn-secondary">Activar</button>}
                <button onClick={() => cambiarEstadoEtapa(item)} className="admin-btn-secondary">
                  {item.estado === 'cerrada' ? 'Reabrir' : 'Cerrar'}
                </button>
                {esAmericana(item) && <button onClick={() => editarSectores(item)} className="admin-btn-secondary">Sectores</button>}
                {esAmericana(item) && (
                  <button onClick={() => setTablaAbierta((abierta) => (abierta === item.id ? null : item.id))} className="admin-btn-secondary">
                    Tabla de puntos
                  </button>
                )}
              </div>
              {tablaAbierta === item.id && <EditorTabla etapa={item} onGuardar={guardarTabla} onCerrar={() => setTablaAbierta(null)} />}
              {item.estado !== 'cerrada' && categorias.length > 1 && (
                <div className="admin-row">
                  <span className="admin-meta">Categorías:</span>
                  {categorias.map(([id, nombre]) => {
                    const cerrada = (item.categoriasCerradas || []).includes(id);
                    return (
                      <button key={id} onClick={() => cambiarCategoriaCerrada(item, id, nombre)} className="admin-btn-secondary">
                        {nombre} · {cerrada ? 'finalizada (reabrir)' : 'en curso (finalizar)'}
                      </button>
                    );
                  })}
                </div>
              )}
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
            {esAmericana(etapaOrden) && (
              <p className="admin-meta">{etapaOrden.nombre} es una ronda americana: no tiene orden de paso, todas escalan a la vez. Elige otra etapa para generar turnos.</p>
            )}
            {etapas.length > 0 && (
              <form onSubmit={generarOrden} className="admin-row">
                <select name="etapaId" value={etapaOrden?.id || ''} onChange={(evento) => setEtapaOrdenId(evento.target.value)} required>
                  {etapas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
                <select name="categoriaId" required>
                  {categorias.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                </select>
                <span key={etapaOrden?.id} className="admin-row">
                  {(etapaOrden?.boulders || []).map((id) => (
                    <label key={id}><input type="checkbox" name="boulderIds" value={id} /> {id}</label>
                  ))}
                </span>
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
                <button className="admin-btn" disabled={esAmericana(etapaOrden)}>Generar</button>
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
                  {Object.entries(etapaAsignacion.sectores || {}).map(([nombre, ids]) => (
                    <label key={`sector-${nombre}`}>
                      <input
                        type="checkbox"
                        name="sectores"
                        value={nombre}
                        defaultChecked={ids.length > 0 && ids.every((id) => (miembroAsignacion.asignaciones?.[etapaAsignacion.id] || []).includes(id))}
                      /> Sector {nombre}
                    </label>
                  ))}
                  {!Object.keys(etapaAsignacion.sectores || {}).length && etapaAsignacion.boulders.map((id) => (
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

// Tabla de puntos de una ronda americana como CSV editable.
// Si la etapa todavía usa la fórmula, el editor parte de la tabla que esa fórmula genera.
function EditorTabla({ etapa, onGuardar, onCerrar }) {
  const reglas = reglasAmericana(etapa);
  const tabla = etapa.tablaPuntos || Object.fromEntries((etapa.boulders || []).map((id) => [
    id, Array.from({ length: reglas.maxIntentos }, (_, intento) => puntosAmericana(etapa, id, intento + 1)),
  ]));
  const [texto, setTexto] = useState(() => tablaACsv(etapa.boulders, tabla));
  const [mejores, setMejores] = useState(reglas.mejoresBloques);
  return (
    <div className="admin-stack">
      <textarea value={texto} onChange={(evento) => setTexto(evento.target.value)} rows={Math.min(16, (etapa.boulders?.length || 4) + 2)} />
      <div className="admin-row">
        <label>Bloques que suman <input type="number" min="1" value={mejores} onChange={(evento) => setMejores(evento.target.value)} className="admin-field-narrow" /></label>
        <button onClick={() => onGuardar(etapa, texto, mejores)} className="admin-btn">Guardar tabla</button>
        <button onClick={onCerrar} className="admin-btn-secondary">Cancelar</button>
      </div>
      <p className="admin-meta">Se puede copiar y pegar desde una planilla. Los puntajes del tablero se recalculan con la tabla nueva.</p>
    </div>
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
