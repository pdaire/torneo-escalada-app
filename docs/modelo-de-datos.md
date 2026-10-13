# Modelo de datos

Competidores, etapas y turnos viven dentro de cada competencia. Los resultados están en una colección aparte para que la misma persona pueda tener un marcador distinto en qualis y en la final.

```mermaid
erDiagram
    COMPETENCIA ||--o{ ETAPA : "etapas"
    COMPETENCIA ||--o{ COMPETIDOR : "competidores"
    COMPETENCIA ||--o{ TURNO : "turnos"
    ETAPA ||--o{ TURNO : "etapaId"
    COMPETIDOR ||--o{ TURNO : "competidorId"
    COMPETENCIA ||--o{ RESULTADO : "competenciaId"
    ETAPA ||--o{ RESULTADO : "etapaId"
    COMPETIDOR ||--o{ RESULTADO : "competidorId"
    COMPETENCIA ||--o{ APELACION : "competenciaId"
    ETAPA ||--o{ APELACION : "etapaId"
    COMPETIDOR o|--o{ APELACION : "competidorId opcional"

    COMPETENCIA {
        string id PK "competencias/{id}"
        string nombre
        string fecha
        boolean activa "una sola activa"
        timestamp creadaEn
    }

    ETAPA {
        string id PK "competencias/{id}/etapas/{etapaId}"
        string nombre
        string tipo "qualis | semi | final"
        string_array boulders "M1, M2, M3, M4"
        number duracionTurno "minutos"
        boolean activa "una sola activa por competencia"
        map asignaciones "correo del juez a boulder"
    }

    COMPETIDOR {
        string id PK "competencias/{id}/competidores/{competidorId}"
        string dorsal
        string nombre
        string categoria
        string categoriaId
    }

    TURNO {
        string id PK "competencias/{id}/turnos/{turnoId}"
        string etapaId FK
        string categoriaId
        string boulderId
        string competidorId FK
        number orden
        string horaProgramada "HH:mm"
    }

    RESULTADO {
        string id PK "resultados/{competencia__etapa__competidor__boulder}"
        string competenciaId FK
        string etapaId FK
        string competidorId FK
        string boulderId
        string nombre "copia"
        string dorsal "copia"
        string categoria "copia"
        string categoriaId "copia"
        number intentos
        number zonaEnIntento "null si no hubo zona"
        number topEnIntento "null si no hubo top"
        string actualizadoPor
        timestamp actualizadoEn
    }

    APELACION {
        string id PK "apelaciones/{id}"
        string tipo "resultado | general"
        string estado "borrador | en_evaluacion | aceptada | rechazada"
        string competenciaId FK
        string etapaId FK
        string autorUid
        string autorEmail
        string argumento
        timestamp creadaEn
        string competidorId FK "solo resultado"
        string dorsal "solo resultado"
        string boulderId "solo resultado"
        map resultadoActual "copia al presentar, solo resultado"
        string resueltaPor "correo del juez"
        timestamp resueltaEn
    }
```

## Resultado

Hay un documento por competidora, bloque y etapa. Guarda el estado actual, no un registro por cada toque.

El id se arma así:

```text
{competenciaId}__{etapaId}__{competidorId}__{boulderId}
```

Ejemplo: `baguales-2026__final__abs_damas_4__M1`.

Nombre, dorsal y categoría se copian en el resultado para que el tablero no tenga que leer la subcolección de competidores al pintar cada celda.

`zonaEnIntento` y `topEnIntento` son el número de intento en que se consiguieron. `null` significa que todavía no hay zona o top. Un top sin zona previa deja la zona en el mismo intento.

Los puntos no se guardan. Se calculan al mostrar el tablero a partir de `topEnIntento` y `zonaEnIntento`, así que una corrección del juez o un cambio de fórmula no deja puntajes desactualizados en Firestore. Ver [Puntuación](puntuacion.md).

## Apelaciones

`apelaciones` es una colección separada de `resultados`. Una apelación nunca cambia automáticamente el marcador.

Una apelación particular guarda la competidora, el bloque y una copia del resultado que existía al presentarla. La corrección pedida va solo en el argumento. Una apelación general guarda el contexto de competencia y etapa, pero no una competidora.

Los estados son `borrador`, `en_evaluacion`, `aceptada` y `rechazada`. El delegado crea el borrador y lo envía a evaluación. Un juez autenticado acepta o rechaza desde la tablet. Aceptar no modifica el resultado: el juez corrige el marcador aparte si corresponde.

## Lo que no es una colección

Los bloques no tienen colección. Son la lista `boulders` de la etapa.

La colección `intentos` queda en Firestore por las reglas viejas. La app ya no la lee ni escribe ahí.

## Reglas

El archivo del repo es `firestore.rules`.

- El público puede leer competencias, configuración y resultados.
- Solo usuarios autenticados pueden leer apelaciones.
- Solo un usuario con sesión iniciada puede escribir competencias, sus subcolecciones y `resultados`.
- El autor puede crear una apelación en `borrador` o `en_evaluacion`, y editarla mientras sigue en borrador.
- Un usuario autenticado puede pasar una apelación de `en_evaluacion` a `aceptada` o `rechazada`. No se pueden borrar.
- Todavía no hay un rol de administrador: cualquier juez autenticado puede editar la configuración.
