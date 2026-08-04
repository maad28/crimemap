import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RotateCcw, MapPinned, Users } from 'lucide-react';
import ZoneMapModal from '../components/ZoneMapModal';

const API = 'http://localhost:3001/api/authority';

export default function AutoridadZonas({ secret }) {
  const [tab, setTab]       = useState('pendiente'); // pendiente | verificada | descartada
  const [zonas, setZonas]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [zonaAbierta, setZonaAbierta] = useState(null); // { zona, reportes } o null

  const headers = { 'x-authority-secret': secret };

  const cargarZonas = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/zonas?estado=${tab}`, { headers });
      const { data } = await res.json();
      setZonas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarZonas(); }, [tab]);

  const resolver = async (id, accion) => {
    await fetch(`${API}/zonas/${id}/${accion}`, { method: 'POST', headers });
    setZonas(prev => prev.filter(z => z.id !== id));
  };

  const verEnMapa = async (zona) => {
    const res = await fetch(`${API}/zonas/${zona.id}/reportes`, { headers });
    const data = await res.json();
    setZonaAbierta({ zona, reportes: data.reportes });
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 16px' }}>Zonas de concentración</h2>

      <div style={styles.tabs}>
        {[
          { id: 'pendiente',  label: 'Pendientes'  },
          { id: 'verificada', label: 'Verificadas' },
          { id: 'descartada', label: 'Descartadas' },
        ].map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p>Cargando...</p>}
      {!loading && zonas.length === 0 && <p style={{ color: '#aaa' }}>No hay zonas en este estado.</p>}

      <div style={styles.grid}>
        {zonas.map(z => (
          <div key={z.id} style={styles.card}>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={styles.tipoBadge}>{z.tipo_predominante}</span>
                <span style={styles.totalBadge}>
                  <Users size={11} /> {z.total_reportes}
                </span>
              </div>

              <p style={styles.meta}>
                Radio: {z.radio_metros}m · Lat/Lng: {Number(z.lat).toFixed(4)}, {Number(z.lng).toFixed(4)}
              </p>
              <p style={styles.meta}>
                Detectada: {new Date(z.primera_deteccion).toLocaleDateString('es-EC')}
              </p>

              <button onClick={() => verEnMapa(z)} style={styles.mapBtn}>
                <MapPinned size={13} /> Ver zona en mapa
              </button>

              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {tab === 'pendiente' && (
                  <>
                    <button onClick={() => resolver(z.id, 'verificar')} style={{ ...styles.actionBtn, background: '#1D9E75' }}>
                      <CheckCircle size={13} /> Verificar
                    </button>
                    <button onClick={() => resolver(z.id, 'descartar')} style={{ ...styles.actionBtn, background: '#E24B4A' }}>
                      <XCircle size={13} /> Descartar
                    </button>
                  </>
                )}
                {(tab === 'verificada' || tab === 'descartada') && (
                  <button onClick={() => resolver(z.id, 'revertir')} style={{ ...styles.actionBtn, background: '#888', width: '100%' }}>
                    <RotateCcw size={13} /> Volver a pendiente
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {zonaAbierta && (
        <ZoneMapModal
          lat={Number(zonaAbierta.zona.lat)}
          lng={Number(zonaAbierta.zona.lng)}
          radio={zonaAbierta.zona.radio_metros}
          miembros={zonaAbierta.reportes}
          onClose={() => setZonaAbierta(null)}
        />
      )}
    </div>
  );
}

const styles = {
  tabs:         { display: 'flex', gap: 6, marginBottom: 16 },
  tabBtn:       { padding: '6px 14px', border: '1px solid #eee', borderRadius: 20, background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer' },
  tabBtnActive: { background: '#1a1a1a', borderColor: '#1a1a1a', color: '#fff', fontWeight: 600 },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  card:         { background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' },
  tipoBadge:    { fontSize: 12, fontWeight: 700, background: '#eeedfe', color: '#534AB7', padding: '3px 10px', borderRadius: 8 },
  totalBadge:   { fontSize: 12, fontWeight: 700, color: '#333', display: 'flex', alignItems: 'center', gap: 4 },
  meta:         { fontSize: 11, color: '#aaa', margin: '6px 0 2px' },
  mapBtn:       { width: '100%', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', background: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: 6, padding: '6px 8px', fontSize: 11, color: '#0C447C', cursor: 'pointer', marginTop: 8 },
  actionBtn:    { flex: 1, display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 11, cursor: 'pointer' },
};