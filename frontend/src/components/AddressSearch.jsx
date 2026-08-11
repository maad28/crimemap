import { useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import L from 'leaflet';

// Guayaquil bounding box — sesga los resultados de Nominatim a la ciudad
// para que "9 de octubre" no te devuelva una calle en otro país.
const VIEWBOX = '-80.05,-2.05,-79.75,-2.35';

export default function AddressSearch({ map, mobile, onResult }) {
  const [query, setQuery]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [marker, setMarker]   = useState(null);

  const buscar = async (e) => {
    e.preventDefault();
    if (!query.trim() || !map) return;
    setLoading(true);
    setError('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ec&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(query + ', Guayaquil, Ecuador')}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const data = await res.json();
      if (!data.length) {
        setError('No se encontró esa dirección en Guayaquil.');
        return;
      }
      const { lat, lon, display_name } = data[0];
      // setView puede disparar un redibujo del heatmap que falla si el
      // contenedor del mapa no tiene tamaño real en ese instante; no dejar
      // que eso tape que la búsqueda sí encontró la dirección.
      try { map.setView([parseFloat(lat), parseFloat(lon)], 17); } catch (e) { console.error(e); }

      if (marker) marker.remove();
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#534AB7;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      });
      const m = L.marker([parseFloat(lat), parseFloat(lon)], { icon }).addTo(map)
        .bindPopup(display_name).openPopup();
      setMarker(m);
      onResult?.({ lat: parseFloat(lat), lng: parseFloat(lon) });
    } catch {
      setError('Error al buscar la dirección. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const limpiar = () => {
    setQuery('');
    setError('');
    if (marker) { marker.remove(); setMarker(null); }
  };

  return (
    <div style={{ ...styles.wrapper, ...(mobile ? styles.wrapperMobile : styles.wrapperDesktop) }}>
      <form onSubmit={buscar} style={styles.form}>
        <Search size={15} color="#aaa" strokeWidth={2} style={{ flexShrink: 0 }} />
        <input
          style={styles.input}
          placeholder="Buscar dirección en Guayaquil..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {loading && <Loader2 size={15} color="#aaa" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
        {!loading && query && (
          <button type="button" onClick={limpiar} style={styles.clearBtn} aria-label="Limpiar">
            <X size={13} color="#aaa" />
          </button>
        )}
      </form>
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

const styles = {
  wrapper:        { position: 'absolute', zIndex: 1000 },
  wrapperDesktop: { top: 16, left: 50, width: 300 },
  wrapperMobile:  { top: 64, left: 12, right: 64 },
  form:           { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 20, padding: '9px 14px', boxShadow: '0 2px 10px rgba(0,0,0,.15)' },
  input:          { flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#333', minWidth: 0, background: 'transparent' },
  clearBtn:       { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 },
  error:          { marginTop: 6, background: '#fff0f0', color: '#E24B4A', fontSize: 11, padding: '6px 10px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.1)' },
};
