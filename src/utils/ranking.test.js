import { describe, expect, it } from 'vitest';
import { ordenDeSalida, ordenarFilas, rankingPorCategoria } from './ranking';

const competidores = [
  { id: 'd1', dorsal: '1', nombre: 'Ana', categoria: 'Damas', categoriaId: 'damas' },
  { id: 'd2', dorsal: '2', nombre: 'Bea', categoria: 'Damas', categoriaId: 'damas' },
  { id: 'd3', dorsal: '3', nombre: 'Caro', categoria: 'Damas', categoriaId: 'damas' },
  { id: 'v1', dorsal: '10', nombre: 'Diego', categoria: 'Varones', categoriaId: 'varones' },
];

function resultado(competidorId, boulderId, zonaEnIntento, topEnIntento, etapaId = 'final') {
  return { competidorId, boulderId, etapaId, zonaEnIntento, topEnIntento };
}

describe('rankingPorCategoria', () => {
  it('separa el ranking por categoría', () => {
    const grupos = rankingPorCategoria({
      competidores,
      turnos: [],
      resultados: [resultado('v1', 'M1', 1, 1), resultado('d2', 'M1', 2, null)],
      etapaId: 'final',
    });
    expect(grupos.map((g) => g.categoriaId)).toEqual(['damas', 'varones']);
    expect(grupos[0].filas.map((f) => [f.id, f.posicion])).toEqual([['d2', 1], ['d1', 2], ['d3', 2]]);
    expect(grupos[1].filas[0]).toMatchObject({ id: 'v1', posicion: 1, decimas: 250 });
  });

  it('solo considera resultados de la etapa', () => {
    const grupos = rankingPorCategoria({
      competidores,
      turnos: [],
      resultados: [resultado('d1', 'M1', 1, 1, 'qualis')],
      etapaId: 'final',
    });
    expect(grupos[0].filas.every((f) => f.decimas === 0)).toBe(true);
  });

  it('con turnos, participan solo quienes tienen turno o resultado', () => {
    const grupos = rankingPorCategoria({
      competidores,
      turnos: [{ etapaId: 'final', competidorId: 'd1' }],
      resultados: [resultado('d3', 'M1', 1, null)],
      etapaId: 'final',
    });
    expect(grupos).toHaveLength(1);
    expect(grupos[0].filas.map((f) => f.id)).toEqual(['d3', 'd1']);
  });

  it('desempata con la posición de la etapa previa', () => {
    const grupos = rankingPorCategoria({
      competidores,
      turnos: [],
      resultados: [resultado('d1', 'M1', 1, null), resultado('d2', 'M1', 1, null)],
      etapaId: 'final',
      posicionesPrevias: new Map([['d1', 3], ['d2', 1]]),
    });
    expect(grupos[0].filas.slice(0, 2).map((f) => [f.id, f.posicion])).toEqual([['d2', 1], ['d1', 2]]);
  });
});

describe('ordenarFilas', () => {
  it('comparte posición en un empate sin desempate', () => {
    const filas = ordenarFilas([
      { id: 'a', dorsal: '1', decimas: 100, previa: null },
      { id: 'b', dorsal: '2', decimas: 250, previa: null },
      { id: 'c', dorsal: '3', decimas: 100, previa: null },
      { id: 'd', dorsal: '4', decimas: 50, previa: null },
    ]);
    expect(filas.map((f) => [f.id, f.posicion])).toEqual([['b', 1], ['a', 2], ['c', 2], ['d', 4]]);
  });
});

describe('ordenDeSalida', () => {
  it('toma los cupos con empates y sale primero la peor clasificada', () => {
    const filas = [
      { id: 'a', posicion: 1 },
      { id: 'b', posicion: 2 },
      { id: 'c', posicion: 2 },
      { id: 'd', posicion: 4 },
    ];
    expect(ordenDeSalida(filas, 2).map((f) => f.id)).toEqual(['c', 'b', 'a']);
  });
});
