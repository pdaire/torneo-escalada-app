// Sectores de una ronda americana: grupos de bloques que revisa un mismo juez.
// Se escriben como "A: 1, 8, 23, 32; B: 2, 9, 16" (o una línea por sector).
// Los números se convierten en los ids de la etapa (1 → B1).

export function bloquesAmericana(cantidad) {
  return Array.from({ length: cantidad }, (_, index) => `B${index + 1}`);
}

export function parsearSectores(texto, boulders) {
  const sectores = {};
  const lineas = String(texto || '').split(/[;\n]/).map((linea) => linea.trim()).filter(Boolean);
  for (const linea of lineas) {
    const [nombre, lista] = linea.split(':');
    if (!lista || !nombre.trim()) return { error: `Falta el nombre o los bloques en "${linea}". Ejemplo: A: 1, 8, 23` };
    const ids = lista.split(/[,\s]+/).filter(Boolean).map((item) => (/^\d+$/.test(item) ? `B${item}` : item.toUpperCase()));
    const desconocidos = ids.filter((id) => !boulders.includes(id));
    if (desconocidos.length) return { error: `El sector ${nombre.trim()} tiene bloques que no existen: ${desconocidos.join(', ')}.` };
    sectores[nombre.trim()] = [...new Set(ids)];
  }
  return { sectores };
}

export function textoDeSectores(sectores = {}) {
  return Object.entries(sectores)
    .map(([nombre, ids]) => `${nombre}: ${ids.map((id) => id.replace(/^B/, '')).join(', ')}`)
    .join('; ');
}

// Sectores de la etapa que incluyen al menos uno de los bloques dados, en orden.
export function sectoresDeBloques(sectores = {}, boulders = []) {
  return Object.entries(sectores)
    .filter(([, ids]) => ids.some((id) => boulders.includes(id)))
    .map(([nombre, ids]) => ({ nombre, boulders: ids }));
}
