# Pantallas

| Ruta | Quién la usa | Qué hace |
| --- | --- | --- |
| `/` | Público | Ranking en vivo de la etapa activa |
| `/juez` | Juez | Anota intentos, zona y top en un bloque |
| `/admin` | Organización | Arma la competencia, el orden de paso y la asignación de jueces |
| `/delegado` | Delegado de club | Presenta apelaciones particulares o generales |

## Tablero `/`

Muestra la competencia activa y su etapa activa. Lista a todas las competidoras que tienen un turno en esa etapa, aunque todavía no tengan puntaje.

Cada bloque muestra, como en las transmisiones de la IFSC, un rectángulo vacío, medio lleno o lleno según no haya zona, haya zona o haya top. Al lado van dos números:

- `T` es el intento en que se hizo el top.
- `z` es el intento en que se hizo la zona.
- `–` significa que todavía no se consiguió.

La última columna es el puntaje IFSC de la ronda. La tabla se ordena por ese puntaje. Con el mismo puntaje se comparte posición, y dentro del empate se ordena por dorsal. Ver [Puntuación](puntuacion.md).

## Tablet del juez `/juez`

1. Entra con el correo y el PIN de Firebase Auth.
2. Elige el bloque. Si la etapa tiene una asignación para ese correo, el bloque queda preseleccionado. Igual se puede cambiar. La elección se guarda en el navegador.
3. **Siguiente** y **Anterior** recorren el orden de paso de ese bloque.
4. **Buscar dorsal** elige a alguien fuera de ese orden. **Siguiente** no sigue a la persona buscada: vuelve al orden programado.
5. **Después en este bloque** salta directo a una competidora que todavía no ha pasado.
6. **+ Intento** suma un intento. **Marcar zona** y **Marcar top** no suman: guardan el intento actual. El top queda bloqueado para nuevos intentos.
7. **Editar** corrige el marcador después de un error o una apelación aceptada.
8. **Apelaciones** muestra las que están en evaluación. El juez puede aceptarlas o rechazarlas.

Sin una etapa activa, la pantalla pide ir a administrar.

## Administración `/admin`

Misma sesión de Firebase Auth que la tablet.

1. Crear una competencia, o cargar el ejemplo Baguales 2026.
2. Marcar una competencia como activa. Solo una queda activa.
3. Agregar etapas (qualis, semifinal, final), sus bloques y la duración del turno. Marcar una como activa.
4. Cargar competidores uno a uno o con CSV `dorsal,nombre,categoria`.
5. Generar el orden de paso por etapa, categoría y bloque. Reordenarlo con Subir y Bajar.
6. Asignar el correo de un juez a un bloque de una etapa.

El ejemplo Baguales 2026 crea la final de Absoluta Damas, seis competidoras y el orden de los cuatro bloques. Es un dato de prueba, no la fuente de cada torneo.

## Delegados `/delegado`

El delegado entra con correo y PIN de Firebase Auth, igual que un juez.

Puede presentar:

- **Resultado particular:** elige competidora y bloque, ve el resultado actual y explica en el texto qué debe corregirse.
- **Situación general:** describe una condición que afectó la competencia completa o una parte de ella, sin asociarla a una competidora.

Puede guardar un borrador y enviarlo después a evaluación. En la tablet, el juez ve las apelaciones en evaluación y las acepta o rechaza. Esa decisión no cambia el marcador: si la acepta, corrige el resultado con Editar.
