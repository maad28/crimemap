//frontend/src/components/ProximityAlert.jsx
import { useState, useEffect } from 'react';
import { AlertTriangle, X, MessageCircle, Send } from 'lucide-react';

const API = `${import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001'}/api/reports`;

function minutosDesde(fecha) {
  return Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
}

export default function ProximityAlert() {
  const [alertas, setAlertas] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res  = await fetch(`${API}/alerta-cercana?lat=${latitude}&lng=${longitude}`);
        const data = await res.json();
        if (data.length > 0) {
          setAlertas(data);
          setVisible(true);
        }
      } catch (e) { console.error(e); }
    }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
  }, []);

  if (!visible || alertas.length === 0) return null;

  const principal = alertas[0];
  const mins = minutosDesde(principal.created_at);
  const tiempoTexto = mins < 60 ? `hace ${mins} min` : `hace ${Math.round(mins/60)} h`;

  const razonConfianza = principal.estado === 'aprobado'
    ? 'verificado por autoridad'
    : `confirmado por ${principal.confirmaciones} ciudadanos`;

  const compartir = (canal) => {
    const distancia = Math.round(principal.distancia_metros);
    const texto = encodeURIComponent(
      `⚠️ Alerta CrimeMap GYE: se reportó "${principal.tipo}" a ${distancia}m de mi ubicación, ${tiempoTexto} (${razonConfianza}).`
    );
    if (canal === 'whatsapp') window.open(`https://wa.me/?text=${texto}`, '_blank');
    if (canal === 'telegram') window.open(`https://t.me/share/url?url=&text=${texto}`, '_blank');
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <button style={styles.closeBtn} onClick={() => setVisible(false)}>
          <X size={14}/>
        </button>
        <div style={styles.iconWrap}>
          <AlertTriangle size={22} color="#E24B4A" strokeWidth={2}/>
        </div>
        <div style={styles.title}>Reporte cercano a tu ubicación</div>
        <div style={styles.desc}>
          <b>{principal.tipo}</b> a {Math.round(principal.distancia_metros)}m, {tiempoTexto}
          <br/><span style={styles.confianza}>({razonConfianza})</span>
        </div>
        {alertas.length > 1 && (
          <div style={styles.masTexto}>+{alertas.length - 1} reporte(s) más cerca de aquí</div>
        )}
        <div style={styles.shareRow}>
          <button style={styles.shareBtnWhatsapp} onClick={() => compartir('whatsapp')}>
            <MessageCircle size={13}/> Avisar por WhatsApp
          </button>
          <button style={styles.shareBtnTelegram} onClick={() => compartir('telegram')}>
            <Send size={13}/> Avisar por Telegram
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
    zIndex: 2600, width: 320, maxWidth: 'calc(100vw - 32px)',
  },
  card: {
    background: '#fff', borderRadius: 14, padding: '16px 18px',
    boxShadow: '0 8px 30px rgba(0,0,0,.2)', border: '1px solid #fdd',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: 10, right: 10, background: 'none', border: 'none',
    cursor: 'pointer', color: '#aaa',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: '50%', background: '#fff0f0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title:    { fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 },
  desc:     { fontSize: 12, color: '#555', lineHeight: 1.4 },
  confianza:{ fontSize: 11, color: '#1D9E75', fontWeight: 600 },
  masTexto: { fontSize: 11, color: '#BA7517', marginTop: 4, fontWeight: 500 },
  shareRow: { display: 'flex', gap: 6, marginTop: 12 },
  shareBtnWhatsapp: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8,
    padding: '7px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  },
  shareBtnTelegram: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    background: '#378ADD', color: '#fff', border: 'none', borderRadius: 8,
    padding: '7px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  },
};