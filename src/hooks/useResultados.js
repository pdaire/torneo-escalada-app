import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { resultadosColRef } from '../utils/resultado';
import { rankingConDesempate } from '../utils/ranking';

function useResultados(clave, crearConsulta) {
  const [estado, setEstado] = useState({ clave: '', resultados: [], error: '' });

  useEffect(() => {
    if (!clave) return undefined;
    return onSnapshot(crearConsulta(), (snapshot) => {
      setEstado({ clave, resultados: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })), error: '' });
    }, (error) => {
      console.error('Error al escuchar resultados:', error);
      setEstado({ clave, resultados: [], error: 'No se pudieron cargar los resultados. Revisa la conexión.' });
    });
  }, [clave]);

  if (!clave) return { resultados: [], error: '', cargando: false };
  if (estado.clave !== clave) return { resultados: [], error: '', cargando: true };
  return { ...estado, cargando: false };
}

export function useResultadosEtapa(competenciaId, etapaId) {
  return useResultados(
    competenciaId && etapaId ? `${competenciaId}/${etapaId}` : '',
    () => query(resultadosColRef(db), where('competenciaId', '==', competenciaId), where('etapaId', '==', etapaId)),
  );
}

// Todos los resultados de la competencia: para la ficha de una competidora,
// que necesita los rankings de todas las etapas.
export function useResultadosCompetencia(competenciaId) {
  return useResultados(
    competenciaId || '',
    () => query(resultadosColRef(db), where('competenciaId', '==', competenciaId)),
  );
}

// Ranking por categoría de una etapa. Si tiene `etapaPreviaId`,
// los empates se rompen con la posición en esa etapa.
export function useRankingEtapa({ competencia, etapa, etapas = [], competidores, turnos }) {
  const actual = useResultadosEtapa(competencia?.id, etapa?.id);
  const previa = useResultadosEtapa(competencia?.id, etapa?.etapaPreviaId);

  const grupos = useMemo(() => (etapa
    ? rankingConDesempate({ etapa, etapas, competidores, turnos, resultados: [...actual.resultados, ...previa.resultados] })
    : []
  ), [etapa, etapas, competidores, turnos, actual.resultados, previa.resultados]);

  return {
    grupos,
    resultados: actual.resultados,
    error: actual.error || previa.error,
    cargando: actual.cargando || previa.cargando,
  };
}
