import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MapView from './components/MapView';
import Admin   from './pages/Admin';
import Autoridad from './pages/Autoridad';   // ← esta línea es la que probablemente falta


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<MapView />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/autoridad" element={<Autoridad />} />
      </Routes>
    </BrowserRouter>
  );
}
