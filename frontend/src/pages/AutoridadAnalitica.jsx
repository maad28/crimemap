//frontend/src/pages/AutoridadAnalitica.jsx
import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Map, FileDown, FileText } from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE = import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001';

const ZONAS_CENTROS = [
  { nombre: 'Socio Vivienda',            lat: -2.12214, lng: -79.95721 },
  { nombre: 'Monte Sinaí',               lat: -2.11542, lng: -79.97015 },
  { nombre: 'El Guasmo Sur',             lat: -2.26182, lng: -79.89845 },
  { nombre: 'Isla Trinitaria',           lat: -2.24251, lng: -79.91632 },
  { nombre: 'Bastión Popular',           lat: -2.09115, lng: -79.93124 },
  { nombre: 'Febres Cordero (Suburbio)', lat: -2.21453, lng: -79.93241 },
  { nombre: 'Pascuales Centro',          lat: -2.05941, lng: -79.90422 },
  { nombre: 'Cristo del Consuelo',       lat: -2.22635, lng: -79.91421 },
  { nombre: 'Sauces (Etapas 1-9)',       lat: -2.13142, lng: -79.89215 },
  { nombre: 'Alborada',                  lat: -2.14152, lng: -79.89942 },
  { nombre: 'Mucho Lote 1',              lat: -2.07841, lng: -79.91232 },
  { nombre: 'Puerto Santa Ana',          lat: -2.18025, lng: -79.87412 },
  { nombre: 'Urdesa Central',            lat: -2.16782, lng: -79.90924 },
  { nombre: 'Los Ceibos',                lat: -2.16853, lng: -79.93815 },
  { nombre: 'Kennedy Norte',             lat: -2.15842, lng: -79.89124 },
  { nombre: 'Barrio Centenario',         lat: -2.22741, lng: -79.89312 },
];

const NIVEL_COLOR = {
  ALTO:  { bg: '#fff0f0', color: '#E24B4A' },
  MEDIO: { bg: '#faeeda', color: '#BA7517' },
  BAJO:  { bg: '#e1f5ee', color: '#1D9E75' },
};

function nombreZona(lat, lng) {
  let mejor = null, mejorDist = Infinity;
  for (const z of ZONAS_CENTROS) {
    const dist = Math.hypot(lat - z.lat, lng - z.lng);
    if (dist < mejorDist) { mejorDist = dist; mejor = z; }
  }
  return mejor && mejorDist < 0.05 ? mejor.nombre : `Zona ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
}

export default function AutoridadAnalitica({ secret }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const headers = { 'x-authority-secret': secret };

  useEffect(() => {
    fetch(`${API_BASE}/api/authority/analitica`, { headers })
      .then(r => r.json())
      .then(d => {
        setData({
          ...d,
          tendencia: d.tendencia.map(t => ({
            ...t,
            fecha:      new Date(t.fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit' }),
            total:      Number(t.total),
            robos:      Number(t.robos),
            asaltos:    Number(t.asaltos),
            homicidios: Number(t.homicidios),
            gdo:        Number(t.gdo),
          })),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando analítica...</p>;
  if (!data) return <p>No se pudo cargar la analítica.</p>;

  const { totales, por_tipo, tendencia, zonas } = data;
  const maxZona = zonas[0]?.riesgo_semanal || 1;

  const descargarCSV = () => {
    let csv = `CrimeMap GYE — Analítica\n`;
    csv += `Generado: ${new Date().toLocaleString('es-EC')}\n\n`;
    csv += 'RESUMEN\n';
    csv += `Total denuncias,${totales.total_denuncias}\n`;
    csv += `Pendientes,${totales.pendientes}\n`;
    csv += `Aprobados,${totales.aprobados}\n`;
    csv += `Rechazados,${totales.rechazados}\n`;
    csv += `Tasa de aprobación,${totales.tasa_aprobacion_pct ?? 0}%\n\n`;
    csv += 'POR TIPO\nTipo,Total,Pendientes,Aprobados,Rechazados\n';
    por_tipo.forEach(t => { csv += `${t.tipo},${t.total},${t.pendientes},${t.aprobados},${t.rechazados}\n`; });
    csv += '\nZONAS CON MÁS RIESGO\nZona,Total,Severidad promedio,Riesgo/semana,Nivel riesgo\n';
    zonas.forEach(z => { csv += `${nombreZona(Number(z.lat_zona), Number(z.lng_zona))},${z.total},${Number(z.severidad_promedio).toFixed(2)},${z.riesgo_semanal},${z.nivel_riesgo}\n`; });
    csv += '\nTENDENCIA DIARIA (30 días)\nFecha,Total,Robos,Asaltos,Homicidios,GDO\n';
    tendencia.forEach(t => { csv += `${t.fecha},${t.total},${t.robos},${t.asaltos},${t.homicidios},${t.gdo}\n`; });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crimemap_analitica_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const descargarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('CrimeMap GYE — Analítica', 14, 18);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, 14, 24);
    doc.text(
      `Total: ${totales.total_denuncias} | Pendientes: ${totales.pendientes} | Aprobados: ${totales.aprobados} | Rechazados: ${totales.rechazados} | Tasa aprobación: ${totales.tasa_aprobacion_pct ?? 0}%`,
      14, 29
    );
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 35,
      head: [['Tipo', 'Total', 'Pendientes', 'Aprobados', 'Rechazados']],
      body: por_tipo.map(t => [t.tipo, t.total, t.pendientes, t.aprobados, t.rechazados]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Zona', 'Total', 'Severidad promedio', 'Riesgo/semana', 'Nivel']],
      body: zonas.map(z => [
        nombreZona(Number(z.lat_zona), Number(z.lng_zona)), z.total, Number(z.severidad_promedio).toFixed(2),
        z.riesgo_semanal, z.nivel_riesgo,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    doc.save(`crimemap_analitica_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div>
      <div style={styles.headerRow}>
        <h2 style={{ margin: 0 }}>Analítica</h2>
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

      {/* KPIs generales */}
      <div style={styles.kpisRow}>
        <div style={{ ...styles.kpiBox, background: '#f5f5f5' }}>
          <div style={{ ...styles.kpiNum, color: '#1a1a1a' }}>{totales.total_denuncias}</div>
          <div style={styles.kpiLabel}>Total denuncias</div>
        </div>
        <div style={{ ...styles.kpiBox, background: '#faeeda' }}>
          <div style={{ ...styles.kpiNum, color: '#BA7517' }}>{totales.pendientes}</div>
          <div style={styles.kpiLabel}>Pendientes</div>
        </div>
        <div style={{ ...styles.kpiBox, background: '#e1f5ee' }}>
          <div style={{ ...styles.kpiNum, color: '#1D9E75' }}>{totales.aprobados}</div>
          <div style={styles.kpiLabel}>Aprobados</div>
        </div>
        <div style={{ ...styles.kpiBox, background: '#eeedfe' }}>
          <div style={{ ...styles.kpiNum, color: '#534AB7' }}>{totales.tasa_aprobacion_pct ?? 0}%</div>
          <div style={styles.kpiLabel}>Tasa de aprobación</div>
        </div>
      </div>

      {/* Tendencia de denuncias */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <TrendingUp size={15} strokeWidth={2} /> Denuncias hechas — últimos 30 días
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={tendencia} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="gradAutTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#534AB7" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#534AB7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#bbb' }} tickLine={false} axisLine={false}
                   interval={Math.ceil(tendencia.length / 8)} />
            <YAxis tick={{ fontSize: 10, fill: '#bbb' }} tickLine={false} axisLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="total" name="Total denuncias"
              stroke="#534AB7" strokeWidth={2} fill="url(#gradAutTotal)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.row2}>
        {/* Por tipo */}
        <div style={{ ...styles.section, flex: 1, minWidth: 280 }}>
          <div style={styles.sectionTitle}>
            <BarChart2 size={15} strokeWidth={2} /> Denuncias por tipo
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={por_tipo} margin={{ top: 10, right: 10, left: -20, bottom: 5 }} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="tipo" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#bbb' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="total" name="Total" fill="#1a1a1a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Zonas */}
        <div style={{ ...styles.section, flex: 1, minWidth: 280 }}>
          <div style={styles.sectionTitle}>
            <Map size={15} strokeWidth={2} /> Zonas con más riesgo
          </div>
          <div style={styles.zonaList}>
            {zonas.map((z, i) => {
              const nombre = nombreZona(Number(z.lat_zona), Number(z.lng_zona));
              const pct    = Math.round((z.riesgo_semanal / maxZona) * 100);
              return (
                <div key={i} style={styles.zonaRow}>
                  <div style={styles.zonaRank}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.zonaTop}>
                      <span style={styles.zonaNombre}>{nombre}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ ...styles.nivelBadge, ...NIVEL_COLOR[z.nivel_riesgo] }}>{z.nivel_riesgo}</span>
                        <span style={styles.zonaTotal}>{z.total} rep.</span>
                      </span>
                    </div>
                    <div style={styles.zonaBar}>
                      <div style={{ ...styles.zonaBarFill, width: `${pct}%`, background: NIVEL_COLOR[z.nivel_riesgo].color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  headerRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  exportGroup:  { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eee', borderRadius: 20, padding: '4px 6px 4px 14px' },
  exportLabel:  { fontSize: 12, color: '#aaa', marginRight: 2 },
  exportBtn:    { display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 16, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  kpisRow:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 },
  kpiBox:       { borderRadius: 10, padding: 16, textAlign: 'center' },
  kpiNum:       { fontSize: 24, fontWeight: 700 },
  kpiLabel:     { fontSize: 11, color: '#888', marginTop: 4 },
  section:      { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 },
  row2:         { display: 'flex', gap: 16, flexWrap: 'wrap' },
  zonaList:     { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 },
  zonaRow:      { display: 'flex', gap: 8, alignItems: 'center' },
  nivelBadge:   { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, whiteSpace: 'nowrap' },
  zonaRank:     { fontSize: 14, fontWeight: 700, color: '#aaa', minWidth: 16 },
  zonaTop:      { display: 'flex', justifyContent: 'space-between', marginBottom: 3 },
  zonaNombre:   { fontSize: 12, fontWeight: 600, color: '#333' },
  zonaTotal:    { fontSize: 12, fontWeight: 700, color: '#534AB7' },
  zonaBar:      { height: 5, background: '#f0f0f0', borderRadius: 3 },
  zonaBarFill:  { height: 5, borderRadius: 3, background: '#534AB7' },
};