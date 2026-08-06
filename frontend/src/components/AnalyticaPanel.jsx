
//Users/mac/crimemap/frontend/src/components/AnalyticaPanel.jsx
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, MapPin, Calendar, Clock } from 'lucide-react';

const TIPO_COLORS = {
  'Robo a persona':'#E24B4A',
  'Robo a domicilio':'#D85A30',
  'Robo a vehículo':'#F0997B',
  'Asalto a mano armada':'#BA7517',
  'Homicidio':'#791F1F',
  'Extorsión':'#993556',
  'Vandalismo':'#1D9E75',
  'Punto GDO':'#534AB7',
  'Otro':'#888',
};

export default function AnalyticaPanel({ reports }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!reports.length) return;

    // Conteo por tipo
    const porTipo = {};
    reports.forEach(r => {
      porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
    });

    // Conteo por hora
    const porHora = Array(24).fill(0);
    reports.forEach(r => {
      const h = new Date(r.created_at).getHours();
      porHora[h]++;
    });

    // Hora pico
    const horaPico = porHora.indexOf(Math.max(...porHora));

    // Severidad promedio
    const sevProm = reports.reduce((a, r) => a + r.severidad, 0) / reports.length;

    // Confirmaciones totales
    const totalConfirm = reports.reduce((a, r) => a + r.confirmaciones, 0);

    // Tipo más frecuente
    const tipoTop = Object.entries(porTipo).sort((a,b) => b[1]-a[1])[0]?.[0];

    const hoy = reports.filter(r => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d.getDate()===now.getDate() && d.getMonth()===now.getMonth();
  }).length;
    setStats({ porTipo, porHora, horaPico,hoy, totalConfirm, tipoTop, total: reports.length });
  }, [reports]);

  if (!stats) return (
    <div style={styles.empty}>Mueve el mapa para cargar datos de la zona</div>
  );

  const tipoData = Object.entries(stats.porTipo).map(([tipo, total]) => ({ tipo, total }));

  const horaData = stats.porHora.map((total, hora) => ({
    hora: `${hora}h`, total,
  }));

  return (
    <div style={styles.wrapper}>

      {/* KPIs */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <MapPin size={14} color="#E24B4A" strokeWidth={2}/>
          <div style={styles.kpiNum}>{stats.total}</div>
          <div style={styles.kpiLabel}>En vista</div>
        </div>
        <div style={styles.kpiCard}>
          <Calendar size={14} color="#BA7517" strokeWidth={2}/>
          <div style={styles.kpiNum}>{stats.hoy}</div>
          <div style={styles.kpiLabel}>Denuncias hoy</div>
        </div>
        <div style={styles.kpiCard}>
          <Clock size={14} color="#534AB7" strokeWidth={2}/>
          <div style={styles.kpiNum}>{stats.horaPico}h</div>
          <div style={styles.kpiLabel}>Hora pico</div>
        </div>
        <div style={styles.kpiCard}>
          <TrendingUp size={14} color="#1D9E75" strokeWidth={2}/>
          <div style={styles.kpiNum}>{stats.totalConfirm}</div>
          <div style={styles.kpiLabel}>Confirm.</div>
        </div>
      </div>

      {/* Tipo más frecuente */}
      <div style={{ ...styles.alertBox, borderColor: TIPO_COLORS[stats.tipoTop] || '#eee' }}>
        <div style={styles.alertLabel}>Incidente más frecuente en esta zona</div>
        <div style={{ ...styles.alertTipo, color: TIPO_COLORS[stats.tipoTop] || '#333' }}>
          {stats.tipoTop}
        </div>
      </div>

      {/* Por tipo */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Por tipo de incidente</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={tipoData} margin={{ top:5, right:5, left:-30, bottom:5 }} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
            <XAxis dataKey="tipo" tick={{ fontSize:9, fill:'#aaa' }} tickLine={false} axisLine={false}/>
            <YAxis tick={{ fontSize:9, fill:'#bbb' }} tickLine={false} axisLine={false}/>
            <Tooltip
              contentStyle={{ fontSize:'12px', borderRadius:'8px', border:'1px solid #eee' }}
              cursor={{ fill:'#f9f9f9' }}
            />
            <Bar dataKey="total" name="Denuncias" radius={[4,4,0,0]}>
              {tipoData.map(entry => (
                <Cell key={entry.tipo} fill={TIPO_COLORS[entry.tipo] || '#888'}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Por hora */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Actividad por hora del día</div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={horaData} margin={{ top:5, right:5, left:-30, bottom:0 }} barSize={5}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
            <XAxis dataKey="hora"
              tick={{ fontSize:8, fill:'#bbb' }} tickLine={false} axisLine={false}
              interval={5}
            />
            <YAxis tick={{ fontSize:8, fill:'#bbb' }} tickLine={false} axisLine={false}/>
            <Tooltip
              contentStyle={{ fontSize:'11px', borderRadius:'8px', border:'1px solid #eee' }}
              cursor={{ fill:'#f9f9f9' }}
            />
            <Bar dataKey="total" name="Denuncias" radius={[2,2,0,0]}>
              {horaData.map((entry, i) => (
                <Cell key={i}
                  fill={entry.total === Math.max(...stats.porHora) ? '#E24B4A' : '#e0e0e0'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={styles.horaPicoNote}>
          Pico de actividad: {stats.horaPico}:00 — {stats.horaPico + 1}:00 hs
        </div>
      </div>

    </div>
  );
}

const styles = {
  wrapper:       { padding:'12px', display:'flex', flexDirection:'column', gap:'12px', overflowY:'auto' },
  empty:         { padding:'24px 16px', textAlign:'center', color:'#aaa', fontSize:'12px' },
  kpiGrid:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' },
  kpiCard:       { background:'#fafafa', borderRadius:'8px', padding:'10px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' },
  kpiNum:        { fontSize:'18px', fontWeight:700, color:'#1a1a1a' },
  kpiLabel:      { fontSize:'10px', color:'#aaa' },
  alertBox:      { border:'2px solid', borderRadius:'10px', padding:'10px 12px' },
  alertLabel:    { fontSize:'10px', color:'#aaa', marginBottom:'2px' },
  alertTipo:     { fontSize:'16px', fontWeight:700 },
  section:       { background:'#fafafa', borderRadius:'10px', padding:'10px' },
  sectionTitle:  { fontSize:'11px', fontWeight:600, color:'#888', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.04em' },
  horaPicoNote:  { fontSize:'10px', color:'#aaa', textAlign:'center', marginTop:'4px' },
};
