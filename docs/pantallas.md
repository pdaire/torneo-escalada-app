# Pantallas

| Ruta | Quién la usa | Qué hace |
| --- | --- | --- |
| `/` | Público | Ranking en vivo de la etapa activa y de las etapas anteriores |
| `/competidor/:id` | Público | Todos los resultados de una competidora en la competencia |
| `/juez` | Juez | Anota intentos, zona y top en un bloque |
| `/admin` | Organización | Arma la competencia, el orden de paso y la asignación de jueces |
| `/delegado` | Delegado de club | Presenta apelaciones particulares o generales |

## Tablero `/`

Muestra la competencia activa. Arriba hay una pestaña por etapa, en orden de competencia (clasificatoria, semifinal, final). La etapa activa está marcada **En vivo** y es la que se abre por defecto. Debajo, un filtro por categoría (**Todas** por defecto).

La etapa y la categoría elegidas quedan en la dirección, así que el enlace se puede compartir:

```text
/?etapa=clasificatoria&categoria=mujeres-sub-15
/?categoria=mujeres-adultas          (etapa activa, una categoría)
```

`categoria` es el id de la categoría (el nombre en minúsculas con guiones). Un valor que no existe muestra todas.

Hay una tabla por categoría. La etiqueta de cada una indica:

| Etiqueta | Cuándo |
| --- | --- |
| **En curso** | Solo en la etapa activa, si la categoría no está finalizada. |
| **Finalizada** | La etapa está cerrada o la categoría se finalizó en `/admin`. |
| Sin etiqueta | Etapa que no está activa ni cerrada (todavía no empieza o nadie la cerró). |

El encabezado sigue la misma lógica: **En vivo** en la etapa activa, **Resultados finales** en una etapa cerrada. Las categorías en curso van primero. Cada tabla lista a todas las competidoras que tienen un turno en esa etapa, aunque todavía no tengan puntaje, y muestra solo los bloques de esa categoría.

En una **ronda americana** la tabla no tiene una columna por bloque: muestra los bloques que suman (los 5 mejores, con sus puntos), la cantidad de tops y el total.

En World Climbing, cada bloque muestra, como en las transmisiones de la IFSC, un rectángulo vacío, medio lleno o lleno según no haya zona, haya zona o haya top. Al lado van dos números:

- `T` es el intento en que se hizo el top.
- `z` es el intento en que se hizo la zona.
- `–` significa que todavía no se consiguió.

La última columna es el puntaje IFSC de la ronda. La tabla se ordena por ese puntaje y desempata con la etapa previa. Si sigue el empate, se comparte posición y se ordena por dorsal. Ver [Puntuación](puntuacion.md).

Cuando cambia un resultado visible (una zona, un top o un puntaje), la fila se ilumina en ámbar y la celda del bloque y el puntaje brillan unos segundos, para que el público lo note. Un intento sin zona ni top no destella, porque el tablero no lo muestra. Al abrir la página o cambiar de pestaña no destella nada.

Tocar un nombre abre su ficha.

## Ficha de competidora `/competidor/:id`

Una tarjeta por etapa en que participa, en orden de competencia, con:

- su posición dentro de la categoría y el puntaje de la etapa;
- si la categoría está en curso o finalizada en esa etapa;
- cada bloque con el intento de la zona, el del top, los intentos totales y los puntos;
- los bloques que todavía no escala, con su hora programada.

En una ronda americana muestra solo los bloques intentados, con sus intentos, si encadenó y los puntos; los que suman al total van marcados con ★.

El nombre de la etapa lleva a esa pestaña del tablero, filtrada por su categoría.

## Tablet del juez `/juez`

Se puede instalar como app en el teléfono o la tablet (ver abajo).

1. Entra con el correo y el PIN de Firebase Auth. La cuenta tiene que ser juez o juez jefe en la competencia activa.
2. Elige el bloque entre los que tiene asignados en la etapa. El juez jefe ve todos. Un bloque se ve atenuado cuando todas las categorías que lo escalan están finalizadas.
3. Si varias categorías escalan ese bloque (por ejemplo M1 en Hombres Sub 15, Sub 17 y Adultos), elige la categoría. Cada una tiene su propio orden de paso. Por defecto se abre la que sigue en curso; las finalizadas aparecen marcadas. Bloque, categoría y turno se recuerdan en el navegador.
4. **Siguiente** y **Anterior** recorren el orden de paso de esa categoría en ese bloque.
5. **Buscar dorsal** elige a alguien fuera de ese orden. **Siguiente** no sigue a la persona buscada: vuelve al orden programado.
6. **Después en este bloque** salta directo a una competidora que todavía no ha pasado.
7. **+ Intento** suma un intento. **Marcar zona** y **Marcar top** no suman: guardan el intento actual. El top queda bloqueado para nuevos intentos.
8. **Editar** corrige el marcador después de un error o una apelación aceptada.
9. **Apelaciones** muestra las que están en evaluación. Solo el juez jefe puede aceptarlas o rechazarlas.

Sin red, la tablet sigue anotando y avisa que hay cambios pendientes de sincronizar. Si la etapa está cerrada o la categoría de la competidora está finalizada, los botones quedan deshabilitados y la tablet lo explica.

La tablet anota solo en la etapa activa. No se cambia de etapa desde aquí: la etapa activa la elige la organización en `/admin`, y las etapas cerradas no se pueden modificar. Cuando todo lo del juez en la etapa está finalizado, la tablet lo avisa.

Sin una etapa activa, la pantalla pide ir a administrar.

### Ronda americana: cartilla digital

Si la etapa activa es una ronda americana, la tablet muestra la cartilla del competidor en vez del orden de paso:

1. Arriba, los sectores del juez (por ejemplo **Sector A** B1 B5 B9 B13 B17 B21). Se elige uno.
2. Se escribe el dorsal y se abre la ficha de la competidora. Las últimas fichas abiertas quedan a mano para volver rápido.
3. Por cada bloque del sector aparece la fila de la cartilla con el valor de cada intento: los fallidos quedan tachados, el encadenado en verde y el siguiente intento con borde.
4. **✗ Falló**, **✓ Encadenó** y **Deshacer** anotan como en papel. Arriba se ve el total de los 5 mejores, que se actualiza al instante; los bloques que suman van con borde verde.
5. **Ver ficha completa** muestra todos los bloques que ya intentó, incluidos los de otros sectores.

### Instalar la app del juez

Abrir https://torneo-escalada-app.web.app/juez y:

- **iPhone o iPad (Safari):** Compartir → **Agregar a inicio**.
- **Android (Chrome):** menú ⋮ → **Instalar app** (o **Agregar a la pantalla de inicio**).

Queda un ícono "Juez" que abre la tablet a pantalla completa, directo en `/juez`. La app abre aunque no haya red: muestra la última versión descargada y los datos que Firestore tenga guardados en el equipo. Con red, siempre carga la versión publicada más nueva.

Solo `/juez` se instala. El tablero, la ficha, `/admin` y `/delegado` siguen siendo web normal.

## Administración `/admin`

Solo para cuentas que están en `admins`.

1. Crear una competencia, o cargar la competencia demo (ver abajo). En desarrollo (`npm run dev`) también se puede cargar el ejemplo Baguales 2026.
2. Marcar una competencia como activa. Solo una queda activa.
3. Agregar etapas (qualis, semifinal, final) con su formato y, si corresponde, la etapa previa.
   - **World Climbing:** bloques (por ejemplo W1–W4, M1–M4) y duración del turno.
   - **Ronda americana:** cantidad de bloques (B1…BN), tabla de puntos (B1 al primer intento, + por bloque, − por intento), máximo de intentos, cuántos bloques suman y sectores (`A: 1, 8, 23, 32; B: 2, 9, 16`). Los sectores se pueden editar después con **Sectores**. No tiene orden de paso.

    Marcar una como activa. **Cerrar** bloquea los resultados de la etapa. En una etapa abierta, cada categoría se puede **finalizar** por separado.
4. Cargar competidores uno a uno o con CSV `dorsal,nombre,categoria`. Una competidora con resultados no se puede quitar.
5. Generar el orden de paso por etapa, categoría y bloques marcados. Con una etapa previa, se puede generar con sus primeras N clasificadas, en orden inverso al ranking. Reordenarlo con Subir y Bajar.
6. Agregar jueces, juez jefe y delegados por correo. Asignar a cada juez uno o más bloques por etapa; en una ronda americana con sectores, se asignan sectores.

### Competencia demo

**Cargar o reiniciar competencia demo** crea la competencia `demo` y la deja activa, así que el tablero público pasa a mostrarla. Para volver a la competencia real, actívala de nuevo.

- Seis categorías (Mujeres y Hombres Sub 15, Sub 17 y Adultos), doce competidoras cada una.
- Tres rondas. Las mujeres escalan bloques W y los hombres bloques M (Women y Men):

  | Ronda | Bloques por categoría | Pasan | Estado |
  | --- | --- | --- | --- |
  | Clasificatoria (ronda americana) | 24 compartidos (B1–B24), sectores A–D | las 12 | Cerrada |
  | Semifinal | 5 (W1–W5, M1–M5) | 8 | Cerrada |
  | Final | 4 (W1–W4, M1–M4) | 6 | Activa |

- En la final, todas las categorías están finalizadas salvo Mujeres Adultas, que está a medias: cada finalista va en un bloque distinto y la última todavía no parte. Los empates de la final se desempatan con la semifinal.
- `pdaire+juez1@gmail.com` es juez de los ocho bloques de la final y de los sectores A y B de la clasificatoria. Para mostrar la cartilla americana, en `/admin` activa la clasificatoria y reábrela. `pdaire+delegado1@gmail.com` es delegado de "Club Demo". Quien carga la demo queda como juez jefe.

Volver a cargarla la reinicia: los resultados anotados durante una demo vuelven a su valor inicial. Las apelaciones presentadas no se borran.

La carga escribe unos 800 resultados y muestra su avance en el botón. No hay que cerrar ni recargar la pestaña mientras tanto. Si se corta, la demo queda a medias (etapas abiertas, faltan resultados de la final): basta con volver a cargarla.

## Delegados `/delegado`

El delegado entra con correo y PIN de Firebase Auth. La cuenta tiene que ser delegado en la competencia activa.

Puede presentar:

- **Resultado particular:** elige competidora y bloque (solo los de su categoría), ve el resultado actual y explica en el texto qué debe corregirse.
- **Situación general:** describe una condición que afectó la competencia completa o una parte de ella, sin asociarla a una competidora.

Puede guardar un borrador y enviarlo después a evaluación. Ve solo sus propias apelaciones. En la tablet, el juez jefe ve las apelaciones en evaluación y las acepta o rechaza. Esa decisión no cambia el marcador: si la acepta, corrige el resultado con Editar.
