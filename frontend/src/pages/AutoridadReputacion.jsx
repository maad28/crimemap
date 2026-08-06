//frontend/src/pages/AutoridadReputacion.jsx
import { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

const API = 'http://localhost:3001/api/authority';

export default function AutoridadReputacion({ secret }) {
  const [dispositivos, setDispositivos] = useState([]);
  const [soloBloqueados, setSoloBloqueados] = useState(false);
  const [loading, setLoading] = useState(true);

  const headers = { 'x-authority-secret': secret };

  const cargar = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/reputacion?bloqueados=${soloBloqueados}`, { headers });
      const data = await res.json();
      setDispositivos(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [soloBloqueados]);

  return (
    <div>
      <h2 style={{ margin: '0 0 16px' }}>Reputación de dispositivos</h2>

      <label style={styles.checkLabel}>
        <input
          type="checkbox"
          checked={soloBloqueados}
          onChange={e => setSoloBloqueados(e.target.checked)}
        />
        Solo bloqueados
      </label>

      {loading && <p>Cargando...</p>}
      {!loading && dispositivos.length === 0 && (
        <p style={{ color: '#aaa' }}>No hay dispositivos que coincidan.</p>
      )}

      <div style={styles.grid}>
        {dispositivos.map(d => (
          <div key={d.device_hash} style={styles.card}>
            <div style={{ padding: 14 }}>
              <div style={styles.cardTop}>
                {d.bloqueado
                  ? <ShieldAlert size={14} color="#E24B4A" strokeWidth={2}/>
                  : <ShieldCheck size={14} color="#1D9E75" strokeWidth={2}/>}
                <span style={styles.hash}>{d.device_hash.slice(0, 16)}...</span>
              </div>
              <div style={{ ...styles.puntos, color: d.bloqueado ? '#E24B4A' : '#1D9E75' }}>
                {d.puntos} pts
              </div>
              <div style={styles.meta}>
                <span>Reportes: {d.reportes_totales}</span>
                <span style={{ color: '#1D9E75' }}>Aprob: {d.reportes_aprobados}</span>
                <span style={{ color: '#E24B4A' }}>Rechaz: {d.reportes_rechazados}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666', cursor: 'pointer', marginBottom: 16 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  card:       { background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  hash:       { fontSize: 11, fontFamily: 'monospace', color: '#666', flex: 1 },
  puntos:     { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  meta:       { display: 'flex', gap: 10, fontSize: 10, color: '#888' },
};