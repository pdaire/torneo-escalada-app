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

describe('bloquesDeCategoria', () => {
  const etapa = { id: 'final', boulders: ['W1', 'W2', 'M1', 'M2'] };
  const turnos = [
    { etapaId: 'final', categoriaId: 'damas', boulderId: 'W2' },
    { etapaId: 'final', categoriaId: 'damas', boulderId: 'W1' },
    { etapaId: 'final', categoriaId: 'varones', boulderId: 'M1' },
    { etapaId: 'qualis', categoriaId: 'damas', boulderId: 'M2' },
  ];

  it('devuelve los bloques con turnos de la categoría, en el orden de la etapa', async () => {
    const { bloquesDeCategoria } = await import('./ranking');
    expect(bloquesDeCategoria(etapa, turnos, 'damas')).toEqual(['W1', 'W2']);
    expect(bloquesDeCategoria(etapa, turnos, 'varones')).toEqual(['M1']);
  });

  it('sin turnos, devuelve todos los de la etapa', async () => {
    const { bloquesDeCategoria } = await import('./ranking');
    expect(bloquesDeCategoria(etapa, turnos, 'otra')).toEqual(etapa.boulders);
  });
});

describe('ordenarEtapas', () => {
  it('sigue la cadena de etapas previas', async () => {
    const { ordenarEtapas } = await import('./ranking');
    const etapas = [
      { id: 'final', nombre: 'Final', etapaPreviaId: 'semi' },
      { id: 'qualis', nombre: 'Qualis', etapaPreviaId: null },
      { id: 'semi', nombre: 'Semi', etapaPreviaId: 'qualis' },
    ];
    expect(ordenarEtapas(etapas).map((e) => e.id)).toEqual(['qualis', 'semi', 'final']);
  });
});

describe('detalleCompetidor', () => {
  it('muestra posición, puntaje y bloques pendientes por etapa', async () => {
    const { detalleCompetidor } = await import('./ranking');
    const etapas = [
      { id: 'final', nombre: 'Final', boulders: ['W1', 'W2'], etapaPreviaId: 'qualis', estado: 'abierta', categoriasCerradas: [] },
      { id: 'qualis', nombre: 'Qualis', boulders: ['W1'], etapaPreviaId: null, estado: 'cerrada' },
    ];
    const turnos = [
      { etapaId: 'qualis', categoriaId: 'damas', boulderId: 'W1', competidorId: 'd1', horaProgramada: '10:00' },
      { etapaId: 'qualis', categoriaId: 'damas', boulderId: 'W1', competidorId: 'd2', horaProgramada: '10:04' },
      { etapaId: 'final', categoriaId: 'damas', boulderId: 'W1', competidorId: 'd1', horaProgramada: '16:00' },
      { etapaId: 'final', categoriaId: 'damas', boulderId: 'W2', competidorId: 'd1', horaProgramada: '16:04' },
    ];
    const resultados = [
      resultado('d1', 'W1', 1, 2, 'qualis'),
      resultado('d2', 'W1', 1, 1, 'qualis'),
      { ...resultado('d1', 'W1', 2, null, 'final'), intentos: 3 },
    ];
    const detalle = detalleCompetidor({ competidorId: 'd1', etapas, competidores, turnos, resultados });
    expect(detalle.map((d) => d.etapa.id)).toEqual(['qualis', 'final']);
    expect(detalle[0]).toMatchObject({ posicion: 2, totalCategoria: 2, decimas: 249, estado: 'finalizada', categoriaId: 'damas' });
    expect(detalle[1].estado).toBe(null);
    expect(detalle[1].bloques).toEqual([
      { boulderId: 'W1', intentos: 3, zonaEnIntento: 2, topEnIntento: null, decimas: 99, horaProgramada: '16:00', pendiente: false },
      { boulderId: 'W2', intentos: 0, zonaEnIntento: null, topEnIntento: null, decimas: 0, horaProgramada: '16:04', pendiente: true },
    ]);
  });
});

describe('estadoCategoria', () => {
  it('en curso solo en la etapa activa; finalizada si la etapa o la categoría están cerradas', async () => {
    const { estadoCategoria } = await import('./ranking');
    expect(estadoCategoria({ activa: true, estado: 'abierta', categoriasCerradas: [] }, 'damas')).toBe('en_curso');
    expect(estadoCategoria({ activa: true, estado: 'abierta', categoriasCerradas: ['damas'] }, 'damas')).toBe('finalizada');
    expect(estadoCategoria({ activa: false, estado: 'cerrada' }, 'damas')).toBe('finalizada');
    expect(estadoCategoria({ activa: false, estado: 'abierta' }, 'damas')).toBe(null);
  });
});
