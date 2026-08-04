//Users/mac/crimemap/frontend/src/components/HistorialPanel.jsx
import { useState, useEffect } from 'react';
import { Clock, MapPin, Trash2, CheckCircle } from 'lucide-react';

const TIPO_COLORS = {
  'Robo':       { bg:'#fff0f0', color:'#A32D2D' },
  'Asalto':     { bg:'#faeeda', color:'#633806' },
  'Punto GDO':  { bg:'#eeedfe', color:'#3C3489' },
  'Vandalismo': { bg:'#e1f5ee', color:'#085041' },
  'Otro':       { bg:'#f5f5f5', color:'#555'    },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} d`;
}

export default function HistorialPanel({ map }) {
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('crimemap_historial');
    if (saved) setHistorial(JSON.parse(saved));
  }, []);

  const limpiar = () => {
    localStorage.removeItem('crimemap_historial');
    setHistorial([]);
  };

  const irA = (r) => {
    if (map) map.setView([r.lat, r.lng], 16);
  };

  if (!historial.length) return (
    <div style={styles.empty}>
      <Clock size={28} color="#ddd" strokeWidth={1.5}/>
      <div>No has hecho denuncias en este dispositivo</div>
      <div style={styles.emptySub}>Tus denuncias aparecerán aquí</div>
    </div>
  );

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Mis denuncias — {historial.length}</span>
        <button style={styles.clearBtn} onClick={limpiar}>
          <Trash2 size={12} strokeWidth={2}/> Limpiar
        </button>
      </div>
      <div style={styles.note}>
        Solo visibles en este dispositivo. Nadie más puede ver tu historial.
      </div>
      <div style={styles.list}>
        {historial.slice().reverse().map((r, i) => {
          const tc = TIPO_COLORS[r.tipo] || TIPO_COLORS['Otro'];
          return (
            <div key={i} style={styles.card} onClick={() => irA(r)}>
              <div style={styles.cardTop}>
                <span style={{...styles.tipoBadge, background:tc.bg, color:tc.color}}>
                  {r.tipo}
                </span>
                <span style={styles.time}>{timeAgo(r.created_at)}</span>
              </div>
              {r.descripcion && (
                <div style={styles.desc}>{r.descripcion}</div>
              )}
              <div style={styles.meta}>
                <MapPin size={10} strokeWidth={2} color="#aaa"/>
                <span>{r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}</span>
                <CheckCircle size={10} strokeWidth={2} color="#1D9E75"/>
                <span style={{ color:'#1D9E75' }}>Enviada</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrapper:     { display:'flex', flexDirection:'column', height:'100%' },
  empty:       { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', color:'#aaa', fontSize:'12px', padding:'24px', textAlign:'center' },
  emptySub:    { fontSize:'11px', color:'#ccc' },
  header:      { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderBottom:'1px solid #eee' },
  headerTitle: { fontSize:'12px', fontWeight:600, color:'#333' },
  clearBtn:    { display:'flex', alignItems:'center', gap:'4px', background:'none', border:'1px solid #eee', borderRadius:'6px', padding:'4px 8px', fontSize:'11px', color:'#aaa', cursor:'pointer' },
  note:        { fontSize:'10px', color:'#bbb', padding:'6px 14px', background:'#fafafa', borderBottom:'1px solid #eee' },
  list:        { flex:1, overflowY:'auto' },
  card:        { padding:'10px 14px', borderBottom:'1px solid #f5f5f5', cursor:'pointer' },
  cardTop:     { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' },
  tipoBadge:   { fontSize:'10px', padding:'2px 7px', borderRadius:'8px', fontWeight:500 },
  time:        { fontSize:'10px', color:'#aaa' },
  desc:        { fontSize:'11px', color:'#666', lineHeight:1.4, marginBottom:'4px' },
  meta:        { display:'flex', alignItems:'center', gap:'4px', fontSize:'10px', color:'#aaa' },
};
