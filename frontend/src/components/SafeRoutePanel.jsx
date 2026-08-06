//frontend/src/components/SafeRoutePanel.jsx
import { useState, useRef } from 'react';
import { Route, Navigation, AlertTriangle, Shield, X, MapPin } from 'lucide-react';
import * as turf from '@turf/turf';
import L from 'leaflet';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const RADIO_PELIGRO_METROS = 500;

export default function SafeRoutePanel({ map }) {
  const [destino, setDestino] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [destinoElegido, setDestinoElegido] = useState(null); // { lat, lng, nombre }
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const rutaLayerRef = useRef(null); // ← corregido: ref en vez de state
  const debounceRef  = useRef(null);

  const API = import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001';

  const buscarSugerencias = (texto) => {
    setDestino(texto);
    setDestinoElegido(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!texto || texto.length < 3) { setSugerencias([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/api/geocode/autocomplete?q=${encodeURIComponent(texto)}`);
        const data = await res.json();
        setSugerencias(data.predictions || []);
      } catch { setSugerencias([]); }
    }, 400);
  };

  const elegirSugerencia = async (prediction) => {
    setSugerencias([]);
    setDestino(prediction.structured_formatting?.main_text || prediction.description);
    try {
      const res  = await fetch(`${API}/api/geocode/place?place_id=${prediction.place_id}`);
      const data = await res.json();
      if (data.result?.geometry) {
        const { lat, lng } = data.result.geometry.location;
        setDestinoElegido({ lat, lng, nombre: data.result.name || prediction.description });
      }
    } catch { setError('Error al obtener coordenadas del destino.'); }
  };

  const calcularRuta = async () => {
    setError('');
    if (!destinoElegido) { setError('Selecciona un destino de la lista.'); return; }
    if (!navigator.geolocation) { setError('Tu navegador no soporta geolocalización.'); return; }
    if (!map) { setError('El mapa todavía no está listo.'); return; }

    setCalculando(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const origenLat = pos.coords.latitude;
        const origenLng = pos.coords.longitude;

        const url = `${OSRM_URL}/${origenLng},${origenLat};${destinoElegido.lng},${destinoElegido.lat}` +
                    `?geometries=geojson&alternatives=true&overview=full`;
        const resRuta  = await fetch(url);
        const dataRuta = await resRuta.json();

        if (!dataRuta.routes || dataRuta.routes.length === 0) {
          setError('No se encontró una ruta hacia ese destino.');
          setCalculando(false);
          return;
        }

const resZonas = await fetch(`${API}/api/reports/zonas-para-ruta`); // antes: zonas-verificadas        const zonas = await resZonas.json();

        const evaluadas = dataRuta.routes.map(ruta => {
          let zonasCercanas = [];
          try {
            if (ruta.geometry.coordinates.length >= 2) {
              const linea = turf.lineString(ruta.geometry.coordinates);
              zonasCercanas = zonas.filter(z => {
                const punto = turf.point([Number(z.lng), Number(z.lat)]);
                const distancia = turf.pointToLineDistance(punto, linea, { units: 'meters' });
                return distancia <= (Number(z.radio_metros) + RADIO_PELIGRO_METROS);
              });
            }
          } catch (e) {
            console.warn('No se pudo evaluar cercanía de zonas para esta ruta:', e);
          }
          return {
            geometry: ruta.geometry,
            distanciaKm: (ruta.distance / 1000).toFixed(1),
            duracionMin: Math.round(ruta.duration / 60),
            zonasCercanas,
          };
        });

        evaluadas.sort((a, b) => {
          if (a.zonasCercanas.length !== b.zonasCercanas.length) {
            return a.zonasCercanas.length - b.zonasCercanas.length;
          }
          return parseFloat(a.distanciaKm) - parseFloat(b.distanciaKm);
        });

        const elegida = evaluadas[0];

        // Borra la capa anterior usando la referencia siempre actualizada
        if (rutaLayerRef.current) {
          rutaLayerRef.current.remove();
          rutaLayerRef.current = null;
        }

        const nuevaLinea = L.geoJSON(elegida.geometry, {
          style: {
            color: elegida.zonasCercanas.length > 0 ? '#BA7517' : '#1D9E75',
            weight: 5, opacity: 0.8,
          },
        }).addTo(map);
        map.fitBounds(nuevaLinea.getBounds(), { padding: [40, 40] });
        rutaLayerRef.current = nuevaLinea;

        setResultado({
          distanciaKm: elegida.distanciaKm,
          duracionMin: elegida.duracionMin,
          zonasEnRuta: elegida.zonasCercanas,
          totalAlternativas: evaluadas.length,
        });
      } catch (e) {
        console.error(e);
        setError('Error al calcular la ruta. Intenta de nuevo.');
      } finally {
        setCalculando(false);
      }
    }, () => {
      setError('No se pudo obtener tu ubicación.');
      setCalculando(false);
    }, { enableHighAccuracy: true, timeout: 8000 });
  };

  const limpiar = () => {
    if (rutaLayerRef.current) {
      rutaLayerRef.current.remove();
      rutaLayerRef.current = null;
    }
    setResultado(null);
    setDestino('');
    setDestinoElegido(null);
    setSugerencias([]);
  };

  return (
    <div style={styles.panel}>
      <div style={styles.title}>
        <Route size={15} strokeWidth={2}/> Ruta más segura
      </div>

      <div style={{ position: 'relative' }}>
        <input
          style={styles.input}
          placeholder="¿A dónde vas?"
          value={destino}
          onChange={e => buscarSugerencias(e.target.value)}
        />
        {sugerencias.length > 0 && (
          <div style={styles.sugerencias}>
            {sugerencias.map((s, i) => (
              <div key={i} style={styles.sugerenciaItem} onClick={() => elegirSugerencia(s)}>
                <MapPin size={11} color="#aaa" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }}/>
                <span>{s.structured_formatting?.main_text || s.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <button style={styles.btn} onClick={calcularRuta} disabled={calculando || !destinoElegido}>
        <Navigation size={13}/> {calculando ? 'Calculando...' : 'Calcular ruta'}
      </button>

      {resultado && (
        <div style={styles.resultado}>
          <div style={styles.resultadoTop}>
            <span>{resultado.distanciaKm} km · {resultado.duracionMin} min</span>
            <button onClick={limpiar} style={styles.clearBtn}><X size={13}/></button>
          </div>

          {resultado.zonasEnRuta.length === 0 ? (
            <div style={styles.badgeVerde}>
              <Shield size={13}/> Esta ruta evita todas las zonas de riesgo verificadas
            </div>
          ) : (
            <div style={styles.badgeAmarillo}>
              <AlertTriangle size={13}/> Pasa cerca de {resultado.zonasEnRuta.length} zona(s) de riesgo
              {resultado.totalAlternativas > 1 && ' — no se encontró una ruta que las evite por completo'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  panel:          { background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 2px 10px rgba(0,0,0,.1)', width: 240 },
  title:          { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 10 },
  input:          { width: '100%', border: '1px solid #eee', borderRadius: 8, padding: '8px 10px', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' },
  sugerencias:    { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #eee', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 10, maxHeight: 160, overflowY: 'auto', marginTop: 2 },
  sugerenciaItem: { display: 'flex', gap: 6, padding: '7px 9px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', fontSize: 11, alignItems: 'flex-start' },
  btn:            { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  error:          { fontSize: 11, color: '#E24B4A', background: '#fff0f0', padding: '6px 10px', borderRadius: 6, marginBottom: 8 },
  resultado:      { marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f0f0' },
  resultadoTop:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 600, marginBottom: 8 },
  clearBtn:       { background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' },
  badgeVerde:     { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#085041', background: '#e1f5ee', padding: '8px 10px', borderRadius: 8 },
  badgeAmarillo:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#633806', background: '#faeeda', padding: '8px 10px', borderRadius: 8, lineHeight: 1.4 },
};