//Users/mac/crimemap/frontend/src/pages/AdminMetrics.jsx
import { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Award } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const FASTAPI = import.meta.env.VITE_API_FASTAPI || 'http://localhost:8000';

const MODELO_INFO = {
  xgboost:       { nombre:'XGBoost',       color:'#534AB7' },
  random_forest: { nombre:'Random Forest', color:'#1D9E75' },
  knn:           { nombre:'KNN Espacial',  color:'#BA7517' },
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

export default function AdminMetrics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const cargarMetricas = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${FASTAPI}/predict/metrics`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch {
      setError('Error al calcular métricas. Verifica que FastAPI esté corriendo y los modelos entrenados.');
    } finally { setLoading(false); }
  };

  useEffect(() => { cargarMetricas(); }, []);

  const barData = data ? Object.entries(data.metricas)
    .filter(([,v]) => !v.error)
    .map(([k,v]) => ({
      modelo: MODELO_INFO[k]?.nombre || k,
      MAE:    v.mae,
      RMSE:   v.rmse,
    })) : [];

  const radarData = data ? [
    { metric:'Precisión', ...Object.fromEntries(
      Object.entries(data.metricas).filter(([,v])=>!v.error).map(([k,v]) => {
        const maxMae = Math.max(...Object.values(data.metricas).filter(x=>!x.error).map(x=>x.mae));
        return [MODELO_INFO[k]?.nombre, Math.round((1-v.mae/maxMae)*100)];
      })
    )},
    { metric:'R² Score', ...Object.fromEntries(
      Object.entries(data.metricas).filter(([,v])=>!v.error).map(([k,v]) => [
        MODELO_INFO[k]?.nombre, Math.round(Math.max(0,v.r2)*100)
      ])
    )},
    { metric:'Estabilidad', ...Object.fromEntries(
      Object.entries(data.metricas).filter(([,v])=>!v.error).map(([k,v]) => {
        const maxStd = Math.max(...Object.values(data.metricas).filter(x=>!x.error).map(x=>x.mae_std));
        return [MODELO_INFO[k]?.nombre, Math.round((1-v.mae_std/(maxStd||1))*100)];
      })
    )},
    { metric:'Bajo RMSE', ...Object.fromEntries(
      Object.entries(data.metricas).filter(([,v])=>!v.error).map(([k,v]) => {
        const maxR = Math.max(...Object.values(data.metricas).filter(x=>!x.error).map(x=>x.rmse));
        return [MODELO_INFO[k]?.nombre, Math.round((1-v.rmse/maxR)*100)];
      })
    )},
  ] : [];

  return (
    <div style={styles.wrapper}>

      <div style={styles.headerRow}>
        <div>
          <div style={styles.pageTitle}>Métricas de precisión</div>
          <div style={styles.pageSub}>Evaluación con 5-fold cross-validation</div>
        </div>
        <button style={styles.recalcBtn} onClick={cargarMetricas} disabled={loading}>
          <RefreshCw size={13} strokeWidth={2}/>
          {loading ? 'Calculando...' : 'Recalcular'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading && (
        <div style={styles.loadingBox}>
          <RefreshCw size={28} color="#aaa" strokeWidth={1.5}/>
          <div style={styles.loadingText}>Ejecutando cross-validation en los 3 modelos...</div>
          <div style={styles.loadingNote}>Esto puede tardar 20-40 segundos</div>
        </div>
      )}

      {data && !loading && (
        <>
          {data.mejor_modelo && (
            <div style={styles.winnerCard}>
              <Trophy size={28} color="#FFD700" strokeWidth={1.5}/>
              <div>
                <div style={styles.winnerTitle}>
                  Mejor modelo: {MODELO_INFO[data.mejor_modelo]?.nombre}
                </div>
                <div style={styles.winnerSub}>
                  Menor error absoluto medio entre los 3 modelos evaluados
                </div>
              </div>
              <div style={styles.winnerBadge}>
                MAE: {data.metricas[data.mejor_modelo]?.mae}
              </div>
            </div>
          )}

          <div style={styles.modelsGrid}>
            {Object.entries(data.metricas).map(([k, v]) => {
              const info   = MODELO_INFO[k] || {};
              const isBest = k === data.mejor_modelo;
              if (v.error) return (
                <div key={k} style={styles.modelCard}>
                  <div style={styles.modelHeader}>
                    <span style={{ fontWeight:700 }}>{info.nombre}</span>
                    <span style={styles.errorBadge}>No entrenado</span>
                  </div>
                </div>
              );
              return (
                <div key={k} style={{...styles.modelCard,...(isBest?{...styles.modelCardBest,borderColor:info.color}:{})}}>
                  {isBest && (
                    <div style={{...styles.bestTag, background:info.color}}>
                      <Award size={10} strokeWidth={2}/> Mejor
                    </div>
                  )}
                  <div style={styles.modelHeader}>
                    <span style={{ fontWeight:700, fontSize:'14px', color:info.color }}>{info.nombre}</span>
                  </div>

                  <div style={styles.metricsRow}>
                    {[
                      { label:'MAE',  value:v.mae,  std:v.mae_std,  desc:'Error Absoluto Medio',      better:'Menor es mejor' },
                      { label:'RMSE', value:v.rmse, std:v.rmse_std, desc:'Error Cuadrático Medio',    better:'Menor es mejor' },
                      { label:'R²',   value:v.r2,   std:v.r2_std,  desc:'Coef. de determinación',    better:'Mayor es mejor' },
                    ].map(m => (
                      <div key={m.label} style={styles.metricCard}>
                        <div style={styles.metricLabel}>{m.label}</div>
                        <div style={{...styles.metricValue, color:info.color}}>{m.value}</div>
                        <div style={styles.metricStd}>± {m.std}</div>
                        <div style={styles.metricDesc}>{m.desc}</div>
                        <div style={styles.metricBetter}>{m.better}</div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.r2Section}>
                    <div style={styles.r2Label}>
                      R² — explica el <b>{Math.round(Math.max(0,v.r2)*100)}%</b> de la varianza
                    </div>
                    <div style={styles.r2Bar}>
                      <div style={{...styles.r2Fill, width:`${Math.max(0,v.r2)*100}%`, background:info.color}}/>
                    </div>
                  </div>
                  <div style={styles.cvNote}>5-fold CV · {v.samples?.toLocaleString()} muestras</div>
                </div>
              );
            })}
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Comparación MAE y RMSE</div>
            <div style={styles.sectionSub}>Menor valor = mayor precisión</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top:10, right:20, left:-10, bottom:5 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="modelo" tick={{ fontSize:12, fill:'#555' }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fontSize:10, fill:'#bbb' }} tickLine={false} axisLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ fontSize:'12px' }}/>
                <Bar dataKey="MAE"  fill="#E24B4A" radius={[4,4,0,0]}/>
                <Bar dataKey="RMSE" fill="#534AB7" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Perfil de rendimiento comparativo</div>
            <div style={styles.sectionSub}>Mayor área = mejor desempeño general</div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top:10, right:30, left:30, bottom:10 }}>
                <PolarGrid stroke="#f0f0f0"/>
                <PolarAngleAxis dataKey="metric" tick={{ fontSize:11, fill:'#888' }}/>
                {Object.entries(MODELO_INFO).map(([k,info]) => (
                  <Radar key={k} name={info.nombre} dataKey={info.nombre}
                    stroke={info.color} fill={info.color} fillOpacity={0.15} strokeWidth={2}/>
                ))}
                <Legend wrapperStyle={{ fontSize:'12px' }}/>
                <Tooltip/>
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Ranking final</div>
            <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  {['Pos.','Modelo','MAE','RMSE','R²','Evaluación'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((r,i) => {
                  const info  = MODELO_INFO[r.modelo] || {};
                  const v     = data.metricas[r.modelo];
                  const eval_ = r.r2>0.7?'Excelente':r.r2>0.4?'Aceptable':'Mejorable';
                  const evalColor = r.r2>0.7?'#1D9E75':r.r2>0.4?'#BA7517':'#E24B4A';
                  return (
                    <tr key={r.modelo} style={{...styles.tr,...(i===0?styles.trFirst:{})}}>
                      <td style={styles.td}>
                        <span style={{ fontWeight:700, color:i===0?'#FFD700':i===1?'#aaa':'#cd7f32' }}>
                          {i+1}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontWeight:600, color:info.color }}>{info.nombre}</span>
                      </td>
                      <td style={styles.td}><span style={{ color:'#E24B4A', fontWeight:600 }}>{r.mae}</span></td>
                      <td style={styles.td}>{v?.rmse}</td>
                      <td style={styles.td}><span style={{ color:'#534AB7', fontWeight:600 }}>{r.r2}</span></td>
                      <td style={styles.td}>
                        <span style={{ color:evalColor, fontWeight:500 }}>{eval_}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            <div style={styles.glossary}>
              <div style={styles.glossaryTitle}>Glosario de métricas</div>
              <div style={styles.glossaryGrid}>
                {[
                  { term:'MAE',     def:'Error Absoluto Medio — promedio de la diferencia entre valor real y predicho.' },
                  { term:'RMSE',    def:'Raíz del Error Cuadrático — penaliza errores grandes. Si RMSE >> MAE, hay outliers.' },
                  { term:'R²',      def:'Coeficiente de determinación — qué porcentaje de la variación explica el modelo.' },
                  { term:'CV 5-fold',def:'Se divide el dataset en 5 partes y se rota para evaluar sin sobreajuste.' },
                ].map(g => (
                  <div key={g.term} style={styles.glossaryItem}>
                    <span style={styles.glossaryTerm}>{g.term}</span>
                    <span style={styles.glossaryDef}>{g.def}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  wrapper:        { display:'flex', flexDirection:'column', gap:'16px' },
  headerRow:      { display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 },
  pageTitle:      { fontSize:'16px', fontWeight:700, color:'#1a1a1a' },
  pageSub:        { fontSize:'12px', color:'#aaa', marginTop:'2px' },
  recalcBtn:      { padding:'8px 16px', background:'#1a1a1a', border:'none', borderRadius:'8px', color:'#fff', fontSize:'12px', cursor:'pointer', fontWeight:500, display:'flex', alignItems:'center', gap:'6px' },
  error:          { background:'#fff0f0', border:'1px solid #fdd', borderRadius:'8px', padding:'12px', fontSize:'12px', color:'#E24B4A' },
  loadingBox:     { background:'#fff', borderRadius:'12px', padding:'40px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,.06)', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' },
  loadingText:    { fontSize:'14px', fontWeight:600, color:'#333' },
  loadingNote:    { fontSize:'12px', color:'#aaa' },
  winnerCard:     { background:'linear-gradient(135deg,#1a1a1a,#2d2d2d)', borderRadius:'12px', padding:'20px', display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' },
  winnerTitle:    { color:'#fff', fontWeight:700, fontSize:'15px', marginBottom:'4px' },
  winnerSub:      { color:'#888', fontSize:'12px' },
  winnerBadge:    { marginLeft:'auto', background:'rgba(255,255,255,.1)', color:'#fff', padding:'6px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:600, whiteSpace:'nowrap' },
  modelsGrid:     { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'12px' },
  modelCard:      { background:'#fff', borderRadius:'12px', padding:'18px', boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'2px solid transparent', position:'relative' },
  modelCardBest:  { boxShadow:'0 4px 16px rgba(0,0,0,.1)' },
  bestTag:        { position:'absolute', top:'-10px', right:'14px', color:'#fff', fontSize:'10px', fontWeight:700, padding:'2px 10px', borderRadius:'10px', display:'flex', alignItems:'center', gap:'3px' },
  modelHeader:    { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' },
  errorBadge:     { fontSize:'11px', background:'#f5f5f5', color:'#aaa', padding:'2px 8px', borderRadius:'6px' },
  metricsRow:     { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'12px' },
  metricCard:     { background:'#fafafa', borderRadius:'8px', padding:'10px', textAlign:'center' },
  metricLabel:    { fontSize:'11px', fontWeight:700, color:'#888', marginBottom:'4px' },
  metricValue:    { fontSize:'18px', fontWeight:700 },
  metricStd:      { fontSize:'10px', color:'#bbb' },
  metricDesc:     { fontSize:'9px', color:'#bbb', marginTop:'2px' },
  metricBetter:   { fontSize:'9px', color:'#aaa', marginTop:'2px' },
  r2Section:      { marginBottom:'8px' },
  r2Label:        { fontSize:'11px', color:'#888', marginBottom:'4px' },
  r2Bar:          { height:'6px', background:'#f0f0f0', borderRadius:'3px' },
  r2Fill:         { height:'6px', borderRadius:'3px', transition:'width .6s' },
  cvNote:         { fontSize:'10px', color:'#bbb', textAlign:'right' },
  section:        { background:'#fff', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' },
  sectionTitle:   { fontSize:'14px', fontWeight:700, color:'#1a1a1a', marginBottom:'2px' },
  sectionSub:     { fontSize:'11px', color:'#aaa', marginBottom:'12px' },
  tableWrapper:   { overflowX:'auto', marginTop:'12px' },
  table:          { width:'100%', borderCollapse:'collapse', minWidth:520 },
  thead:          { background:'#f5f5f5' },
  th:             { padding:'10px 14px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'.04em' },
  tr:             { borderBottom:'1px solid #f5f5f5' },
  trFirst:        { background:'#fffbf0' },
  td:             { padding:'10px 14px', fontSize:'13px', color:'#333' },
  tooltip:        { background:'#fff', border:'1px solid #eee', borderRadius:'8px', padding:'8px 12px', boxShadow:'0 2px 8px rgba(0,0,0,.1)' },
  tooltipTitle:   { fontSize:'11px', color:'#888', marginBottom:'4px', fontWeight:600 },
  glossary:       { marginTop:'20px', background:'#fafafa', borderRadius:'10px', padding:'14px' },
  glossaryTitle:  { fontSize:'12px', fontWeight:700, color:'#555', marginBottom:'10px' },
  glossaryGrid:   { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'10px' },
  glossaryItem:   { display:'flex', flexDirection:'column', gap:'2px' },
  glossaryTerm:   { fontSize:'11px', fontWeight:700, color:'#333' },
  glossaryDef:    { fontSize:'11px', color:'#888', lineHeight:1.5 },
};
