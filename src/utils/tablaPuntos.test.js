import { describe, expect, it } from 'vitest';
import { generarTablaPuntos, parsearTablaPuntos, tablaACsv } from './tablaPuntos';

describe('tabla de puntos', () => {
  it('lee una tabla pegada desde una planilla, con encabezado y tabulaciones', () => {
    const texto = 'Boulder/Intento\t1\t2\t3\n1\t10\t8\t6\n2\t15\t11\t7\nB3\t40\t30\t25\n';
    expect(parsearTablaPuntos(texto)).toEqual({
      boulders: ['B1', 'B2', 'B3'],
      tabla: { B1: [10, 8, 6], B2: [15, 11, 7], B3: [40, 30, 25] },
      maxIntentos: 3,
    });
  });

  it('acepta comas o punto y coma, filas de distinto largo y valores sin fórmula', () => {
    expect(parsearTablaPuntos('1;100;50\n2,300,200,150,120')).toEqual({
      boulders: ['B1', 'B2'],
      tabla: { B1: [100, 50], B2: [300, 200, 150, 120] },
      maxIntentos: 4,
    });
  });

  it('avisa de errores con la fila', () => {
    expect(parsearTablaPuntos('').error).toMatch(/al menos una fila/);
    expect(parsearTablaPuntos('1,10\n1,12').error).toMatch(/dos veces/);
    expect(parsearTablaPuntos('1,10\nX,12').error).toMatch(/Fila 2/);
    expect(parsearTablaPuntos('1,10,abc').error).toMatch(/números/);
    expect(parsearTablaPuntos('1').error).toMatch(/no tiene puntos/);
  });

  it('genera la cartilla clásica y vuelve a CSV sin perder datos', () => {
    const generada = generarTablaPuntos({ cantidad: 24, puntajeBase: 10, incrementoPorBloque: 2, descuentoPorIntento: 2, maxIntentos: 5 });
    expect(generada.tabla.B1).toEqual([10, 8, 6, 4, 2]);
    expect(generada.tabla.B24).toEqual([56, 54, 52, 50, 48]);
    const csv = tablaACsv(generada.boulders, generada.tabla);
    expect(csv.split('\n')[0]).toBe('Bloque,Intento 1,Intento 2,Intento 3,Intento 4,Intento 5');
    expect(parsearTablaPuntos(csv)).toEqual(generada);
  });
});
