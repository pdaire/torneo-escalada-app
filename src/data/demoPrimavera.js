// Demo chica: "Primavera - El Muro", una sola categoría (General) en ronda americana,
// con 20 competidores y la ronda en curso. Determinística, como la demo principal.
import { AMERICANA_POR_DEFECTO } from '../utils/score';
import { generarTablaPuntos } from '../utils/tablaPuntos';
import { generador, sectoresDemo, simularAmericana } from './demo';

export const PRIMAVERA_ID = 'primavera-el-muro';
const ETAPA_ID = 'ronda-americana';

const NOMBRES = [
  'Sofía Álvarez', 'Matías Rojas', 'Valentina Pérez', 'Benjamín Soto', 'Isidora Fuentes',
  'Tomás Navarro', 'Florencia Díaz', 'Agustín Morales', 'Catalina Reyes', 'Vicente Herrera',
  'Antonia Castro', 'Joaquín Vargas', 'Martina Ortiz', 'Lucas Sepúlveda', 'Emilia Torres',
  'Diego Muñoz', 'Javiera Rivera', 'Sebastián Contreras', 'Josefa Espinoza', 'Nicolás Silva',
];

function etapaPrimavera() {
  const { boulders, tabla, maxIntentos } = generarTablaPuntos({ ...AMERICANA_POR_DEFECTO, cantidad: 20 });
  return {
    id: ETAPA_ID,
    nombre: 'Ronda americana',
    tipo: 'qualis',
    formato: 'americana',
    etapaPreviaId: null,
    boulders,
    tablaPuntos: tabla,
    maxIntentos,
    mejoresBloques: AMERICANA_POR_DEFECTO.mejoresBloques,
    sectores: sectoresDemo(boulders),
  };
}

export function demoPrimavera() {
  const azar = generador(2027);
  const etapa = etapaPrimavera();
  const competidores = NOMBRES.map((nombre, index) => ({
    id: `general-${index + 1}`,
    dorsal: String(index + 1),
    nombre,
    categoria: 'General',
    categoriaId: 'general',
  }));

  // La ronda va a la mitad: cada uno lleva una parte de los bloques que va a probar,
  // empezando por los más fáciles. Los dos últimos dorsales recién llegan.
  const resultados = competidores.flatMap((competidor, index) => {
    const nivel = 0.3 + (azar() * 0.55);
    const intentados = simularAmericana(azar, nivel, etapa);
    const avance = index >= competidores.length - 2 ? 0 : 0.35 + (azar() * 0.5);
    return intentados
      .slice(0, Math.round(intentados.length * avance))
      .map((resultado) => ({ etapaId: etapa.id, competidorId: competidor.id, ...resultado }));
  });

  return {
    id: PRIMAVERA_ID,
    nombre: 'Primavera - El Muro',
    etapas: [etapa],
    etapaActiva: etapa.id,
    competidores,
    turnos: [],
    resultados,
    etapasCerradas: [],
    categoriasCerradas: {},
    asignacionesJuez: { [etapa.id]: [...etapa.sectores.A, ...etapa.sectores.B] },
  };
}
