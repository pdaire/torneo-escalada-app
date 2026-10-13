import { describe, expect, it } from 'vitest';
import { demoPrimavera } from './demoPrimavera';
import { rankingPorCategoria } from '../utils/ranking';
import { validarResultado } from '../utils/resultado';

const demo = demoPrimavera();
const [etapa] = demo.etapas;

describe('demo Primavera - El Muro', () => {
  it('una categoría General con 20 competidores y una ronda americana activa de 20 bloques', () => {
    expect(demo.nombre).toBe('Primavera - El Muro');
    expect(demo.competidores).toHaveLength(20);
    expect(new Set(demo.competidores.map((c) => c.categoriaId))).toEqual(new Set(['general']));
    expect(etapa).toMatchObject({ formato: 'americana', maxIntentos: 5, mejoresBloques: 5 });
    expect(etapa.boulders).toHaveLength(20);
    expect(etapa.tablaPuntos.B1).toEqual([10, 8, 6, 4, 2]);
    expect(demo.etapaActiva).toBe(etapa.id);
    expect(demo.turnos).toEqual([]);
  });

  it('la ronda va a la mitad: hay resultados válidos y quedan competidores sin empezar', () => {
    demo.resultados.forEach((r) => {
      expect(validarResultado(r)).toBe('');
      expect(r.intentos).toBeLessThanOrEqual(5);
      if (r.topEnIntento != null) expect(r.topEnIntento).toBe(r.intentos);
    });
    const [general] = rankingPorCategoria({ ...demo, etapa });
    expect(general.filas).toHaveLength(20);
    expect(general.filas.filter((f) => f.puntaje > 0).length).toBeGreaterThan(12);
    expect(general.filas.filter((f) => Object.keys(f.boulders).length === 0).length).toBeGreaterThanOrEqual(2);
  });

  it('el juez demo tiene los sectores A y B', () => {
    expect(demo.asignacionesJuez[etapa.id]).toEqual([...etapa.sectores.A, ...etapa.sectores.B]);
  });

  it('es determinística', () => {
    expect(demoPrimavera()).toEqual(demo);
  });
});
