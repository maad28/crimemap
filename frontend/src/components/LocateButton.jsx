//frontend/src/components/LocateButton.jsx
import { useState } from 'react';
import { LocateFixed } from 'lucide-react';

export default function LocateButton({ map, mobile }) {
  const [buscando, setBuscando] = useState(false);

  const centrarEnMiUbicacion = () => {
    if (!navigator.geolocation || !map) return;
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 16);
        setBuscando(false);
      },
      () => { setBuscando(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <button
      style={{ ...styles.btn, bottom: mobile ? 156 : 24 }}
      onClick={centrarEnMiUbicacion}
      disabled={buscando}
      aria-label="Ir a mi ubicación actual"
    >
      <LocateFixed size={20} color={buscando ? '#aaa' : '#1a1a1a'} strokeWidth={2}/>
    </button>
  );
}

const styles = {
  btn: {
    position: 'absolute', right: 12, zIndex: 1000,
    width: 42, height: 42, borderRadius: '50%',
    background: '#fff', border: '1px solid #eee',
    boxShadow: '0 2px 10px rgba(0,0,0,.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
};