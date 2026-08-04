import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { X } from 'lucide-react';

export default function ZoneMapModal({ lat, lng, radio, miembros, onClose }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current, { center: [lat, lng], zoom: 15 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    L.circle([lat, lng], { radius: radio, color: '#534AB7', fillColor: '#534AB7', fillOpacity: 0.12, weight: 2 }).addTo(map);

    (miembros || []).forEach(r => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:10px;height:10px;border-radius:50%;background:#E24B4A;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
        iconSize: [10, 10], iconAnchor: [5, 5],
      });
      L.marker([r.lat, r.lng], { icon }).addTo(map).bindPopup(`${r.tipo}${r.descripcion ? ' — ' + r.descripcion : ''}`);
    });

    mapInstance.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapInstance.current = null; };
  }, [lat, lng, radio, miembros]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <strong>Zona de concentración — {miembros?.length || 0} reportes</strong>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>
        <div ref={mapRef} style={{ width: '100%', height: 400 }} />
      </div>
    </div>
  );
}

const styles = {
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:    { background: '#fff', borderRadius: 12, overflow: 'hidden', width: 520, maxWidth: '90vw', boxShadow: '0 10px 40px rgba(0,0,0,.3)' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#888' },
};