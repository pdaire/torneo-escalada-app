# Puntuación

Se usa el sistema de puntos de búlder de la IFSC (2025). La fórmula está en `src/utils/score.js`. La validación y el documento de resultado están en `src/utils/resultado.js`.

## Puntos por bloque

| Resultado | Puntos | Ejemplo |
| --- | --- | --- |
| Top en el 1.er intento (flash) | 25.0 | 25.0 |
| Top en el intento N | 25 − 0.1 × (N − 1) | Top en 4 intentos: 25 − 0.3 = 24.7 |
| Zona en el 1.er intento, sin top | 10.0 | 10.0 |
| Zona en el intento N, sin top | 10 − 0.1 × (N − 1) | Zona en 3 intentos: 10 − 0.2 = 9.8 |
| Sin zona ni top | 0.0 | 0.0 |

Top y zona no se suman: si hay top, el bloque vale los puntos del top. Los intentos que cuentan son los fallidos antes de conseguirlo, es decir, N − 1.

## Puntaje de la ronda

Se suman los puntos de cada bloque de la etapa. En una ronda de cuatro bloques, el máximo es 100.0.

Las competidoras se ordenan de mayor a menor puntaje. Si dos tienen el mismo puntaje, comparten posición.

Los puntos se calculan en décimas enteras (25.0 son 250 décimas) para que las sumas no arrastren errores de coma flotante.

## Cómo anota el juez

| Acción | Qué guarda |
| --- | --- |
| + Intento | Suma 1 a `intentos`. No marca zona ni top. |
| Marcar zona | Guarda el intento actual en `zonaEnIntento`. No suma un intento extra. |
| Marcar top | Guarda el intento actual en `topEnIntento`. Si no había zona, la zona queda en ese mismo intento. |
| Editar | Permite corregir los tres números y valida el resultado antes de guardar. |

Zona y top se pueden marcar solo cuando ya hay al menos un intento y todavía no hay top. Después del top, + Intento queda deshabilitado.

## Validación al editar

- Los intentos totales son un entero, cero o más.
- La zona, si existe, cae entre 1 y el total.
- El top, si existe, cae entre 1 y el total.
- La zona no puede quedar en un intento posterior al top.

## Qué se ve en el tablero

En cada bloque hay un rectángulo y dos números:

| Rectángulo | Significado |
| --- | --- |
| Vacío | Sin zona |
| Medio lleno | Zona |
| Lleno | Top |

`T 4` y `z 2` significan top en el intento 4 y zona en el intento 2. `–` significa que todavía no se consiguió.

La última columna es el puntaje de la ronda con un decimal.
