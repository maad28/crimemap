//frontend/src/pages/AnalyticsDashboard.jsx
import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Clock, Calendar, Filter } from 'lucide-react';

const API_EXPRESS = 'http://localhost:3001';
const API_FASTAPI = 'http://localhost:8000';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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
  { nombre: 'Kennedy Norte',               lat: -2.15842, lng: -79.89124 },
  { nombre: 'Barrio Centenario',           lat: -2.22741, lng: -79.89312 },
];

function Barra({ label, valor, max, color }) {
  const pct = max > 0 ? (valor / max) * 100 : 0;
  return (
    <div style={styles.barraRow}>
      <span style={styles.barraLabel}>{label}</span>
      <div style={styles.barraTrack}>
        <div style={{ ...styles.barraFill, width: `${pct}%`, background: color }} />
      </div>
      <span style={styles.barraValor}>{valor}</span>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [dias, setDias] = useState(30);
  const [historico, setHistorico] = useState(null);
  const [loadingHist, setLoadingHist] = useState(true);

  const [zona, setZona] = useState(ZONAS[0]);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [prediccion, setPrediccion] = useState(null);
  const [loadingPred, setLoadingPred] = useState(false);
  const [tiposZona, setTiposZona] = useState(null);


  useEffect(() => {
    setLoadingHist(true);
    fetch(`${API_EXPRESS}/api/reports/analitica-historica?dias=${dias}`)
      .then(r => r.json())
      .then(setHistorico)
      .finally(() => setLoadingHist(false));
  }, [dias]);

  const calcularPrediccion = () => {
    setLoadingPred(true);
    fetch(`${API_FASTAPI}/predict/proximas-horas?fecha=${fecha}&lat=${zona.lat}&lng=${zona.lng}`)
      .then(r => r.json())
      .then(setPrediccion)
      .finally(() => setLoadingPred(false));
  };
  const cargarTiposZona = () => {
  fetch(`${API_EXPRESS}/api/reports/tipos-por-zona?lat=${zona.lat}&lng=${zona.lng}`)
    .then(r => r.json())
    .then(setTiposZona);
};

  const maxHora = historico ? Math.max(...historico.por_hora.map(h => h.total), 1) : 1;
  const maxDia  = historico ? Math.max(...historico.por_dia_semana.map(d => d.total), 1) : 1;
  const horaPico = historico ? historico.por_hora.reduce((a, b) => b.total > a.total ? b : a) : null;
  const diaPico  = historico ? historico.por_dia_semana.reduce((a, b) => b.total > a.total ? b : a) : null;
useEffect(() => {
  cargarTiposZona();
}, [zona]);
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <BarChart2 size={20} strokeWidth={2}/> Analítica y predicción
        </div>
        <div style={styles.filterGroup}>
          <Filter size={14} color="#888"/>
          <select value={dias} onChange={e => setDias(Number(e.target.value))} style={styles.select}>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={180}>Todo el histórico</option>
          </select>
        </div>
      </div>

      {loadingHist && <p style={styles.loading}>Cargando datos históricos...</p>}

      {historico && (
        <>
          <div style={styles.kpiRow}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiValue}>{historico.total_reportes}</div>
              <div style={styles.kpiLabel}>Reportes totales</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiValue}>{horaPico ? `${horaPico.hora}:00` : '—'}</div>
              <div style={styles.kpiLabel}>Hora con más reportes</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiValue}>{diaPico ? DIAS_SEMANA[diaPico.dia] : '—'}</div>
              <div style={styles.kpiLabel}>Día con más reportes</div>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}><Clock size={14}/> Reportes por hora del día</div>
            {historico.por_hora.map(h => (
              <Barra key={h.hora} label={`${h.hora}:00`} valor={h.total} max={maxHora} color="#534AB7"/>
            ))}
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}><Calendar size={14}/> Reportes por día de la semana</div>
            {historico.por_dia_semana.map(d => (
              <Barra key={d.dia} label={DIAS_SEMANA[d.dia]} valor={d.total} max={maxDia} color="#1D9E75"/>
            ))}
          </div>
        </>
      )}

      <div style={styles.section}>
        <div style={styles.sectionTitle}><TrendingUp size={14}/> Predicción de horas de mayor riesgo (XGBoost)</div>

        <div style={styles.predFilters}>
          <select value={zona.nombre} onChange={e => setZona(ZONAS.find(z => z.nombre === e.target.value))} style={styles.select}>
            {ZONAS.map(z => <option key={z.nombre} value={z.nombre}>{z.nombre}</option>)}
          </select>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={styles.select}/>
          <button onClick={calcularPrediccion} style={styles.btn} disabled={loadingPred}>
            {loadingPred ? 'Calculando...' : 'Calcular predicción'}
          </button>
        </div>

        {prediccion && (
          <>
            <div style={styles.predResumen}>
              Hora de mayor riesgo estimado para <b>{zona.nombre}</b> el {fecha}:
              <span style={styles.predHoraDestacada}> {prediccion.hora_mayor_riesgo}:00</span>
            </div>
            {prediccion.por_hora.map(h => (
              <Barra key={h.hora} label={`${h.hora}:00`} valor={h.robos_estimados}
                     max={Math.max(...prediccion.por_hora.map(x => x.robos_estimados), 1)} color="#BA7517"/>
            ))}
          </>
        )}
      </div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}><BarChart2 size={14}/> Tipos de incidente más frecuentes en {zona.nombre}</div>
        {tiposZona && tiposZona.tipos.length > 0 ? (
            tiposZona.tipos.map(t => (
            <Barra key={t.tipo} label={t.tipo} valor={t.porcentaje} max={100} color="#D85A30" labelWidth={140}/>
            ))
        ) : (
            <p style={{ color: '#aaa', fontSize: 12 }}>Sin datos históricos suficientes para esta zona.</p>
        )}
        {tiposZona && (
            <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
            Basado en {tiposZona.total_general} reportes históricos dentro de 1 km de esta zona.
            </p>
        )}
        </div>
    </div>
  );
}

const styles = {
  page:           { padding: 24, maxWidth: 720, margin: '0 auto', fontFamily: '-apple-system,sans-serif' },
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle:    { display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700 },
  filterGroup:    { display: 'flex', alignItems: 'center', gap: 6 },
  select:         { padding: '8px 12px', borderRadius: 8, border: '1px solid #eee', fontSize: 13 },
  loading:        { color: '#aaa', fontSize: 13 },
  kpiRow:         { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 },
  kpiCard:        { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16, textAlign: 'center' },
  kpiValue:       { fontSize: 22, fontWeight: 700, color: '#1a1a1a' },
  kpiLabel:       { fontSize: 11, color: '#888', marginTop: 4 },
  section:        { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 18, marginBottom: 16 },
  sectionTitle:   { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, marginBottom: 14 },
  barraRow:       { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  barraLabel:     { width: 70, fontSize: 11, color: '#666' },
  barraTrack:     { flex: 1, height: 14, background: '#f5f5f5', borderRadius: 7, overflow: 'hidden' },
  barraFill:      { height: '100%', borderRadius: 7, transition: 'width .3s' },
  barraValor:     { width: 36, fontSize: 11, color: '#333', textAlign: 'right' },
  predFilters:    { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  btn:            { background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  predResumen:    { fontSize: 13, color: '#555', marginBottom: 14, background: '#faeeda', padding: '10px 14px', borderRadius: 8 },
  predHoraDestacada: { fontWeight: 700, color: '#633806' },
};