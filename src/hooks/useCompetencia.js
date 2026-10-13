import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { competenciaRef, competidoresCol, docsConId, etapasCol, turnosCol } from '../utils/competicion';

// Competencia de la URL (/:competenciaId/...) con sus etapas, competidoras y turnos.
// `etapa` es la etapa activa de esa competencia. Si la competencia no existe,
// `competencia` queda en null y `noExiste` en true.
export function useCompetencia(competenciaId) {
  const [estado, setEstado] = useState({ id: '', competencia: null, cargando: true, error: '' });
  const [etapas, setEtapas] = useState([]);
  const [competidores, setCompetidores] = useState([]);
  const [turnos, setTurnos] = useState([]);

  useEffect(() => {
    if (!competenciaId) return undefined;
    return onSnapshot(competenciaRef(db, competenciaId), (snap) => {
      setEstado({ id: competenciaId, competencia: snap.exists() ? { id: snap.id, ...snap.data() } : null, cargando: false, error: '' });
    }, (err) => setEstado({ id: competenciaId, competencia: null, cargando: false, error: err.message }));
  }, [competenciaId]);

  const existe = estado.id === competenciaId && Boolean(estado.competencia);

  useEffect(() => {
    setEtapas([]);
    setCompetidores([]);
    setTurnos([]);
    if (!existe) return undefined;
    const desuscribir = [
      onSnapshot(etapasCol(db, competenciaId), (snapshot) => setEtapas(docsConId(snapshot))),
      onSnapshot(competidoresCol(db, competenciaId), (snapshot) => setCompetidores(docsConId(snapshot))),
      onSnapshot(turnosCol(db, competenciaId), (snapshot) => setTurnos(docsConId(snapshot))),
    ];
    return () => desuscribir.forEach((fn) => fn());
  }, [competenciaId, existe]);

  const vigente = estado.id === competenciaId;
  const competencia = vigente ? estado.competencia : null;
  const listas = competencia ? { etapas, competidores, turnos } : { etapas: [], competidores: [], turnos: [] };
  return {
    competencia,
    etapa: listas.etapas.find((item) => item.activa) || null,
    ...listas,
    cargando: !vigente || estado.cargando,
    noExiste: vigente && !estado.cargando && !estado.competencia,
    error: vigente ? estado.error : '',
  };
}
