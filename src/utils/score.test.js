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
