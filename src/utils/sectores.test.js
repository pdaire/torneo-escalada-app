import { describe, expect, it } from 'vitest';
import { bloquesAmericana, parsearSectores, sectoresDeBloques, textoDeSectores } from './sectores';

const boulders = bloquesAmericana(32);

describe('sectores', () => {
  it('lee sectores con números o ids, separados por ; o líneas', () => {
    expect(parsearSectores('A: 1, 8, 23, 32; B: b2 9\nC:16', boulders)).toEqual({
      sectores: { A: ['B1', 'B8', 'B23', 'B32'], B: ['B2', 'B9'], C: ['B16'] },
    });
  });

  it('avisa de bloques inexistentes o líneas sin formato', () => {
    expect(parsearSectores('A: 1, 40', boulders).error).toMatch(/B40/);
    expect(parsearSectores('A 1 2', boulders).error).toMatch(/Ejemplo/);
  });

  it('vuelve a texto y encuentra los sectores de un juez', () => {
    const sectores = { A: ['B1', 'B8'], B: ['B2'] };
    expect(textoDeSectores(sectores)).toBe('A: 1, 8; B: 2');
    expect(sectoresDeBloques(sectores, ['B8'])).toEqual([{ nombre: 'A', boulders: ['B1', 'B8'] }]);
  });
});
