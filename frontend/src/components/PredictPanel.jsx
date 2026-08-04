//Users/mac/crimemap/frontend/src/components/PredictPanel.jsx
import { useState, useEffect } from 'react';
import { Zap, Trees, Navigation, Calendar, Clock } from 'lucide-react';
import { apiFastapi } from '../api/client';

const MODELO_INFO = {
  xgboost:       { Icon: Zap,        color:'#534AB7', label:'XGBoost'       },
  random_forest: { Icon: Trees,      color:'#1D9E75', label:'Random Forest' },
  knn:           { Icon: Navigation, color:'#BA7517', label:'KNN Espacial'  },
};

export default function PredictPanel({ map, onGridData }) {
  const [models,   setModels]   = useState([]);
  const [selected, setSelected] = useState('xgboost');
  const [fecha,    setFecha]    = useState(() => new Date().toISOString().split('T')[0]);
  const [hora,     setHora]     = useState(new Date().getHours());
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    apiFastapi.get('/predict/models').then(r => setModels(r.data));
  }, []);

  const predecirGrid = async () => {
    try {
      setLoading(true); setError(''); setResult(null);
      const { data } = await apiFastapi.post('/predict/predict-grid', null, {
        params: { fecha, hora, modelo: selected }
      });
      onGridData(data.zonas);
      setResult({
        altas:  data.zonas.filter(z => z.nivel_riesgo === 'ALTO').length,
        medias: data.zonas.filter(z => z.nivel_riesgo === 'MEDIO').length,
        total:  data.zonas.length,
        modelo: selected,
      });
    } catch { setError('Error al predecir. Verifica que el modelo esté entrenado.'); }
    finally { setLoading(false); }
  };

  const limpiar = () => { onGridData(null); setResult(null); };

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Predicción territorial</div>

      <div style={styles.section}>
        <div style={styles.label}>Modelo predictivo</div>
        {models.map(m => {
          const info = MODELO_INFO[m.id] || {};
          const sel  = selected === m.id;
          const Icon = info.Icon;
          return (
            <div key={m.id}
              style={{...styles.modelCard, ...(sel ? {...styles.modelCardSel, borderColor: info.color} : {}),
                      ...(m.entrenado ? {} : styles.modelCardDisabled)}}
              onClick={() => m.entrenado && setSelected(m.id)}>
              <div style={styles.modelTop}>
                {Icon && <Icon size={14} color={sel ? info.color : '#aaa'} strokeWidth={2}/>}
                <span style={{...styles.modelName, ...(sel ? {color: info.color} : {})}}>
                  {info.label || m.nombre}
                </span>
                {!m.entrenado && <span style={styles.noTrain}>sin entrenar</span>}
                {sel && <div style={{...styles.selDot, background: info.color}}/>}
              </div>
              <div style={styles.modelDesc}>{m.descripcion}</div>
            </div>
          );
        })}
      </div>

      <div style={styles.section}>
        <div style={styles.label}>
          <Calendar size={11} strokeWidth={2}/> Fecha
        </div>
        <input type="date" value={fecha}
          onChange={e => setFecha(e.target.value)}
          style={styles.input}/>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>
          <Clock size={11} strokeWidth={2}/> Hora — {hora}:00
        </div>
        <input type="range" min={0} max={23} value={hora}
          onChange={e => setHora(Number(e.target.value))}
          style={styles.slider}/>
        <div style={styles.horaLabels}>
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <button style={{...styles.btn, ...(loading ? styles.btnDisabled : {})}}
              onClick={predecirGrid} disabled={loading}>
        {loading ? 'Calculando...' : 'Ver predicción en mapa'}
      </button>

      {result && (
        <>
          <div style={styles.results}>
            <div style={styles.resultRow}>
              {[
                { label:'ALTO',  count: result.altas,                              bg:'#fff0f0', color:'#E24B4A' },
                { label:'MEDIO', count: result.medias,                             bg:'#faeeda', color:'#BA7517' },
                { label:'BAJO',  count: result.total-result.altas-result.medias,   bg:'#e1f5ee', color:'#1D9E75' },
              ].map(r => (
                <div key={r.label} style={{...styles.resultBox, background:r.bg}}>
                  <div style={{...styles.resultNum, color:r.color}}>{r.count}</div>
                  <div style={styles.resultLabel}>{r.label}</div>
                </div>
              ))}
            </div>
          </div>
          <button style={styles.btnClear} onClick={limpiar}>Limpiar predicción</button>
        </>
      )}
    </div>
  );
}

const styles = {
  panel:              { padding:'14px', borderTop:'1px solid #eee' },
  title:              { fontWeight:600, fontSize:'13px', marginBottom:'12px', color:'#333' },
  section:            { marginBottom:'12px' },
  label:              { fontSize:'11px', fontWeight:500, color:'#888', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.04em', display:'flex', alignItems:'center', gap:'4px' },
  modelCard:          { border:'1px solid #eee', borderRadius:'8px', padding:'8px 10px', marginBottom:'5px', cursor:'pointer' },
  modelCardSel:       { background:'#fafafe' },
  modelCardDisabled:  { opacity:.5, cursor:'not-allowed' },
  modelTop:           { display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' },
  modelName:          { fontSize:'12px', fontWeight:600, flex:1, color:'#555' },
  selDot:             { width:'6px', height:'6px', borderRadius:'50%' },
  noTrain:            { fontSize:'10px', color:'#aaa', background:'#f5f5f5', padding:'1px 6px', borderRadius:'8px' },
  modelDesc:          { fontSize:'11px', color:'#aaa', lineHeight:1.4 },
  input:              { width:'100%', border:'1px solid #eee', borderRadius:'8px', padding:'6px 10px', fontSize:'12px', boxSizing:'border-box' },
  slider:             { width:'100%', accentColor:'#534AB7' },
  horaLabels:         { display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#bbb', marginTop:'2px' },
  error:              { fontSize:'11px', color:'#E24B4A', marginBottom:'8px', background:'#fff0f0', padding:'6px 10px', borderRadius:'6px' },
  btn:                { width:'100%', padding:'9px', background:'#534AB7', border:'none', borderRadius:'8px', color:'#fff', fontWeight:600, fontSize:'12px', cursor:'pointer', marginBottom:'10px' },
  btnDisabled:        { opacity:.6, cursor:'not-allowed' },
  results:            { background:'#fafafa', borderRadius:'8px', padding:'10px', marginBottom:'8px' },
  resultRow:          { display:'flex', gap:'6px' },
  resultBox:          { flex:1, borderRadius:'8px', padding:'8px 6px', textAlign:'center' },
  resultNum:          { fontSize:'20px', fontWeight:700 },
  resultLabel:        { fontSize:'9px', color:'#888', marginTop:'2px' },
  btnClear:           { width:'100%', padding:'7px', background:'#f5f5f5', border:'1px solid #eee', borderRadius:'8px', color:'#666', fontSize:'12px', cursor:'pointer' },
};
