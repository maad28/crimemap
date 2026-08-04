//Users/mac/crimemap/frontend/src/components/ReportForm.jsx
import { useState, useRef, useEffect } from 'react';
import { X, MapPin, Send, Navigation, Search } from 'lucide-react';
import { createReport } from '../api/reports';

const TIPOS = ['Robo', 'Asalto', 'Punto GDO', 'Vandalismo', 'Otro'];

function guardarEnHistorial(reporte) {
  const saved = localStorage.getItem('crimemap_historial');
  const hist  = saved ? JSON.parse(saved) : [];
  hist.push(reporte);
  localStorage.setItem('crimemap_historial', JSON.stringify(hist.slice(-50)));
}

export default function ReportForm({ lat, lng, deviceId, onCreated, onClose, onMoveMap }) {
  const [tipo,        setTipo]        = useState('Robo');
  const [desc,        setDesc]        = useState('');
  const [sev,         setSev]         = useState(3);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [locating,    setLocating]    = useState(false);
  const [search,      setSearch]      = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [locationTag, setLocationTag] = useState('');
  const [currentLat,  setCurrentLat]  = useState(lat);
  const [currentLng,  setCurrentLng]  = useState(lng);
  const debounceRef = useRef(null);
  const API = import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001';

  // Autocomplete con debounce de 400ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search || search.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
const res  = await fetch(`${API}/api/geocode/autocomplete?q=${encodeURIComponent(search)}`);
        const data = await res.json();
        setSuggestions(data.predictions || []);
      } catch { setSuggestions([]); }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Seleccionar una sugerencia
  const selectSuggestion = async (prediction) => {
    setSearch('');
    setSuggestions([]);
    try {
const res  = await fetch(`${API}/api/geocode/place?place_id=${prediction.place_id}`);
      const data = await res.json();
      if (data.result?.geometry) {
        const { lat: newLat, lng: newLng } = data.result.geometry.location;
        setCurrentLat(newLat);
        setCurrentLng(newLng);
        setLocationTag(data.result.name || prediction.structured_formatting?.main_text || prediction.description);
        onMoveMap(newLat, newLng);
      }
    } catch { setError('Error al obtener coordenadas.'); }
  };

  // Ubicación actual por GPS
  const getMyLocation = () => {
    if (!navigator.geolocation) { setError('Tu navegador no soporta geolocalización.'); return; }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        setCurrentLat(newLat);
        setCurrentLng(newLng);
        setLocationTag('Mi ubicación actual');
        onMoveMap(newLat, newLng);
        setLocating(false);
      },
      () => { setError('No se pudo obtener tu ubicación.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const submit = async () => {
    if (!deviceId) return;
    try {
      setLoading(true);
      const res = await createReport({
        tipo, descripcion: desc,
        lat: currentLat, lng: currentLng,
        severidad: sev, device_id: deviceId
      });
      guardarEnHistorial({
        id: res.id, tipo, descripcion: desc,
        lat: currentLat, lng: currentLng,
        severidad: sev, created_at: new Date().toISOString(),
      });
      onCreated();
    } catch { setError('Error al enviar. Intenta de nuevo.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.card}>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <MapPin size={14} color="#E24B4A" strokeWidth={2}/>
          <span>Nueva denuncia</span>
        </div>
        <button onClick={onClose} style={styles.closeBtn}>
          <X size={14} strokeWidth={2}/>
        </button>
      </div>

      {/* Tag de ubicación seleccionada */}
      {locationTag ? (
        <div style={styles.locationTag}>
          <MapPin size={11} color="#E24B4A" strokeWidth={2}/>
          <span>{locationTag}</span>
          <button style={styles.tagClose} onClick={() => setLocationTag('')}>
            <X size={10} strokeWidth={2}/>
          </button>
        </div>
      ) : (
        <div style={styles.coords}>
          {currentLat.toFixed(4)}°, {currentLng.toFixed(4)}°
        </div>
      )}

      {/* Barra de búsqueda con autocomplete */}
      <div style={styles.searchWrapper}>
        <div style={styles.searchRow}>
          <Search size={13} color="#aaa" strokeWidth={2} style={{ flexShrink:0 }}/>
          <input
            style={styles.searchInput}
            placeholder="Buscar dirección..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setSuggestions([])}
            autoComplete="off"
          />
          {search && (
            <button style={styles.clearSearch} onClick={() => { setSearch(''); setSuggestions([]); }}>
              <X size={11} strokeWidth={2}/>
            </button>
          )}
        </div>

        {/* Sugerencias */}
        {suggestions.length > 0 && (
          <div style={styles.suggestions}>
            {suggestions.map((s, i) => (
              <div key={i} style={styles.suggestionItem} onClick={() => selectSuggestion(s)}>
                <MapPin size={11} color="#aaa" strokeWidth={2} style={{ flexShrink:0, marginTop:2 }}/>
                <div>
                  <div style={styles.suggMain}>
                    {s.structured_formatting?.main_text || s.description.split(',')[0]}
                  </div>
                  <div style={styles.suggSub}>
                    {s.structured_formatting?.secondary_text || s.description.split(',').slice(1).join(',')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botón GPS */}
      <button
        style={{...styles.locationBtn, ...(locating ? styles.locationBtnLoading : {})}}
        onClick={getMyLocation}
        disabled={locating}>
        <Navigation size={13} strokeWidth={2}/>
        {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
      </button>

      {/* Tipos de incidente */}
      <div style={styles.tipoGrid}>
        {TIPOS.map(t => (
          <button key={t}
            style={{...styles.tipoBtn,...(tipo===t?styles.tipoBtnSel:{})}}
            onClick={() => setTipo(t)}>{t}</button>
        ))}
      </div>

      <textarea
        style={styles.textarea}
        placeholder="Descripción breve (opcional)..."
        value={desc}
        onChange={e => setDesc(e.target.value)}
        rows={3}
      />

      <div style={styles.sevRow}>
        <span style={styles.sevLabel}>Severidad:</span>
        {[1,2,3,4,5].map(n => (
          <button key={n}
            style={{...styles.sevBtn,...(sev===n?styles.sevBtnSel:{})}}
            onClick={() => setSev(n)}>{n}</button>
        ))}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <button style={styles.submitBtn} onClick={submit} disabled={loading}>
        <Send size={13} strokeWidth={2}/>
        {loading ? 'Enviando...' : 'Enviar denuncia'}
      </button>
    </div>
  );
}

const styles = {
  card:               { background:'#fff', borderRadius:'12px', padding:'16px', width:'260px', boxShadow:'0 4px 20px rgba(0,0,0,.15)', border:'1px solid #eee' },
  header:             { display:'flex', justifyContent:'space-between', alignItems:'center', fontWeight:600, fontSize:'13px', marginBottom:'8px' },
  headerLeft:         { display:'flex', alignItems:'center', gap:'6px' },
  closeBtn:           { background:'none', border:'none', cursor:'pointer', color:'#aaa', display:'flex', alignItems:'center', padding:'2px' },
  coords:             { fontSize:'10px', color:'#aaa', marginBottom:'8px', fontFamily:'monospace' },
  locationTag:        { display:'flex', alignItems:'center', gap:'5px', background:'#fff0f0', border:'1px solid #fdd', borderRadius:'8px', padding:'5px 8px', marginBottom:'8px', fontSize:'11px', color:'#A32D2D', fontWeight:500 },
  tagClose:           { background:'none', border:'none', cursor:'pointer', color:'#aaa', display:'flex', alignItems:'center', marginLeft:'auto', padding:'1px' },
  searchWrapper:      { position:'relative', marginBottom:'8px' },
  searchRow:          { display:'flex', alignItems:'center', gap:'6px', border:'1px solid #eee', borderRadius:'8px', padding:'6px 8px' },
  searchInput:        { flex:1, border:'none', outline:'none', fontSize:'12px', background:'transparent' },
  clearSearch:        { background:'none', border:'none', cursor:'pointer', color:'#bbb', display:'flex', alignItems:'center', padding:'0' },
  suggestions:        { position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #eee', borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,.12)', zIndex:3000, maxHeight:'200px', overflowY:'auto', marginTop:'4px' },
  suggestionItem:     { display:'flex', gap:'8px', padding:'8px 10px', cursor:'pointer', borderBottom:'1px solid #f5f5f5', alignItems:'flex-start' },
  suggMain:           { fontSize:'12px', fontWeight:500, color:'#333' },
  suggSub:            { fontSize:'10px', color:'#aaa', marginTop:'1px' },
  locationBtn:        { width:'100%', padding:'7px', background:'#f0f7ff', border:'1px solid #cce0ff', borderRadius:'8px', color:'#0C447C', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginBottom:'10px', fontWeight:500 },
  locationBtnLoading: { opacity:.6, cursor:'not-allowed' },
  tipoGrid:           { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginBottom:'10px' },
  tipoBtn:            { padding:'6px 4px', border:'1px solid #eee', borderRadius:'8px', fontSize:'11px', cursor:'pointer', background:'#fafafa', color:'#555' },
  tipoBtnSel:         { background:'#fff0f0', borderColor:'#E24B4A', color:'#E24B4A', fontWeight:600 },
  textarea:           { width:'100%', border:'1px solid #eee', borderRadius:'8px', padding:'6px 8px', fontSize:'12px', resize:'none', fontFamily:'inherit', marginBottom:'8px', boxSizing:'border-box' },
  sevRow:             { display:'flex', alignItems:'center', gap:'4px', marginBottom:'10px' },
  sevLabel:           { fontSize:'11px', color:'#888' },
  sevBtn:             { width:'24px', height:'24px', borderRadius:'50%', border:'1px solid #eee', background:'#fafafa', fontSize:'11px', cursor:'pointer' },
  sevBtnSel:          { background:'#E24B4A', color:'#fff', border:'1px solid #E24B4A' },
  error:              { fontSize:'11px', color:'#E24B4A', marginBottom:'8px' },
  submitBtn:          { width:'100%', padding:'9px', background:'#E24B4A', border:'none', borderRadius:'8px', color:'#fff', fontWeight:600, fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' },
};
