// Plantillas para crear una competencia con sus etapas ya armadas.
// El organizador después solo carga competidores y jueces (y ajusta lo que quiera).
import { AMERICANA_POR_DEFECTO } from '../utils/score';
import { generarTablaPorSector, generarTablaPuntos } from '../utils/tablaPuntos';

const ETAPA_BASE = { estado: 'abierta', categoriasCerradas: [] };

// Cuatro sectores con bloques intercalados por dificultad: A = 1, 5, 9…; B = 2, 6, 10…
function sectores(boulders) {
  const resultado = { A: [], B: [], C: [], D: [] };
  boulders.forEach((id, index) => resultado['ABCD'[index % 4]].push(id));
  return resultado;
}

function rondaAmericana(id, nombre, tipo, cantidad) {
  const { boulders, tabla, maxIntentos } = generarTablaPuntos({ ...AMERICANA_POR_DEFECTO, cantidad });
  return {
    ...ETAPA_BASE,
    id,
    nombre,
    tipo,
    formato: 'americana',
    boulders,
    tablaPuntos: tabla,
    maxIntentos,
    mejoresBloques: AMERICANA_POR_DEFECTO.mejoresBloques,
    sectores: sectores(boulders),
    etapaPreviaId: null,
  };
}

export const PLANTILLAS = [
  {
    id: 'vacia',
    nombre: 'Vacía',
    descripcion: 'Sin etapas: las armo después en el admin de la competencia.',
    etapas: () => [],
  },
  {
    id: 'americana',
    nombre: 'Ronda americana',
    descripcion: '1 etapa, 24 bloques B1–B24 en 4 sectores, tabla clásica (10, 8, 6…), suman los 5 mejores.',
    etapas: () => [{ ...rondaAmericana('ronda-americana', 'Ronda americana', 'qualis', 24), activa: true }],
  },
  {
    id: 'americana-sectores',
    nombre: 'Ronda americana por sectores',
    descripcion: '1 etapa, 3 sectores con numeración propia (A1–A7, B1–B7, C1–C7). Cada bloque tiene su propia fila de puntos; parte con la misma tabla en cada sector.',
    etapas: () => {
      const { boulders, tabla, maxIntentos, sectores } = generarTablaPorSector({
        ...AMERICANA_POR_DEFECTO, sectores: ['A', 'B', 'C'], bloquesPorSector: 7,
      });
      return [{
        ...ETAPA_BASE,
        id: 'ronda-americana',
        nombre: 'Ronda americana',
        tipo: 'qualis',
        formato: 'americana',
        numeracion: 'sector',
        boulders,
        tablaPuntos: tabla,
        maxIntentos,
        mejoresBloques: AMERICANA_POR_DEFECTO.mejoresBloques,
        sectores,
        etapaPreviaId: null,
        activa: true,
      }];
    },
  },
  {
    id: 'americana-final',
    nombre: 'Clasificatoria americana + final World Climbing',
    descripcion: 'Clasificatoria de 24 bloques (activa) y final de 4 bloques por categoría (W1–W4, M1–M4) que desempata con la clasificatoria.',
    etapas: () => [
      { ...rondaAmericana('clasificatoria', 'Clasificatoria', 'qualis', 24), activa: true },
      {
        ...ETAPA_BASE,
        id: 'final',
        nombre: 'Final',
        tipo: 'final',
        formato: 'wc',
        boulders: ['W1', 'W2', 'W3', 'W4', 'M1', 'M2', 'M3', 'M4'],
        duracionTurno: 4,
        etapaPreviaId: 'clasificatoria',
        activa: false,
      },
    ],
  },
];

export function plantilla(id) {
  return PLANTILLAS.find((item) => item.id === id) || PLANTILLAS[0];
}

// Texto para mandarle al organizador (WhatsApp o correo) con sus direcciones y los primeros pasos.
export function mensajeParaOrganizador({ origen, competencia, correoOrganizador }) {
  const base = `${origen}/${competencia.id}`;
  return [
    `¡Hola! Ya está creada la competencia "${competencia.nombre}".`,
    '',
    `Administración: ${base}/admin`,
    correoOrganizador
      ? `Entra con ${correoOrganizador} y la clave que te enviaré por separado.`
      : 'Te enviaré tu usuario y clave por separado.',
    '',
    'Primeros pasos:',
    '1. Revisa las etapas y, si es ronda americana, los sectores y la tabla de puntos.',
    '2. Carga los competidores (se puede pegar un CSV: dorsal,nombre,categoria).',
    '3. Agrega a tus jueces y delegados por correo y asígnales bloques o sectores.',
    '',
    `Jueces (se puede instalar como app): ${base}/juez`,
    `Delegados: ${base}/delegado`,
    `Resultados en vivo para el público: ${base}`,
  ].join('\n');
}
