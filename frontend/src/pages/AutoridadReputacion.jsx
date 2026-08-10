//frontend/src/pages/AutoridadReputacion.jsx
import { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, FileDown, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = `${import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001'}/api/authority`;

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

  const descargarCSV = () => {
    if (!dispositivos.length) return;
    let csv = `CrimeMap GYE — Reputación de dispositivos\n`;
    csv += `Generado: ${new Date().toLocaleString('es-EC')}\n\n`;
    csv += 'Device hash,Puntos,Reportes totales,Aprobados,Rechazados,Bloqueado,Primera actividad\n';
    dispositivos.forEach(d => {
      csv += `${d.device_hash},${d.puntos},${d.reportes_totales},${d.reportes_aprobados},${d.reportes_rechazados},${d.bloqueado},${d.primera_actividad}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crimemap_reputacion_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const descargarPDF = () => {
    if (!dispositivos.length) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('CrimeMap GYE — Reputación de dispositivos', 14, 18);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, 14, 24);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 30,
      head: [['Device hash', 'Puntos', 'Totales', 'Aprob.', 'Rechaz.', 'Bloqueado']],
      body: dispositivos.map(d => [
        `${d.device_hash.slice(0, 16)}...`, d.puntos, d.reportes_totales,
        d.reportes_aprobados, d.reportes_rechazados, d.bloqueado ? 'Sí' : 'No',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    doc.save(`crimemap_reputacion_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 16px' }}>Reputación de dispositivos</h2>

      <div style={styles.toolbarRow}>
        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={soloBloqueados}
            onChange={e => setSoloBloqueados(e.target.checked)}
          />
          Solo bloqueados
        </label>

        <div style={styles.exportGroup}>
          <span style={styles.exportLabel}>Exportar</span>
          <button onClick={descargarCSV} disabled={!dispositivos.length} style={styles.exportBtn}>
            <FileDown size={14}/> CSV
          </button>
          <button onClick={descargarPDF} disabled={!dispositivos.length} style={styles.exportBtn}>
            <FileText size={14}/> PDF
          </button>
        </div>
      </div>

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
  toolbarRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666', cursor: 'pointer' },
  exportGroup:{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eee', borderRadius: 20, padding: '4px 6px 4px 14px' },
  exportLabel:{ fontSize: 12, color: '#aaa', marginRight: 2 },
  exportBtn:  { display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 16, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  card:       { background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  hash:       { fontSize: 11, fontFamily: 'monospace', color: '#666', flex: 1 },
  puntos:     { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  meta:       { display: 'flex', gap: 10, fontSize: 10, color: '#888' },
};