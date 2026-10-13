import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatearPuntos } from '../utils/score';
import { useEtapaActiva } from '../hooks/useEtapaActiva';
import { useRankingEtapa } from '../hooks/useResultados';
import { bloquesDeCategoria, ordenarEtapas } from '../utils/ranking';
import { EstadoCategoria, MarcaBoulder } from '../components/Marcador';
import './publico.css';

// Columnas de una categoría: sus bloques en la etapa, más cualquiera con resultados.
function bloquesVisibles(grupo, etapa, turnos) {
  const propios = bloquesDeCategoria(etapa, turnos, grupo.categoriaId);
  const conResultado = new Set(grupo.filas.flatMap((fila) => Object.keys(fila.boulders)));
  return [...propios, ...[...conResultado].filter((id) => !propios.includes(id))];
}

function categoriaFinalizada(etapa, categoriaId) {
  return etapa?.estado === 'cerrada' || Boolean(etapa?.categoriasCerradas?.includes(categoriaId));
}

function PestanasEtapas({ etapas, seleccionada, onElegir }) {
  if (etapas.length < 2) return null;
  return (
    <nav aria-label="Etapas" className="pestanas">
      {etapas.map((item) => {
        const elegida = item.id === seleccionada?.id;
        return (
          <button
            key={item.id}
            onClick={() => onElegir(item)}
            aria-current={elegida ? 'page' : undefined}
            className={elegida ? 'pestana elegida' : 'pestana'}>
            {item.nombre}
            {item.activa && <span className="pestana-vivo">● En vivo</span>}
          </button>
        );
      })}
    </nav>
  );
}

function TablaCategoria({ grupo, etapa, turnos, conTitulo }) {
  const bloques = bloquesVisibles(grupo, etapa, turnos);
  return (
    <section className="categoria">
      {conTitulo && (
        <h2 className="categoria-titulo">
          {grupo.categoria}
          <EstadoCategoria finalizada={categoriaFinalizada(etapa, grupo.categoriaId)} />
        </h2>
      )}
      <div className="tabla-contenedor">
        <table className="ranking">
          <thead>
            <tr>
              <th>Pos</th>
              <th className="nombre">Escalador</th>
              {bloques.map((boulder) => <th key={boulder}>{boulder}</th>)}
              <th className="puntaje">Puntaje</th>
            </tr>
          </thead>
          <tbody>
            {grupo.filas.map((comp) => (
              <tr key={comp.id}>
                <td className={comp.posicion === 1 && comp.decimas > 0 ? 'pos oro' : 'pos'}>{comp.posicion}°</td>
                <td className="nombre">
                  <Link to={`/competidor/${comp.id}`}>
                    {comp.dorsal && <span className="dorsal">#{comp.dorsal} </span>}
                    {comp.nombre}
                  </Link>
                </td>
                {bloques.map((boulderId) => (
                  <td key={boulderId}>
                    <MarcaBoulder boulder={comp.boulders[boulderId]} />
                  </td>
                ))}
                <td className="puntaje">{formatearPuntos(comp.decimas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PublicDashboard() {
  const { competencia, etapa: etapaActiva, etapas, competidores, turnos, cargando } = useEtapaActiva();
  const [parametros, setParametros] = useSearchParams();
  const etapa = etapas.find((item) => item.id === parametros.get('etapa')) || etapaActiva;
  const { grupos, error: errorCarga, cargando: cargandoResultados } = useRankingEtapa({ competencia, etapa, competidores, turnos });

  useEffect(() => {
    document.body.classList.add('public-board');
    return () => document.body.classList.remove('public-board');
  }, []);

  const elegirEtapa = (item) => {
    setParametros(item.activa ? {} : { etapa: item.id }, { replace: true });
  };

  // Las categorías que siguen en curso van primero.
  const ordenados = grupos.slice().sort((a, b) => (
    Number(categoriaFinalizada(etapa, a.categoriaId)) - Number(categoriaFinalizada(etapa, b.categoriaId))
  ));
  const enVivo = etapa?.activa && etapa?.estado !== 'cerrada';

  return (
    <div className="publico">
      <header className="publico-encabezado">
        {etapa && <p className={enVivo ? 'publico-kicker en-vivo' : 'publico-kicker'}>{enVivo ? 'En vivo' : 'Resultados finales'}</p>}
        <h1 className="publico-titulo">{cargando ? 'Cargando…' : `Resultados${etapa ? ` ${etapa.nombre}` : ''}`}</h1>
        {competencia && <p className="publico-sub">{competencia.nombre}</p>}
      </header>

      <PestanasEtapas etapas={ordenarEtapas(etapas)} seleccionada={etapa} onElegir={elegirEtapa} />

      {!cargando && ordenados.length === 0 && (
        <p className="publico-sub" style={{ textAlign: 'center', padding: '3rem 0' }}>
          {errorCarga || (etapa ? 'Esperando a que los jueces registren resultados…' : 'No hay una etapa activa.')}
        </p>
      )}

      {!cargandoResultados && ordenados.map((grupo) => (
        <TablaCategoria key={grupo.categoriaId} grupo={grupo} etapa={etapa} turnos={turnos} conTitulo={ordenados.length > 1} />
      ))}
    </div>
  );
}
