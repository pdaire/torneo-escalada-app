import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { resultadosColRef } from '../utils/resultado';
import { posicionesDeRanking, rankingPorCategoria } from '../utils/ranking';

export function useResultadosEtapa(competenciaId, etapaId) {
  const clave = competenciaId && etapaId ? `${competenciaId}/${etapaId}` : '';
  const [estado, setEstado] = useState({ clave: '', resultados: [], error: '' });

  useEffect(() => {
    if (!clave) return undefined;
    const consulta = query(
      resultadosColRef(db),
      where('competenciaId', '==', competenciaId),
      where('etapaId', '==', etapaId),
    );
    return onSnapshot(consulta, (snapshot) => {
      setEstado({ clave, resultados: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })), error: '' });
    }, (error) => {
      console.error('Error al escuchar resultados:', error);
      setEstado({ clave, resultados: [], error: 'No se pudieron cargar los resultados. Revisa la conexión.' });
    });
  }, [clave]);

  return estado.clave === clave ? estado : { resultados: [], error: '' };
}

// Ranking por categoría de la etapa. Si la etapa tiene `etapaPreviaId`,
// los empates se rompen con la posición en esa etapa.
export function useRankingEtapa({ competencia, etapa, competidores, turnos }) {
  const actual = useResultadosEtapa(competencia?.id, etapa?.id);
  const previa = useResultadosEtapa(competencia?.id, etapa?.etapaPreviaId);

  const grupos = useMemo(() => {
    if (!etapa) return [];
    const posicionesPrevias = etapa.etapaPreviaId
      ? posicionesDeRanking(rankingPorCategoria({
        competidores, turnos, resultados: previa.resultados, etapaId: etapa.etapaPreviaId,
      }))
      : new Map();
    return rankingPorCategoria({
      competidores, turnos, resultados: actual.resultados, etapaId: etapa.id, posicionesPrevias,
    });
  }, [etapa, competidores, turnos, actual.resultados, previa.resultados]);

  return { grupos, resultados: actual.resultados, error: actual.error || previa.error };
}
