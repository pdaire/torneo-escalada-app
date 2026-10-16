import { describe, expect, it } from 'vitest';
import { decimasBoulder, formatearPuntos } from './score';

describe('decimasBoulder', () => {
  it('flash vale 25.0', () => {
    expect(decimasBoulder({ topEnIntento: 1, zonaEnIntento: 1 })).toBe(250);
  });

  it('descuenta 0.1 por intento fallido', () => {
    expect(decimasBoulder({ topEnIntento: 4, zonaEnIntento: 2 })).toBe(247);
    expect(decimasBoulder({ topEnIntento: null, zonaEnIntento: 3 })).toBe(98);
  });

  it('sin zona ni top vale 0', () => {
    expect(decimasBoulder({ topEnIntento: null, zonaEnIntento: null })).toBe(0);
    expect(decimasBoulder()).toBe(0);
  });

  it('formatea con un decimal', () => {
    expect(formatearPuntos(247 + 98)).toBe('34.5');
  });
});

describe('ronda americana', async () => {
  const { puntosAmericana, puntajeDeEtapa, formatearPuntaje, reglasAmericana } = await import('./score');
  const etapa = { formato: 'americana', boulders: Array.from({ length: 24 }, (_, i) => `B${i + 1}`) };

  it('reproduce la cartilla: B1 = 10 8 6 4 2, B13 = 34 … 26, B24 = 56 … 48', () => {
    expect([1, 2, 3, 4, 5].map((k) => puntosAmericana(etapa, 'B1', k))).toEqual([10, 8, 6, 4, 2]);
    expect([1, 2, 3, 4, 5].map((k) => puntosAmericana(etapa, 'B13', k))).toEqual([34, 32, 30, 28, 26]);
    expect([1, 2, 3, 4, 5].map((k) => puntosAmericana(etapa, 'B24', k))).toEqual([56, 54, 52, 50, 48]);
  });

  it('pasado el máximo de intentos no puntúa', () => {
    expect(puntosAmericana(etapa, 'B24', 6)).toBe(0);
  });

  it('suma solo los 5 mejores bloques encadenados', () => {
    const marcas = Object.fromEntries(['B1', 'B5', 'B9', 'B12', 'B20', 'B23', 'B24'].map((id) => [id, { topEnIntento: 1 }]));
    marcas.B2 = { topEnIntento: null, intentos: 5 };
    const { puntaje, cuentan } = puntajeDeEtapa(etapa, marcas);
    expect(cuentan).toEqual(['B24', 'B23', 'B20', 'B12', 'B9']);
    expect(puntaje).toBe(56 + 54 + 48 + 32 + 26);
    expect(formatearPuntaje(etapa, puntaje)).toBe('216');
  });

  it('usa los valores configurados en la etapa', () => {
    const otra = { ...etapa, puntajeBase: 100, incrementoPorBloque: 10, descuentoPorIntento: 5, mejoresBloques: 3 };
    expect(puntosAmericana(otra, 'B2', 3)).toBe(100);
    expect(reglasAmericana(otra).mejoresBloques).toBe(3);
  });

  it('con tabla de puntos, usa los valores de los organizadores sin ninguna fórmula', () => {
    const conTabla = { formato: 'americana', boulders: ['B1', 'B2', 'B3'], maxIntentos: 3, mejoresBloques: 2,
      tablaPuntos: { B1: [100, 60, 55], B2: [150, 149], B3: [400, 120, 10] } };
    expect([1, 2, 3, 4].map((k) => puntosAmericana(conTabla, 'B2', k))).toEqual([150, 149, 0, 0]);
    const { puntaje, cuentan } = puntajeDeEtapa(conTabla, { B1: { topEnIntento: 1 }, B2: { topEnIntento: 2 }, B3: { topEnIntento: 3 } });
    expect(cuentan).toEqual(['B2', 'B1']);
    expect(puntaje).toBe(149 + 100);
    expect(reglasAmericana({ formato: 'americana', tablaPuntos: { B1: [1, 1, 1, 1] } }).maxIntentos).toBe(4);
  });

  it('por sector: A1 y B1 son bloques distintos con sus propios puntos', () => {
    const etapa = { formato: 'americana', numeracion: 'sector', maxIntentos: 3, mejoresBloques: 5,
      boulders: ['A1', 'A2', 'B1', 'B2'], tablaPuntos: { A1: [10, 8, 6], A2: [12, 10, 8], B1: [30, 20, 10], B2: [40, 35, 30] } };
    const { puntaje, cuentan } = puntajeDeEtapa(etapa, { A1: { topEnIntento: 1 }, B1: { topEnIntento: 2 } });
    expect(cuentan).toEqual(['B1', 'A1']);
    expect(puntaje).toBe(20 + 10);
  });

  it('World Climbing sigue sumando todos los bloques en décimas', () => {
    const wc = { formato: 'wc', boulders: ['W1', 'W2'] };
    expect(puntajeDeEtapa(wc, { W1: { topEnIntento: 1, zonaEnIntento: 1 }, W2: { zonaEnIntento: 2 } }).puntaje).toBe(250 + 99);
  });
});
