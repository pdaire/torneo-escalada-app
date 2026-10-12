/**
 * Motor de ordenamiento (Búlder)
 * Criterio de jerarquía estricta:
 * 1. Tops (T) -> Mayor a menor
 * 2. Zonas (z) -> Mayor a menor
 * 3. Intentos a Top (aT) -> Menor a mayor
 * 4. Intentos a Zona (aZ) -> Menor a mayor
 */

export const sortScore = (a, b) => {
    // 1. Desempate por Tops
    if (b.T !== a.T) return b.T - a.T; 
    
    // 2. Desempate por Zonas
    if (b.z !== a.z) return b.z - a.z; 
    
    // 3. Desempate por Intentos a Top (Quien usa MENOS intentos, es mejor)
    const aT_val = a.T > 0 ? a.aT : 999;
    const bT_val = b.T > 0 ? b.aT : 999;
    if (aT_val !== bT_val) return aT_val - bT_val;
    
    // 4. Desempate por Intentos a Zona
    const aZ_val = a.z > 0 ? a.aZ : 999;
    const bZ_val = b.z > 0 ? b.aZ : 999;
    if (aZ_val !== bZ_val) return aZ_val - bZ_val;
    
    // Empate absoluto
    return 0; 
};
