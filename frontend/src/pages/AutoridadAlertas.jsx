//frontend/src/pages/AutoridadAlertas.jsx
import { useState, useEffect } from 'react';
import { AlertTriangle, Check, Zap, UserX, FileDown, FileText, Ban, ShieldOff } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = `${import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001'}/api/authority`;

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
  const [bloqueando, setBloqueando] = useState(new Set());
  const [bloqueados, setBloqueados] = useState(new Set());

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

  const bloquearDispositivo = async (hash) => {
    setBloqueando(prev => new Set(prev).add(hash));
    try {
      await fetch(`${API}/dispositivos/${hash}/bloquear`, { method: 'POST', headers });
      setBloqueados(prev => new Set(prev).add(hash));
    } finally {
      setBloqueando(prev => { const next = new Set(prev); next.delete(hash); return next; });
    }
  };

  const resumenAlerta = (a) => a.tipo_alerta === 'rafaga_temporal'
    ? `${a.detalle.total_reportes} reportes de tipo "${a.detalle.tipo}" en 500m en 10 min, ${a.detalle.dispositivos_involucrados.length} dispositivos`
    : `Dispositivo de ${a.detalle.minutos_desde_creacion} min ya acumuló ${a.detalle.confirmaciones_recibidas} confirmaciones`;

  const descargarCSV = () => {
    if (!alertas.length) return;
    let csv = `CrimeMap GYE — Alertas de actividad sospechosa\n`;
    csv += `Generado: ${new Date().toLocaleString('es-EC')}\n\n`;
    csv += 'ID,Tipo,Detalle,Revisada,Fecha\n';
    alertas.forEach(a => {
      const detalle = resumenAlerta(a).replace(/,/g, ';');
      csv += `${a.id},${a.tipo_alerta},"${detalle}",${a.revisada},${a.created_at}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crimemap_alertas_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const descargarPDF = () => {
    if (!alertas.length) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('CrimeMap GYE — Alertas de actividad sospechosa', 14, 18);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, 14, 24);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 30,
      head: [['ID', 'Tipo', 'Detalle', 'Revisada', 'Fecha']],
      body: alertas.map(a => [
        a.id,
        a.tipo_alerta === 'rafaga_temporal' ? 'Ráfaga temporal' : 'Dispositivo sospechoso',
        resumenAlerta(a),
        a.revisada ? 'Sí' : 'No',
        new Date(a.created_at).toLocaleDateString('es-EC'),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 8 },
      columnStyles: { 2: { cellWidth: 90 } },
      margin: { left: 14, right: 14 },
    });
    doc.save(`crimemap_alertas_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 16px' }}>Alertas de actividad sospechosa</h2>

      <div style={styles.toolbarRow}>
        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={soloNoRevisadas}
            onChange={e => setSoloNoRevisadas(e.target.checked)}
          />
          Solo pendientes de revisión
        </label>

        <div style={styles.exportGroup}>
          <span style={styles.exportLabel}>Exportar</span>
          <button onClick={descargarCSV} disabled={!alertas.length} style={styles.exportBtn}>
            <FileDown size={14}/> CSV
          </button>
          <button onClick={descargarPDF} disabled={!alertas.length} style={styles.exportBtn}>
            <FileText size={14}/> PDF
          </button>
        </div>
      </div>

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
              <>
                <p style={styles.detalle}>
                  {a.detalle.total_reportes} reportes de tipo "{a.detalle.tipo}" en 500m
                  en los últimos 10 minutos, involucrando {a.detalle.dispositivos_involucrados.length} dispositivos distintos.
                </p>
                <div style={styles.hashList}>
                  {a.detalle.dispositivos_involucrados.map(hash => (
                    <div key={hash} style={styles.hashRow}>
                      <span style={styles.hash}>{hash.slice(0, 16)}...</span>
                      {bloqueados.has(hash) ? (
                        <span style={styles.bloqueadoTag}><ShieldOff size={11}/> Bloqueado</span>
                      ) : (
                        <button onClick={() => bloquearDispositivo(hash)} disabled={bloqueando.has(hash)} style={styles.blockBtnSmall}>
                          <Ban size={11}/> {bloqueando.has(hash) ? 'Bloqueando...' : 'Bloquear'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={styles.detalle}>
                Dispositivo con {a.detalle.minutos_desde_creacion} minutos de antigüedad
                ya acumuló {a.detalle.confirmaciones_recibidas} confirmaciones.
                (hash: {(a.detalle.device_hash || a.detalle.device_hash_parcial || '?').slice(0, 16)}...)
              </p>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {a.tipo_alerta !== 'rafaga_temporal' && a.detalle.device_hash && (
                bloqueados.has(a.detalle.device_hash) ? (
                  <span style={styles.bloqueadoTag}><ShieldOff size={11}/> Dispositivo bloqueado</span>
                ) : (
                  <button
                    onClick={() => bloquearDispositivo(a.detalle.device_hash)}
                    disabled={bloqueando.has(a.detalle.device_hash)}
                    style={{ ...styles.btn, background: '#E24B4A' }}>
                    <Ban size={13}/> {bloqueando.has(a.detalle.device_hash) ? 'Bloqueando...' : 'Bloquear dispositivo'}
                  </button>
                )
              )}
              <button onClick={() => marcarRevisada(a.id)} style={styles.btn}>
                <Check size={13}/> Marcar como revisada
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  toolbarRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666', cursor: 'pointer' },
  exportGroup:{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eee', borderRadius: 20, padding: '4px 6px 4px 14px' },
  exportLabel:{ fontSize: 12, color: '#aaa', marginRight: 2 },
  exportBtn:  { display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 16, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  list:       { display: 'flex', flexDirection: 'column', gap: 10 },
  card:       { background: '#fff', border: '1px solid #faeeda', borderRadius: 12, padding: 14 },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  tipoLabel:  { fontWeight: 600, fontSize: 13, flex: 1 },
  time:       { fontSize: 11, color: '#aaa' },
  detalle:    { fontSize: 12, color: '#555', margin: '6px 0 10px', lineHeight: 1.4 },
  btn:        { display: 'flex', alignItems: 'center', gap: 6, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' },
  hashList:     { display: 'flex', flexDirection: 'column', gap: 4, margin: '6px 0 10px', background: '#fafafa', borderRadius: 8, padding: '6px 8px' },
  hashRow:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hash:         { fontSize: 11, fontFamily: 'monospace', color: '#666' },
  blockBtnSmall:{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff0f0', color: '#E24B4A', border: '1px solid #f5d5d5', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', flexShrink: 0 },
  bloqueadoTag: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#E24B4A', fontWeight: 600 },
};