import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicDashboard from './pages/PublicDashboard';
import JuezView from './pages/JuezView';
import DelegadoView from './pages/DelegadoView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta raíz: El tablero gigante para el público */}
        <Route path="/" element={<PublicDashboard />} />

        {/* Ruta protegida: La tablet del juez */}
        <Route path="/juez" element={<JuezView />} />

        {/* Ruta de monitoreo: Para los delegados de clubes */}
        <Route path="/delegado" element={<DelegadoView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
