import { describe, expect, it } from 'vitest';
import { CATEGORIA_EN_CURSO, generarDemo } from './demo';
import { validarResultado } from '../utils/resultado';
import { rankingPorCategoria } from '../utils/ranking';

const demo = generarDemo();

describe('generarDemo', () => {
  it('tiene seis categorías de doce competidoras con dorsales únicos', () => {
    const categorias = new Set(demo.competidores.map((c) => c.categoriaId));
    expect(categorias.size).toBe(6);
    expect(demo.competidores).toHaveLength(72);
    expect(new Set(demo.competidores.map((c) => c.dorsal)).size).toBe(72);
  });

  it('todos los resultados son válidos', () => {
    demo.resultados.forEach((r) => expect(validarResultado(r)).toBe(''));
  });

  it('la clasificatoria está completa: 72 competidoras × 6 bloques', () => {
    expect(demo.resultados.filter((r) => r.etapaId === 'clasificatoria')).toHaveLength(432);
  });

  it('la semifinal está completa: 8 por categoría × 5 bloques', () => {
    const semi = demo.resultados.filter((r) => r.etapaId === 'semifinal');
    expect(semi).toHaveLength(6 * 8 * 5);
    rankingPorCategoria({ ...demo, etapaId: 'semifinal' }).forEach((g) => expect(g.filas).toHaveLength(8));
  });

  it('a cada ronda pasan las mejores de la ronda anterior', () => {
    const enSemi = new Set(demo.turnos.filter((t) => t.etapaId === 'semifinal').map((t) => t.competidorId));
    const enFinal = new Set(demo.turnos.filter((t) => t.etapaId === 'final').map((t) => t.competidorId));
    enFinal.forEach((id) => expect(enSemi.has(id)).toBe(true));
    rankingPorCategoria({ ...demo, etapaId: 'clasificatoria' }).forEach((g) => {
      g.filas.filter((f) => f.posicion <= 8).slice(0, 8).forEach((f) => expect(enSemi.has(f.id)).toBe(true));
    });
  });

  it('cierra la clasificatoria y la semifinal', () => {
    expect(demo.etapasCerradas).toEqual(['clasificatoria', 'semifinal']);
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

  it('las mujeres escalan W y los hombres M: 6, 5 y 4 bloques por ronda', () => {
    demo.turnos.forEach((t) => {
      expect(t.boulderId[0]).toBe(t.categoriaId.startsWith('mujeres') ? 'W' : 'M');
    });
    const cantidad = (etapaId) => new Set(demo.turnos
      .filter((t) => t.etapaId === etapaId && t.categoriaId === 'mujeres-adultas')
      .map((t) => t.boulderId)).size;
    expect([cantidad('clasificatoria'), cantidad('semifinal'), cantidad('final')]).toEqual([6, 5, 4]);
  });

  it('es determinística', () => {
    expect(generarDemo()).toEqual(demo);
  });
});
