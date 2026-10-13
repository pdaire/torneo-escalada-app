import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { competenciasCol, docsConId, rutas } from '../utils/competicion';
import './publico.css';

function formatearFecha(fecha) {
  if (!fecha) return '';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Portada: las competencias publicadas (`activa`). `destino` (juez o delegado) hace que
// cada tarjeta lleve a esa pantalla; lo usan las direcciones viejas /juez y /delegado.
export default function Portada({ aviso = '', destino = '' }) {
  const [competencias, setCompetencias] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.classList.add('public-board');
    return () => document.body.classList.remove('public-board');
  }, []);

  useEffect(() => onSnapshot(query(competenciasCol(db), where('activa', '==', true)), (snapshot) => {
    setCompetencias(docsConId(snapshot).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || a.nombre.localeCompare(b.nombre)));
  }, () => setError('No se pudieron cargar las competencias. Revisa la conexión.')), []);

  const enlace = (id) => (destino ? rutas[destino](id) : rutas.tablero(id));

  return (
    <div className="publico">
      <main className="portada">
        <header className="publico-encabezado">
          <p className="publico-kicker">Búlder</p>
          <h1 className="publico-titulo">Competencias</h1>
          {aviso && <p className="publico-sub">{aviso}</p>}
        </header>
        {error && <p className="publico-sub">{error}</p>}
        {competencias === null && !error && <p className="publico-sub" style={{ textAlign: 'center' }}>Cargando…</p>}
        {competencias?.length === 0 && <p className="publico-sub" style={{ textAlign: 'center' }}>No hay competencias publicadas.</p>}
        <div className="portada-lista">
          {competencias?.map((item) => (
            <Link key={item.id} to={enlace(item.id)} className="portada-tarjeta">
              <strong>{item.nombre}</strong>
              <span>{[formatearFecha(item.fecha), item.club, item.lugar].filter(Boolean).join(' · ')}</span>
              <small>/{item.id}{destino ? `/${destino}` : ''}</small>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
