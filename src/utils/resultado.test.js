import { describe, expect, it } from 'vitest';
import { idResultado, leerResultado, prepararResultado, validarResultado } from './resultado';

describe('validarResultado', () => {
  it('acepta un marcador consistente', () => {
    expect(validarResultado({ intentos: 4, zonaEnIntento: 2, topEnIntento: 4 })).toBe('');
    expect(validarResultado({ intentos: 0, zonaEnIntento: null, topEnIntento: null })).toBe('');
  });

  it('rechaza intentos negativos o no enteros', () => {
    expect(validarResultado({ intentos: -1, zonaEnIntento: null, topEnIntento: null })).not.toBe('');
    expect(validarResultado({ intentos: 1.5, zonaEnIntento: null, topEnIntento: null })).not.toBe('');
  });

  it('rechaza zona o top fuera del total', () => {
    expect(validarResultado({ intentos: 2, zonaEnIntento: 3, topEnIntento: null })).not.toBe('');
    expect(validarResultado({ intentos: 2, zonaEnIntento: 1, topEnIntento: 3 })).not.toBe('');
  });

  it('rechaza zona posterior al top', () => {
    expect(validarResultado({ intentos: 5, zonaEnIntento: 4, topEnIntento: 2 })).not.toBe('');
  });
});

describe('prepararResultado', () => {
  it('un top sin zona deja la zona en el mismo intento', () => {
    expect(prepararResultado({ intentos: 3, zonaEnIntento: null, topEnIntento: 3 }))
      .toEqual({ intentos: 3, zonaEnIntento: 3, topEnIntento: 3 });
  });
});

describe('leerResultado', () => {
  it('un documento viejo sin versión queda en versión 0', () => {
    expect(leerResultado({ intentos: 2 })).toEqual({ intentos: 2, zonaEnIntento: null, topEnIntento: null, version: 0 });
  });
});

it('idResultado une las cuatro claves', () => {
  expect(idResultado({ competenciaId: 'c', etapaId: 'final', competidorId: 'x-4', boulderId: 'M1' })).toBe('c__final__x-4__M1');
});
