//frontend/src/pages/AutoridadAlertas.jsx
import { useState, useEffect } from 'react';
import { AlertTriangle, Check, Zap, UserX } from 'lucide-react';

const API = 'http://localhost:3001/api/authority';

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} d`;
}

export default function AutoridadAlertas({ secret }) {
  const [alertas, setAlertas] = useState([]);
  const [soloNoRevisadas, setSoloNoRevisadas] = useState(true);
  const [loading, setLoading] = useState(true);

  const headers = { 'x-authority-secret': secret };

  const cargar = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/alertas?revisada=${!soloNoRevisadas}`, { headers });
      const data = await res.json();
      setAlertas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [soloNoRevisadas]);

  const marcarRevisada = async (id) => {
    await fetch(`${API}/alertas/${id}/marcar-revisada`, { method: 'POST', headers });
    setAlertas(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 16px' }}>Alertas de actividad sospechosa</h2>

      <label style={styles.checkLabel}>
        <input
          type="checkbox"
          checked={soloNoRevisadas}
          onChange={e => setSoloNoRevisadas(e.target.checked)}
        />
        Solo pendientes de revisión
      </label>

      {loading && <p>Cargando...</p>}
      {!loading && alertas.length === 0 && (
        <p style={{ color: '#aaa' }}>No hay alertas en este momento.</p>
      )}

      <div style={styles.list}>
        {alertas.map(a => (
          <div key={a.id} style={styles.card}>
            <div style={styles.cardTop}>
              {a.tipo_alerta === 'rafaga_temporal'
                ? <Zap size={16} color="#BA7517" strokeWidth={2}/>
                : <UserX size={16} color="#E24B4A" strokeWidth={2}/>}
              <span style={styles.tipoLabel}>
                {a.tipo_alerta === 'rafaga_temporal' ? 'Ráfaga temporal' : 'Dispositivo nuevo sospechoso'}
              </span>
              <span style={styles.time}>{timeAgo(a.created_at)}</span>
            </div>

            {a.tipo_alerta === 'rafaga_temporal' ? (
              <p style={styles.detalle}>
                {a.detalle.total_reportes} reportes de tipo "{a.detalle.tipo}" en 500m
                en los últimos 10 minutos, involucrando {a.detalle.dispositivos_involucrados.length} dispositivos distintos.
              </p>
            ) : (
              <p style={styles.detalle}>
                Dispositivo con {a.detalle.minutos_desde_creacion} minutos de antigüedad
                ya acumuló {a.detalle.confirmaciones_recibidas} confirmaciones.
                (hash: {a.detalle.device_hash_parcial}...)
              </p>
            )}

            <button onClick={() => marcarRevisada(a.id)} style={styles.btn}>
              <Check size={13}/> Marcar como revisada
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666', cursor: 'pointer', marginBottom: 16 },
  list:       { display: 'flex', flexDirection: 'column', gap: 10 },
  card:       { background: '#fff', border: '1px solid #faeeda', borderRadius: 12, padding: 14 },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  tipoLabel:  { fontWeight: 600, fontSize: 13, flex: 1 },
  time:       { fontSize: 11, color: '#aaa' },
  detalle:    { fontSize: 12, color: '#555', margin: '6px 0 10px', lineHeight: 1.4 },
  btn:        { display: 'flex', alignItems: 'center', gap: 6, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' },
};