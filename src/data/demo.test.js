import { describe, expect, it } from 'vitest';
import { CATEGORIA_EN_CURSO, generarDemo } from './demo';
import { validarResultado } from '../utils/resultado';
import { rankingPorCategoria } from '../utils/ranking';

const demo = generarDemo();

describe('generarDemo', () => {
  it('tiene seis categorías de ocho competidoras con dorsales únicos', () => {
    const categorias = new Set(demo.competidores.map((c) => c.categoriaId));
    expect(categorias.size).toBe(6);
    expect(demo.competidores).toHaveLength(48);
    expect(new Set(demo.competidores.map((c) => c.dorsal)).size).toBe(48);
  });

  it('todos los resultados son válidos', () => {
    demo.resultados.forEach((r) => expect(validarResultado(r)).toBe(''));
  });

  it('la clasificatoria está completa: 48 competidoras × 4 bloques', () => {
    expect(demo.resultados.filter((r) => r.etapaId === 'clasificatoria')).toHaveLength(192);
  });

  it('la final tiene seis por categoría y solo Mujeres Adultas queda a medias', () => {
    const final = demo.resultados.filter((r) => r.etapaId === 'final');
    const porCategoria = {};
    final.forEach((r) => {
      const categoria = demo.competidores.find((c) => c.id === r.competidorId).categoriaId;
      porCategoria[categoria] = (porCategoria[categoria] || 0) + 1;
    });
    Object.entries(porCategoria).forEach(([categoria, cantidad]) => {
      expect(cantidad).toBe(categoria === CATEGORIA_EN_CURSO ? 4 + 4 + 3 + 2 + 1 : 24);
    });
    expect(demo.categoriasCerradasFinal).toHaveLength(5);
    expect(demo.categoriasCerradasFinal).not.toContain(CATEGORIA_EN_CURSO);
    const grupos = rankingPorCategoria({ ...demo, etapaId: 'final' });
    grupos.forEach((g) => expect(g.filas).toHaveLength(6));
  });

  it('es determinística', () => {
    expect(generarDemo()).toEqual(demo);
  });
});
