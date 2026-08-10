//frontend/src/pages/ReportesExport.jsx
import { useState, useEffect } from 'react';
import { FileDown, FileText, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = `${import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001'}/api/reports`;

const TIPOS = [
  'Robo a persona', 'Robo a domicilio', 'Robo a vehículo',
  'Asalto a mano armada', 'Homicidio', 'Extorsión',
  'Vandalismo', 'Punto GDO', 'Otro',
];

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ZONAS = [
  { nombre: 'Socio Vivienda',              lat: -2.12214, lng: -79.95721 },
  { nombre: 'Monte Sinaí',                 lat: -2.11542, lng: -79.97015 },
  { nombre: 'El Guasmo Sur',               lat: -2.26182, lng: -79.89845 },
  { nombre: 'Isla Trinitaria',             lat: -2.24251, lng: -79.91632 },
  { nombre: 'Bastión Popular',             lat: -2.09115, lng: -79.93124 },
  { nombre: 'Febres Cordero (Suburbio)',   lat: -2.21453, lng: -79.93241 },
  { nombre: 'Pascuales Centro',            lat: -2.05941, lng: -79.90422 },
  { nombre: 'Cristo del Consuelo',         lat: -2.22635, lng: -79.91421 },
  { nombre: 'Sauces (Etapas 1-9)',         lat: -2.13142, lng: -79.89215 },
  { nombre: 'Alborada',                    lat: -2.14152, lng: -79.89942 },
  { nombre: 'Mucho Lote 1',                lat: -2.07841, lng: -79.91232 },
  { nombre: 'Puerto Santa Ana',            lat: -2.18025, lng: -79.87412 },
  { nombre: 'Urdesa Central',              lat: -2.16782, lng: -79.90924 },
  { nombre: 'Los Ceibos',                  lat: -2.16853, lng: -79.93815 },
  { nombre: 'Kennedy Norte',                lat: -2.15842, lng: -79.89124 },
  { nombre: 'Barrio Centenario',           lat: -2.22741, lng: -79.89312 },
];

const PERIODOS = [
  { label: 'Últimos 7 días',    valor: 7   },
  { label: 'Últimos 30 días',   valor: 30  },
  { label: 'Últimos 90 días',   valor: 90  },
  { label: 'Todo el histórico', valor: ''  },
];

export default function ReportesExport() {
  const [zonaNombre, setZonaNombre]         = useState('');
  const [radio, setRadio]                   = useState(1000);
  const [dias, setDias]                     = useState(30);
  const [mes, setMes]                       = useState('');
  const [diaSemana, setDiaSemana]           = useState('');
  const [horaMin, setHoraMin]               = useState('');
  const [horaMax, setHoraMax]               = useState('');
  const [tipo, setTipo]                     = useState('');
  const [severidadMin, setSevMin]           = useState(1);
  const [mesesTendencia, setMesesTendencia] = useState(3);

  const [resultados, setResultados] = useState(null);
  const [tendencia, setTendencia]   = useState(null);
  const [loading, setLoading]       = useState(false);

  const zona = ZONAS.find(z => z.nombre === zonaNombre) || null;

  const construirParams = () => {
    const params = new URLSearchParams();
    if (zona) { params.set('lat', zona.lat); params.set('lng', zona.lng); params.set('radio', radio); }
    if (dias) params.set('dias', dias);
    if (mes) params.set('mes', mes);
    if (diaSemana !== '') params.set('dia_semana', diaSemana);
    if (horaMin !== '') params.set('hora_min', horaMin);
    if (horaMax !== '') params.set('hora_max', horaMax);
    if (tipo) params.set('tipo', tipo);
    if (severidadMin > 1) params.set('severidad_min', severidadMin);
    return params;
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/exportar?${construirParams()}`);
      setResultados(await res.json());
    } catch {
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarTendencia = async () => {
    if (!zona) { setTendencia(null); return; }
    try {
      const res = await fetch(`${API}/tendencia-zona?lat=${zona.lat}&lng=${zona.lng}&radio=${radio}&meses=${mesesTendencia}`);
      setTendencia(await res.json());
    } catch {
      setTendencia(null);
    }
  };

  useEffect(() => { cargar(); }, [zonaNombre, radio, dias, mes, diaSemana, horaMin, horaMax, tipo, severidadMin]);
  useEffect(() => { cargarTendencia(); }, [zonaNombre, radio, mesesTendencia]);

  const nombreArchivo = () => `crimemap_reportes_${new Date().toISOString().slice(0, 10)}`;

  const resumenFiltros = () =>
    `Zona: ${zonaNombre || 'Todas'} | Período: ${dias || 'todo'} días | Mes: ${mes ? MESES[mes - 1] : 'todos'} | ` +
    `Día: ${diaSemana !== '' ? DIAS_SEMANA[diaSemana] : 'todos'} | Hora: ${horaMin || '0'}-${horaMax || '23'} | Tipo: ${tipo || 'todos'}`;

  const descargarCSV = () => {
    if (!resultados?.length) return;
    let csv = `CrimeMap GYE — Exportación de reportes\n`;
    csv += `Generado: ${new Date().toLocaleString('es-EC')}\n`;
    csv += `${resumenFiltros()}\n\n`;
    csv += 'ID,Tipo,Descripción,Severidad,Confirmaciones,Estado,Lat,Lng,Fecha\n';
    resultados.forEach(r => {
      const desc = (r.descripcion || '').replace(/,/g, ';').replace(/\n/g, ' ');
      csv += `${r.id},${r.tipo},"${desc}",${r.severidad},${r.confirmaciones},${r.estado},${r.lat},${r.lng},${r.created_at}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${nombreArchivo()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const descargarPDF = () => {
    if (!resultados?.length) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('CrimeMap GYE — Exportación de reportes', 14, 18);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, 14, 24);
    doc.text(resumenFiltros(), 14, 29);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 35,
      head: [['ID', 'Tipo', 'Sev.', 'Confirm.', 'Estado', 'Fecha']],
      body: resultados.map(r => [
        r.id, r.tipo, r.severidad, r.confirmaciones, r.estado,
        new Date(r.created_at).toLocaleDateString('es-EC'),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    doc.save(`${nombreArchivo()}.pdf`);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerTitle}><FileDown size={20} strokeWidth={2}/> Exportar reportes</div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}><Filter size={14}/> Filtros</div>
        <div style={styles.filtersGrid}>
          <label style={styles.label}>
            Zona
            <select value={zonaNombre} onChange={e => setZonaNombre(e.target.value)} style={styles.select}>
              <option value="">Todas las zonas</option>
              {ZONAS.map(z => <option key={z.nombre} value={z.nombre}>{z.nombre}</option>)}
            </select>
          </label>
          {zona && (
            <label style={styles.label}>
              Radio (m)
              <input type="number" value={radio} min={200} step={100}
                onChange={e => setRadio(Number(e.target.value))} style={styles.select}/>
            </label>
          )}
          <label style={styles.label}>
            Período
            <select value={dias} onChange={e => setDias(e.target.value)} style={styles.select}>
              {PERIODOS.map(p => <option key={p.label} value={p.valor}>{p.label}</option>)}
            </select>
          </label>
          <label style={styles.label}>
            Mes
            <select value={mes} onChange={e => setMes(e.target.value)} style={styles.select}>
              <option value="">Todos</option>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label style={styles.label}>
            Día de la semana
            <select value={diaSemana} onChange={e => setDiaSemana(e.target.value)} style={styles.select}>
              <option value="">Todos</option>
              {DIAS_SEMANA.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
          <label style={styles.label}>
            Hora desde
            <input type="number" min={0} max={23} value={horaMin}
              onChange={e => setHoraMin(e.target.value)} style={styles.select} placeholder="0"/>
          </label>
          <label style={styles.label}>
            Hora hasta
            <input type="number" min={0} max={23} value={horaMax}
              onChange={e => setHoraMax(e.target.value)} style={styles.select} placeholder="23"/>
          </label>
          <label style={styles.label}>
            Tipo de incidente
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={styles.select}>
              <option value="">Todos</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={styles.label}>
            Severidad mínima
            <select value={severidadMin} onChange={e => setSevMin(Number(e.target.value))} style={styles.select}>
              {[1, 2, 3, 4, 5].map(s => <option key={s} value={s}>{s}+</option>)}
            </select>
          </label>
        </div>
      </div>

      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>{loading ? '…' : (resultados?.length ?? 0)}</div>
          <div style={styles.kpiLabel}>Reportes encontrados</div>
        </div>
      </div>

      {zona && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}><TrendingUp size={14}/> Tendencia en {zona.nombre}</div>
          <div style={styles.tendenciaControls}>
            <span style={{ fontSize: 12, color: '#666' }}>Comparar últimos</span>
            <select value={mesesTendencia} onChange={e => setMesesTendencia(Number(e.target.value))} style={styles.selectInline}>
              {[1, 2, 3, 6].map(m => <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>)}
            </select>
          </div>
          {tendencia && tendencia.variacion_pct !== null ? (
            <>
              <div style={{
                ...styles.tendenciaBadge,
                background: tendencia.variacion_pct > 0 ? '#faeaea' : '#e1f5ee',
                color:      tendencia.variacion_pct > 0 ? '#E24B4A' : '#1D9E75',
              }}>
                {tendencia.variacion_pct > 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                {tendencia.variacion_pct > 0 ? '+' : ''}{tendencia.variacion_pct}%
              </div>
              <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                {tendencia.actual} denuncias en los últimos {mesesTendencia} {mesesTendencia === 1 ? 'mes' : 'meses'},
                frente a {tendencia.anterior} en el período anterior.
              </p>
            </>
          ) : (
            <p style={{ color: '#aaa', fontSize: 12 }}>Sin datos suficientes del período anterior para comparar.</p>
          )}
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.sectionTitle}><FileText size={14}/> Exportar</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={descargarCSV} disabled={!resultados?.length} style={styles.btnSecondary}>
            <FileDown size={14}/> Descargar CSV
          </button>
          <button onClick={descargarPDF} disabled={!resultados?.length} style={styles.btn}>
            <FileText size={14}/> Descargar PDF
          </button>
        </div>

        {resultados && resultados.length > 0 && (
          <div style={styles.previewWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Sev.</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {resultados.slice(0, 10).map(r => (
                  <tr key={r.id}>
                    <td style={styles.td}>{r.tipo}</td>
                    <td style={styles.td}>{r.severidad}</td>
                    <td style={styles.td}>{r.estado}</td>
                    <td style={styles.td}>{new Date(r.created_at).toLocaleDateString('es-EC')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {resultados.length > 10 && (
              <p style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
                Mostrando 10 de {resultados.length} — descarga el archivo para ver todos.
              </p>
            )}
          </div>
        )}
        {resultados && resultados.length === 0 && !loading && (
          <p style={{ color: '#aaa', fontSize: 12, marginTop: 10 }}>Sin reportes para estos filtros.</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  page:           { padding: 24, maxWidth: 720, margin: '0 auto', fontFamily: '-apple-system,sans-serif' },
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle:    { display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700 },
  section:        { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 18, marginBottom: 16 },
  sectionTitle:   { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, marginBottom: 14 },
  filtersGrid:    { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  label:          { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: '#888', fontWeight: 600 },
  select:         { padding: '8px 10px', borderRadius: 8, border: '1px solid #eee', fontSize: 13, color: '#1a1a1a' },
  selectInline:   { padding: '5px 8px', borderRadius: 6, border: '1px solid #eee', fontSize: 12, color: '#1a1a1a' },
  kpiRow:         { display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 },
  kpiCard:        { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16, textAlign: 'center' },
  kpiValue:       { fontSize: 26, fontWeight: 700, color: '#1a1a1a' },
  kpiLabel:       { fontSize: 11, color: '#888', marginTop: 4 },
  tendenciaControls: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  tendenciaBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 700, padding: '8px 16px', borderRadius: 10 },
  btn:            { display: 'flex', alignItems: 'center', gap: 6, background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnSecondary:   { display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', color: '#333', border: '1px solid #eee', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  previewWrap:    { marginTop: 16, overflowX: 'auto' },
  table:          { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:             { textAlign: 'left', padding: '6px 8px', color: '#888', fontWeight: 600, borderBottom: '1px solid #eee' },
  td:             { padding: '6px 8px', borderBottom: '1px solid #f5f5f5', color: '#333' },
};
