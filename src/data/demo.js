// Competencia de demostración: seis categorías, clasificatoria cerrada y final en curso.
// Todo es determinístico: cargar la demo dos veces produce los mismos resultados.
import { ordenDeSalida, rankingPorCategoria } from '../utils/ranking';
import { sumarMinutos } from '../utils/competicion';

export const DEMO_ID = 'demo';
export const DEMO_JUEZ = 'pdaire+juez1@gmail.com';
export const DEMO_DELEGADO = 'pdaire+delegado1@gmail.com';
export const CATEGORIA_EN_CURSO = 'mujeres-adultas';

const CUPOS_FINAL = 6;
// W de Women, M de Men.
const BLOQUES_MUJERES = ['W1', 'W2', 'W3', 'W4'];
const BLOQUES_HOMBRES = ['M1', 'M2', 'M3', 'M4'];

function bloquesDe(categoria) {
  return categoria.id.startsWith('mujeres') ? BLOQUES_MUJERES : BLOQUES_HOMBRES;
}
const INTERVALO = 4;

const CATEGORIAS = [
  {
    id: 'mujeres-sub-15', nombre: 'Mujeres Sub 15', dorsal: 101,
    nombres: ['Antonia Rojas', 'Florencia Muñoz', 'Isidora Soto', 'Josefa Contreras', 'Martina Silva', 'Emilia Sepúlveda', 'Agustina Morales', 'Trinidad Fuentes'],
  },
  {
    id: 'hombres-sub-15', nombre: 'Hombres Sub 15', dorsal: 201,
    nombres: ['Benjamín Araya', 'Vicente Espinoza', 'Agustín Castillo', 'Tomás Tapia', 'Maximiliano Reyes', 'Joaquín Pizarro', 'Mateo Vergara', 'Lucas Cortés'],
  },
  {
    id: 'mujeres-sub-17', nombre: 'Mujeres Sub 17', dorsal: 301,
    nombres: ['Catalina Gutiérrez', 'Valentina Herrera', 'Fernanda Núñez', 'Javiera Bravo', 'Constanza Vega', 'Amanda Olivares', 'Ignacia Carrasco', 'Sofía Riquelme'],
  },
  {
    id: 'hombres-sub-17', nombre: 'Hombres Sub 17', dorsal: 401,
    nombres: ['Martín Jara', 'Cristóbal Navarro', 'Diego Sandoval', 'Felipe Alarcón', 'Nicolás Valenzuela', 'Sebastián Cáceres', 'Gaspar Salazar', 'Bastián Orellana'],
  },
  {
    id: 'mujeres-adultas', nombre: 'Mujeres Adultas', dorsal: 501,
    nombres: ['Camila Figueroa', 'Daniela Paredes', 'Francisca Lagos', 'Carolina Ibáñez', 'Macarena Saavedra', 'Paula Henríquez', 'Bárbara Poblete', 'Natalia Zúñiga'],
  },
  {
    id: 'hombres-adultos', nombre: 'Hombres Adultos', dorsal: 601,
    nombres: ['Ignacio Toro', 'Rodrigo Cifuentes', 'Pablo Miranda', 'Andrés Aguilera', 'Gonzalo Escobar', 'Matías Gallardo', 'Francisco Molina', 'Javier Leiva'],
  },
];

export const ETAPAS = {
  clasificatoria: {
    id: 'clasificatoria',
    nombre: 'Clasificatoria',
    tipo: 'qualis',
    boulders: [...BLOQUES_MUJERES, ...BLOQUES_HOMBRES],
    duracionTurno: 5,
    etapaPreviaId: null,
    inicio: '10:00',
  },
  final: {
    id: 'final',
    nombre: 'Final',
    tipo: 'final',
    boulders: [...BLOQUES_MUJERES, ...BLOQUES_HOMBRES],
    duracionTurno: INTERVALO,
    etapaPreviaId: 'clasificatoria',
    inicio: '15:00',
  },
};

function generador(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6D2B79F5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function acotar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

// Simula un bloque intento por intento. `maxIntentos` es lo que alcanzó a probar en su turno.
function simularBloque(azar, nivel, dificultad, maxIntentos) {
  const pZona = acotar(0.25 + nivel - (dificultad * 0.6), 0.05, 0.9);
  const pTop = acotar(nivel - dificultad + 0.05, 0.02, 0.75);
  let zonaEnIntento = null;
  let topEnIntento = null;
  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    if (zonaEnIntento == null && azar() < pZona) zonaEnIntento = intento;
    if (zonaEnIntento != null && azar() < pTop) {
      topEnIntento = intento;
      break;
    }
  }
  return { intentos: topEnIntento ?? maxIntentos, zonaEnIntento, topEnIntento };
}

export function generarDemo() {
  const azar = generador(2026);
  const competidores = [];
  const nivel = {};

  CATEGORIAS.forEach((categoria) => {
    categoria.nombres.forEach((nombre, index) => {
      const dorsal = String(categoria.dorsal + index);
      const id = `${categoria.id}-${dorsal}`;
      competidores.push({ id, dorsal, nombre, categoria: categoria.nombre, categoriaId: categoria.id });
      nivel[id] = 0.3 + (azar() * 0.55);
    });
  });

  const turnos = [];
  const resultados = [];

  // Clasificatoria: todas las competidoras, en orden de dorsal. Cada categoría parte una hora después.
  const clasificatoria = ETAPAS.clasificatoria;
  CATEGORIAS.forEach((categoria, indiceCategoria) => {
    const lista = competidores.filter((item) => item.categoriaId === categoria.id);
    const inicioCategoria = sumarMinutos(clasificatoria.inicio, indiceCategoria * 60);
    bloquesDe(categoria).forEach((boulderId, indiceBloque) => {
      const dificultad = 0.15 + (azar() * 0.5);
      lista.forEach((competidor, index) => {
        turnos.push(turno(clasificatoria, categoria.id, boulderId, competidor.id, index,
          sumarMinutos(inicioCategoria, (index + indiceBloque) * clasificatoria.duracionTurno)));
        const maxIntentos = 3 + Math.floor(azar() * 4);
        resultados.push({
          etapaId: clasificatoria.id, competidorId: competidor.id, boulderId,
          ...simularBloque(azar, nivel[competidor.id], dificultad, maxIntentos),
        });
      });
    });
  });

  // Final: las primeras de cada categoría en la clasificatoria, en orden inverso al ranking.
  const final = ETAPAS.final;
  const rankingClasificatoria = rankingPorCategoria({
    competidores, turnos, resultados, etapaId: clasificatoria.id,
  });
  CATEGORIAS.forEach((categoria, indiceCategoria) => {
    const grupo = rankingClasificatoria.find((item) => item.categoriaId === categoria.id);
    const orden = ordenDeSalida(grupo.filas, CUPOS_FINAL).slice(-CUPOS_FINAL);
    const enCurso = categoria.id === CATEGORIA_EN_CURSO;
    const inicioCategoria = sumarMinutos(final.inicio, indiceCategoria * 45);
    const bloques = bloquesDe(categoria);
    bloques.forEach((boulderId, indiceBloque) => {
      const dificultad = 0.3 + (azar() * 0.45);
      orden.forEach((fila, index) => {
        turnos.push(turno(final, categoria.id, boulderId, fila.id, index,
          sumarMinutos(inicioCategoria, (index + indiceBloque) * INTERVALO)));
        // En la categoría en curso, la competidora `index` ya terminó los bloques
        // anteriores a `4 - index` y está escalando el siguiente.
        const bloquesTerminados = enCurso ? bloques.length - index : bloques.length;
        if (indiceBloque < bloquesTerminados) {
          const maxIntentos = 2 + Math.floor(azar() * 4);
          resultados.push({
            etapaId: final.id, competidorId: fila.id, boulderId,
            ...simularBloque(azar, nivel[fila.id], dificultad, maxIntentos),
          });
        } else if (indiceBloque === bloquesTerminados) {
          const parcial = simularBloque(azar, nivel[fila.id], dificultad, 1 + Math.floor(azar() * 2));
          resultados.push({
            etapaId: final.id, competidorId: fila.id, boulderId,
            intentos: parcial.intentos,
            zonaEnIntento: parcial.zonaEnIntento,
            topEnIntento: null,
          });
        }
      });
    });
  });

  return {
    competidores,
    turnos,
    resultados,
    categoriasCerradasFinal: CATEGORIAS.map((item) => item.id).filter((id) => id !== CATEGORIA_EN_CURSO),
  };
}

function turno(etapa, categoriaId, boulderId, competidorId, index, horaProgramada) {
  return {
    id: `${etapa.id}-${boulderId}-${competidorId}`,
    etapaId: etapa.id,
    categoriaId,
    boulderId,
    competidorId,
    orden: index + 1,
    horaProgramada,
  };
}
