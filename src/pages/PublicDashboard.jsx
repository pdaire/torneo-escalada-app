import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { onSnapshot, query, where } from 'firebase/firestore';
import { sortScore } from '../utils/score';
import { rankingFromResultados, resultadosColRef } from '../utils/resultado';
import { useEtapaActiva } from '../hooks/useEtapaActiva';

function bloquesVisibles(ranking, preferidos = []) {
  const presentes = new Set(ranking.flatMap((comp) => Object.keys(comp.boulders)));
  const ordenados = preferidos.filter((boulder) => presentes.has(boulder));
  const resto = [...presentes].filter((boulder) => !ordenados.includes(boulder));
  return [...ordenados, ...resto];
}

function celdaBoulder(boulder) {
  const tieneTop = boulder?.topEnIntento != null;
  const tieneZona = boulder?.zonaEnIntento != null;
  if (tieneTop) return { color: '#28a745', texto: `TOP · ${boulder.topEnIntento}`, marcado: true };
  if (tieneZona) return { color: '#ffc107', texto: `ZONA · ${boulder.zonaEnIntento}`, marcado: true };
  return { color: 'transparent', texto: '-', marcado: false };
}

export default function PublicDashboard() {
  const [ranking, setRanking] = useState([]);
  const [errorCarga, setErrorCarga] = useState('');
  const { competencia, etapa, cargando } = useEtapaActiva();

  useEffect(() => {
    document.body.classList.add('public-board');
    return () => document.body.classList.remove('public-board');
  }, []);

  useEffect(() => {
    if (!competencia || !etapa) {
      setRanking([]);
      return undefined;
    }
    const consulta = query(resultadosColRef(db), where('competenciaId', '==', competencia.id));
    return onSnapshot(consulta, (snapshot) => {
      const deLaEtapa = snapshot.docs
        .map((item) => item.data())
        .filter((item) => item.etapaId === etapa.id);
      const rankingActual = rankingFromResultados(deLaEtapa);
      rankingActual.sort(sortScore);
      setRanking(rankingActual);
      setErrorCarga('');
    }, (error) => {
      console.error('Error al escuchar resultados:', error);
      setErrorCarga('No se pudieron cargar los resultados. Revisa la conexión o las reglas de Firestore.');
    });
  }, [competencia?.id, etapa?.id]);

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
              <th style={{ padding: '1.5rem 1rem' }}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((comp, index) => (
              <tr key={comp.id} style={{ borderBottom: '1px solid #333', fontSize: '1.5rem' }}>
                <td style={{ padding: '1.5rem 1rem', fontWeight: 'bold', color: index === 0 ? '#ffd700' : '#fff' }}>
                  {index + 1}°
                </td>
                <td style={{ padding: '1.5rem 1rem', textAlign: 'left', fontWeight: 'bold' }}>
                  {comp.dorsal ? `#${comp.dorsal} ` : ''}{comp.nombre}
                </td>
                {bloques.map((boulderId) => {
                  const celda = celdaBoulder(comp.boulders[boulderId]);
                  return (
                    <td key={boulderId} style={{ padding: '1rem' }}>
                      <div style={{ backgroundColor: celda.color, color: celda.marcado ? '#000' : '#fff', padding: '0.5rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        {celda.texto}
                      </div>
                    </td>
                  );
                })}
                <td style={{ padding: '1.5rem 1rem', fontWeight: 'bold', color: '#4facfe' }}>
                  {comp.T}T {comp.z}z {comp.aT} {comp.aZ}
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
