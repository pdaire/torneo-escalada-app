import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import writeExcelFile from 'write-excel-file/node';
import { demoPrincipal } from '../data/demo';
import { demoPrimavera } from '../data/demoPrimavera';
import { construirLibro, nombreArchivo } from './exportacion';

const generado = new Date(2026, 9, 16, 18, 30);

function libroDe(demo, extra = {}) {
  return construirLibro({
    competencia: { id: demo.id, nombre: demo.nombre, fecha: '2026-10-16', club: 'Club', lugar: 'Muro' },
    etapas: demo.etapas.map((etapa) => ({
      ...etapa,
      activa: etapa.id === demo.etapaActiva,
      estado: demo.etapasCerradas.includes(etapa.id) ? 'cerrada' : 'abierta',
      categoriasCerradas: demo.categoriasCerradas[etapa.id] || [],
    })),
    competidores: demo.competidores,
    turnos: demo.turnos,
    resultados: demo.resultados.map((r) => ({ ...r, actualizadoPor: 'juez@club.cl', actualizadoEn: generado })),
    generado,
    ...extra,
  });
}

const valor = (celda) => (celda && typeof celda === 'object' && !(celda instanceof Date) ? celda.value : celda);

describe('exportación a Excel', () => {
  it('demo completa: resumen, una hoja por etapa en orden, resultados y competidores', () => {
    const hojas = libroDe(demoPrincipal());
    expect(hojas.map((h) => h.sheet)).toEqual(['Resumen', 'Clasificatoria', 'Semifinal', 'Final', 'Resultados', 'Competidores']);
    const resumen = hojas[0].data;
    expect(valor(resumen[0][0])).toBe('Competencia demo');
    expect(resumen.slice(8).map((fila) => [fila[0], fila[1], fila[2], fila[3]])).toEqual([
      ['Clasificatoria', 'Ronda americana', 'Cerrada', 72],
      ['Semifinal', 'World Climbing', 'Cerrada', 48],
      ['Final', 'World Climbing', 'Abierta (activa)', 36],
    ]);
  });

  it('hoja americana: puntaje, tops, bloques que suman y ✓/✗ por bloque', () => {
    const [, clasificatoria] = libroDe(demoPrincipal());
    const [titulos, primera] = clasificatoria.data;
    expect(titulos.slice(0, 7).map(valor)).toEqual(['Categoría', 'Pos', 'Dorsal', 'Nombre', 'Puntaje', 'Tops', 'Suman (5 mejores)']);
    expect(titulos).toHaveLength(7 + 24);
    expect(primera[1]).toBe(1);
    expect(typeof valor(primera[4])).toBe('number');
    expect(primera[6]).toMatch(/^B\d+ \(\d+\)(, B\d+ \(\d+\)){4}$/);
    const porBloque = primera.slice(7).filter(Boolean);
    porBloque.forEach((texto) => expect(texto).toMatch(/^[✓✗][1-5]$/));
  });

  it('hoja World Climbing: top y zona por bloque y puntaje con un decimal', () => {
    const final = libroDe(demoPrincipal())[3];
    const [titulos, ...filas] = final.data;
    expect(titulos.map(valor)).toEqual(['Categoría', 'Pos', 'Dorsal', 'Nombre', 'W1', 'W2', 'W3', 'W4', 'M1', 'M2', 'M3', 'M4', 'Puntaje', 'Desempate (pos. etapa previa)']);
    const conTop = filas.flatMap((f) => f.slice(4, 12)).find((texto) => texto && texto.startsWith('T'));
    expect(conTop).toMatch(/^T\d z\d$/);
    const puntaje = filas[0][12];
    expect(puntaje.format).toBe('0.0');
    expect(puntaje.value * 10).toBeCloseTo(Math.round(puntaje.value * 10));
  });

  it('hoja Resultados: una fila por bloque anotado, con autor y fecha', () => {
    const demo = demoPrimavera();
    const hojas = libroDe(demo);
    const resultados = hojas.find((h) => h.sheet === 'Resultados').data;
    expect(resultados).toHaveLength(1 + demo.resultados.length);
    const fila = resultados[1];
    expect(fila[0]).toBe('Ronda americana');
    expect(['Sí', 'No']).toContain(fila[9]);
    expect(fila[10]).toBe('juez@club.cl');
    expect(valor(fila[11])).toEqual(generado);
  });

  it('apelaciones en su hoja solo si hay', () => {
    const demo = demoPrimavera();
    expect(libroDe(demo).some((h) => h.sheet === 'Apelaciones')).toBe(false);
    const hojas = libroDe(demo, {
      apelaciones: [{ etapaId: 'ronda-americana', tipo: 'resultado', estado: 'aceptada', dorsal: '4', competidorNombre: 'Benjamín Soto',
        boulderId: 'B3', argumento: 'Encadenó en el segundo intento.', autorEmail: 'delegado@club.cl', resueltaPor: 'jefe@club.cl', creadaEn: generado }],
    });
    const apelaciones = hojas.find((h) => h.sheet === 'Apelaciones').data;
    expect(apelaciones[1].slice(1, 8)).toEqual(['Ronda americana', 'Resultado', 'Aceptada', 4, 'Benjamín Soto', 'B3', 'Encadenó en el segundo intento.']);
  });

  it('nombres de hoja válidos para Excel y únicos', () => {
    const hojas = construirLibro({
      competencia: { id: 'x', nombre: 'X' },
      etapas: [
        { id: 'a', nombre: 'Final: hombres/mujeres [A] con un nombre larguísimo', boulders: [] },
        { id: 'b', nombre: 'Resultados', boulders: [] },
      ],
      competidores: [], turnos: [], resultados: [],
    });
    const nombres = hojas.map((h) => h.sheet);
    nombres.forEach((nombre) => {
      expect(nombre.length).toBeLessThanOrEqual(31);
      expect(nombre).not.toMatch(/[[\]:*?/\\]/);
    });
    expect(new Set(nombres.map((n) => n.toLowerCase())).size).toBe(nombres.length);
  });

  it('nombre del archivo con la dirección y la fecha', () => {
    expect(nombreArchivo({ id: 'copa-chile' }, generado)).toBe('copa-chile-resultados-2026-10-16.xlsx');
  });

  it('genera un .xlsx válido con todas las hojas', async () => {
    const hojas = libroDe(demoPrincipal());
    const buffer = await writeExcelFile(hojas.map(({ sheet, data, columns, stickyRowsCount, stickyColumnsCount }) => ({
      sheet, data, columns, stickyRowsCount, stickyColumnsCount,
    }))).toBuffer();
    const carpeta = mkdtempSync(join(tmpdir(), 'excel-'));
    const archivo = join(carpeta, 'libro.xlsx');
    writeFileSync(archivo, buffer);
    try {
      const libro = execFileSync('unzip', ['-p', archivo, 'xl/workbook.xml']).toString();
      ['Resumen', 'Clasificatoria', 'Semifinal', 'Final', 'Resultados', 'Competidores']
        .forEach((nombre) => expect(libro).toContain(`name="${nombre}"`));
      const textos = execFileSync('unzip', ['-p', archivo, 'xl/sharedStrings.xml']).toString();
      expect(textos).toContain('Competencia demo');
      expect(textos).toContain('Mujeres Adultas');
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });
});
