import { useEffect } from 'react';
import { formatearPuntos } from '../utils/score';
import { useEtapaActiva } from '../hooks/useEtapaActiva';
import { useRankingEtapa } from '../hooks/useResultados';
import { bloquesDeCategoria } from '../utils/ranking';

// Columnas de una categoría: sus bloques en la etapa, más cualquiera con resultados.
function bloquesVisibles(grupo, etapa, turnos) {
  const propios = bloquesDeCategoria(etapa, turnos, grupo.categoriaId);
  const conResultado = new Set(grupo.filas.flatMap((fila) => Object.keys(fila.boulders)));
  return [...propios, ...[...conResultado].filter((id) => !propios.includes(id))];
}

function EstadoCategoria({ finalizada }) {
  return (
    <span style={{
      fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
      padding: '0.25rem 0.6rem', borderRadius: '999px',
      backgroundColor: finalizada ? '#2d2d2d' : '#ff4757', color: finalizada ? '#aaa' : '#fff',
    }}>
      {finalizada ? 'Finalizada' : 'En curso'}
    </span>
  );
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
  const { competencia, etapa, competidores, turnos, cargando } = useEtapaActiva();
  const { grupos, error: errorCarga } = useRankingEtapa({ competencia, etapa, competidores, turnos });

  useEffect(() => {
    document.body.classList.add('public-board');
    return () => document.body.classList.remove('public-board');
  }, []);

  const titulo = etapa ? `Resultados ${etapa.nombre}` : 'Resultados';
  const variasCategorias = grupos.length > 1;

  return (
    <div style={{ backgroundColor: '#121212', color: '#ffffff', minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h3 style={{ color: '#ff4757', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>En Vivo</h3>
        <h1 style={{ margin: '5px 0', fontSize: '3rem', color: '#ffffff' }}>{cargando ? 'Cargando...' : titulo}</h1>
        {competencia && <p style={{ color: '#aaa' }}>{competencia.nombre}{etapa?.estado === 'cerrada' ? ' · Resultados finales' : ''}</p>}
      </div>

      {grupos.length === 0 && (
        <p style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          {errorCarga || (etapa ? 'Esperando a que los jueces registren resultados...' : 'No hay una etapa activa.')}
        </p>
      )}

      {grupos.map((grupo) => {
        const bloques = bloquesVisibles(grupo, etapa, turnos);
        return (
        <section key={grupo.categoriaId} style={{ maxWidth: '1100px', margin: '0 auto 2.5rem' }}>
          {variasCategorias && (
            <h2 style={{ margin: '0 0 0.75rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {grupo.categoria}
              <EstadoCategoria finalizada={etapa?.estado === 'cerrada' || Boolean(etapa?.categoriasCerradas?.includes(grupo.categoriaId))} />
            </h2>
          )}
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', overflowX: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
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
                {grupo.filas.map((comp) => (
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
              </tbody>
            </table>
          </div>
        </section>
        );
      })}
    </div>
  );
}
