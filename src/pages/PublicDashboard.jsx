import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatearPuntos } from '../utils/score';
import { useEtapaActiva } from '../hooks/useEtapaActiva';
import { useRankingEtapa } from '../hooks/useResultados';
import { bloquesDeCategoria, cambiosEntre, estadoCategoria, firmasDeRanking, ordenarEtapas } from '../utils/ranking';
import { EstadoCategoria, MarcaBoulder } from '../components/Marcador';
import './publico.css';

// Columnas de una categoría: sus bloques en la etapa, más cualquiera con resultados.
function bloquesVisibles(grupo, etapa, turnos) {
  const propios = bloquesDeCategoria(etapa, turnos, grupo.categoriaId);
  const conResultado = new Set(grupo.filas.flatMap((fila) => Object.keys(fila.boulders)));
  return [...propios, ...[...conResultado].filter((id) => !propios.includes(id))];
}

const DURACION_DESTELLO = 3000;

// Marca por unos segundos las celdas y filas que cambiaron desde el último snapshot,
// para que el público note un resultado nuevo. Al cargar la página o cambiar de
// etapa no marca nada. Devuelve clave → momento del cambio (sirve como `key` para
// reiniciar la animación si la misma celda vuelve a cambiar).
function useDestellos(grupos, contexto, listo) {
  const anterior = useRef(null);
  const temporizadores = useRef([]);
  const [destellos, setDestellos] = useState(() => new Map());

  useEffect(() => () => temporizadores.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!listo) return;
    const firmas = firmasDeRanking(grupos);
    const previo = anterior.current;
    anterior.current = { contexto, firmas };
    if (!previo || previo.contexto !== contexto) return;
    const cambiadas = cambiosEntre(previo.firmas, firmas);
    if (!cambiadas.length) return;
    const momento = Date.now();
    setDestellos((actual) => {
      const siguiente = new Map(actual);
      cambiadas.forEach((clave) => siguiente.set(clave, momento));
      return siguiente;
    });
    temporizadores.current.push(setTimeout(() => {
      setDestellos((actual) => {
        const siguiente = new Map(actual);
        cambiadas.forEach((clave) => { if (siguiente.get(clave) === momento) siguiente.delete(clave); });
        return siguiente;
      });
    }, DURACION_DESTELLO));
  }, [grupos, contexto, listo]);

  return destellos;
}

function FiltroCategorias({ grupos, seleccionada, onElegir }) {
  if (grupos.length < 2) return null;
  const opciones = [{ categoriaId: '', categoria: 'Todas' }, ...grupos.slice().sort((a, b) => a.categoria.localeCompare(b.categoria))];
  return (
    <nav aria-label="Categorías" className="pestanas pestanas-categorias">
      {opciones.map((item) => {
        const elegida = item.categoriaId === (seleccionada || '');
        return (
          <button
            key={item.categoriaId || 'todas'}
            onClick={() => onElegir(item.categoriaId)}
            aria-current={elegida ? 'page' : undefined}
            className={elegida ? 'pestana pestana-chica elegida' : 'pestana pestana-chica'}>
            {item.categoria}
          </button>
        );
      })}
    </nav>
  );
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

function TablaCategoria({ grupo, etapa, turnos, conTitulo, destellos }) {
  const bloques = bloquesVisibles(grupo, etapa, turnos);
  return (
    <section className="categoria">
      {conTitulo && (
        <h2 className="categoria-titulo">
          {grupo.categoria}
          <EstadoCategoria estado={estadoCategoria(etapa, grupo.categoriaId)} />
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
              <tr key={comp.id} className={destellos.has(comp.id) ? 'fila-destello' : undefined}>
                <td className={comp.posicion === 1 && comp.decimas > 0 ? 'pos oro' : 'pos'}>{comp.posicion}°</td>
                <td className="nombre">
                  <Link to={`/competidor/${comp.id}`}>
                    {comp.dorsal && <span className="dorsal">#{comp.dorsal} </span>}
                    {comp.nombre}
                  </Link>
                </td>
                {bloques.map((boulderId) => {
                  const momento = destellos.get(`${comp.id}/${boulderId}`);
                  return (
                    <td key={boulderId}>
                      <div key={momento || 'quieta'} className={momento ? 'celda-destello' : undefined}>
                        <MarcaBoulder boulder={comp.boulders[boulderId]} />
                      </div>
                    </td>
                  );
                })}
                <td className="puntaje">
                  <span key={destellos.get(comp.id) || 'quieto'} className={destellos.has(comp.id) ? 'puntaje-destello' : undefined}>
                    {formatearPuntos(comp.decimas)}
                  </span>
                </td>
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
  const destellos = useDestellos(grupos, `${competencia?.id}/${etapa?.id}`, !cargando && !cargandoResultados);

  useEffect(() => {
    document.body.classList.add('public-board');
    return () => document.body.classList.remove('public-board');
  }, []);

  // La etapa y la categoría elegidas quedan en la URL: ?etapa=semifinal&categoria=mujeres-sub-15.
  // Sin `etapa` se muestra la activa; sin `categoria`, todas.
  const cambiarParametros = (cambios) => {
    const siguientes = new URLSearchParams(parametros);
    Object.entries(cambios).forEach(([clave, valor]) => {
      if (valor) siguientes.set(clave, valor);
      else siguientes.delete(clave);
    });
    setParametros(siguientes, { replace: true });
  };
  const elegirEtapa = (item) => cambiarParametros({ etapa: item.activa ? '' : item.id });
  const elegirCategoria = (categoriaId) => cambiarParametros({ categoria: categoriaId });

  const categoriaElegida = grupos.some((g) => g.categoriaId === parametros.get('categoria')) ? parametros.get('categoria') : '';
  // Las categorías que siguen en curso van primero.
  const ordenados = grupos
    .filter((g) => !categoriaElegida || g.categoriaId === categoriaElegida)
    .sort((a, b) => Number(estadoCategoria(etapa, a.categoriaId) !== 'en_curso') - Number(estadoCategoria(etapa, b.categoriaId) !== 'en_curso'));
  const enVivo = etapa?.activa && etapa?.estado !== 'cerrada';
  const encabezado = enVivo ? 'En vivo' : etapa?.estado === 'cerrada' ? 'Resultados finales' : '';

  return (
    <div className="publico">
      <header className="publico-encabezado">
        {encabezado && <p className={enVivo ? 'publico-kicker en-vivo' : 'publico-kicker'}>{encabezado}</p>}
        <h1 className="publico-titulo">{cargando ? 'Cargando…' : `Resultados${etapa ? ` ${etapa.nombre}` : ''}`}</h1>
        {competencia && <p className="publico-sub">{competencia.nombre}</p>}
      </header>

      <PestanasEtapas etapas={ordenarEtapas(etapas)} seleccionada={etapa} onElegir={elegirEtapa} />
      {!cargandoResultados && <FiltroCategorias grupos={grupos} seleccionada={categoriaElegida} onElegir={elegirCategoria} />}

      {!cargando && ordenados.length === 0 && (
        <p className="publico-sub" style={{ textAlign: 'center', padding: '3rem 0' }}>
          {errorCarga || (etapa ? 'Esperando a que los jueces registren resultados…' : 'No hay una etapa activa.')}
        </p>
      )}

      {!cargandoResultados && ordenados.map((grupo) => (
        <TablaCategoria key={grupo.categoriaId} grupo={grupo} etapa={etapa} turnos={turnos} conTitulo={grupos.length > 1} destellos={destellos} />
      ))}
    </div>
  );
}
