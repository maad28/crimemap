//frontend/src/pages/ReporteGeneral.jsx
import { useState, useEffect } from 'react';
import { FileDown, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = 'http://localhost:3001/api/admin';

export default function ReporteGeneral({ secret, rol }) {
  // rol = 'admin' o 'autoridad'
  const headerName = rol === 'admin' ? 'x-admin-secret' : 'x-authority-secret';
  const headers = { [headerName]: secret };

  useEffect(() => {
    fetch(`http://localhost:3001/api/reporte-general`, { headers })
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const descargarCSV = () => {
    if (!data) return;
    let csv = 'CrimeMap GYE — Reporte General\n';
    csv += `Generado: ${new Date(data.generado_en).toLocaleString('es-EC')}\n\n`;

    csv += 'RESUMEN GENERAL\n';
    csv += `Total reportes,${data.totales.total_reportes}\n`;
    csv += `Pendientes,${data.totales.pendientes}\n`;
    csv += `Aprobados,${data.totales.aprobados}\n`;
    csv += `Rechazados,${data.totales.rechazados}\n`;
    csv += `Dispositivos únicos,${data.totales.dispositivos_unicos}\n`;
    csv += `Confirmaciones totales,${data.totales.confirmaciones_totales}\n`;
    csv += `Severidad promedio,${data.totales.severidad_promedio}\n\n`;

    csv += 'POR TIPO DE INCIDENTE\n';
    csv += 'Tipo,Total,Severidad promedio,Confirmaciones\n';
    data.por_tipo.forEach(t => {
      csv += `${t.tipo},${t.total},${t.severidad_promedio},${t.confirmaciones}\n`;
    });
    csv += '\n';

    csv += 'ZONAS DE CONCENTRACIÓN\n';
    csv += 'ID,Tipo predominante,Total reportes,Radio (m),Estado,Lat,Lng\n';
    data.zonas.forEach(z => {
      csv += `${z.id},${z.tipo_predominante},${z.total_reportes},${z.radio_metros},${z.estado},${z.lat},${z.lng}\n`;
    });
    csv += '\n';

    csv += 'REPUTACIÓN DE DISPOSITIVOS\n';
    csv += `Total dispositivos,${data.reputacion.total_dispositivos}\n`;
    csv += `Bloqueados,${data.reputacion.bloqueados}\n`;
    csv += `Confiables (≥130 pts),${data.reputacion.confiables}\n`;
    csv += `Puntos promedio,${data.reputacion.puntos_promedio}\n\n`;

    csv += 'ALERTAS DE SEGURIDAD\n';
    csv += 'Tipo,Total,Revisadas\n';
    data.alertas.forEach(a => {
      csv += `${a.tipo_alerta},${a.total},${a.revisadas}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `crimemap_reporte_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const descargarPDF = () => {
    if (!data) return;

    const doc = new jsPDF();
    const fecha = new Date(data.generado_en).toLocaleString('es-EC');
    let y = 20;

    // Encabezado
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('CrimeMap GYE — Reporte General', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120);
    doc.text(`Generado: ${fecha}`, 14, y);
    doc.setTextColor(0);
    y += 10;

    // Sección: Resumen general
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Resumen general', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total reportes', data.totales.total_reportes],
        ['Pendientes', data.totales.pendientes],
        ['Aprobados', data.totales.aprobados],
        ['Rechazados', data.totales.rechazados],
        ['Dispositivos únicos', data.totales.dispositivos_unicos],
        ['Confirmaciones totales', data.totales.confirmaciones_totales],
        ['Severidad promedio', data.totales.severidad_promedio],
      ],
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 12;

    // Sección: Por tipo de incidente
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Distribución por tipo de incidente', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Total', 'Severidad prom.', 'Confirmaciones']],
      body: data.por_tipo.map(t => [t.tipo, t.total, t.severidad_promedio, t.confirmaciones]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 12;

    // Nueva página si no hay espacio suficiente
    if (y > 240) { doc.addPage(); y = 20; }

    // Sección: Zonas de concentración
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Zonas de concentración', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['ID', 'Tipo predominante', 'Reportes', 'Radio (m)', 'Estado']],
      body: data.zonas.map(z => [z.id, z.tipo_predominante, z.total_reportes, z.radio_metros, z.estado]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 12;

    if (y > 220) { doc.addPage(); y = 20; }

    // Sección: Reputación de dispositivos
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Reputación de dispositivos', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total dispositivos', data.reputacion.total_dispositivos],
        ['Bloqueados', data.reputacion.bloqueados],
        ['Confiables (≥130 pts)', data.reputacion.confiables],
        ['Puntos promedio', data.reputacion.puntos_promedio],
      ],
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 12;

    if (y > 240) { doc.addPage(); y = 20; }

    // Sección: Alertas
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Alertas de actividad sospechosa', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Tipo de alerta', 'Total', 'Revisadas']],
      body: data.alertas.map(a => [a.tipo_alerta, a.total, a.revisadas]),
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    // Pie de página en todas las hojas
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`CrimeMap GYE — Página ${p} de ${totalPages}`, 14, 290);
    }

    doc.save(`crimemap_reporte_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  if (loading) return <p>Generando reporte...</p>;
  if (!data)   return <p>No se pudo generar el reporte.</p>;

  return (
    <div>
      <div style={styles.headerRow}>
        <h2 style={{ margin: 0 }}>Reporte general del sistema</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={descargarCSV} style={styles.btnSecondary}>
            <FileDown size={14}/> CSV
          </button>
          <button onClick={descargarPDF} style={styles.btn}>
            <FileText size={14}/> Descargar PDF
          </button>
        </div>
      </div>
      <p style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
        Generado: {new Date(data.generado_en).toLocaleString('es-EC')}
      </p>

      <Section titulo="Resumen general">
        <Grid items={[
          ['Total reportes', data.totales.total_reportes],
          ['Pendientes', data.totales.pendientes],
          ['Aprobados', data.totales.aprobados],
          ['Rechazados', data.totales.rechazados],
          ['Dispositivos únicos', data.totales.dispositivos_unicos],
          ['Confirmaciones totales', data.totales.confirmaciones_totales],
          ['Severidad promedio', data.totales.severidad_promedio],
        ]}/>
      </Section>

      <Section titulo="Distribución por tipo de incidente">
        <table style={styles.table}>
          <thead><tr><th>Tipo</th><th>Total</th><th>Severidad prom.</th><th>Confirmaciones</th></tr></thead>
          <tbody>
            {data.por_tipo.map(t => (
              <tr key={t.tipo}>
                <td>{t.tipo}</td><td>{t.total}</td><td>{t.severidad_promedio}</td><td>{t.confirmaciones}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section titulo="Zonas de concentración">
        <table style={styles.table}>
          <thead><tr><th>ID</th><th>Tipo predominante</th><th>Reportes</th><th>Radio (m)</th><th>Estado</th></tr></thead>
          <tbody>
            {data.zonas.map(z => (
              <tr key={z.id}>
                <td>{z.id}</td><td>{z.tipo_predominante}</td><td>{z.total_reportes}</td>
                <td>{z.radio_metros}</td><td>{z.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section titulo="Reputación de dispositivos">
        <Grid items={[
          ['Total dispositivos', data.reputacion.total_dispositivos],
          ['Bloqueados', data.reputacion.bloqueados],
          ['Confiables (≥130 pts)', data.reputacion.confiables],
          ['Puntos promedio', data.reputacion.puntos_promedio],
        ]}/>
      </Section>

      <Section titulo="Alertas de actividad sospechosa">
        <table style={styles.table}>
          <thead><tr><th>Tipo de alerta</th><th>Total</th><th>Revisadas</th></tr></thead>
          <tbody>
            {data.alertas.map(a => (
              <tr key={a.tipo_alerta}><td>{a.tipo_alerta}</td><td>{a.total}</td><td>{a.revisadas}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ titulo, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{titulo}</div>
      {children}
    </div>
  );
}

function Grid({ items }) {
  return (
    <div style={styles.grid}>
      {items.map(([label, value]) => (
        <div key={label} style={styles.gridItem}>
          <div style={styles.gridValue}>{value}</div>
          <div style={styles.gridLabel}>{label}</div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  headerRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  btn:          { display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' },
  btnSecondary: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#333', border: '1px solid #eee', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' },
  section:      { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16, marginTop: 16 },
  sectionTitle: { fontWeight: 700, fontSize: 14, marginBottom: 10 },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  gridItem:     { background: '#fafafa', borderRadius: 8, padding: 10, textAlign: 'center' },
  gridValue:    { fontSize: 20, fontWeight: 700 },
  gridLabel:    { fontSize: 10, color: '#888', marginTop: 2 },
  table:        { width: '100%', fontSize: 12, borderCollapse: 'collapse' },
};