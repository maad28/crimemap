import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { X } from 'lucide-react';

export default function MapModal({ lat, lng, tipo, onClose }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current, { center: [lat, lng], zoom: 16 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#E24B4A;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
    L.marker([lat, lng], { icon }).addTo(map).bindPopup(tipo).openPopup();
    mapInstance.current = map;

    // Leaflet necesita un resize forzado cuando el contenedor aparece dentro de un modal
    setTimeout(() => map.invalidateSize(), 100);

    return () => { map.remove(); mapInstance.current = null; };
  }, [lat, lng, tipo]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <strong>{tipo}</strong>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>
        <div ref={mapRef} style={{ width: '100%', height: 360 }} />
      </div>
    </div>
  );
}

const styles = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:     { background: '#fff', borderRadius: 12, overflow: 'hidden', width: 480, maxWidth: '90vw', boxShadow: '0 10px 40px rgba(0,0,0,.3)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee' },
  closeBtn:  { background: 'none', border: 'none', cursor: 'pointer', color: '#888' },
};