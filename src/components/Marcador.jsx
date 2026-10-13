// Marca de un bloque como en las transmisiones de la IFSC:
// rectángulo vacío, medio lleno o lleno, con el intento del top y de la zona.
// Los estilos están en pages/publico.css.

export function IconoLogro({ top, zona }) {
  const relleno = top != null ? '100%' : zona != null ? '50%' : '0%';
  const etiqueta = top != null ? 'Top' : zona != null ? 'Zona' : 'Sin zona';
  return (
    <span role="img" aria-label={etiqueta} className="icono-logro">
      <span className="icono-logro-relleno" style={{ height: relleno }} />
    </span>
  );
}

export function MarcaBoulder({ boulder }) {
  const top = boulder?.topEnIntento ?? null;
  const zona = boulder?.zonaEnIntento ?? null;
  return (
    <div className="marca">
      <IconoLogro top={top} zona={zona} />
      <div className="marca-numeros">
        <div>T {top ?? '–'}</div>
        <div>z {zona ?? '–'}</div>
      </div>
    </div>
  );
}

// Etiqueta de una categoría en una etapa: 'en_curso', 'finalizada' o nada.
export function EstadoCategoria({ estado }) {
  if (!estado) return null;
  return (
    <span className={estado === 'en_curso' ? 'estado-categoria en-curso' : 'estado-categoria'}>
      {estado === 'en_curso' ? 'En curso' : 'Finalizada'}
    </span>
  );
}
