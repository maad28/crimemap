import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { X, ClipboardList, AlertTriangle, ShieldAlert, Users, Clock, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { nombreZona } from '../utils/zonasNombres';

const NIVEL_COLOR = {
  ALTO:  '#E24B4A',
  MEDIO: '#BA7517',
  BAJO:  '#1D9E75',
};

const TENDENCIA_ICON = {
  subida:  { Icon: TrendingUp,   color: '#E24B4A', label: 'En aumento' },
  bajada:  { Icon: TrendingDown, color: '#1D9E75', label: 'En descenso' },
  estable: { Icon: Minus,        color: '#888',    label: 'Estable' },
};

export default function ZoneDetailModal({ zona, onClose }) {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);

  const { lat, lng, radio_metros, nivel_riesgo, riesgo_semanal, reportes_7dias,
    reportes_hoy, tendencia, principales_categorias, ultima_actualizacion } = zona;

  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current, { center: [lat, lng], zoom: 16, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    L.circle([lat, lng], {
      radius: radio_metros, color: '#534AB7', fillColor: '#534AB7',
      fillOpacity: 0.08, weight: 2, dashArray: '6,6',
    }).addTo(map);

    L.circleMarker([lat, lng], {
      radius: 7, color: '#fff', weight: 3, fillColor: '#534AB7', fillOpacity: 1,
    }).addTo(map);

    L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(map);

    mapInstance.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapInstance.current = null; };
  }, [lat, lng, radio_metros]);

  const nivelColor = NIVEL_COLOR[nivel_riesgo] || '#888';
  const tend = TENDENCIA_ICON[tendencia] || TENDENCIA_ICON.estable;
  // zonas-fijas ya trae el nombre; zonas-verificadas no, así que se estima
  // por cercanía al sector conocido más próximo.
  const nombre = zona.nombre || nombreZona(lat, lng);
  const categorias = (principales_categorias || []).join(', ') || '—';
  const fechaActualizacion = ultima_actualizacion
    ? new Date(ultima_actualizacion).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <strong style={styles.headerTitle}>{nombre}</strong>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} color="#fff" /></button>
        </div>

        <div style={styles.body}>
          <div style={styles.sectionLabel}>Vista zoom</div>
          <div ref={mapRef} style={styles.map} />

          <div style={styles.radioRow}>
            <span style={styles.radioDot} />
            Radio de análisis: {radio_metros} m
          </div>

          <div style={styles.statsList}>
            <div style={styles.statRow}>
              <ClipboardList size={17} color="#534AB7" strokeWidth={1.8} />
              <span style={styles.statLabel}>Total reportes (7 días)</span>
              <span style={styles.statValue}>{reportes_7dias}</span>
            </div>
            <div style={styles.statRow}>
              <AlertTriangle size={17} color="#BA7517" strokeWidth={1.8} />
              <span style={styles.statLabel}>Reportes hoy</span>
              <span style={styles.statValue}>{reportes_hoy}</span>
            </div>
            <div style={styles.statRow}>
              <ShieldAlert size={17} color={nivelColor} strokeWidth={1.8} />
              <span style={styles.statLabel}>Riesgo actual</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...styles.statValue, color: nivelColor }}>
                  {nivel_riesgo} ({riesgo_semanal})
                </div>
                <div style={{ ...styles.tendencia, color: tend.color }}>
                  <tend.Icon size={12} strokeWidth={2.5} /> {tend.label}
                </div>
              </div>
            </div>
            <div style={styles.statRow}>
              <Users size={17} color="#534AB7" strokeWidth={1.8} />
              <span style={styles.statLabel}>Principales categorías</span>
              <span style={{ ...styles.statValue, ...styles.statValueSmall }}>{categorias}</span>
            </div>
            <div style={styles.statRow}>
              <Clock size={17} color="#534AB7" strokeWidth={1.8} />
              <span style={styles.statLabel}>Última actualización</span>
              <span style={styles.statValue}>{fechaActualizacion}</span>
            </div>
          </div>

          <div style={styles.infoBox}>
            <Info size={16} color="#534AB7" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>El nivel de riesgo se calcula con la severidad acumulada de los reportes en el área, normalizada por semana y hora.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:     { background: '#fff', borderRadius: 16, overflow: 'hidden', width: 400, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,.3)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', background: '#1a1a2e' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 700 },
  closeBtn:  { background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 8, cursor: 'pointer', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  body:      { padding: 18 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: '#534AB7', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 },
  map:       { width: '100%', height: 220, borderRadius: 12, border: '1px solid #eee', marginBottom: 10 },
  radioRow:  { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666', marginBottom: 16 },
  radioDot:  { width: 10, height: 10, borderRadius: '50%', border: '2px dashed #534AB7', flexShrink: 0 },
  statsList: { display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 14, borderTop: '1px solid #f0f0f0' },
  statRow:   { display: 'flex', alignItems: 'center', gap: 10 },
  statLabel: { flex: 1, fontSize: 13, color: '#555' },
  statValue: { fontSize: 15, fontWeight: 700, color: '#1a1a1a', textAlign: 'right' },
  statValueSmall: { fontSize: 12, fontWeight: 500, color: '#666', maxWidth: 160 },
  tendencia: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, justifyContent: 'flex-end', marginTop: 2 },
  infoBox:   { display: 'flex', gap: 8, background: '#f0eefc', borderRadius: 10, padding: '12px 14px', fontSize: 11, color: '#534AB7', lineHeight: 1.4, marginTop: 18 },
};
