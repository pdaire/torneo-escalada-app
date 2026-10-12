import { Link } from 'react-router-dom';
import './pages.css';

function PublicDashboard() {
  return (
    <main className="page">
      <p className="page-kicker">Público</p>
      <h1>Tablero del torneo</h1>
      <p className="page-lead">
        Resultados en vivo para el público. Esta pantalla se va a llenar con
        categorías, vías y puntajes.
      </p>
      <nav className="page-nav" aria-label="Otras vistas">
        <Link to="/juez">Vista del juez</Link>
        <Link to="/delegado">Vista del delegado</Link>
      </nav>
    </main>
  );
}

export default PublicDashboard
