//frontend/src/components/PanicButton.jsx
import { useState } from 'react';
import { AlertOctagon, Phone, MessageCircle, X, MapPin } from 'lucide-react';

const NUMERO_EMERGENCIA = '911'; // ECU 911

export default function PanicButton({ mobile }) {
  const [confirmando, setConfirmando] = useState(false);
  const [ubicando, setUbicando]       = useState(false);
  const [error, setError]             = useState('');

  const llamar = () => {
    window.location.href = `tel:${NUMERO_EMERGENCIA}`;
    setConfirmando(false);
  };

  const enviarPorWhatsapp = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Tu dispositivo no soporta geolocalización.');
      return;
    }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const mensaje = encodeURIComponent(
          `🚨 Necesito ayuda. Esta es mi ubicación actual: ${link}`
        );
        window.open(`https://wa.me/?text=${mensaje}`, '_blank');
        setUbicando(false);
        setConfirmando(false);
      },
      () => {
        setError('No se pudo obtener tu ubicación.');
        setUbicando(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <>
      <button
        style={{ ...styles.fab, right: mobile ? 16 : 264 }}
        onClick={() => setConfirmando(true)}
        aria-label="Botón de pánico, opciones de emergencia"
      >
        <AlertOctagon size={24} color="#fff" strokeWidth={2.2} />
      </button>

      {confirmando && (
        <div style={styles.overlay} onClick={() => setConfirmando(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.iconWrap}>
              <AlertOctagon size={32} color="#E24B4A" strokeWidth={2}/>
            </div>
            <div style={styles.title}>¿Necesitas ayuda?</div>
            <div style={styles.subtitle}>
              Úsalo solo en una emergencia real.
            </div>

            <button style={styles.btnLlamar} onClick={llamar}>
              <Phone size={15}/> Llamar al {NUMERO_EMERGENCIA}
            </button>

            <button style={styles.btnWhatsapp} onClick={enviarPorWhatsapp} disabled={ubicando}>
              <MessageCircle size={15}/>
              {ubicando ? 'Obteniendo ubicación...' : 'Enviar ubicación por WhatsApp'}
            </button>

            {error && (
              <div style={styles.error}>
                <MapPin size={12}/> {error}
              </div>
            )}

            <button style={styles.btnCancelar} onClick={() => setConfirmando(false)}>
              <X size={14}/> Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  fab: {
    position: 'fixed', bottom: 100, zIndex: 2500,
    width: 56, height: 56, borderRadius: '50%',
    background: '#E24B4A', border: '3px solid #fff',
    boxShadow: '0 4px 16px rgba(226,75,74,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 3500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: 24, width: 300,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 10px 40px rgba(0,0,0,.3)',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: '50%', background: '#fff0f0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title:    { fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 1.4, marginBottom: 18 },
  btnLlamar: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: '#E24B4A', color: '#fff', border: 'none', borderRadius: 10,
    padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8,
  },
  btnWhatsapp: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 10,
    padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8,
  },
  error: {
    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#E24B4A',
    background: '#fff0f0', padding: '6px 10px', borderRadius: 6, marginBottom: 8, width: '100%',
  },
  btnCancelar: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10,
    padding: '9px', fontSize: 13, cursor: 'pointer',
  },
};