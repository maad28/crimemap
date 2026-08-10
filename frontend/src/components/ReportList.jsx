//Users/mac/crimemap/frontend/src/components/ReportList.jsx
import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

const TIPO_COLORS = {
  'Robo a persona':       { bg:'#fff0f0', color:'#A32D2D' },
  'Robo a domicilio':     { bg:'#fbe4d9', color:'#8a3a1c' },
  'Robo a vehículo':      { bg:'#fdece0', color:'#b4552c' },
  'Asalto a mano armada': { bg:'#faeeda', color:'#633806' },
  'Homicidio':            { bg:'#f5dede', color:'#501313' },
  'Extorsión':            { bg:'#fbeaf0', color:'#72243e' },
  'Vandalismo':           { bg:'#e1f5ee', color:'#085041' },
  'Punto GDO':            { bg:'#eeedfe', color:'#3C3489' },
  'Otro':                 { bg:'#f5f5f5', color:'#555'    },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} d`;
}

export default function ReportList({ reports, map, onSelect }) {
  const [filter, setFilter] = useState('Todos');
const tipos = ['Todos', 'Robo a persona', 'Robo a domicilio', 'Robo a vehículo',
               'Asalto a mano armada', 'Homicidio', 'Extorsión', 'Vandalismo', 'Punto GDO', 'Otro'];  const filtered = filter === 'Todos' ? reports : reports.filter(r => r.tipo === filter);

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <span style={styles.title}>Denuncias</span>
        <span style={styles.badge}>{reports.length}</span>
      </div>
      <div style={styles.filters}>
        {tipos.map(t => (
          <button key={t}
            style={{...styles.filterBtn, ...(filter===t ? styles.filterBtnActive : {})}}
            onClick={() => setFilter(t)}>{t}</button>
        ))}
      </div>
      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={styles.empty}>Sin denuncias en esta zona</div>
        )}
        {filtered.map(r => {
          const tc = TIPO_COLORS[r.tipo] || TIPO_COLORS['Otro'];
          const esConfiable = r.reputacion_puntos >= 130;
          return (
            <div key={r.id} style={styles.card}
                onClick={() => onSelect ? onSelect(r.id) : map?.setView([r.lat, r.lng], 16)}>
              <div style={styles.cardTop}>
                <span style={{...styles.tipoBadge, background:tc.bg, color:tc.color}}>
                  {r.tipo}
                </span>
                {esConfiable && <span style={{ fontSize: 12 }}>⭐</span>}
                <span style={styles.time}>{timeAgo(r.created_at)}</span>
              </div>
              {r.descripcion && <div style={styles.desc}>{r.descripcion}</div>}
              <div style={styles.confirms}>
                <CheckCircle size={11} color="#1D9E75" strokeWidth={2}/>
                <span>{r.confirmaciones} confirmaron</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={styles.footer}>La lista se actualiza al mover el mapa</div>
    </aside>
  );
}

const styles = {
  sidebar:        { width:'240px', background:'#fff', borderLeft:'1px solid #eee', display:'flex', flexDirection:'column', zIndex:1000 },
  header:         { padding:'14px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', justifyContent:'space-between' },
  title:          { fontWeight:600, fontSize:'14px' },
  badge:          { background:'#fff0f0', color:'#A32D2D', fontSize:'11px', padding:'2px 8px', borderRadius:'10px', fontWeight:600 },
  filters:        { padding:'8px 10px', display:'flex', gap:'5px', flexWrap:'wrap', borderBottom:'1px solid #eee' },
  filterBtn:      { padding:'3px 8px', border:'1px solid #eee', borderRadius:'12px', fontSize:'11px', cursor:'pointer', background:'#fafafa', color:'#666' },
  filterBtnActive:{ background:'#E24B4A', borderColor:'#E24B4A', color:'#fff' },
  list:           { flex:1, overflowY:'auto' },
  card:           { padding:'10px 12px', borderBottom:'1px solid #f5f5f5', cursor:'pointer' },
  cardTop:        { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' },
  tipoBadge:      { fontSize:'10px', padding:'2px 7px', borderRadius:'8px', fontWeight:500 },
  time:           { fontSize:'10px', color:'#aaa' },
  desc:           { fontSize:'11px', color:'#666', lineHeight:1.4, marginBottom:'4px' },
  confirms:       { display:'flex', alignItems:'center', gap:'4px', fontSize:'10px', color:'#1D9E75' },
  empty:          { padding:'24px', textAlign:'center', color:'#aaa', fontSize:'12px' },
  footer:         { padding:'10px', fontSize:'10px', color:'#aaa', textAlign:'center', borderTop:'1px solid #eee' },
};
