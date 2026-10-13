import { Link } from 'react-router-dom';
import '../pages/publico.css';

// La dirección no corresponde a ninguna competencia.
export default function NoExiste({ competenciaId }) {
  return (
    <div className="publico">
      <main className="ficha" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <h1 className="publico-titulo">No encontramos esta competencia</h1>
        <p className="publico-sub">No hay ninguna competencia en <strong>/{competenciaId}</strong>.</p>
        <p><Link to="/">Ver las competencias</Link></p>
      </main>
    </div>
  );
}
