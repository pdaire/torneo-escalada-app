import { describe, expect, it } from 'vitest';
import { rutas, slug, validarSlug } from './competicion';

describe('nombre de la competencia en la URL', () => {
  it('sugiere un slug desde el nombre', () => {
    expect(slug('Primavera - El Muro')).toBe('primavera-el-muro');
    expect(slug('Copa Chile 2026')).toBe('copa-chile-2026');
  });

  it('acepta slugs válidos y rechaza los inválidos, reservados o repetidos', () => {
    expect(validarSlug('copa-chile-2026')).toBe('');
    expect(validarSlug('Copa Chile')).toMatch(/minúsculas/);
    expect(validarSlug('-copa')).toMatch(/guion/);
    expect(validarSlug('ab')).toMatch(/entre 3 y 60/);
    expect(validarSlug('admin')).toMatch(/reservado/);
    expect(validarSlug('juez.webmanifest')).toMatch(/minúsculas/);
    expect(validarSlug('baguales-2026', ['baguales-2026'])).toMatch(/Ya existe/);
  });

  it('arma las rutas de la competencia', () => {
    expect(rutas.juez('copa-chile')).toBe('/copa-chile/juez');
    expect(rutas.tablero('copa-chile', { etapa: 'final' })).toBe('/copa-chile?etapa=final');
    expect(rutas.competidor('copa-chile', 'general-4')).toBe('/copa-chile/competidor/general-4');
  });
});
