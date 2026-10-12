export const CATEGORIA = {
  id: 'absoluta_damas',
  nombre: 'Absoluta Damas',
};

export const BOULDERS = ['M1', 'M2', 'M3', 'M4'];

const ORDEN_DORSALES = ['9', '6', '3', '4', '1', '2'];

const INICIO_BLOQUE = {
  M1: '15:15',
  M2: '15:31',
  M3: '15:47',
  M4: '16:03',
};

export const COMPETIDORES = [
  { id: 'abs_damas_9', dorsal: '9', nombre: 'Gabriela Sandoval' },
  { id: 'abs_damas_6', dorsal: '6', nombre: 'Beatriz Rozas' },
  { id: 'abs_damas_3', dorsal: '3', nombre: 'Alejandra Contreras' },
  { id: 'abs_damas_4', dorsal: '4', nombre: 'Camila González' },
  { id: 'abs_damas_1', dorsal: '1', nombre: 'Muykuay Silva' },
  { id: 'abs_damas_2', dorsal: '2', nombre: 'Martina Castro' },
].map((competidor) => ({
  ...competidor,
  categoria: CATEGORIA.nombre,
  categoriaId: CATEGORIA.id,
}));

function sumarMinutos(hora, minutos) {
  const [horas, mins] = hora.split(':').map(Number);
  const total = horas * 60 + mins + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function turnosDe(boulderId) {
  const inicio = INICIO_BLOQUE[boulderId] ?? INICIO_BLOQUE.M1;
  return ORDEN_DORSALES.map((dorsal, index) => ({
    orden: index + 1,
    hora: sumarMinutos(inicio, index * 4),
    competidor: COMPETIDORES.find((competidor) => competidor.dorsal === dorsal),
  }));
}

export function buscarPorDorsal(texto) {
  const consulta = texto.trim();
  if (!consulta) return [];
  return COMPETIDORES.filter((competidor) => competidor.dorsal.startsWith(consulta));
}
