import { useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { guardarResultado, resultadosColRef } from '../utils/resultado';
import { puntajeDeEtapa, puntosAmericana, reglasAmericana } from '../utils/score';
import { sectoresDeBloques } from '../utils/sectores';

// Cartilla digital de la ronda americana: el juez elige a la competidora por dorsal
// y, en los bloques de su sector, marca cada intento como fallido (✗) o encadenado (✓),
// igual que en la ficha de papel. El total muestra la suma de los mejores bloques.

function leerLista(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave) || '[]');
  } catch {
    return [];
  }
}

function guardarValor(clave, valor) {
  try {
    localStorage.setItem(clave, typeof valor === 'string' ? valor : JSON.stringify(valor));
  } catch {
    // Sin almacenamiento local: solo dura esta sesión.
  }
}

function mensajeError(error) {
  if (error?.code === 'permission-denied') {
    return 'No se guardó: otro dispositivo cambió este bloque, la etapa o la categoría está cerrada, o el bloque no es tuyo. Se muestra el valor vigente.';
  }
  return 'Error al guardar. Revisa tu conexión.';
}

const boton = {
  border: 'none',
  borderRadius: '10px',
  fontWeight: 'bold',
  touchAction: 'manipulation',
  cursor: 'pointer',
};

export default function JuezAmericana({ competencia, etapa, competidores, boulders, correo, esJuezJefe, pie }) {
  const reglas = reglasAmericana(etapa);
  const sectores = sectoresDeBloques(etapa.sectores, boulders);
  const [sector, setSector] = useState(() => {
    const guardado = typeof localStorage !== 'undefined' ? localStorage.getItem(`juez.sector.${etapa.id}`) : '';
    return sectores.some((item) => item.nombre === guardado) ? guardado : (sectores[0]?.nombre || '');
  });
  const [dorsal, setDorsal] = useState('');
  const [competidorId, setCompetidorId] = useState('');
  const [recientes, setRecientes] = useState(() => leerLista(`juez.recientes.${etapa.id}`));
  const [marcas, setMarcas] = useState({});
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [verFicha, setVerFicha] = useState(false);
  const marcasRef = useRef({});

  const competidor = competidores.find((item) => item.id === competidorId) || null;
  const categoriaCerrada = Boolean(competidor && etapa.categoriasCerradas?.includes(competidor.categoriaId));
  const bloqueado = etapa.estado === 'cerrada' || categoriaCerrada;
  const sectorElegido = sectores.find((item) => item.nombre === sector);
  // Bloques que este juez anota ahora: los del sector elegido que tiene asignados.
  const bloquesVisibles = (sectorElegido ? sectorElegido.boulders.filter((id) => boulders.includes(id)) : boulders)
    .slice()
    .sort((a, b) => etapa.boulders.indexOf(a) - etapa.boulders.indexOf(b));
  const { puntaje, cuentan } = useMemo(() => puntajeDeEtapa(etapa, marcas), [etapa, marcas]);

  useEffect(() => {
    if (!competidorId) return undefined;
    marcasRef.current = {};
    setMarcas({});
    setListo(false);
    setAviso('');
    let primera = true;
    const consulta = query(
      resultadosColRef(db),
      where('competenciaId', '==', competencia.id),
      where('etapaId', '==', etapa.id),
      where('competidorId', '==', competidorId),
    );
    return onSnapshot(consulta, { includeMetadataChanges: true }, (snapshot) => {
      // Un bloque con escrituras propias en cola ya está adelante en el estado local.
      const siguiente = { ...marcasRef.current };
      snapshot.docs.forEach((item) => {
        if (!primera && item.metadata.hasPendingWrites) return;
        const data = item.data();
        siguiente[data.boulderId] = {
          intentos: data.intentos ?? 0,
          zonaEnIntento: data.zonaEnIntento ?? null,
          topEnIntento: data.topEnIntento ?? null,
          version: data.version ?? 0,
        };
      });
      primera = false;
      marcasRef.current = siguiente;
      setMarcas(siguiente);
      setListo(true);
    }, () => {
      setListo(true);
      setAviso('No se pudo leer la ficha. Revisa tu conexión.');
    });
  }, [competencia.id, etapa.id, competidorId]);

  const elegirCompetidor = (id) => {
    setCompetidorId(id);
    setDorsal('');
    setVerFicha(false);
    const lista = [id, ...recientes.filter((item) => item !== id)].slice(0, 8);
    setRecientes(lista);
    guardarValor(`juez.recientes.${etapa.id}`, lista);
  };

  const elegirSector = (nombre) => {
    setSector(nombre);
    guardarValor(`juez.sector.${etapa.id}`, nombre);
  };

  const escribir = (boulderId, siguiente, accion) => {
    const actual = marcasRef.current[boulderId] || { intentos: 0, zonaEnIntento: null, topEnIntento: null, version: 0 };
    const marcador = { ...siguiente, version: actual.version + 1 };
    marcasRef.current = { ...marcasRef.current, [boulderId]: marcador };
    setMarcas(marcasRef.current);
    setAviso('');
    const clave = { competenciaId: competencia.id, etapaId: etapa.id, competidorId, boulderId };
    guardarResultado(db, clave, marcador, accion, correo).catch((error) => {
      console.error('Error al guardar:', error);
      setAviso(mensajeError(error));
    });
  };

  const fallo = (boulderId) => {
    const actual = marcasRef.current[boulderId] || { intentos: 0, topEnIntento: null };
    if (actual.topEnIntento != null || actual.intentos >= reglas.maxIntentos) return;
    escribir(boulderId, { intentos: actual.intentos + 1, zonaEnIntento: null, topEnIntento: null }, 'intento');
  };

  const encadeno = (boulderId) => {
    const actual = marcasRef.current[boulderId] || { intentos: 0, topEnIntento: null };
    if (actual.topEnIntento != null || actual.intentos >= reglas.maxIntentos) return;
    const intento = actual.intentos + 1;
    // Sin zonas en la ronda americana: la zona queda en el mismo intento solo por consistencia del modelo.
    escribir(boulderId, { intentos: intento, zonaEnIntento: intento, topEnIntento: intento }, 'top');
  };

  const deshacer = (boulderId) => {
    const actual = marcasRef.current[boulderId];
    if (!actual || actual.intentos === 0) return;
    escribir(boulderId, { intentos: actual.intentos - 1, zonaEnIntento: null, topEnIntento: null }, 'edicion');
  };

  const consulta = dorsal.trim();
  const coincidencias = consulta ? competidores.filter((item) => String(item.dorsal).startsWith(consulta)).slice(0, 8) : [];
  const conIntentos = Object.entries(marcas)
    .filter(([, marca]) => marca.intentos > 0)
    .sort(([a], [b]) => etapa.boulders.indexOf(a) - etapa.boulders.indexOf(b));

  return (
    <div style={{ width: '100%', padding: '1rem', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '100svh', color: '#111', backgroundColor: '#fff', boxSizing: 'border-box' }}>
      <p style={{ margin: 0, color: '#666', fontWeight: 'bold', fontSize: '0.9rem' }}>
        {etapa.nombre} · Ronda americana · {competencia.nombre} · {correo}{esJuezJefe ? ' · juez jefe' : ''}
      </p>

      {sectores.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {sectores.map((item) => (
            <button
              key={item.nombre}
              onClick={() => elegirSector(item.nombre)}
              style={{ ...boton, padding: '0.6rem 0.9rem', borderRadius: '999px', border: '2px solid #111', backgroundColor: item.nombre === sector ? '#111' : '#fff', color: item.nombre === sector ? '#fff' : '#111' }}>
              Sector {item.nombre}
              <span style={{ fontWeight: 'normal', marginLeft: '0.4rem' }}>{item.boulders.join(' ')}</span>
            </button>
          ))}
        </div>
      )}

      <div>
        <input
          inputMode="numeric"
          placeholder="Dorsal de la competidora"
          value={dorsal}
          onChange={(evento) => setDorsal(evento.target.value.replace(/\D/g, ''))}
          onKeyDown={(evento) => { if (evento.key === 'Enter' && coincidencias[0]) elegirCompetidor(coincidencias[0].id); }}
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.9rem', fontSize: '1.8rem', textAlign: 'center', borderRadius: '10px', border: '2px solid #111' }}
        />
        {coincidencias.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
            {coincidencias.map((item) => (
              <button key={item.id} onClick={() => elegirCompetidor(item.id)} style={{ ...boton, padding: '0.9rem', fontSize: '1.2rem', textAlign: 'left', backgroundColor: '#f0f0f0' }}>
                #{item.dorsal} {item.nombre} <span style={{ color: '#666', fontWeight: 'normal' }}>· {item.categoria}</span>
              </button>
            ))}
          </div>
        )}
        {consulta && coincidencias.length === 0 && <p style={{ margin: '0.4rem 0 0', color: '#dc3545' }}>No hay una competidora con ese dorsal.</p>}
        {!consulta && recientes.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginTop: '0.5rem' }}>
            {recientes.map((id) => competidores.find((item) => item.id === id)).filter(Boolean).map((item) => (
              <button
                key={item.id}
                onClick={() => elegirCompetidor(item.id)}
                style={{ ...boton, flex: '0 0 auto', padding: '0.5rem 0.7rem', border: item.id === competidorId ? '2px solid #111' : '1px solid #ccc', backgroundColor: '#f7f7f7' }}>
                #{item.dorsal} {item.nombre.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {!competidor && (
        <p style={{ margin: '1rem 0', color: '#666', textAlign: 'center' }}>
          Escribe el dorsal para abrir la ficha de la competidora.
        </p>
      )}

      {competidor && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', backgroundColor: '#f0f0f0', padding: '0.9rem 1rem', borderRadius: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#111' }}>#{competidor.dorsal} {competidor.nombre}</h2>
              <p style={{ margin: '0.2rem 0 0', color: '#555' }}>{competidor.categoria}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2.2rem', fontWeight: 'bold', lineHeight: 1 }}>{puntaje}</div>
              <div style={{ fontSize: '0.85rem', color: '#555' }}>{reglas.mejoresBloques} mejores</div>
            </div>
          </div>

          {bloqueado && (
            <p style={{ margin: 0, padding: '0.75rem', borderRadius: '8px', backgroundColor: '#f8d7da', fontWeight: 'bold' }}>
              {etapa.estado === 'cerrada' ? 'La etapa está cerrada.' : `${competidor.categoria} ya está finalizada.`} Sus resultados no se pueden modificar.
            </p>
          )}
          {aviso && <p style={{ margin: 0, padding: '0.75rem', borderRadius: '8px', backgroundColor: '#fff3cd', fontWeight: 'bold' }}>{aviso}</p>}
          {!listo && <p style={{ margin: 0, textAlign: 'center' }}>Cargando ficha…</p>}

          {listo && bloquesVisibles.map((boulderId) => (
            <FilaBloque
              key={boulderId}
              boulderId={boulderId}
              marca={marcas[boulderId]}
              etapa={etapa}
              maxIntentos={reglas.maxIntentos}
              cuenta={cuentan.includes(boulderId)}
              bloqueado={bloqueado}
              onFallo={() => fallo(boulderId)}
              onEncadeno={() => encadeno(boulderId)}
              onDeshacer={() => deshacer(boulderId)}
            />
          ))}

          {listo && (
            <button onClick={() => setVerFicha((abierta) => !abierta)} style={{ ...boton, padding: '0.8rem', backgroundColor: '#f0f0f0' }}>
              {verFicha ? 'Ocultar ficha completa' : `Ver ficha completa (${conIntentos.length} bloques intentados)`}
            </button>
          )}
          {listo && verFicha && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {conIntentos.length === 0 && <p style={{ margin: 0, color: '#666' }}>Todavía no tiene intentos en esta etapa.</p>}
              {conIntentos.map(([boulderId, marca]) => (
                <div key={boulderId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '8px', backgroundColor: cuentan.includes(boulderId) ? '#d4edda' : '#f7f7f7' }}>
                  <strong>{boulderId}</strong>
                  <span>{marca.topEnIntento != null ? `✓ intento ${marca.topEnIntento}` : `✗ × ${marca.intentos}`}</span>
                  <span style={{ fontWeight: 'bold' }}>{marca.topEnIntento != null ? puntosAmericana(etapa, boulderId, marca.topEnIntento) : 0} pts</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 'auto' }}>{pie}</div>
    </div>
  );
}

// Una fila de la cartilla: el valor de cada intento, como en papel.
// Los intentos fallidos quedan tachados y el intento encadenado, marcado en verde.
function FilaBloque({ boulderId, marca, etapa, maxIntentos, cuenta, bloqueado, onFallo, onEncadeno, onDeshacer }) {
  const intentos = marca?.intentos ?? 0;
  const top = marca?.topEnIntento ?? null;
  const terminado = top != null || intentos >= maxIntentos;
  const valores = Array.from({ length: maxIntentos }, (_, index) => puntosAmericana(etapa, boulderId, index + 1));

  return (
    <div style={{ border: cuenta ? '2px solid #28a745' : '1px solid #ddd', borderRadius: '12px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <strong style={{ fontSize: '1.4rem', minWidth: '3.2rem' }}>{boulderId}</strong>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${maxIntentos}, minmax(0, 1fr))`, gap: '0.3rem', flex: 1 }}>
          {valores.map((valor, index) => {
            const intento = index + 1;
            const esTop = top === intento;
            const fallido = intento <= intentos && !esTop;
            const siguiente = !terminado && intento === intentos + 1;
            return (
              <span
                key={intento}
                aria-label={`Intento ${intento}: ${valor} puntos${esTop ? ', encadenado' : fallido ? ', fallido' : ''}`}
                style={{
                  textAlign: 'center', padding: '0.45rem 0', borderRadius: '8px', fontSize: '1.15rem', fontWeight: 'bold',
                  fontVariantNumeric: 'tabular-nums',
                  backgroundColor: esTop ? '#28a745' : fallido ? '#eee' : '#fff',
                  color: esTop ? '#fff' : fallido ? '#999' : '#111',
                  textDecoration: fallido ? 'line-through' : 'none',
                  border: siguiente ? '2px solid #111' : '1px solid #ddd',
                }}>
                {valor}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem' }}>
        <button onClick={onFallo} disabled={terminado || bloqueado} style={{ ...boton, padding: '0.9rem', fontSize: '1.2rem', backgroundColor: terminado || bloqueado ? '#eee' : '#f8d7da', color: terminado || bloqueado ? '#999' : '#111' }}>
          ✗ Falló
        </button>
        <button onClick={onEncadeno} disabled={terminado || bloqueado} style={{ ...boton, padding: '0.9rem', fontSize: '1.2rem', backgroundColor: terminado || bloqueado ? '#eee' : '#d4edda', color: terminado || bloqueado ? '#999' : '#111' }}>
          ✓ Encadenó
        </button>
        <button onClick={onDeshacer} disabled={!intentos || bloqueado} title="Deshacer el último intento" style={{ ...boton, padding: '0.9rem 0.8rem', fontSize: '0.95rem', backgroundColor: '#f0f0f0', color: !intentos || bloqueado ? '#999' : '#111' }}>
          Deshacer
        </button>
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#555' }}>
        {top != null
          ? `Encadenado en el intento ${top} · ${valores[top - 1]} pts${cuenta ? ' · suma al total' : ''}`
          : intentos >= maxIntentos
            ? `Sin encadenar en ${maxIntentos} intentos · 0 pts`
            : intentos > 0
              ? `${intentos} ${intentos === 1 ? 'intento fallido' : 'intentos fallidos'} · siguiente vale ${valores[intentos]} pts`
              : `Sin intentos · al primer intento vale ${valores[0]} pts`}
      </p>
    </div>
  );
}
