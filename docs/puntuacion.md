# Puntuación

Cada etapa tiene un formato: **World Climbing** (sistema de puntos IFSC 2025) o **ronda americana**. Ver [Ronda americana](#ronda-americana) al final.

## World Climbing

Se usa el sistema de puntos de búlder de la IFSC (2025). La fórmula está en `src/utils/score.js`, el ranking en `src/utils/ranking.js` y la validación en `src/utils/resultado.js`. Los tres tienen tests.

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

Cada categoría tiene su propio ranking. Las competidoras se ordenan de mayor a menor puntaje.

Si dos tienen el mismo puntaje y la etapa tiene una etapa previa, gana la que quedó mejor en esa etapa (countback). Si siguen empatadas, comparten posición. El desempate mira solo una etapa hacia atrás.

Los puntos se calculan en décimas enteras (25.0 son 250 décimas) para que las sumas no arrastren errores de coma flotante.

## Cómo anota el juez

| Acción | Qué guarda |
| --- | --- |
| + Intento | Suma 1 a `intentos`. No marca zona ni top. |
| Marcar zona | Guarda el intento actual en `zonaEnIntento`. No suma un intento extra. |
| Marcar top | Guarda el intento actual en `topEnIntento`. Si no había zona, la zona queda en ese mismo intento. |
| Editar | Permite corregir los tres números y valida el resultado antes de guardar. |

Cada acción se guarda al instante en la tablet, también sin red, y se sincroniza al volver la conexión. Si mientras tanto otro dispositivo cambió el mismo resultado, la escritura atrasada se rechaza y la tablet vuelve al valor vigente.

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

## Ronda americana

Formato masivo y dinámico, típico de campeonatos amateur o de clasificatorias: todas escalan al mismo tiempo en distintos bloques del muro. Los bloques van numerados por dificultad (B1 el más fácil).

### Puntos

Cada etapa americana tiene su **tabla de puntos**: cuántos puntos da cada bloque según el intento en que se encadena. La definen los organizadores y no tiene que seguir ninguna fórmula. Por ejemplo:

| Bloque | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| 1 | 100 | 70 | 50 | 30 |
| 2 | 120 | 90 | 60 | 40 |
| 6 | 600 | 400 | 250 | |

La cantidad de columnas define el máximo de intentos. Un intento sin valor en la tabla (como el 4.º del bloque 6) vale 0.

En `/admin` la tabla se crea de dos formas:

- **Pegar CSV:** una fila por bloque con el número del bloque y los puntos por intento. Se puede copiar desde una planilla (tabulación, coma o punto y coma); el encabezado es opcional.
- **Generar con fórmula:** un atajo para la cartilla clásica, `base + incremento × (N − 1) − descuento × (k − 1)`. Con 10, 2 y 2 queda B1 = 10 8 6 4 2 … B24 = 56 54 52 50 48.

### Numeración por sector

Una ronda americana puede numerar sus bloques de dos formas:

| Numeración | Bloques | Sectores |
| --- | --- | --- |
| **Única** | B1, B2… B24 en toda la etapa | Se escriben aparte (`A: 1, 5, 9; B: 2, 6, 10`) y agrupan esos números |
| **Por sector** | Cada sector numera desde 1: A1…A7, B1…B7, C1…C7 | Salen de la tabla de puntos |

Por sector, A1 y B1 son bloques distintos y cada uno tiene su propia fila de puntos (si valen lo mismo, se repite el valor). La tabla lleva una columna más:

```text
Sector,Bloque,Intento 1,Intento 2,Intento 3,Intento 4,Intento 5
A,1,10,8,6,4,2
A,2,12,10,8,6,4
B,1,30,20,10
```

Agregar o quitar filas cambia los bloques de cada sector. El nombre del sector usa letras y números sin espacios (`A`, `Norte`); el bloque se muestra como `A3` o `NORTE3` (si el sector termina en número, con guion: `S1-3`). La fórmula, en este modo, genera la misma tabla en cada sector como punto de partida.

Después se revisa y edita con **Tabla de puntos**. Como los puntos no se guardan en los resultados, cambiar la tabla recalcula el tablero de inmediato.

No hay zonas: solo cuenta encadenar. Sin encadenar dentro del máximo de intentos, el bloque vale 0.

El total es la suma de los mejores bloques (5 por defecto; se configura en la etapa). Los empates comparten posición; si la etapa tiene etapa previa, desempata la posición en ella.

### Cómo anota el juez

| Acción | Qué guarda |
| --- | --- |
| ✗ Falló | Suma un intento sin encadenar. |
| ✓ Encadenó | Suma un intento y lo marca como encadenado. |
| Deshacer | Quita el último intento (y el encadenado, si lo había). |

Con el bloque encadenado o con el máximo de intentos usado, ✗ y ✓ quedan deshabilitados. Las reglas de Firestore rechazan más intentos que el máximo y un encadenado que no sea el último intento.

El cálculo está en `src/utils/score.js` (`puntosAmericana`, `puntajeDeEtapa`) y la lectura de la tabla en `src/utils/tablaPuntos.js`.
