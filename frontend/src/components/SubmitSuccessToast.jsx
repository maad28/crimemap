import { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

export default function SubmitSuccessToast({ onDismiss, mobile }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{ ...styles.toast, ...(mobile ? styles.toastMobile : styles.toastDesktop) }}>
      <CheckCircle size={20} color="#1D9E75" strokeWidth={2} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={styles.title}>¡Reporte enviado!</div>
        <div style={styles.desc}>
          Ya se muestra en el mapa como pendiente. Un moderador de la Autoridad lo va a revisar y verificar antes de que aparezca confirmado para los demás.
        </div>
      </div>
      <button onClick={onDismiss} style={styles.closeBtn} aria-label="Cerrar">
        <X size={13} color="#aaa" />
      </button>
    </div>
  );
}

const styles = {
  toast: {
    position: 'absolute', left: '50%', transform: 'translateX(-50%)',
    zIndex: 2200, display: 'flex', alignItems: 'flex-start', gap: 10,
    background: '#fff', borderRadius: 14, padding: '12px 14px',
    boxShadow: '0 4px 20px rgba(0,0,0,.18)', border: '1px solid #eee',
  },
  toastDesktop: { bottom: 24, width: 320 },
  toastMobile:  { bottom: 84, width: 'calc(100vw - 32px)', maxWidth: 320 },
  title: { fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 },
  desc:  { fontSize: 11, color: '#666', lineHeight: 1.4 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2, display: 'flex' },
};
