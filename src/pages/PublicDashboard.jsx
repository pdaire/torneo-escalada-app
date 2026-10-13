import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { onSnapshot, query, where } from 'firebase/firestore';
import { formatearPuntos, sortScore } from '../utils/score';
import { rankingFromResultados, resultadosColRef } from '../utils/resultado';
import { useEtapaActiva } from '../hooks/useEtapaActiva';

function bloquesVisibles(ranking, preferidos = []) {
  const presentes = new Set(ranking.flatMap((comp) => Object.keys(comp.boulders)));
  const ordenados = preferidos.length ? preferidos : [...presentes];
  const resto = [...presentes].filter((boulder) => !ordenados.includes(boulder));
  return [...ordenados, ...resto];
}

function filaVacia(competidor) {
  return {
    id: competidor.id,
    nombre: competidor.nombre,
    dorsal: competidor.dorsal,
    categoria: competidor.categoria,
    boulders: {},
    decimas: 0,
  };
}

function rankingDeEtapa(resultados, competidores, turnos, etapaId) {
  const enEtapa = new Set(
    turnos.filter((turno) => turno.etapaId === etapaId).map((turno) => turno.competidorId),
  );
  const participantes = enEtapa.size
    ? competidores.filter((item) => enEtapa.has(item.id))
    : competidores;
  const conResultado = new Map(rankingFromResultados(resultados).map((item) => [item.id, item]));
  const filas = participantes.map((competidor) => conResultado.get(competidor.id) || filaVacia(competidor));
  const ids = new Set(filas.map((item) => item.id));
  conResultado.forEach((item) => {
    if (!ids.has(item.id)) filas.push(item);
  });
  filas.sort((a, b) => Number(a.dorsal) - Number(b.dorsal) || String(a.nombre).localeCompare(String(b.nombre)));
  filas.sort(sortScore);
  return filas.map((fila) => ({
    ...fila,
    posicion: filas.findIndex((item) => item.decimas === fila.decimas) + 1,
  }));
}

function IconoLogro({ top, zona }) {
  const relleno = top != null ? '100%' : zona != null ? '50%' : '0%';
  const etiqueta = top != null ? 'Top' : zona != null ? 'Zona' : 'Sin zona';
  return (
    <span
      role="img"
      aria-label={etiqueta}
      style={{ position: 'relative', display: 'inline-block', width: '16px', height: '30px', border: '2px solid #f5f5f5', borderRadius: '2px', boxSizing: 'border-box', overflow: 'hidden', flex: '0 0 auto' }}>
      <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: relleno, backgroundColor: '#f5f5f5' }} />
    </span>
  );
}

function MarcaBoulder({ boulder }) {
  const top = boulder?.topEnIntento ?? null;
  const zona = boulder?.zonaEnIntento ?? null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
      <IconoLogro top={top} zona={zona} />
      <div style={{ textAlign: 'left', fontSize: '1rem', lineHeight: 1.25, color: '#ddd', fontVariantNumeric: 'tabular-nums' }}>
        <div>T {top ?? '–'}</div>
        <div>z {zona ?? '–'}</div>
      </div>
    </div>
  );
}

export default function PublicDashboard() {
  const [resultados, setResultados] = useState([]);
  const [errorCarga, setErrorCarga] = useState('');
  const { competencia, etapa, competidores, turnos, cargando } = useEtapaActiva();

  useEffect(() => {
    document.body.classList.add('public-board');
    return () => document.body.classList.remove('public-board');
  }, []);

  useEffect(() => {
    if (!competencia || !etapa) {
      setResultados([]);
      return undefined;
    }
    const consulta = query(resultadosColRef(db), where('competenciaId', '==', competencia.id));
    return onSnapshot(consulta, (snapshot) => {
      const deLaEtapa = snapshot.docs
        .map((item) => item.data())
        .filter((item) => item.etapaId === etapa.id);
      setResultados(deLaEtapa);
      setErrorCarga('');
    }, (error) => {
      console.error('Error al escuchar resultados:', error);
      setErrorCarga('No se pudieron cargar los resultados. Revisa la conexión o las reglas de Firestore.');
    });
  }, [competencia?.id, etapa?.id]);

  const ranking = useMemo(
    () => (etapa ? rankingDeEtapa(resultados, competidores, turnos, etapa.id) : []),
    [resultados, competidores, turnos, etapa],
  );
  const bloques = bloquesVisibles(ranking, etapa?.boulders || []);
  const titulo = etapa ? `Resultados ${etapa.nombre}` : 'Resultados';

  return (
    <div style={{ backgroundColor: '#121212', color: '#ffffff', minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h3 style={{ color: '#ff4757', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>En Vivo</h3>
        <h1 style={{ margin: '5px 0', fontSize: '3rem', color: '#ffffff' }}>{cargando ? 'Cargando...' : titulo}</h1>
        {competencia && <p style={{ color: '#aaa' }}>{competencia.nombre}</p>}
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', backgroundColor: '#1e1e1e', borderRadius: '12px', overflowX: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ backgroundColor: '#2d2d2d', color: '#aaa', fontSize: '1.2rem' }}>
              <th style={{ padding: '1.5rem 1rem' }}>Pos</th>
              <th style={{ padding: '1.5rem 1rem', textAlign: 'left' }}>Escalador</th>
              {bloques.map((boulder) => <th key={boulder} style={{ padding: '1.5rem 1rem' }}>{boulder}</th>)}
              <th style={{ padding: '1.5rem 1rem', textAlign: 'right' }}>Puntaje</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((comp) => (
              <tr key={comp.id} style={{ borderBottom: '1px solid #333', fontSize: '1.5rem' }}>
                <td style={{ padding: '1.5rem 1rem', fontWeight: 'bold', color: comp.posicion === 1 && comp.decimas > 0 ? '#ffd700' : '#fff' }}>
                  {comp.posicion}°
                </td>
                <td style={{ padding: '1.5rem 1rem', textAlign: 'left', fontWeight: 'bold' }}>
                  {comp.dorsal ? `#${comp.dorsal} ` : ''}{comp.nombre}
                </td>
                {bloques.map((boulderId) => (
                  <td key={boulderId} style={{ padding: '1rem' }}>
                    <MarcaBoulder boulder={comp.boulders[boulderId]} />
                  </td>
                ))}
                <td style={{ padding: '1.5rem 1rem', fontWeight: 'bold', fontSize: '1.8rem', textAlign: 'right', color: '#fff', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {formatearPuntos(comp.decimas)}
                </td>
              </tr>
            ))}

            {ranking.length === 0 && (
              <tr>
                <td colSpan={3 + bloques.length} style={{ padding: '3rem', color: '#666' }}>
                  {errorCarga || (etapa ? 'Esperando a que los jueces registren resultados...' : 'No hay una etapa activa.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
