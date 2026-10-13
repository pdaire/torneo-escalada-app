import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useEtapaActiva } from '../hooks/useEtapaActiva';
import { useResultadosCompetencia } from '../hooks/useResultados';
import { detalleCompetidor } from '../utils/ranking';
import { formatearPuntos } from '../utils/score';
import { EstadoCategoria, IconoLogro } from '../components/Marcador';
import './publico.css';

function FilaBloque({ bloque }) {
  if (bloque.pendiente) {
    return (
      <tr className="pendiente">
        <td><span className="ficha-bloque">{bloque.boulderId}</span></td>
        <td colSpan={3}>{bloque.horaProgramada ? `Pendiente · ${bloque.horaProgramada}` : 'Pendiente'}</td>
        <td className="numero">–</td>
      </tr>
    );
  }
  return (
    <tr>
      <td>
        <span className="ficha-bloque">
          <IconoLogro top={bloque.topEnIntento} zona={bloque.zonaEnIntento} />
          {bloque.boulderId}
        </span>
      </td>
      <td>{bloque.zonaEnIntento ?? '–'}</td>
      <td>{bloque.topEnIntento ?? '–'}</td>
      <td>{bloque.intentos}</td>
      <td className="numero">{formatearPuntos(bloque.decimas)}</td>
    </tr>
  );
}

function TarjetaEtapa({ item }) {
  const { etapa } = item;
  return (
    <section className="ficha-etapa">
      <div className="ficha-etapa-encabezado">
        <h2>
          <Link to={etapa.activa ? '/' : `/?etapa=${etapa.id}`}>{etapa.nombre}</Link>
          <EstadoCategoria finalizada={item.categoriaFinalizada} />
        </h2>
        <p className="ficha-resumen">
          <span className={item.posicion === 1 && item.decimas > 0 ? 'oro' : ''}>{item.posicion}°</span>
          <small> de {item.totalCategoria} · </small>
          {formatearPuntos(item.decimas)} pts
        </p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="ficha-tabla">
          <thead>
            <tr>
              <th>Bloque</th>
              <th>Zona</th>
              <th>Top</th>
              <th>Intentos</th>
              <th className="numero">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {item.bloques.map((bloque) => <FilaBloque key={bloque.boulderId} bloque={bloque} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CompetidorView() {
  const { competidorId } = useParams();
  const { competencia, etapas, competidores, turnos, cargando } = useEtapaActiva();
  const { resultados, cargando: cargandoResultados, error } = useResultadosCompetencia(competencia?.id);
  const competidor = competidores.find((item) => item.id === competidorId);

  useEffect(() => {
    document.body.classList.add('public-board');
    return () => document.body.classList.remove('public-board');
  }, []);

  const detalle = useMemo(() => (competidor
    ? detalleCompetidor({ competidorId, etapas, competidores, turnos, resultados })
    : []
  ), [competidor, competidorId, etapas, competidores, turnos, resultados]);

  return (
    <div className="publico">
      <main className="ficha">
        <Link to="/" className="publico-sub">← Volver al tablero</Link>

        {(cargando || cargandoResultados) && <p className="publico-sub">Cargando…</p>}
        {error && <p style={{ color: '#ff4757' }}>{error}</p>}
        {!cargando && !competidor && <p className="publico-sub">No encontramos a esta competidora en {competencia?.nombre || 'la competencia activa'}.</p>}

        {competidor && (
          <>
            <header className="ficha-encabezado">
              <p className="publico-kicker">{competidor.categoria}</p>
              <h1 className="ficha-nombre"><span className="dorsal">#{competidor.dorsal}</span> {competidor.nombre}</h1>
              {competencia && <p className="publico-sub">{competencia.nombre}</p>}
            </header>

            {!cargandoResultados && detalle.length === 0 && (
              <p className="publico-sub">Todavía no tiene turnos ni resultados en esta competencia.</p>
            )}
            {!cargandoResultados && detalle.map((item) => <TarjetaEtapa key={item.etapa.id} item={item} />)}
            {!cargandoResultados && detalle.length > 0 && (
              <p className="ficha-nota">Zona y top: número de intento en que se lograron. – significa que todavía no se logró.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
