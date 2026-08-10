//Users/mac/crimemap/frontend/src/components/PredictPanel.jsx
import { useState, useEffect } from 'react';
import { Zap, Calendar, Clock } from 'lucide-react';
import { apiFastapi } from '../api/client';

const MODELO = 'xgboost'; // XGBoost es el modelo elegido según la comparación de precisión en Admin → Métricas

export default function PredictPanel({ map, onGridData }) {
  const [entrenado, setEntrenado] = useState(true);
  const [fecha,    setFecha]    = useState(() => new Date().toISOString().split('T')[0]);
  const [hora,     setHora]     = useState(new Date().getHours());
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    apiFastapi.get('/predict/models').then(r => {
      const xgb = r.data.find(m => m.id === MODELO);
      if (xgb) setEntrenado(xgb.entrenado);
    });
  }, []);

  const predecirGrid = async () => {
    try {
      setLoading(true); setError(''); setResult(null);
      const { data } = await apiFastapi.post('/predict/predict-grid', null, {
        params: { fecha, hora, modelo: MODELO }
      });
      onGridData(data.zonas);
      setResult({
        altas:  data.zonas.filter(z => z.nivel_riesgo === 'ALTO').length,
        medias: data.zonas.filter(z => z.nivel_riesgo === 'MEDIO').length,
        total:  data.zonas.length,
      });
    } catch { setError('Error al predecir. Verifica que el modelo esté entrenado.'); }
    finally { setLoading(false); }
  };

  const limpiar = () => { onGridData(null); setResult(null); };

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Predicción territorial</div>

      <div style={styles.section}>
        <div style={styles.modeloTag}>
          <Zap size={13} color="#534AB7" strokeWidth={2}/>
          <span>Modelo: XGBoost</span>
          {!entrenado && <span style={styles.noTrain}>sin entrenar</span>}
        </div>
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

      <button style={{...styles.btn, ...((loading || !entrenado) ? styles.btnDisabled : {})}}
              onClick={predecirGrid} disabled={loading || !entrenado}>
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
  modeloTag:          { display:'flex', alignItems:'center', gap:'6px', border:'1px solid #eee', borderRadius:'8px', padding:'8px 10px', fontSize:'12px', fontWeight:600, color:'#534AB7' },
  noTrain:            { fontSize:'10px', color:'#aaa', background:'#f5f5f5', padding:'1px 6px', borderRadius:'8px', fontWeight:500 },
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
