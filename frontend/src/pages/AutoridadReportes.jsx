//frontend/src/pages/AutoridadReportes.jsx
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, MapPin, RotateCcw, Map as MapIcon, FileDown, FileText } from 'lucide-react';
import MapModal from '../components/MapModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TIPOS = [
  'Robo a persona', 'Robo a domicilio', 'Robo a vehículo',
  'Asalto a mano armada', 'Homicidio', 'Extorsión',
  'Vandalismo', 'Punto GDO', 'Otro',
];const PERIODOS = [
  { label: 'Últimas 24h',      valor: 1   },
  { label: 'Últimos 7 días',   valor: 7   },
  { label: 'Últimos 30 días',  valor: 30  },
  { label: 'Todo',             valor: ''  },
];
const API = 'http://localhost:3001/api/authority';
const GEOCODE_API = 'http://localhost:3001/api/geocode';
const LIMIT = 12;

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} d`;
}

export default function AutoridadReportes({ secret }) {
  const [tab, setTab]                 = useState('pendientes');
  const [reportes, setReportes]       = useState([]);
  const [direcciones, setDirecciones] = useState({});
  const [loading, setLoading]         = useState(true);
  const [filtroTipo, setFiltroTipo]   = useState('');
  const [severidadMin, setSevMin]     = useState(1);
  const [dias, setDias]               = useState(30);
  const [orden, setOrden]             = useState('recientes');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [mapaAbierto, setMapaAbierto] = useState(null);

  const headers = { 'x-authority-secret': secret };

  const cargarReportes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', LIMIT);
      if (dias) params.set('dias', dias);
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (severidadMin > 1) params.set('severidad_min', severidadMin);
      params.set('orden', orden);

      const url = tab === 'pendientes'
        ? `${API}/pendientes?${params}`
        : `${API}/revisados?estado=${tab === 'aprobados' ? 'aprobado' : 'rechazado'}&${params}`;

      const res  = await fetch(url, { headers });
      const { data, totalPages: tp } = await res.json();
      setReportes(data);
      setTotalPages(tp || 1);
      cargarDirecciones(data);
    } finally {
      setLoading(false);
    }
  };

  const cargarDirecciones = async (lista) => {
    lista.forEach(async (r) => {
      if (direcciones[r.id]) return;
      try {
        const res = await fetch(`${GEOCODE_API}/reverse?lat=${r.lat}&lng=${r.lng}`);
        const data = await res.json();
        setDirecciones(prev => ({ ...prev, [r.id]: data.address }));
      } catch {
        setDirecciones(prev => ({ ...prev, [r.id]: 'Dirección no disponible' }));
      }
    });
  };

  useEffect(() => { cargarReportes(); }, [tab, page, dias, filtroTipo, severidadMin, orden]);
  useEffect(() => { setPage(1); }, [tab, dias, filtroTipo, severidadMin, orden]);

  const resolver = async (id, accion) => {
    await fetch(`${API}/${id}/${accion}`, { method: 'POST', headers });
    cargarReportes();
  };
  const exportarDatos = async () => {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (dias) params.set('dias', dias);
  if (filtroTipo) params.set('tipo', filtroTipo);
  if (severidadMin > 1) params.set('severidad_min', severidadMin);
  params.set('orden', orden);

  const res = await fetch(`${API}/exportar?${params}`, { headers });
  return res.json();
};

const descargarCSV = async () => {
  const datos = await exportarDatos();
  let csv = `CrimeMap GYE — Reportes (${tab})\n`;
  csv += `Generado: ${new Date().toLocaleString('es-EC')}\n`;
  csv += `Filtros: tipo=${filtroTipo || 'todos'}, dias=${dias || 'todo'}, severidad_min=${severidadMin}\n\n`;
  csv += 'ID,Tipo,Descripción,Severidad,Confirmaciones,Estado,Lat,Lng,Fecha\n';
  datos.forEach(r => {
    const desc = (r.descripcion || '').replace(/,/g, ';').replace(/\n/g, ' ');
    csv += `${r.id},${r.tipo},"${desc}",${r.severidad},${r.confirmaciones},${r.estado},${r.lat},${r.lng},${r.created_at}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `crimemap_reportes_${tab}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const descargarPDF = async () => {
  const datos = await exportarDatos();
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`CrimeMap GYE — Reportes (${tab})`, 14, 18);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(120);
  doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, 14, 24);
  doc.text(`Filtros: tipo=${filtroTipo || 'todos'} | días=${dias || 'todo'} | severidad mín=${severidadMin}`, 14, 29);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 35,
    head: [['ID', 'Tipo', 'Sev.', 'Confirm.', 'Estado', 'Fecha']],
    body: datos.map(r => [
      r.id, r.tipo, r.severidad, r.confirmaciones, r.estado,
      new Date(r.created_at).toLocaleDateString('es-EC'),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 26] },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  doc.save(`crimemap_reportes_${tab}_${new Date().toISOString().slice(0,10)}.pdf`);
};

  return (
    <div>
      <h2 style={{ margin: '0 0 16px' }}>Reportes</h2>

      <div style={styles.tabs}>
        {[
          { id: 'pendientes', label: 'Pendientes' },
          { id: 'aprobados',  label: 'Aprobados'  },
          { id: 'rechazados', label: 'Rechazados' },
        ].map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={styles.toolbarRow}>
  <div style={styles.filtersRow}>
    <select value={dias} onChange={e => setDias(e.target.value)} style={styles.select}>
      {PERIODOS.map(p => (
        <option key={p.label} value={p.valor}>{p.label}</option>
      ))}
    </select>

    <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={styles.select}>
      <option value="">Todos los tipos</option>
      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
    </select>

    <select value={orden} onChange={e => setOrden(e.target.value)} style={styles.select}>
      <option value="recientes">Más recientes</option>
      <option value="antiguos">Más antiguos</option>
    </select>

    <div style={styles.sevFilter}>
      <span style={{ fontSize: 12, color: '#888' }}>Severidad mín: {severidadMin}</span>
      <input type="range" min="1" max="5" value={severidadMin}
        onChange={e => setSevMin(Number(e.target.value))} style={{ width: 100 }} />
    </div>
  </div>

  <div style={styles.exportGroup}>
    <span style={styles.exportLabel}>Exportar</span>
    <button onClick={descargarCSV} style={styles.exportBtn}>
      <FileDown size={14}/> CSV
    </button>
    <button onClick={descargarPDF} style={styles.exportBtn}>
      <FileText size={14}/> PDF
    </button>
  </div>

</div>

      {loading && <p>Cargando...</p>}
      {!loading && reportes.length === 0 && <p style={{ color: '#aaa' }}>No hay reportes con estos filtros.</p>}

      <div style={styles.grid}>
        {reportes.map(r => (
          <div key={r.id} style={styles.card}>
            <div style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13 }}>{r.tipo}</strong>
                <span style={styles.timeLabel}>
                  <Clock size={11} /> {timeAgo(r.created_at)}
                </span>
              </div>

              {r.descripcion && <p style={styles.desc}>{r.descripcion}</p>}

              <p style={styles.direccion}>
                <MapPin size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{direcciones[r.id] || 'Buscando dirección...'}</span>
              </p>

              <p style={styles.meta}>Sev. {r.severidad} · {r.confirmaciones} confirm.</p>

              <button onClick={() => setMapaAbierto(r)} style={styles.mapBtn}>
                <MapIcon size={13} /> Ver en mapa
              </button>

              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {tab === 'pendientes' && (
                  <>
                    <button onClick={() => resolver(r.id, 'aprobar')} style={{ ...styles.actionBtn, background: '#1D9E75' }}>
                      <CheckCircle size={13} /> Aprobar
                    </button>
                    <button onClick={() => resolver(r.id, 'rechazar')} style={{ ...styles.actionBtn, background: '#E24B4A' }}>
                      <XCircle size={13} /> Rechazar
                    </button>
                  </>
                )}
                {(tab === 'aprobados' || tab === 'rechazados') && (
                  <button onClick={() => resolver(r.id, 'revertir')} style={{ ...styles.actionBtn, background: '#888', width: '100%' }}>
                    <RotateCcw size={13} /> Revertir
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ ...styles.pageBtn, ...(page === 1 ? styles.pageBtnDisabled : {}) }}>
            ← Anterior
          </button>
          <span style={styles.pageInfo}>Página {page} de {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ ...styles.pageBtn, ...(page === totalPages ? styles.pageBtnDisabled : {}) }}>
            Siguiente →
          </button>
        </div>
      )}

      {mapaAbierto && (
        <MapModal
          lat={mapaAbierto.lat}
          lng={mapaAbierto.lng}
          tipo={mapaAbierto.tipo}
          onClose={() => setMapaAbierto(null)}
        />
      )}
    </div>
  );
}

const styles = {
  tabs:            { display: 'flex', gap: 6, marginBottom: 12 },
  tabBtn:          { padding: '6px 14px', border: '1px solid #eee', borderRadius: 20, background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer' },
  tabBtnActive:    { background: '#1a1a1a', borderColor: '#1a1a1a', color: '#fff', fontWeight: 600 },
  filtersRow:      { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  select:          { padding: '6px 10px', borderRadius: 8, border: '1px solid #eee', fontSize: 13, background: '#fff' },
  sevFilter:       { display: 'flex', alignItems: 'center', gap: 8 },
  grid:            { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  card:            { background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' },
  timeLabel:       { fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 3 },
  desc:            { fontSize: 12, color: '#555', margin: '4px 0' },
  direccion:       { fontSize: 11, color: '#666', display: 'flex', gap: 4, margin: '6px 0', lineHeight: 1.3 },
  meta:            { fontSize: 11, color: '#aaa', margin: '2px 0' },
  mapBtn:          { width: '100%', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', background: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: 6, padding: '6px 8px', fontSize: 11, color: '#0C447C', cursor: 'pointer', marginTop: 6 },
  actionBtn:       { flex: 1, display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 11, cursor: 'pointer' },
  pagination:      { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 },
  pageBtn:         { padding: '7px 16px', border: '1px solid #eee', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#333' },
  pageBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  pageInfo:        { fontSize: 12, color: '#888' },
  toolbarRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 },
  filtersRow:   { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  select:       { padding: '8px 12px', borderRadius: 20, border: '1px solid #eee', fontSize: 13, background: '#fff', color: '#333' },
  sevFilter:    { display: 'flex', alignItems: 'center', gap: 8 },
  exportGroup:  { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eee', borderRadius: 20, padding: '4px 6px 4px 14px' },
  exportLabel:  { fontSize: 12, color: '#aaa', marginRight: 2 },
  exportBtn:    { display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 16, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};