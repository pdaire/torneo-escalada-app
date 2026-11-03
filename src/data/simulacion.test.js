import { describe, expect, it } from 'vitest';
import { simularEtapa } from './simulacion';
import { plantilla } from './plantillas';
import { validarResultado } from '../utils/resultado';
import { rankingPorCategoria } from '../utils/ranking';
import { reglasAmericana } from '../utils/score';

const competidores = Array.from({ length: 30 }, (_, i) => ({
  id: `c-${i + 1}`, dorsal: String(i + 1), nombre: `Competidor ${i + 1}`,
  categoria: i % 2 ? 'Experto Damas' : 'Novicio Varones', categoriaId: i % 2 ? 'experto-damas' : 'novicio-varones',
}));

describe('simular resultados', () => {
  it('ronda americana: resultados válidos dentro del máximo de intentos y con top en el último intento', () => {
    const [etapa] = plantilla('americana').etapas();
    const resultados = simularEtapa({ etapa: { ...etapa, id: 'ronda' }, competidores, avance: 1, semilla: 7 });
    expect(resultados.length).toBeGreaterThan(200);
    resultados.forEach((r) => {
      expect(validarResultado(r)).toBe('');
      expect(r.intentos).toBeLessThanOrEqual(reglasAmericana(etapa).maxIntentos);
      if (r.topEnIntento != null) expect(r.topEnIntento).toBe(r.intentos);
      expect(etapa.boulders).toContain(r.boulderId);
    });
    const grupos = rankingPorCategoria({ competidores, turnos: [], resultados, etapa: { ...etapa, id: 'ronda' } });
    expect(grupos.flatMap((g) => g.filas).filter((f) => f.puntaje > 0).length).toBeGreaterThan(25);
  });

  it('el avance controla cuánto se escaló y es determinístico con la misma semilla', () => {
    const [etapa] = plantilla('americana').etapas();
    const total = simularEtapa({ etapa, competidores, avance: 1, semilla: 3 }).length;
    const mitad = simularEtapa({ etapa, competidores, avance: 0.5, semilla: 3 }).length;
    expect(mitad).toBeGreaterThan(total * 0.3);
    expect(mitad).toBeLessThan(total * 0.75);
    expect(simularEtapa({ etapa, competidores, avance: 0, semilla: 3 })).toEqual([]);
    expect(simularEtapa({ etapa, competidores, avance: 0.5, semilla: 3 })).toEqual(simularEtapa({ etapa, competidores, avance: 0.5, semilla: 3 }));
  });

  it('numeración por sector y categorías finalizadas', () => {
    const [etapa] = plantilla('americana-sectores').etapas();
    const cerrada = { ...etapa, categoriasCerradas: ['experto-damas'] };
    const resultados = simularEtapa({ etapa: cerrada, competidores, avance: 1, semilla: 5 });
    expect(resultados.every((r) => /^[ABC]\d$/.test(r.boulderId))).toBe(true);
    expect(resultados.some((r) => competidores.find((c) => c.id === r.competidorId).categoriaId === 'experto-damas')).toBe(false);
  });

  it('World Climbing con orden de paso: solo los primeros turnos según el avance', () => {
    const etapa = { id: 'final', formato: 'wc', boulders: ['M1', 'M2'] };
    const turnos = competidores.slice(0, 6).flatMap((c, i) => ['M1', 'M2'].map((b) => ({ etapaId: 'final', competidorId: c.id, boulderId: b, orden: i + 1 })));
    const resultados = simularEtapa({ etapa, competidores, turnos, avance: 0.5, semilla: 2 });
    expect(new Set(resultados.map((r) => r.competidorId))).toEqual(new Set(['c-1', 'c-2', 'c-3']));
    resultados.forEach((r) => expect(validarResultado(r)).toBe(''));
  });
});
