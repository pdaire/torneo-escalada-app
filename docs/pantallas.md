# Pantallas

| Ruta | Quién la usa | Qué hace |
| --- | --- | --- |
| `/` | Público | Ranking en vivo de la etapa activa y de las etapas anteriores |
| `/competidor/:id` | Público | Todos los resultados de una competidora en la competencia |
| `/juez` | Juez | Anota intentos, zona y top en un bloque |
| `/admin` | Organización | Arma la competencia, el orden de paso y la asignación de jueces |
| `/delegado` | Delegado de club | Presenta apelaciones particulares o generales |

## Tablero `/`

Muestra la competencia activa. Arriba hay una pestaña por etapa, en orden de competencia (clasificatoria, semifinal, final). La etapa activa está marcada **En vivo** y es la que se abre por defecto. Las demás muestran sus resultados finales; la etapa elegida queda en la dirección (`/?etapa=semifinal`), así que el enlace se puede compartir.

Hay una tabla por categoría, marcada como **En curso** o **Finalizada**. Las categorías en curso van primero. Cada tabla lista a todas las competidoras que tienen un turno en esa etapa, aunque todavía no tengan puntaje, y muestra solo los bloques de esa categoría.

Cada bloque muestra, como en las transmisiones de la IFSC, un rectángulo vacío, medio lleno o lleno según no haya zona, haya zona o haya top. Al lado van dos números:

- `T` es el intento en que se hizo el top.
- `z` es el intento en que se hizo la zona.
- `–` significa que todavía no se consiguió.

La última columna es el puntaje IFSC de la ronda. La tabla se ordena por ese puntaje y desempata con la etapa previa. Si sigue el empate, se comparte posición y se ordena por dorsal. Ver [Puntuación](puntuacion.md).

Tocar un nombre abre su ficha.

## Ficha de competidora `/competidor/:id`

Una tarjeta por etapa en que participa, en orden de competencia, con:

- su posición dentro de la categoría y el puntaje de la etapa;
- si la categoría está en curso o finalizada en esa etapa;
- cada bloque con el intento de la zona, el del top, los intentos totales y los puntos;
- los bloques que todavía no escala, con su hora programada.

El nombre de la etapa lleva a esa pestaña del tablero.

## Tablet del juez `/juez`

1. Entra con el correo y el PIN de Firebase Auth. La cuenta tiene que ser juez o juez jefe en la competencia activa.
2. Elige el bloque entre los que tiene asignados en la etapa. El juez jefe ve todos. La elección se guarda en el navegador.
3. **Siguiente** y **Anterior** recorren el orden de paso de ese bloque.
4. **Buscar dorsal** elige a alguien fuera de ese orden. **Siguiente** no sigue a la persona buscada: vuelve al orden programado.
5. **Después en este bloque** salta directo a una competidora que todavía no ha pasado.
6. **+ Intento** suma un intento. **Marcar zona** y **Marcar top** no suman: guardan el intento actual. El top queda bloqueado para nuevos intentos.
7. **Editar** corrige el marcador después de un error o una apelación aceptada.
8. **Apelaciones** muestra las que están en evaluación. Solo el juez jefe puede aceptarlas o rechazarlas.

Sin red, la tablet sigue anotando y avisa que hay cambios pendientes de sincronizar. Si la etapa está cerrada, los botones quedan deshabilitados.

Sin una etapa activa, la pantalla pide ir a administrar.

## Administración `/admin`

Solo para cuentas que están en `admins`.

1. Crear una competencia, o cargar la competencia demo (ver abajo). En desarrollo (`npm run dev`) también se puede cargar el ejemplo Baguales 2026.
2. Marcar una competencia como activa. Solo una queda activa.
3. Agregar etapas (qualis, semifinal, final), sus bloques, la duración del turno y, si corresponde, la etapa previa. Marcar una como activa. **Cerrar** bloquea los resultados de la etapa. En una etapa abierta, cada categoría se puede **finalizar** por separado.
4. Cargar competidores uno a uno o con CSV `dorsal,nombre,categoria`. Una competidora con resultados no se puede quitar.
5. Generar el orden de paso por etapa, categoría y bloques marcados. Con una etapa previa, se puede generar con sus primeras N clasificadas, en orden inverso al ranking. Reordenarlo con Subir y Bajar.
6. Agregar jueces, juez jefe y delegados por correo. Asignar a cada juez uno o más bloques por etapa.

### Competencia demo

**Cargar o reiniciar competencia demo** crea la competencia `demo` y la deja activa, así que el tablero público pasa a mostrarla. Para volver a la competencia real, actívala de nuevo.

- Seis categorías (Mujeres y Hombres Sub 15, Sub 17 y Adultos), doce competidoras cada una.
- Tres rondas. Las mujeres escalan bloques W y los hombres bloques M (Women y Men):

  | Ronda | Bloques por categoría | Pasan | Estado |
  | --- | --- | --- | --- |
  | Clasificatoria | 6 (W1–W6, M1–M6) | las 12 | Cerrada |
  | Semifinal | 5 (W1–W5, M1–M5) | 8 | Cerrada |
  | Final | 4 (W1–W4, M1–M4) | 6 | Activa |

- En la final, todas las categorías están finalizadas salvo Mujeres Adultas, que está a medias: cada finalista va en un bloque distinto y la última todavía no parte. Los empates de la final se desempatan con la semifinal.
- `pdaire+juez1@gmail.com` es juez de los ocho bloques de la final. `pdaire+delegado1@gmail.com` es delegado de "Club Demo". Quien carga la demo queda como juez jefe.

Volver a cargarla la reinicia: los resultados anotados durante una demo vuelven a su valor inicial. Las apelaciones presentadas no se borran.

## Delegados `/delegado`

El delegado entra con correo y PIN de Firebase Auth. La cuenta tiene que ser delegado en la competencia activa.

Puede presentar:

- **Resultado particular:** elige competidora y bloque, ve el resultado actual y explica en el texto qué debe corregirse.
- **Situación general:** describe una condición que afectó la competencia completa o una parte de ella, sin asociarla a una competidora.

Puede guardar un borrador y enviarlo después a evaluación. Ve solo sus propias apelaciones. En la tablet, el juez jefe ve las apelaciones en evaluación y las acepta o rechaza. Esa decisión no cambia el marcador: si la acepta, corrige el resultado con Editar.
