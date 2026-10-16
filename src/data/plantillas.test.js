import { describe, expect, it } from 'vitest';
import { PLANTILLAS, mensajeParaOrganizador, plantilla } from './plantillas';

describe('plantillas de competencia', () => {
  it('vacía no crea etapas', () => {
    expect(plantilla('vacia').etapas()).toEqual([]);
  });

  it('ronda americana: una etapa activa con tabla clásica y 4 sectores que cubren los 24 bloques', () => {
    const [etapa] = plantilla('americana').etapas();
    expect(etapa).toMatchObject({ formato: 'americana', activa: true, estado: 'abierta', maxIntentos: 5, mejoresBloques: 5 });
    expect(etapa.boulders).toHaveLength(24);
    expect(etapa.tablaPuntos.B1).toEqual([10, 8, 6, 4, 2]);
    expect(Object.keys(etapa.sectores)).toEqual(['A', 'B', 'C', 'D']);
    expect(Object.values(etapa.sectores).flat().sort()).toEqual(etapa.boulders.slice().sort());
    expect(etapa.sectores.A.slice(0, 3)).toEqual(['B1', 'B5', 'B9']);
  });

  it('ronda americana por sectores: 3 sectores con numeración propia y puntos por bloque', () => {
    const [etapa] = plantilla('americana-sectores').etapas();
    expect(etapa).toMatchObject({ formato: 'americana', numeracion: 'sector', activa: true });
    expect(etapa.boulders).toHaveLength(21);
    expect(etapa.sectores).toEqual({
      A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
      B: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'],
      C: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
    });
    expect(etapa.tablaPuntos.B1).toEqual([10, 8, 6, 4, 2]);
  });

  it('clasificatoria americana + final: la final desempata con la clasificatoria y solo una etapa queda activa', () => {
    const etapas = plantilla('americana-final').etapas();
    expect(etapas.map((e) => [e.id, e.formato, e.activa])).toEqual([['clasificatoria', 'americana', true], ['final', 'wc', false]]);
    expect(etapas[1].etapaPreviaId).toBe('clasificatoria');
  });

  it('cada plantilla tiene nombre y descripción, y una desconocida cae en vacía', () => {
    PLANTILLAS.forEach((item) => expect(item.nombre && item.descripcion).toBeTruthy());
    expect(plantilla('otra').id).toBe('vacia');
  });

  it('el mensaje para el organizador trae sus direcciones', () => {
    const texto = mensajeParaOrganizador({
      origen: 'https://torneo-escalada-app.web.app',
      competencia: { id: 'copa-chile-2026', nombre: 'Copa Chile 2026' },
      correoOrganizador: 'org@club.cl',
    });
    expect(texto).toContain('https://torneo-escalada-app.web.app/copa-chile-2026/admin');
    expect(texto).toContain('https://torneo-escalada-app.web.app/copa-chile-2026/juez');
    expect(texto).toContain('org@club.cl');
  });
});
