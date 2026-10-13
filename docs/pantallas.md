# Pantallas

Cada competencia vive en su propia dirección: el id de la competencia (`copa-chile-2026`) es la primera parte de la ruta. Puede haber varias competencias al mismo tiempo.

| Ruta | Quién la usa | Qué hace |
| --- | --- | --- |
| `/` | Público | Portada: las competencias publicadas |
| `/:competencia` | Público | Ranking en vivo de la etapa activa y de las etapas anteriores |
| `/:competencia/competidor/:id` | Público | Todos los resultados de una competidora en la competencia |
| `/:competencia/juez` | Juez | Anota en sus bloques (o la cartilla, en una ronda americana) |
| `/:competencia/delegado` | Delegado de club | Presenta apelaciones particulares o generales |
| `/:competencia/admin` | Organizador o admin | Arma esa competencia: etapas, competidores, orden de paso, jueces |
| `/admin` | Admin de la plataforma | Todas las competencias: crearlas, publicarlas, demos |

Las direcciones de la versión anterior, sin competencia (`/juez`, `/delegado`), llevan a la portada con un enlace a esa pantalla de cada competencia. Una dirección que no corresponde a ninguna competencia muestra un aviso.

## Portada `/`

Lista las competencias publicadas (con **Publicar en la portada** en `/admin`), de la más reciente a la más antigua, con fecha, club y lugar. Una competencia no publicada no aparece, pero sus direcciones funcionan igual.

## Tablero `/:competencia`

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

El encabezado sigue la misma lógica: **En vivo** en la etapa activa, **Resultados finales** en una etapa cerrada. Las categorías en curso van primero.

Las direcciones de ejemplo de arriba van detrás del nombre de la competencia: `/copa-chile?etapa=clasificatoria&categoria=mujeres-sub-15`. Cada tabla lista a todas las competidoras que tienen un turno en esa etapa, aunque todavía no tengan puntaje, y muestra solo los bloques de esa categoría.

En una **ronda americana** la tabla no tiene una columna por bloque: muestra los bloques que suman (los 5 mejores, con sus puntos), la cantidad de tops y el total.

En World Climbing, cada bloque muestra, como en las transmisiones de la IFSC, un rectángulo vacío, medio lleno o lleno según no haya zona, haya zona o haya top. Al lado van dos números:

- `T` es el intento en que se hizo el top.
- `z` es el intento en que se hizo la zona.
- `–` significa que todavía no se consiguió.

La última columna es el puntaje IFSC de la ronda. La tabla se ordena por ese puntaje y desempata con la etapa previa. Si sigue el empate, se comparte posición y se ordena por dorsal. Ver [Puntuación](puntuacion.md).

Cuando cambia un resultado visible, la fila se ilumina en ámbar unos segundos y brilla lo que cambió:

| Vista | Qué destella |
| --- | --- |
| World Climbing | La celda del bloque (zona o top nuevo) y el puntaje |
| Ronda americana | Los bloques que suman, los tops y el puntaje. Un top que no entra en los mejores igual destella la fila y los tops |
| Ficha de competidora | La fila del bloque (también un intento nuevo) y la posición y el puntaje de la etapa |

Un intento sin zona ni top no destella en el tablero, porque no lo muestra. Al abrir la página o cambiar de pestaña, categoría o competidora no destella nada.

Tocar un nombre abre su ficha.

## Ficha de competidora `/:competencia/competidor/:id`

Una tarjeta por etapa en que participa, en orden de competencia, con:

- su posición dentro de la categoría y el puntaje de la etapa;
- si la categoría está en curso o finalizada en esa etapa;
- cada bloque con el intento de la zona, el del top, los intentos totales y los puntos;
- los bloques que todavía no escala, con su hora programada.

En una ronda americana muestra solo los bloques intentados, con sus intentos, si encadenó y los puntos; los que suman al total van marcados con ★.

El nombre de la etapa lleva a esa pestaña del tablero, filtrada por su categoría.

## Tablet del juez `/:competencia/juez`

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

Abrir la tablet de la competencia, por ejemplo https://torneo-escalada-app.web.app/copa-chile/juez, y:

- **iPhone o iPad (Safari):** Compartir → **Agregar a inicio**.
- **Android (Chrome):** menú ⋮ → **Instalar app** (o **Agregar a la pantalla de inicio**).

Queda un ícono "Juez" que abre la tablet de **esa competencia** a pantalla completa. Cada competencia se instala por separado: un juez que trabaja en dos torneos tiene dos íconos, y cada uno abre en su `/…/juez`. Las tablets instaladas con la versión anterior (en `/juez`) abren la portada: hay que instalar de nuevo desde la dirección de la competencia. La app abre aunque no haya red: muestra la última versión descargada y los datos que Firestore tenga guardados en el equipo. Con red, siempre carga la versión publicada más nueva.

Solo `/…/juez` se instala. La portada, el tablero, la ficha, `/admin` y `/delegado` siguen siendo web normal.

## Administración de la plataforma `/admin`

Solo para el super admin: una cuenta que está en `admins` y entra con **Google**. Con correo y clave no se puede administrar la plataforma, aunque el correo sea el mismo. Los organizadores, jueces y delegados siguen entrando con correo y clave. En la demo local, `/admin` muestra también el formulario de clave.

- **Nueva competencia:** nombre, dirección (se sugiere desde el nombre: "Copa Chile 2026" → `copa-chile-2026`), fecha, club organizador, lugar y, opcional, el correo del organizador. La dirección no se puede cambiar después: es el id de la competencia. Se crea oculta de la portada.
- **Todas las competencias:** enlaces para administrar cada una y ver su tablero, y **Publicar en la portada** / **Quitar de la portada**. Pueden estar varias publicadas a la vez.
- **Demos** (ver abajo). En desarrollo (`npm run dev`) también se puede cargar el ejemplo Baguales 2026.

## Administración de una competencia `/:competencia/admin`

Para el admin de la plataforma y para los **organizadores** de esa competencia. Un organizador solo ve y cambia su competencia: no puede crear otras ni publicarla en la portada, y no anota resultados salvo que también se agregue como juez.

Arriba están las direcciones para compartir (tablero, tablet del juez, delegados).

1. Agregar etapas (qualis, semifinal, final) con su formato y, si corresponde, la etapa previa.
   - **World Climbing:** bloques (por ejemplo W1–W4, M1–M4) y duración del turno.
   - **Ronda americana:** tabla de puntos (pegada como CSV o generada con la fórmula de la cartilla clásica), cuántos bloques suman y sectores (`A: 1, 8, 23, 32; B: 2, 9, 16`). La tabla y los sectores se editan después con **Tabla de puntos** y **Sectores**. No tiene orden de paso. Ver [Puntuación](puntuacion.md#ronda-americana).

    Marcar una como activa (una por competencia). **Cerrar** bloquea los resultados de la etapa. En una etapa abierta, cada categoría se puede **finalizar** por separado.
2. Cargar competidores uno a uno o con CSV `dorsal,nombre,categoria`. Una competidora con resultados no se puede quitar.
3. Generar el orden de paso por etapa, categoría y bloques marcados. Con una etapa previa, se puede generar con sus primeras N clasificadas, en orden inverso al ranking. Reordenarlo con Subir y Bajar.
4. Agregar organizadores, jueces, juez jefe y delegados por correo. Asignar a cada juez uno o más bloques por etapa; en una ronda americana con sectores, se asignan sectores.

### Competencias demo

En `/admin` hay dos botones. Cada uno crea (o reinicia) su competencia y la publica en la portada, junto a las demás. En las dos, `pdaire+juez1@gmail.com` es juez, `pdaire+delegado1@gmail.com` es delegado de "Club Demo" y quien carga la demo queda como juez jefe.

#### Demo Primavera - El Muro

En `/primavera-el-muro`. Competencia chica: una sola categoría (General), 20 competidores y una ronda americana de 20 bloques (B1–B20, tabla clásica, suman los 5 mejores) en curso. Cada uno lleva parte de sus bloques y los dos últimos dorsales todavía no empiezan. Sectores A–D; el juez demo tiene A y B. Sirve para mostrar la cartilla del juez sin tocar nada en el admin.

#### Demo completa (3 rondas)

En `/demo`:

- Seis categorías (Mujeres y Hombres Sub 15, Sub 17 y Adultos), doce competidoras cada una.
- Tres rondas. Las mujeres escalan bloques W y los hombres bloques M (Women y Men):

  | Ronda | Bloques por categoría | Pasan | Estado |
  | --- | --- | --- | --- |
  | Clasificatoria (ronda americana) | 24 compartidos (B1–B24), sectores A–D | las 12 | Cerrada |
  | Semifinal | 5 (W1–W5, M1–M5) | 8 | Cerrada |
  | Final | 4 (W1–W4, M1–M4) | 6 | Activa |

- En la final, todas las categorías están finalizadas salvo Mujeres Adultas, que está a medias: cada finalista va en un bloque distinto y la última todavía no parte. Los empates de la final se desempatan con la semifinal.
- `pdaire+juez1@gmail.com` es juez de los ocho bloques de la final y de los sectores A y B de la clasificatoria. Para mostrar la cartilla americana, en `/demo/admin` activa la clasificatoria y reábrela. `pdaire+delegado1@gmail.com` es delegado de "Club Demo". Quien carga la demo queda como juez jefe.

Volver a cargarla la reinicia: los resultados anotados durante una demo vuelven a su valor inicial. Las apelaciones presentadas no se borran.

La carga escribe unos 800 resultados y muestra su avance en el botón. No hay que cerrar ni recargar la pestaña mientras tanto. Si se corta, la demo queda a medias (etapas abiertas, faltan resultados de la final): basta con volver a cargarla.

## Delegados `/:competencia/delegado`

El delegado entra con correo y PIN de Firebase Auth. La cuenta tiene que ser delegado en la competencia activa.

Puede presentar:

- **Resultado particular:** elige competidora y bloque (solo los de su categoría), ve el resultado actual y explica en el texto qué debe corregirse.
- **Situación general:** describe una condición que afectó la competencia completa o una parte de ella, sin asociarla a una competidora.

Puede guardar un borrador y enviarlo después a evaluación. Ve solo sus propias apelaciones. En la tablet, el juez jefe ve las apelaciones en evaluación y las acepta o rechaza. Esa decisión no cambia el marcador: si la acepta, corrige el resultado con Editar.
