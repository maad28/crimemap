//frontend/src/components/PoliceMarkers.jsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';

// Mismo bounding box que ya usas en el resto del sistema (seed.py)
const BBOX = { south: -2.270, west: -79.980, north: -2.050, east: -79.865 };
const CACHE_KEY = 'crimemap_policia_cache';
const CACHE_HORAS = 24; // refresca una vez al día, no en cada carga

async function obtenerComisarias() {
  const cache = localStorage.getItem(CACHE_KEY);
  if (cache) {
    const { datos, timestamp } = JSON.parse(cache);
    const horas = (Date.now() - timestamp) / (1000 * 60 * 60);
    if (horas < CACHE_HORAS) return datos;
  }

  const query = `
    [out:json];
    (
      node["amenity"="police"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
    );
    out body;
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
  });
  const data = await res.json();

  const comisarias = data.elements.map(el => ({
    lat:    el.lat,
    lng:    el.lon,
    nombre: el.tags?.name || 'Unidad de Policía',
  }));

  localStorage.setItem(CACHE_KEY, JSON.stringify({ datos: comisarias, timestamp: Date.now() }));
  return comisarias;
}

export default function PoliceMarkers({ map }) {
  const layers = useRef([]);

  useEffect(() => {
    if (!map) return;

    obtenerComisarias().then(comisarias => {
      layers.current.forEach(l => l.remove());
      layers.current = [];

      comisarias.forEach(c => {
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              width:34px; height:34px; border-radius:8px;
              background:#0C447C; border:2.5px solid white;
              box-shadow:0 2px 8px rgba(0,0,0,.4);
              display:flex; align-items:center; justify-content:center;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([c.lat, c.lng], { icon, zIndexOffset: 900 })
          .bindPopup(`<b>🛡️ ${c.nombre}</b>`)
          .addTo(map);

        layers.current.push(marker);
      });
    }).catch(err => console.error('Error al cargar comisarías:', err));

    return () => {
      layers.current.forEach(l => l.remove());
    };
  }, [map]);

  return null;
}