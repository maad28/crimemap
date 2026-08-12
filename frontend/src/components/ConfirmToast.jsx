//Users/mac/crimemap/frontend/src/components/ConfirmToast.jsx
import { MapPin, Check, X, AlertTriangle, Clock } from 'lucide-react';
import { confirmReport } from '../api/reports';

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} d`;
}

function formatFechaHora(dateStr) {
  const d = new Date(dateStr);
  const dia  = d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
  const hora = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  return `${dia}, ${hora}`;
}

const TIPO_ICONS = {
  'Robo a persona':      '🔴',
  'Robo a domicilio':    '🟤',
  'Robo a vehículo':     '🟠',
  'Asalto a mano armada':'🔶',
  'Homicidio':           '⚫',
  'Extorsión':           '🟣',
  'Vandalismo':          '🟡',
  'Punto GDO':           '🟪',
  'Otro':                '⚪',
};

export default function ConfirmToast({ reports, onDismiss }) {
  const first = reports[0];
  const hasMultiple = reports.length > 1;

  const handleConfirm = async () => {
    try {
      await confirmReport(first.id);
      const confirmed = JSON.parse(localStorage.getItem('crimemap_confirmed') || '[]');
      confirmed.push(first.id);
      localStorage.setItem('crimemap_confirmed', JSON.stringify(confirmed));
    } catch {}
    onDismiss();
  };

  return (
    <div style={styles.toast}>

      {/* Header */}
      <div style={styles.header}>
        <MapPin size={13} color="#E24B4A" strokeWidth={2} />
        <span style={styles.headerText}>
          {hasMultiple
            ? `${reports.length} denuncias cercanas`
            : `Denuncia a ${first.distancia_metros ? Math.round(first.distancia_metros) + 'm' : 'menos de 500m'}`}
        </span>
        <button style={styles.closeBtn} onClick={onDismiss}>
          <X size={11} strokeWidth={2.5} />
        </button>
      </div>

      {/* Detalle del reporte */}
      <div style={styles.body}>
        <div style={styles.tipo}>
          <span>{TIPO_ICONS[first.tipo] || '⚪'}</span>
          <span style={styles.tipoText}>{first.tipo}</span>
          <span style={styles.severidad}>
            {'●'.repeat(first.severidad)}{'○'.repeat(5 - first.severidad)}
          </span>
        </div>

        {first.created_at && (
          <div style={styles.fecha}>
            <Clock size={10} strokeWidth={2} />
            <span>{timeAgo(first.created_at)} · {formatFechaHora(first.created_at)}</span>
          </div>
        )}

        {first.descripcion && (
          <p style={styles.descripcion}>
            "{first.descripcion.length > 80
              ? first.descripcion.slice(0, 80) + '...'
              : first.descripcion}"
          </p>
        )}

        {hasMultiple && (
          <p style={styles.masReportes}>
            +{reports.length - 1} reporte{reports.length - 1 > 1 ? 's' : ''} más en la zona
          </p>
        )}
      </div>

      {/* Pregunta y acciones */}
      <div style={styles.footer}>
        <span style={styles.pregunta}>¿Puedes confirmar este problema?</span>
        <div style={styles.actions}>
          <button style={styles.yes} onClick={handleConfirm}>
            <Check size={12} strokeWidth={2.5} /> Sí, confirmo
          </button>
          <button style={styles.no} onClick={onDismiss}>
            No
          </button>
        </div>
      </div>

    </div>
  );
}

const styles = {
  toast: {
    position: 'absolute', top: '16px', left: '50%',
    transform: 'translateX(-50%)',
    background: '#fff', border: '1px solid #eee',
    borderRadius: '16px', padding: '0',
    width: '280px',
    zIndex: 2000,
    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
    overflow: 'hidden',
    fontSize: '12px',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '10px 12px 8px',
    borderBottom: '1px solid #f5f5f5',
    background: '#fafafa',
  },
  headerText: {
    flex: 1, color: '#555', fontSize: '11px', fontWeight: 600
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#aaa', padding: '0', display: 'flex', alignItems: 'center'
  },
  body: {
    padding: '10px 12px 8px',
  },
  tipo: {
    display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'
  },
  tipoText: {
    fontWeight: 700, color: '#222', fontSize: '13px', flex: 1
  },
  severidad: {
    color: '#E24B4A', fontSize: '10px', letterSpacing: '1px'
  },
  fecha: {
    display: 'flex', alignItems: 'center', gap: '4px',
    color: '#999', fontSize: '10px', marginTop: '2px',
  },
  descripcion: {
    margin: '4px 0 0', color: '#666', fontSize: '11px',
    fontStyle: 'italic', lineHeight: '1.4',
  },
  masReportes: {
    margin: '6px 0 0', color: '#E24B4A', fontSize: '10px', fontWeight: 600
  },
  footer: {
    padding: '8px 12px 10px',
    borderTop: '1px solid #f5f5f5',
    background: '#fafafa',
  },
  pregunta: {
    display: 'block', color: '#555', fontSize: '11px', marginBottom: '7px'
  },
  actions: {
    display: 'flex', gap: '8px'
  },
  yes: {
    flex: 1, padding: '6px 10px', background: '#E24B4A',
    border: 'none', borderRadius: '10px', color: '#fff',
    fontSize: '11px', cursor: 'pointer', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
  },
  no: {
    padding: '6px 14px', background: '#f5f5f5',
    border: '1px solid #eee', borderRadius: '10px',
    color: '#666', fontSize: '11px', cursor: 'pointer'
  },
};