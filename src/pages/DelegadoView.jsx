import { Link } from 'react-router-dom';
import './pages.css';

function DelegadoView() {
  return (
    <main className="page">
      <p className="page-kicker">Delegado</p>
      <h1>Seguimiento del club</h1>
      <p className="page-lead">
        Monitoreo para los delegados de clubes. Esta pantalla se va a llenar
        con el estado de cada competidor.
      </p>
      <nav className="page-nav" aria-label="Otras vistas">
        <Link to="/">Tablero público</Link>
        <Link to="/juez">Vista del juez</Link>
      </nav>
    </main>
  );
}

export default DelegadoView
