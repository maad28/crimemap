//frontend/src/pages/AutoridadZonas.jsx

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RotateCcw, MapPinned, Users, FileDown, FileText, RefreshCw, LayoutGrid, List } from 'lucide-react';
import ZoneMapModal from '../components/ZoneMapModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = `${import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001'}/api/authority`;

const NIVEL_COLOR = {
  ALTO:  { bg: '#fff0f0', color: '#E24B4A' },
  MEDIO: { bg: '#faeeda', color: '#BA7517' },
  BAJO:  { bg: '#e1f5ee', color: '#1D9E75' },
};

export default function AutoridadZonas({ secret }) {
  const [tab, setTab]       = useState('pendiente'); // pendiente | verificada | descartada
  const [zonas, setZonas]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [zonaAbierta, setZonaAbierta] = useState(null); // { zona, reportes } o null
  const [recalculando, setRecalculando] = useState(false);
  const [orden, setOrden]   = useState('total_desc');
  const [vista, setVista]   = useState('cards'); // cards | lista

  const headers = { 'x-authority-secret': secret };

  const cargarZonas = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/zonas?estado=${tab}&orden=${orden}&limit=100`, { headers });
      const { data } = await res.json();
      setZonas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarZonas(); }, [tab, orden]);

  const resolver = async (id, accion) => {
    await fetch(`${API}/zonas/${id}/${accion}`, { method: 'POST', headers });
    setZonas(prev => prev.filter(z => z.id !== id));
  };

  const verEnMapa = async (zona) => {
    const res = await fetch(`${API}/zonas/${zona.id}/reportes`, { headers });
    const data = await res.json();
    setZonaAbierta({ zona, reportes: data.reportes });
  };

  const recalcular = async () => {
    setRecalculando(true);
    try {
      await fetch(`${API}/zonas/recalcular`, { method: 'POST', headers });
      await cargarZonas();
    } finally {
      setRecalculando(false);
    }
  };

  const descargarCSV = () => {
    if (!zonas.length) return;
    let csv = `CrimeMap GYE — Zonas de concentración (${tab})\n`;
    csv += `Generado: ${new Date().toLocaleString('es-EC')}\n\n`;
    csv += 'ID,Tipo predominante,Total reportes,Nivel riesgo,Riesgo/semana,Radio (m),Lat,Lng,Estado,Primera detección\n';
    zonas.forEach(z => {
      csv += `${z.id},${z.tipo_predominante},${z.total_reportes},${z.nivel_riesgo},${z.riesgo_semanal},${z.radio_metros},${z.lat},${z.lng},${z.estado},${z.primera_deteccion}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `crimemap_zonas_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const descargarPDF = () => {
    if (!zonas.length) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`CrimeMap GYE — Zonas de concentración (${tab})`, 14, 18);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, 14, 24);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 30,
      head: [['ID', 'Tipo predominante', 'Total', 'Riesgo', 'Radio (m)', 'Estado', 'Detectada']],
      body: zonas.map(z => [
        z.id, z.tipo_predominante, z.total_reportes, `${z.nivel_riesgo} (${z.riesgo_semanal}/sem)`, z.radio_metros, z.estado,
        new Date(z.primera_deteccion).toLocaleDateString('es-EC'),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    doc.save(`crimemap_zonas_${tab}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 16px' }}>Zonas de concentración</h2>

      <div style={styles.toolbarRow}>
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

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={orden} onChange={e => setOrden(e.target.value)} style={styles.select}>
            <option value="total_desc">Más denuncias</option>
            <option value="total_asc">Menos denuncias</option>
            <option value="recientes">Más recientes</option>
            <option value="antiguas">Más antiguas</option>
          </select>

          <div style={styles.vistaToggle}>
            <button onClick={() => setVista('cards')} title="Vista de tarjetas"
              style={{ ...styles.vistaBtn, ...(vista === 'cards' ? styles.vistaBtnActive : {}) }}>
              <LayoutGrid size={14}/>
            </button>
            <button onClick={() => setVista('lista')} title="Vista de lista"
              style={{ ...styles.vistaBtn, ...(vista === 'lista' ? styles.vistaBtnActive : {}) }}>
              <List size={14}/>
            </button>
          </div>

          <button
            onClick={() => {
              if (window.confirm('Esto vuelve a calcular todas las zonas desde los reportes actuales. ¿Continuar?')) recalcular();
            }}
            disabled={recalculando}
            style={styles.recalcBtn}
            title="Útil si los reportes cambiaron (ej. tras un reseed) y las zonas quedaron desactualizadas">
            <RefreshCw size={13} style={recalculando ? { animation: 'spin 1s linear infinite' } : undefined}/>
            {recalculando ? 'Recalculando...' : 'Recalcular zonas'}
          </button>

          <div style={styles.exportGroup}>
            <span style={styles.exportLabel}>Exportar</span>
            <button onClick={descargarCSV} disabled={!zonas.length} style={styles.exportBtn}>
              <FileDown size={14}/> CSV
            </button>
            <button onClick={descargarPDF} disabled={!zonas.length} style={styles.exportBtn}>
              <FileText size={14}/> PDF
            </button>
          </div>
        </div>
      </div>

      {loading && <p>Cargando...</p>}
      {!loading && zonas.length === 0 && <p style={{ color: '#aaa' }}>No hay zonas en este estado.</p>}

      {vista === 'cards' ? (
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

                <div style={{ marginTop: 6 }}>
                  <span style={{ ...styles.nivelBadge, ...NIVEL_COLOR[z.nivel_riesgo] }}>
                    Riesgo {z.nivel_riesgo} · {z.riesgo_semanal}/sem
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
      ) : (
        <div style={styles.listWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Tipo predominante</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Riesgo</th>
                <th style={styles.th}>Radio</th>
                <th style={styles.th}>Lat/Lng</th>
                <th style={styles.th}>Detectada</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {zonas.map(z => (
                <tr key={z.id}>
                  <td style={styles.td}><span style={styles.tipoBadge}>{z.tipo_predominante}</span></td>
                  <td style={styles.td}><Users size={11} style={{ marginRight: 4, verticalAlign: -1 }}/>{z.total_reportes}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.nivelBadge, ...NIVEL_COLOR[z.nivel_riesgo] }}>
                      {z.nivel_riesgo} · {z.riesgo_semanal}/sem
                    </span>
                  </td>
                  <td style={styles.td}>{z.radio_metros}m</td>
                  <td style={styles.td}>{Number(z.lat).toFixed(4)}, {Number(z.lng).toFixed(4)}</td>
                  <td style={styles.td}>{new Date(z.primera_deteccion).toLocaleDateString('es-EC')}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => verEnMapa(z)} style={styles.mapBtnSmall}>
                        <MapPinned size={12}/>
                      </button>
                      {tab === 'pendiente' && (
                        <>
                          <button onClick={() => resolver(z.id, 'verificar')} style={{ ...styles.actionBtnSmall, background: '#1D9E75' }}>
                            <CheckCircle size={12}/>
                          </button>
                          <button onClick={() => resolver(z.id, 'descartar')} style={{ ...styles.actionBtnSmall, background: '#E24B4A' }}>
                            <XCircle size={12}/>
                          </button>
                        </>
                      )}
                      {(tab === 'verificada' || tab === 'descartada') && (
                        <button onClick={() => resolver(z.id, 'revertir')} style={{ ...styles.actionBtnSmall, background: '#888' }}>
                          <RotateCcw size={12}/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
  toolbarRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  tabs:         { display: 'flex', gap: 6 },
  tabBtn:       { padding: '6px 14px', border: '1px solid #eee', borderRadius: 20, background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer' },
  tabBtnActive: { background: '#1a1a1a', borderColor: '#1a1a1a', color: '#fff', fontWeight: 600 },
  exportGroup:  { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eee', borderRadius: 20, padding: '4px 6px 4px 14px' },
  exportLabel:  { fontSize: 12, color: '#aaa', marginRight: 2 },
  exportBtn:    { display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 16, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  recalcBtn:    { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#534AB7', border: '1px solid #d8d4f5', borderRadius: 20, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  select:       { padding: '7px 12px', borderRadius: 20, border: '1px solid #eee', fontSize: 12, background: '#fff', color: '#333' },
  vistaToggle:  { display: 'flex', background: '#fff', border: '1px solid #eee', borderRadius: 20, padding: 3, gap: 2 },
  vistaBtn:     { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 16, background: 'transparent', color: '#aaa', cursor: 'pointer' },
  vistaBtnActive: { background: '#1a1a1a', color: '#fff' },
  listWrap:     { overflowX: 'auto', background: '#fff', border: '1px solid #eee', borderRadius: 12 },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:           { textAlign: 'left', padding: '10px 12px', color: '#888', fontWeight: 600, borderBottom: '1px solid #eee', whiteSpace: 'nowrap' },
  td:           { padding: '9px 12px', borderBottom: '1px solid #f5f5f5', color: '#333', whiteSpace: 'nowrap' },
  mapBtnSmall:  { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, background: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: 6, color: '#0C447C', cursor: 'pointer' },
  actionBtnSmall: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  card:         { background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' },
  tipoBadge:    { fontSize: 12, fontWeight: 700, background: '#eeedfe', color: '#534AB7', padding: '3px 10px', borderRadius: 8 },
  totalBadge:   { fontSize: 12, fontWeight: 700, color: '#333', display: 'flex', alignItems: 'center', gap: 4 },
  nivelBadge:   { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, whiteSpace: 'nowrap' },
  meta:         { fontSize: 11, color: '#aaa', margin: '6px 0 2px' },
  mapBtn:       { width: '100%', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', background: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: 6, padding: '6px 8px', fontSize: 11, color: '#0C447C', cursor: 'pointer', marginTop: 8 },
  actionBtn:    { flex: 1, display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 11, cursor: 'pointer' },
};