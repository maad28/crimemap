//Users/mac/crimemap/frontend/src/pages/AdminAnalytics.jsx
import { useState, useEffect } from 'react';
import { TrendingUp, Map, CheckCircle, RefreshCw } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const API = 'http://localhost:3001/api/admin';

const ZONAS_CENTROS = [
  { nombre: 'Centro histórico', lat: -2.1894, lng: -79.8891 },
  { nombre: 'Urdesa',           lat: -2.1550, lng: -79.9020 },
  { nombre: 'Alborada',         lat: -2.1380, lng: -79.8950 },
  { nombre: 'Sauces',           lat: -2.1200, lng: -79.9100 },
  { nombre: 'Mapasingue',       lat: -2.1100, lng: -79.9050 },
  { nombre: 'Guasmo Sur',       lat: -2.2300, lng: -79.8900 },
  { nombre: 'Fertisa',          lat: -2.1650, lng: -79.9400 },
  { nombre: 'Kennedy Norte',    lat: -2.1450, lng: -79.9150 },
  { nombre: 'Centenario',       lat: -2.1750, lng: -79.8980 },
  { nombre: 'Los Esteros',      lat: -2.1950, lng: -79.9100 },
  { nombre: 'Chongón',          lat: -2.2100, lng: -79.9200 },
];

function nombreZona(lat, lng) {
  let mejor = null;
  let mejorDist = Infinity;
  for (const z of ZONAS_CENTROS) {
    const dist = Math.hypot(lat - z.lat, lng - z.lng);
    if (dist < mejorDist) { mejorDist = dist; mejor = z; }
  }
  return mejor && mejorDist < 0.05 ? mejor.nombre : `Zona ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
}

const TIPO_COLORS = {
  'Robo':'#E24B4A','Asalto':'#BA7517',
  'Punto GDO':'#534AB7','Vandalismo':'#1D9E75','Otro':'#888',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={styles.tooltip}>
      <div style={styles.tooltipTitle}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color:p.color, fontSize:'12px' }}>
          {p.name}: <b>{p.value}</b>
        </div>
      ))}
    </div>
  );
};

export default function AdminAnalytics({ secret }) {
  const [tendencia,  setTendencia]  = useState([]);
  const [zonas,      setZonas]      = useState([]);
  const [confirm,    setConfirm]    = useState([]);
  const [diasFiltro, setDiasFiltro] = useState(30);
  const [loading,    setLoading]    = useState(true);

  const headers = { 'x-admin-secret': secret };

  useEffect(() => { loadAll(); }, [diasFiltro]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [t, z, c] = await Promise.all([
        fetch(`${API}/tendencia?dias=${diasFiltro}`, { headers }).then(r => r.json()),
        fetch(`${API}/zonas-riesgo`,                 { headers }).then(r => r.json()),
        fetch(`${API}/confirmaciones-tipo`,           { headers }).then(r => r.json()),
      ]);
      setTendencia(t.map(d => ({
        ...d,
        fecha:   new Date(d.fecha).toLocaleDateString('es', { day:'2-digit', month:'2-digit' }),
        total:   Number(d.total),
        robos:   Number(d.robos),
        asaltos: Number(d.asaltos),
        gdo:     Number(d.gdo),
      })));
      setZonas(z);
      setConfirm(c);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const maxZona        = zonas[0]?.total || 1;
  const totalPeriodo   = tendencia.reduce((a, d) => a + d.total, 0);
  const promedioDiario = tendencia.length ? Math.round(totalPeriodo / tendencia.length) : 0;
  const ult7  = tendencia.slice(-7);
  const ant7  = tendencia.slice(-14, -7);
  const avgU  = ult7.reduce((a, d) => a + d.total, 0) / (ult7.length || 1);
  const avgA  = ant7.reduce((a, d) => a + d.total, 0) / (ant7.length || 1);
  const tendPct = avgA ? Math.round(((avgU - avgA) / avgA) * 100) : 0;
  const pico    = tendencia.reduce((m, d) => d.total > m ? d.total : m, 0);

  if (loading) return (
    <div style={styles.loading}>
      <RefreshCw size={18} color="#aaa" strokeWidth={1.5}/>
      <span>Cargando análisis...</span>
    </div>
  );

  return (
    <div style={styles.wrapper}>

      {/* Tendencia temporal */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>
              <TrendingUp size={15} strokeWidth={2} color="#1a1a1a"/> Tendencia temporal
            </div>
            <div style={styles.sectionSub}>Evolución de denuncias en el tiempo</div>
          </div>
          <div style={styles.filtros}>
            {[7,30,60,180].map(d => (
              <button key={d}
                style={{...styles.filtroBtn,...(diasFiltro===d?styles.filtroBtnActive:{})}}
                onClick={() => setDiasFiltro(d)}>{d}d</button>
            ))}
          </div>
        </div>

        <div style={styles.kpisRow}>
          {[
            { label:`Total ${diasFiltro}d`, value: totalPeriodo,   color:'#1a1a1a' },
            { label:'Promedio diario',       value: promedioDiario, color:'#534AB7' },
            { label:'vs semana anterior',    value:`${tendPct>=0?'▲':'▼'} ${Math.abs(tendPct)}%`, color:tendPct>=0?'#E24B4A':'#1D9E75' },
            { label:'Pico máximo',           value: pico,           color:'#BA7517' },
          ].map(k => (
            <div key={k.label} style={styles.kpiBox}>
              <div style={{...styles.kpiNum, color:k.color}}>{k.value}</div>
              <div style={styles.kpiLabel}>{k.label}</div>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={tendencia} margin={{ top:5, right:10, left:-20, bottom:5 }}>
            <defs>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#E24B4A" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#E24B4A" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
            <XAxis dataKey="fecha" tick={{ fontSize:10, fill:'#bbb' }} tickLine={false} axisLine={false}
                   interval={Math.ceil(tendencia.length/8)}/>
            <YAxis tick={{ fontSize:10, fill:'#bbb' }} tickLine={false} axisLine={false}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Area type="monotone" dataKey="total" name="Total"
              stroke="#E24B4A" strokeWidth={2} fill="url(#gradTotal)"
              dot={false} activeDot={{ r:4 }}/>
          </AreaChart>
        </ResponsiveContainer>

        <div style={{ marginTop:'16px' }}>
          <div style={styles.subTitle}>Desglose por tipo — últimos 14 días</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={tendencia.slice(-14)} margin={{ top:5, right:10, left:-20, bottom:5 }} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
              <XAxis dataKey="fecha" tick={{ fontSize:9, fill:'#bbb' }} tickLine={false} axisLine={false}/>
              <YAxis tick={{ fontSize:9, fill:'#bbb' }} tickLine={false} axisLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ fontSize:'11px' }}/>
              <Bar dataKey="robos"   name="Robo"      fill="#E24B4A" radius={[2,2,0,0]}/>
              <Bar dataKey="asaltos" name="Asalto"    fill="#BA7517" radius={[2,2,0,0]}/>
              <Bar dataKey="gdo"     name="Punto GDO" fill="#534AB7" radius={[2,2,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.row2}>

        {/* Mapa de densidad */}
        <div style={{...styles.section, flex:1}}>
          <div style={styles.sectionTitle}>
            <Map size={15} strokeWidth={2} color="#1a1a1a"/> Densidad por zona
          </div>
          <div style={styles.sectionSub}>Ranking de zonas urbanas por incidencia</div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={zonas.slice(0,8).map(z => ({
                nombre: nombreZona(Number(z.lat_zona), Number(z.lng_zona)),
                total:  Number(z.total),
              })).reverse()}
              layout="vertical"
              margin={{ top:0, right:10, left:60, bottom:0 }}
              barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:9, fill:'#bbb' }} tickLine={false} axisLine={false}/>
              <YAxis type="category" dataKey="nombre"
                     tick={{ fontSize:10, fill:'#555' }} tickLine={false} axisLine={false} width={55}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="total" name="Denuncias" radius={[0,4,4,0]}
                   fill="#E24B4A" background={{ fill:'#f9f9f9', radius:4 }}/>
            </BarChart>
          </ResponsiveContainer>

          <div style={styles.zonaList}>
            {zonas.slice(0,6).map((z, i) => {
            const nombre = nombreZona(Number(z.lat_zona), Number(z.lng_zona));
            const pct    = Math.round((z.total / maxZona) * 100);
            const nivel  = pct > 70 ? 'ALTO' : pct > 40 ? 'MEDIO' : 'BAJO';
            const color  = nivel==='ALTO'?'#E24B4A':nivel==='MEDIO'?'#BA7517':'#1D9E75';
            return (
              <div key={i} style={styles.zonaRow}>
                <div style={{...styles.zonaRank, color}}>{i+1}</div>
                <div style={styles.zonaInfo}>
                  <div style={styles.zonaTop}>
                    <span style={styles.zonaNombre}>{nombre}</span>
                    <span style={{...styles.zonaNivel, background:color+'20', color}}>{nivel}</span>
                  </div>
                  <div style={styles.zonaBar}>
                    <div style={{...styles.zonaBarFill, width:`${pct}%`, background:color}}/>
                  </div>
                  <div style={styles.zonaMeta}>
                    <span>{z.total} denuncias</span>
                    <span>{Number(z.severidad_promedio).toFixed(1)} sev. prom.</span>
                    <span>{z.confirmaciones_total} confirmaciones</span>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Tasa de confirmación */}
        <div style={{...styles.section, width:'300px'}}>
          <div style={styles.sectionTitle}>
            <CheckCircle size={15} strokeWidth={2} color="#1a1a1a"/> Tasa de confirmación
          </div>
          <div style={styles.sectionSub}>Qué tipos la gente más confirma</div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={confirm.map(c => ({
                tipo: c.tipo,
                tasa: Number(c.tasa_confirmacion_pct),
              }))}
              margin={{ top:10, right:10, left:-20, bottom:5 }}
              barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
              <XAxis dataKey="tipo" tick={{ fontSize:10, fill:'#888' }} tickLine={false} axisLine={false}/>
              <YAxis tick={{ fontSize:9, fill:'#bbb' }} tickLine={false} axisLine={false}
                     domain={[0,100]} tickFormatter={v => `${v}%`}/>
              <Tooltip formatter={v => `${v}%`} content={<CustomTooltip/>}/>
              <Bar dataKey="tasa" name="Tasa %" radius={[4,4,0,0]} fill="#534AB7"/>
            </BarChart>
          </ResponsiveContainer>

          <div style={styles.confirmList}>
            {confirm.map(c => {
              const color = TIPO_COLORS[c.tipo] || '#888';
              return (
                <div key={c.tipo} style={styles.confirmCard}>
                  <div style={styles.confirmTop}>
                    <span style={{...styles.confirmBadge, background:color+'20', color}}>
                      {c.tipo}
                    </span>
                    <span style={{fontSize:'16px', fontWeight:700, color}}>
                      {c.tasa_confirmacion_pct}%
                    </span>
                  </div>
                  <div style={styles.confirmBarBg}>
                    <div style={{...styles.confirmBarFill, width:`${c.tasa_confirmacion_pct}%`, background:color}}/>
                  </div>
                  <div style={styles.confirmMeta}>
                    <span>{c.total_denuncias} denuncias</span>
                    <span>{c.promedio_confirmaciones} prom. confirmaciones</span>
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
  wrapper:        { display:'flex', flexDirection:'column', gap:'16px' },
  loading:        { padding:'40px', textAlign:'center', color:'#aaa', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' },
  section:        { background:'#fff', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' },
  sectionHeader:  { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' },
  sectionTitle:   { fontSize:'14px', fontWeight:700, color:'#1a1a1a', marginBottom:'2px', display:'flex', alignItems:'center', gap:'6px' },
  sectionSub:     { fontSize:'11px', color:'#aaa' },
  subTitle:       { fontSize:'12px', fontWeight:600, color:'#888', marginBottom:'8px' },
  filtros:        { display:'flex', gap:'4px' },
  filtroBtn:      { padding:'4px 10px', border:'1px solid #eee', borderRadius:'8px', fontSize:'11px', cursor:'pointer', background:'#fafafa', color:'#888' },
  filtroBtnActive:{ background:'#1a1a1a', color:'#fff', border:'1px solid #1a1a1a' },
  kpisRow:        { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' },
  kpiBox:         { background:'#fafafa', borderRadius:'10px', padding:'12px', textAlign:'center' },
  kpiNum:         { fontSize:'20px', fontWeight:700 },
  kpiLabel:       { fontSize:'10px', color:'#aaa', marginTop:'2px' },
  tooltip:        { background:'#fff', border:'1px solid #eee', borderRadius:'8px', padding:'8px 12px', boxShadow:'0 2px 8px rgba(0,0,0,.1)' },
  tooltipTitle:   { fontSize:'11px', color:'#888', marginBottom:'4px', fontWeight:600 },
  row2:           { display:'flex', gap:'16px', alignItems:'flex-start' },
  zonaList:       { display:'flex', flexDirection:'column', gap:'8px', marginTop:'12px' },
  zonaRow:        { display:'flex', gap:'8px', alignItems:'flex-start' },
  zonaRank:       { fontSize:'16px', fontWeight:700, minWidth:'20px' },
  zonaInfo:       { flex:1 },
  zonaTop:        { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'3px' },
  zonaNombre:     { fontSize:'11px', fontWeight:600, color:'#333' },
  zonaNivel:      { fontSize:'10px', padding:'1px 6px', borderRadius:'6px', fontWeight:600 },
  zonaBar:        { height:'4px', background:'#f0f0f0', borderRadius:'2px', marginBottom:'3px' },
  zonaBarFill:    { height:'4px', borderRadius:'2px' },
  zonaMeta:       { display:'flex', gap:'8px', fontSize:'10px', color:'#aaa' },
  confirmList:    { display:'flex', flexDirection:'column', gap:'8px', marginTop:'12px' },
  confirmCard:    { border:'1px solid #f0f0f0', borderRadius:'8px', padding:'10px' },
  confirmTop:     { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' },
  confirmBadge:   { fontSize:'11px', padding:'2px 8px', borderRadius:'8px', fontWeight:600 },
  confirmBarBg:   { height:'4px', background:'#f0f0f0', borderRadius:'2px', marginBottom:'5px' },
  confirmBarFill: { height:'4px', borderRadius:'2px' },
  confirmMeta:    { display:'flex', gap:'8px', fontSize:'10px', color:'#aaa' },
};
