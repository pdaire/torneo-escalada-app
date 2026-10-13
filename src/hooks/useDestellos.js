import { useEffect, useRef, useState } from 'react';
import { cambiosEntre } from '../utils/ranking';

const DURACION_DESTELLO = 3000;

// Marca por unos segundos lo que cambió desde el último snapshot, para que el
// público note un resultado nuevo. `firmas` es un Map clave → valor visible
// (ver firmasDeRanking y firmasDeFicha). Al cargar la página o cambiar de
// `contexto` (otra etapa, otra competidora) no marca nada.
// Devuelve clave → momento del cambio: sirve como `key` para reiniciar la
// animación si lo mismo vuelve a cambiar antes de que termine.
export function useDestellos(firmas, contexto, listo) {
  const anterior = useRef(null);
  const temporizadores = useRef([]);
  const [destellos, setDestellos] = useState(() => new Map());

  useEffect(() => () => temporizadores.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!listo) return;
    const previo = anterior.current;
    anterior.current = { contexto, firmas };
    if (!previo || previo.contexto !== contexto) return;
    const cambiadas = cambiosEntre(previo.firmas, firmas);
    if (!cambiadas.length) return;
    const momento = Date.now();
    setDestellos((actual) => {
      const siguiente = new Map(actual);
      cambiadas.forEach((clave) => siguiente.set(clave, momento));
      return siguiente;
    });
    temporizadores.current.push(setTimeout(() => {
      setDestellos((actual) => {
        const siguiente = new Map(actual);
        cambiadas.forEach((clave) => { if (siguiente.get(clave) === momento) siguiente.delete(clave); });
        return siguiente;
      });
    }, DURACION_DESTELLO));
  }, [firmas, contexto, listo]);

  return destellos;
}
