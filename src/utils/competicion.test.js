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

describe('importar competidores', async () => {
  const { parsearCompetidoresCsv } = await import('./competicion');

  it('acepta coma, punto y coma y tabulación (copiado desde Excel), con encabezado', () => {
    const { competidores, descartadas } = parsearCompetidoresCsv('dorsal\tnombre\tcategoria\n60\tTor-kjetil Johansen\tExperto Varones\r\n44;Florencia Encina;Experto Damas\n61,Håkon-Aleksander,Novicio Varones\n');
    expect(descartadas).toEqual([]);
    expect(competidores).toEqual([
      { id: 'experto-varones-60', dorsal: '60', nombre: 'Tor-kjetil Johansen', categoria: 'Experto Varones', categoriaId: 'experto-varones' },
      { id: 'experto-damas-44', dorsal: '44', nombre: 'Florencia Encina', categoria: 'Experto Damas', categoriaId: 'experto-damas' },
      { id: 'novicio-varones-61', dorsal: '61', nombre: 'Håkon-Aleksander', categoria: 'Novicio Varones', categoriaId: 'novicio-varones' },
    ]);
  });

  it('informa las líneas incompletas y los dorsales repetidos en una categoría', () => {
    const { competidores, descartadas } = parsearCompetidoresCsv('1,Ana,General\n2,Bea\n1,Otra,General\n1,Carla,Damas');
    expect(competidores.map((c) => c.id)).toEqual(['general-1', 'damas-1']);
    expect(descartadas.map((d) => d.linea)).toEqual([2, 3]);
    expect(descartadas[1].motivo).toMatch(/repetido/);
  });

});
