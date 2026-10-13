import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCompetencia } from '../hooks/useCompetencia';
import { rutas } from '../utils/competicion';
import NoExiste from '../components/NoExiste';
import { useResultadosCompetencia } from '../hooks/useResultados';
import { detalleCompetidor, firmasDeFicha } from '../utils/ranking';
import { useDestellos } from '../hooks/useDestellos';
import { esAmericana, formatearPuntaje, formatearPuntos, reglasAmericana } from '../utils/score';
import { EstadoCategoria, IconoLogro } from '../components/Marcador';
import './publico.css';

function FilaBloque({ bloque, destello }) {
  if (bloque.pendiente) {
    return (
      <tr key={destello || 'quieta'} className={destello ? 'pendiente fila-destello' : 'pendiente'}>
        <td><span className="ficha-bloque">{bloque.boulderId}</span></td>
        <td colSpan={3}>{bloque.horaProgramada ? `Pendiente · ${bloque.horaProgramada}` : 'Pendiente'}</td>
        <td className="numero">–</td>
      </tr>
    );
  }
  return (
    <tr key={destello || 'quieta'} className={destello ? 'fila-destello' : undefined}>
      <td>
        <span className="ficha-bloque">
          <IconoLogro top={bloque.topEnIntento} zona={bloque.zonaEnIntento} />
          {bloque.boulderId}
        </span>
      </td>
      <td>{bloque.zonaEnIntento ?? '–'}</td>
      <td>{bloque.topEnIntento ?? '–'}</td>
      <td>{bloque.intentos}</td>
      <td className="numero">{formatearPuntos(bloque.puntos)}</td>
    </tr>
  );
}

// Ronda americana: solo los bloques intentados, marcando los que suman al total.
function TablaAmericana({ item, destellos }) {
  const { etapa } = item;
  const intentados = item.bloques.filter((bloque) => bloque.intentos > 0);
  const reglas = reglasAmericana(etapa);
  return (
    <>
      <table className="ficha-tabla">
        <thead>
          <tr>
            <th>Bloque</th>
            <th>Intentos</th>
            <th>Encadenó</th>
            <th className="numero">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {intentados.map((bloque) => (
            <tr
              key={`${bloque.boulderId}-${destellos.get(`${etapa.id}/${bloque.boulderId}`) || ''}`}
              className={[bloque.cuenta ? 'suma' : '', destellos.has(`${etapa.id}/${bloque.boulderId}`) ? 'fila-destello' : ''].join(' ').trim() || undefined}>
              <td><span className="ficha-bloque">{bloque.boulderId}</span></td>
              <td>{bloque.intentos}</td>
              <td>{bloque.topEnIntento != null ? `✓ intento ${bloque.topEnIntento}` : '✗'}</td>
              <td className="numero">{bloque.puntos}{bloque.cuenta ? ' ★' : ''}</td>
            </tr>
          ))}
          {!intentados.length && (
            <tr className="pendiente"><td colSpan={4}>Todavía no intenta ningún bloque.</td></tr>
          )}
        </tbody>
      </table>
      <p className="ficha-nota">
        ★ suma al total: los {reglas.mejoresBloques} mejores bloques. {item.bloques.length - intentados.length} de {item.bloques.length} bloques sin intentar.
      </p>
    </>
  );
}

function TarjetaEtapa({ item, competenciaId, destellos }) {
  const { etapa } = item;
  const americana = esAmericana(etapa);
  return (
    <section className="ficha-etapa">
      <div className="ficha-etapa-encabezado">
        <h2>
          <Link to={rutas.tablero(competenciaId, { ...(etapa.activa ? {} : { etapa: etapa.id }), categoria: item.categoriaId })}>{etapa.nombre}</Link>
          <EstadoCategoria estado={item.estado} />
        </h2>
        <p key={destellos.get(etapa.id) || 'quieto'} className={destellos.has(etapa.id) ? 'ficha-resumen puntaje-destello' : 'ficha-resumen'}>
          <span className={item.posicion === 1 && item.puntaje > 0 ? 'oro' : ''}>{item.posicion}°</span>
          <small> de {item.totalCategoria} · </small>
          {formatearPuntaje(etapa, item.puntaje)} pts
          {americana && <small> · {item.tops} tops</small>}
        </p>
      </div>
      {americana && <TablaAmericana item={item} destellos={destellos} />}
      {!americana && <div style={{ overflowX: 'auto' }}>
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
            {item.bloques.map((bloque) => (
              <FilaBloque key={bloque.boulderId} bloque={bloque} destello={destellos.get(`${etapa.id}/${bloque.boulderId}`)} />
            ))}
          </tbody>
        </table>
      </div>}
    </section>
  );
}

export default function CompetidorView() {
  const { competenciaId, competidorId } = useParams();
  const { competencia, etapas, competidores, turnos, cargando, noExiste } = useCompetencia(competenciaId);
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
  const firmas = useMemo(() => firmasDeFicha(detalle), [detalle]);
  const destellos = useDestellos(firmas, `${competenciaId}/${competidorId}`, !cargando && !cargandoResultados);

  if (noExiste) return <NoExiste competenciaId={competenciaId} />;

  return (
    <div className="publico">
      <main className="ficha">
        <Link to={rutas.tablero(competenciaId)} className="publico-sub">← Volver al tablero</Link>

        {(cargando || cargandoResultados) && <p className="publico-sub">Cargando…</p>}
        {error && <p style={{ color: '#ff4757' }}>{error}</p>}
        {!cargando && !competidor && <p className="publico-sub">No encontramos a esta competidora en {competencia?.nombre || 'esta competencia'}.</p>}

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
            {!cargandoResultados && detalle.map((item) => <TarjetaEtapa key={item.etapa.id} item={item} competenciaId={competenciaId} destellos={destellos} />)}
            {!cargandoResultados && detalle.some((item) => !esAmericana(item.etapa)) && (
              <p className="ficha-nota">Zona y top: número de intento en que se lograron. – significa que todavía no se logró.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
