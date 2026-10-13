// Competencia de demostración: seis categorías, clasificatoria y semifinal cerradas,
// final en curso en Mujeres Adultas.
// Todo es determinístico: cargar la demo dos veces produce los mismos resultados.
import { ordenDeSalida, posicionesDeRanking, rankingPorCategoria } from '../utils/ranking';
import { sumarMinutos } from '../utils/competicion';

export const DEMO_ID = 'demo';
export const DEMO_JUEZ = 'pdaire+juez1@gmail.com';
export const DEMO_DELEGADO = 'pdaire+delegado1@gmail.com';
export const CATEGORIA_EN_CURSO = 'mujeres-adultas';

// W de Women, M de Men: W1…Wn para mujeres y M1…Mn para hombres.
function bloques(prefijo, cantidad) {
  return Array.from({ length: cantidad }, (_, index) => `${prefijo}${index + 1}`);
}

function bloquesDe(etapa, categoria) {
  return bloques(categoria.id.startsWith('mujeres') ? 'W' : 'M', etapa.bloquesPorCategoria);
}

const CATEGORIAS = [
  {
    id: 'mujeres-sub-15', nombre: 'Mujeres Sub 15', dorsal: 101,
    nombres: ['Antonia Rojas', 'Florencia Muñoz', 'Isidora Soto', 'Josefa Contreras', 'Martina Silva', 'Emilia Sepúlveda',
      'Agustina Morales', 'Trinidad Fuentes', 'Rafaela Lillo', 'Maite Cárdenas', 'Julieta Garrido', 'Laura Peña'],
  },
  {
    id: 'hombres-sub-15', nombre: 'Hombres Sub 15', dorsal: 201,
    nombres: ['Benjamín Araya', 'Vicente Espinoza', 'Agustín Castillo', 'Tomás Tapia', 'Maximiliano Reyes', 'Joaquín Pizarro',
      'Mateo Vergara', 'Lucas Cortés', 'Facundo Ortiz', 'Simón Godoy', 'Alonso Bustos', 'Emiliano Vidal'],
  },
  {
    id: 'mujeres-sub-17', nombre: 'Mujeres Sub 17', dorsal: 301,
    nombres: ['Catalina Gutiérrez', 'Valentina Herrera', 'Fernanda Núñez', 'Javiera Bravo', 'Constanza Vega', 'Amanda Olivares',
      'Ignacia Carrasco', 'Sofía Riquelme', 'Monserrat Day', 'Renata Sanhueza', 'Colomba Ruiz', 'Elisa Parra'],
  },
  {
    id: 'hombres-sub-17', nombre: 'Hombres Sub 17', dorsal: 401,
    nombres: ['Martín Jara', 'Cristóbal Navarro', 'Diego Sandoval', 'Felipe Alarcón', 'Nicolás Valenzuela', 'Sebastián Cáceres',
      'Gaspar Salazar', 'Bastián Orellana', 'Renato Quiroz', 'Damián Moya', 'Clemente Arce', 'León Becerra'],
  },
  {
    id: 'mujeres-adultas', nombre: 'Mujeres Adultas', dorsal: 501,
    nombres: ['Camila Figueroa', 'Daniela Paredes', 'Francisca Lagos', 'Carolina Ibáñez', 'Macarena Saavedra', 'Paula Henríquez',
      'Bárbara Poblete', 'Natalia Zúñiga', 'Verónica Aravena', 'Pía Mella', 'Lorena Uribe', 'Andrea Fuenzalida'],
  },
  {
    id: 'hombres-adultos', nombre: 'Hombres Adultos', dorsal: 601,
    nombres: ['Ignacio Toro', 'Rodrigo Cifuentes', 'Pablo Miranda', 'Andrés Aguilera', 'Gonzalo Escobar', 'Matías Gallardo',
      'Francisco Molina', 'Javier Leiva', 'Cristián Olave', 'Mauricio Rebolledo', 'Esteban Carvajal', 'Hernán Venegas'],
  },
];

// En orden de competencia. `cupos`: cuántas por categoría entran a la etapa (null = todas).
const RONDAS = [
  {
    id: 'clasificatoria', nombre: 'Clasificatoria', tipo: 'qualis', bloquesPorCategoria: 6,
    duracionTurno: 5, etapaPreviaId: null, cupos: null, inicio: '09:00', separacionCategorias: 60,
  },
  {
    id: 'semifinal', nombre: 'Semifinal', tipo: 'semi', bloquesPorCategoria: 5,
    duracionTurno: 5, etapaPreviaId: 'clasificatoria', cupos: 8, inicio: '13:00', separacionCategorias: 45,
  },
  {
    id: 'final', nombre: 'Final', tipo: 'final', bloquesPorCategoria: 4,
    duracionTurno: 4, etapaPreviaId: 'semifinal', cupos: 6, inicio: '16:30', separacionCategorias: 35,
  },
];

export const ETAPA_ACTIVA = 'final';

// Documentos de etapa tal como se guardan en Firestore.
export const ETAPAS = Object.fromEntries(RONDAS.map((ronda) => [ronda.id, {
  id: ronda.id,
  nombre: ronda.nombre,
  tipo: ronda.tipo,
  boulders: [...bloques('W', ronda.bloquesPorCategoria), ...bloques('M', ronda.bloquesPorCategoria)],
  duracionTurno: ronda.duracionTurno,
  etapaPreviaId: ronda.etapaPreviaId,
}]));

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

function turno(etapaId, categoriaId, boulderId, competidorId, index, horaProgramada) {
  return {
    id: `${etapaId}-${boulderId}-${competidorId}`,
    etapaId,
    categoriaId,
    boulderId,
    competidorId,
    orden: index + 1,
    horaProgramada,
  };
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
  const posicionesPorEtapa = {};

  RONDAS.forEach((ronda) => {
    // Ranking de la etapa previa, con su propio desempate, para elegir clasificadas.
    const rankingPrevio = ronda.etapaPreviaId
      ? rankingPorCategoria({
        competidores, turnos, resultados, etapaId: ronda.etapaPreviaId,
        posicionesPrevias: posicionesPorEtapa[RONDAS.find((r) => r.id === ronda.etapaPreviaId).etapaPreviaId] || new Map(),
      })
      : null;

    CATEGORIAS.forEach((categoria, indiceCategoria) => {
      // Clasificatoria en orden de dorsal; las demás, al revés del ranking previo.
      const orden = rankingPrevio
        ? ordenDeSalida(rankingPrevio.find((g) => g.categoriaId === categoria.id).filas, ronda.cupos).slice(-ronda.cupos)
        : competidores.filter((c) => c.categoriaId === categoria.id);
      const enCurso = ronda.id === ETAPA_ACTIVA && categoria.id === CATEGORIA_EN_CURSO;
      const inicioCategoria = sumarMinutos(ronda.inicio, indiceCategoria * ronda.separacionCategorias);
      const bloquesCategoria = bloquesDe(ronda, categoria);

      bloquesCategoria.forEach((boulderId, indiceBloque) => {
        const dificultad = 0.2 + (azar() * 0.5);
        orden.forEach((competidor, index) => {
          turnos.push(turno(ronda.id, categoria.id, boulderId, competidor.id, index,
            sumarMinutos(inicioCategoria, (index + indiceBloque) * ronda.duracionTurno)));
          // En la categoría en curso, la competidora `index` ya terminó los bloques
          // anteriores a `n - index` y está escalando el siguiente.
          const terminados = enCurso ? bloquesCategoria.length - index : bloquesCategoria.length;
          if (indiceBloque < terminados) {
            resultados.push({
              etapaId: ronda.id, competidorId: competidor.id, boulderId,
              ...simularBloque(azar, nivel[competidor.id], dificultad, 2 + Math.floor(azar() * 5)),
            });
          } else if (indiceBloque === terminados) {
            const parcial = simularBloque(azar, nivel[competidor.id], dificultad, 1 + Math.floor(azar() * 2));
            resultados.push({
              etapaId: ronda.id, competidorId: competidor.id, boulderId,
              intentos: parcial.intentos,
              zonaEnIntento: parcial.zonaEnIntento,
              topEnIntento: null,
            });
          }
        });
      });
    });

    posicionesPorEtapa[ronda.id] = posicionesDeRanking(rankingPorCategoria({
      competidores, turnos, resultados, etapaId: ronda.id,
      posicionesPrevias: posicionesPorEtapa[ronda.etapaPreviaId] || new Map(),
    }));
  });

  return {
    competidores,
    turnos,
    resultados,
    etapasCerradas: RONDAS.map((r) => r.id).filter((id) => id !== ETAPA_ACTIVA),
    categoriasCerradasFinal: CATEGORIAS.map((item) => item.id).filter((id) => id !== CATEGORIA_EN_CURSO),
  };
}
