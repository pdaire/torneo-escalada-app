import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Portada from './pages/Portada';
import PublicDashboard from './pages/PublicDashboard';
import CompetidorView from './pages/CompetidorView';
import JuezView from './pages/JuezView';
import DelegadoView from './pages/DelegadoView';
import AdminGlobal from './pages/AdminGlobal';
import AdminCompetencia from './pages/AdminCompetencia';

// Cada competencia vive en su propia dirección: /copa-chile, /copa-chile/juez, …
// Las rutas sin competencia (/juez, /delegado, /competidor/…) son de la versión
// anterior: llevan a la portada para elegir la competencia.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portada />} />
        <Route path="/admin" element={<AdminGlobal />} />
        <Route path="/juez" element={<Portada aviso="Elige la competencia para abrir la tablet del juez." destino="juez" />} />
        <Route path="/delegado" element={<Portada aviso="Elige la competencia para presentar apelaciones." destino="delegado" />} />
        <Route path="/competidor/*" element={<Navigate to="/" replace />} />

        <Route path="/:competenciaId" element={<PublicDashboard />} />
        <Route path="/:competenciaId/competidor/:competidorId" element={<CompetidorView />} />
        <Route path="/:competenciaId/juez" element={<JuezView />} />
        <Route path="/:competenciaId/delegado" element={<DelegadoView />} />
        <Route path="/:competenciaId/admin" element={<AdminCompetencia />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
