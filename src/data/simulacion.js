// Resultados aleatorios para probar una competencia (desde /admin → Simular resultados).
// Genera intentos plausibles para la etapa activa: los mejores encadenan más y los
// bloques difíciles cuestan más. `avance` (0 a 1) es cuánto de la ronda ya se escaló.
import { estadoCategoria } from '../utils/ranking';
import { esAmericana, reglasAmericana } from '../utils/score';
import { acotar, generador, simularBloque } from './demo';

// Dificultad de cada bloque de 0 a 1. En una ronda americana sale de los puntos al
// primer intento (vale más = más difícil), así sirve también con numeración por sector.
function dificultades(etapa) {
  const valor = (id, index) => etapa.tablaPuntos?.[id]?.[0] ?? index;
  const ordenados = (etapa.boulders || []).map((id, index) => [id, valor(id, index)]).sort((a, b) => a[1] - b[1]);
  return new Map(ordenados.map(([id], index) => [id, (index + 1) / ordenados.length]));
}

function simularAmericana(azar, nivel, etapa, avance) {
  const maxIntentos = reglasAmericana(etapa).maxIntentos;
  const dificultad = dificultades(etapa);
  const intentados = [];
  // Cada uno prueba casi todos los fáciles y algunos difíciles, empezando por los fáciles.
  [...dificultad.entries()].forEach(([boulderId, d]) => {
    if (azar() > acotar(1.15 - d + nivel * 0.4, 0.15, 0.95)) return;
    const pTop = acotar(nivel * 1.35 - d + 0.25, 0.03, 0.9);
    let intentos = 0;
    let topEnIntento = null;
    const tope = 1 + Math.floor(azar() * maxIntentos);
    while (intentos < tope) {
      intentos += 1;
      if (azar() < pTop) {
        topEnIntento = intentos;
        break;
      }
    }
    intentados.push({ boulderId, intentos, zonaEnIntento: topEnIntento, topEnIntento });
  });
  // Cada competidor va un poco más adelante o más atrás que el avance general.
  const propio = acotar(avance * (0.7 + azar() * 0.6), 0, 1);
  return intentados.slice(0, Math.round(intentados.length * propio));
}

export function simularEtapa({ etapa, competidores, turnos = [], avance = 1, semilla = Date.now() }) {
  const azar = generador(semilla);
  const abiertas = competidores.filter((c) => estadoCategoria(etapa, c.categoriaId) !== 'finalizada');
  const nivel = new Map(abiertas.map((c) => [c.id, 0.3 + azar() * 0.55]));

  if (esAmericana(etapa)) {
    return abiertas.flatMap((c) => simularAmericana(azar, nivel.get(c.id), etapa, avance)
      .map((resultado) => ({ etapaId: etapa.id, competidorId: c.id, ...resultado })));
  }

  // World Climbing: se escala por orden de paso. Con el avance, pasan los primeros
  // turnos de cada bloque. Sin orden de paso, todos en todos los bloques de la etapa.
  const dificultad = new Map((etapa.boulders || []).map((id) => [id, 0.2 + azar() * 0.5]));
  const turnosEtapa = turnos.filter((t) => t.etapaId === etapa.id && nivel.has(t.competidorId));
  const pares = turnosEtapa.length
    ? turnosEtapa
    : abiertas.flatMap((c, index) => (etapa.boulders || []).map((boulderId) => ({ competidorId: c.id, boulderId, orden: index + 1 })));
  const ultimoOrden = Math.max(1, ...pares.map((t) => t.orden || 1));
  return pares
    .filter((t) => (t.orden || 1) <= Math.round(ultimoOrden * avance))
    .map((t) => ({
      etapaId: etapa.id,
      competidorId: t.competidorId,
      boulderId: t.boulderId,
      ...simularBloque(azar, nivel.get(t.competidorId), dificultad.get(t.boulderId) ?? 0.4, 2 + Math.floor(azar() * 5)),
    }));
}
