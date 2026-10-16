# Costos

Estimación del costo de Firebase / Google Cloud para la plataforma, con dos tipos de campeonato al mes. Estimado en octubre de 2026 a partir de cómo funciona la app; los precios y supuestos están abajo para recalcular.

## Resumen

Un campeonato de cada tipo al mes:

| | Costo |
| --- | --- |
| Ronda americana, 40 competidores, 40 bloques | ~US$0,05 por campeonato |
| Como la demo: 6 categorías × 20, tres rondas | ~US$1 por campeonato |
| Hosting, Authentication, almacenamiento | US$0 |
| **Total al mes** | **~US$1 a 2** |

Casi todo el costo son **lecturas de Firestore hechas por el público** (tablero y fichas). Las escrituras de los jueces quedan dentro de lo gratis.

**El riesgo no es el costo sino el plan.** En el plan gratuito (Spark) la cuota de 50.000 lecturas diarias es un límite duro: los dos campeonatos la superan y, al pasarla, el tablero y las tablets dejan de actualizarse hasta el día siguiente. Ver [Plan](#plan-spark-o-blaze).

## Precios usados

Precios de lista de Firestore (edición Standard, región `nam5`). Varían por región y pueden cambiar: confirmar en https://firebase.google.com/pricing y https://cloud.google.com/firestore/pricing.

| Concepto | Gratis por día | Precio después |
| --- | --- | --- |
| Lecturas de documentos | 50.000 | ~US$0,06 por 100.000 |
| Escrituras de documentos | 20.000 | ~US$0,18 por 100.000 |
| Borrados | 20.000 | ~US$0,02 por 100.000 |
| Almacenamiento | 1 GiB | ~US$0,18 por GiB al mes |

La cuota gratis es **diaria**. Un campeonato concentra casi todo su consumo en un día, así que lo gratis de los demás días del mes no ayuda.

Otros servicios que usa la app:

| Servicio | Uso estimado | Gratis |
| --- | --- | --- |
| Hosting | ~305 KB comprimidos por visitante nuevo (las visitas siguientes usan la caché del navegador). 500 visitantes ≈ 150 MB | 10 GB al mes en Blaze; 360 MB por día en Spark |
| Authentication | Correo y clave, y Google para el super admin | Sin costo para estos proveedores |
| Almacenamiento Firestore | Unos pocos MB por campeonato | 1 GiB |

No se usan Cloud Functions ni Storage.

## Qué consume la app

| Acción | Consumo |
| --- | --- |
| Un toque del juez (+ intento, zona, top, ✗, ✓, editar) | 2 escrituras (resultado e historial) y ~3–4 lecturas de las reglas, que consultan el rol, la etapa y la competidora |
| Abrir el tablero | Lee todos los resultados de la etapa (de todas las categorías, aunque se filtre una), las competidoras y los turnos. En World Climbing, también los resultados de la etapa previa |
| Cada resultado que cambia | 1 lectura **por cada pantalla con el tablero o la ficha abierta** |
| Abrir la ficha de una competidora | Lee todos los resultados de la competencia |
| Tablet del juez | Lee el resultado de cada competidora que abre (World Climbing) o su ficha de la etapa (ronda americana) |
| Una pantalla que vuelve después de 30 minutos sin conexión | Vuelve a leer todo lo que escucha |

## Escenario 1: ronda americana

40 competidores, 40 bloques, una sola etapa.

| Supuesto | Valor |
| --- | --- |
| Bloques que intenta cada competidor | ~20 |
| Intentos por bloque | ~2,5 |
| Aperturas del tablero en el día | ~100 |
| Pantallas abiertas a la vez | ~30 |

| Concepto | Cálculo | Cantidad |
| --- | --- | --- |
| Toques de jueces | 40 × 20 × 2,5 | ~2.000 |
| Escrituras | 2.000 × 2 | **~4.000** |
| Lecturas de reglas | 2.000 × 4 | ~8.000 |
| Aperturas del tablero | 100 × ~450 documentos | ~45.000 |
| Actualizaciones en vivo | 2.000 × 30 pantallas | ~60.000 |
| Tablets y fichas | | ~20.000 |
| **Lecturas totales** | | **~130.000** |

Costo: (130.000 − 50.000 gratis) × US$0,06 / 100.000 ≈ **US$0,05**.

## Escenario 2: como la demo

Mujeres y hombres Sub 15, Sub 17 y Adultos, 20 por categoría (120 en total). Clasificatoria en ronda americana de 24 bloques, semifinal de 8 por categoría con 5 bloques y final de 6 por categoría con 4 bloques.

| Supuesto | Valor |
| --- | --- |
| Bloques por competidor en la clasificatoria | ~18, con ~2,5 intentos |
| Toques por bloque en semifinal y final | ~3,5 (intentos, zona, top) |
| Aperturas del tablero en el día | ~200 |
| Fichas abiertas | ~300 |
| Pantallas abiertas a la vez | ~60 |

| Concepto | Cálculo | Cantidad |
| --- | --- | --- |
| Toques de jueces | 120 × 18 × 2,5 + 48 × 5 × 3,5 + 36 × 4 × 3,5 | ~6.700 |
| Escrituras | 6.700 × 2 | **~13.400** |
| Lecturas de reglas | 6.700 × 4 | ~27.000 |
| Aperturas del tablero | 200 × ~2.300 documentos | ~460.000 |
| Actualizaciones en vivo | 6.700 × 60 pantallas | ~400.000 |
| Fichas abiertas | 300 × ~2.500 documentos | ~750.000 |
| **Lecturas totales** | | **~1,7 millones** |

Costo: (1.700.000 − 50.000) × US$0,06 / 100.000 ≈ **US$1**. Las escrituras quedan bajo las 20.000 gratis.

## Para recalcular

```text
toques         = competidores × bloques intentados × toques por bloque   (sumar por etapa)
escrituras     = toques × 2
lecturas       = toques × 4                                  (reglas)
               + aperturas del tablero × resultados de la etapa
               + toques × pantallas abiertas a la vez         (tiempo real)
               + fichas abiertas × resultados de la competencia
costo lecturas = max(0, lecturas − 50.000) × 0,06 / 100.000   (US$)
costo escrit.  = max(0, escrituras − 20.000) × 0,18 / 100.000
```

Lo que más mueve el resultado es el público: cuántas personas abren el tablero y las fichas, y cuántas pantallas quedan abiertas mientras se anota.

## Plan: Spark o Blaze

| | Spark (gratuito) | Blaze (pago por uso) |
| --- | --- | --- |
| Costo | US$0 | Lo que se consuma sobre la cuota gratis: ~US$1–2 al mes con estos campeonatos |
| Al superar 50.000 lecturas en el día | **Firestore rechaza las lecturas hasta la medianoche (hora del Pacífico)**: el tablero y las tablets dejan de actualizarse | Se cobra el excedente |
| Escenario 1 | Supera la cuota | ~US$0,05 |
| Escenario 2 | Supera la cuota, probablemente durante la clasificatoria | ~US$1 |

**Recomendación:** usar Blaze con una alerta de presupuesto.

1. En la consola de Firebase, abajo a la izquierda, ver el plan actual y cambiar a **Blaze** (pide una tarjeta).
2. En Google Cloud → **Facturación → Presupuestos y alertas**, crear un presupuesto de, por ejemplo, US$5 al mes con avisos al 50 %, 90 % y 100 %.

La alerta avisa, pero no corta el servicio: si algo se dispara, hay tiempo de revisar antes de que el costo sea relevante.

## Medir el consumo real

- **Firebase → Firestore → Uso:** lecturas, escrituras y borrados por día. Conviene mirarlo el día después de cada campeonato y comparar con este documento.
- **Google Cloud → Facturación → Informes:** el costo real por servicio.
- **Firebase → Hosting → Uso:** transferencia del sitio.

## Si el consumo crece

Hoy no se justifican (ahorran menos de US$1 al mes), pero son los cambios con más efecto si llegaran más campeonatos o más público:

| Cambio | Ahorro en el escenario 2 |
| --- | --- |
| Que la ficha lea solo los resultados de esa competidora, no los de toda la competencia | ~750.000 lecturas: casi la mitad |
| Que el tablero filtrado por categoría lea solo los resultados de esa categoría | Hasta ~5/6 de las aperturas del tablero cuando el público filtra |
| Guardar el ranking calculado en un documento por etapa (requiere Cloud Functions) | El tablero pasaría a leer 1 documento por apertura en vez de miles |
