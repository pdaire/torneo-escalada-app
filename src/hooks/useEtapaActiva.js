import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { competenciasCol, competidoresCol, docsConId, etapasCol, turnosCol } from '../utils/competicion';

export function useEtapaActiva() {
  const [competencia, setCompetencia] = useState(null);
  const [etapa, setEtapa] = useState(null);
  const [competidores, setCompetidores] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const consulta = query(competenciasCol(db), where('activa', '==', true));
    return onSnapshot(consulta, (snapshot) => {
      const primera = snapshot.docs[0];
      setCompetencia(primera ? { id: primera.id, ...primera.data() } : null);
      setCargando(false);
      setError('');
    }, (err) => {
      setError(err.message);
      setCargando(false);
    });
  }, []);

  useEffect(() => {
    if (!competencia) {
      setEtapa(null);
      setCompetidores([]);
      setTurnos([]);
      return undefined;
    }

    const unsubEtapas = onSnapshot(etapasCol(db, competencia.id), (snapshot) => {
      const etapas = docsConId(snapshot);
      setEtapa(etapas.find((item) => item.activa) || null);
    });
    const unsubCompetidores = onSnapshot(competidoresCol(db, competencia.id), (snapshot) => {
      setCompetidores(docsConId(snapshot));
    });
    const unsubTurnos = onSnapshot(turnosCol(db, competencia.id), (snapshot) => {
      setTurnos(docsConId(snapshot));
    });

    return () => {
      unsubEtapas();
      unsubCompetidores();
      unsubTurnos();
    };
  }, [competencia?.id]);

  return { competencia, etapa, competidores, turnos, cargando, error };
}
