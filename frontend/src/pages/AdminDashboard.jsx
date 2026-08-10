import { useState, useEffect } from 'react';
import {
  MapPin, Smartphone, Clock, Zap,
  BarChart2, Ruler, Tag, RefreshCw, LogOut, ArrowLeft
} from 'lucide-react';
import AdminAnalytics from './AdminAnalytics';
import AdminMetrics   from './AdminMetrics';
import AutoridadAlertas from './AutoridadAlertas';


const API = `${import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001'}/api/admin`;

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} d`;
}

export default function AdminDashboard({ secret, onLogout }) {
  const [stats,    setStats]    = useState(null);
  const [devices,  setDevices]  = useState([]);
  const [tab,      setTab]      = useState('analytics');
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [blocking, setBlocking] = useState(null);

  const headers = { 'x-admin-secret': secret };

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        fetch(`${API}/stats`,   { headers }).then(r => r.json()),
        fetch(`${API}/devices`, { headers }).then(r => r.json()),
      ]);
      setStats(s); setDevices(d);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const blockDevice = async (hash) => {
    if (!confirm('¿Eliminar todas las denuncias de este dispositivo?')) return;
    setBlocking(hash);
    try {
      await fetch(`${API}/devices/${hash}`, { method:'DELETE', headers });
      await loadAll();
    } catch(e) { console.error(e); }
    finally { setBlocking(null); }
  };

  const filtered = devices.filter(d =>
    d.device_hash.includes(search) ||
    (d.tipos||[]).join(' ').toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id:'analytics', label:'Análisis',    Icon: BarChart2 },
    { id:'metrics',   label:'Métricas ML', Icon: Ruler     },
    { id:'tipos',     label:'Por tipo',    Icon: Tag       },
    { id:'devices',   label:'Dispositivos',Icon: Smartphone},
  ];

  const STAT_CARDS = stats ? [
    { label:'Total denuncias',     value: stats.total_reportes,      color:'#E24B4A', Icon: MapPin     },
    { label:'Dispositivos únicos', value: stats.dispositivos_unicos, color:'#534AB7', Icon: Smartphone },
    { label:'Últimas 24h',         value: stats.ultimas_24h,         color:'#BA7517', Icon: Clock      },
    { label:'Última hora',         value: stats.ultima_hora,         color:'#1D9E75', Icon: Zap        },
  ] : [];

  const TIPO_COLORS = {
    'Robo':'#E24B4A','Asalto':'#BA7517',
    'Punto GDO':'#534AB7','Vandalismo':'#1D9E75','Otro':'#888'
  };

  if (loading) return (
    <div style={styles.loadingScreen}>
      <RefreshCw size={24} color="#aaa" strokeWidth={1.5}/>
      <span>Cargando panel...</span>
    </div>
  );

  return (
    <div style={styles.shell}>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <MapPin size={18} color="#E24B4A" strokeWidth={2}/>
          <div>
            <div style={styles.headerLogo}>CrimeMap Admin</div>
            <div style={styles.headerSub}>Panel de superadministración · Guayaquil</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <a href="/" style={styles.headerLink}>
            <ArrowLeft size={13} strokeWidth={2}/> Volver al mapa
          </a>
          <button style={styles.logoutBtn} onClick={onLogout}>
            <LogOut size={13} strokeWidth={2}/> Cerrar sesión
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={styles.statsGrid}>
        {STAT_CARDS.map(s => (
          <div key={s.label} style={styles.statCard}>
            <s.Icon size={20} color={s.color} strokeWidth={1.8}/>
            <div style={{...styles.statNum, color:s.color}}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map(({ id, label, Icon }) => (
          <div key={id}
            style={{...styles.tab,...(tab===id?styles.tabActive:{})}}
            onClick={() => setTab(id)}>
            <Icon size={14} strokeWidth={1.8}/>
            {label}
          </div>
        ))}
        <button style={styles.refreshBtn} onClick={loadAll}>
          <RefreshCw size={13} strokeWidth={2}/> Actualizar
        </button>
      </div>

      <div style={styles.content}>

        {tab === 'analytics' && <AdminAnalytics secret={secret}/>}
        {tab === 'metrics'   && <AdminMetrics/>}

        {tab === 'tipos' && stats && (
          <div style={styles.tipoGrid}>
            {(stats.por_tipo||[]).map(t => {
              const pct   = Math.round((t.total/stats.total_reportes)*100);
              const color = TIPO_COLORS[t.tipo]||'#888';
              return (
                <div key={t.tipo} style={styles.tipoCard}>
                  <div style={styles.tipoTop}>
                    <span style={{...styles.tipoBadge, background:color+'20', color}}>{t.tipo}</span>
                    <span style={styles.tipoCount}>{t.total}</span>
                  </div>
                  <div style={styles.barBg}>
                    <div style={{...styles.barFill, width:`${pct}%`, background:color}}/>
                  </div>
                  <div style={styles.tipoPct}>{pct}% del total</div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'devices' && (
          <>
            <div style={styles.searchRow}>
              <input style={styles.searchInput}
                placeholder="Buscar por hash o tipo..."
                value={search} onChange={e => setSearch(e.target.value)}/>
              <span style={styles.searchCount}>{filtered.length} dispositivos</span>
            </div>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    {['Device Hash','Denuncias','Tipos','Última actividad','Primera','Acción'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const isSpam = d.total_denuncias > 20;
                    return (
                      <tr key={d.device_hash} style={{...styles.tr,...(isSpam?styles.trSpam:{})}}>
                        <td style={styles.td}>
                          <div style={styles.hashCell}>
                            {isSpam && <span style={styles.spamBadge}>spam</span>}
                            <code style={styles.hash}>{d.device_hash.slice(0,16)}...</code>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={{fontWeight:700, color:d.total_denuncias>20?'#E24B4A':d.total_denuncias>10?'#BA7517':'#333'}}>
                            {d.total_denuncias}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.tiposCell}>
                            {(d.tipos||[]).map(t => <span key={t} style={styles.tipoTag}>{t}</span>)}
                          </div>
                        </td>
                        <td style={styles.td}>{timeAgo(d.ultima_actividad)}</td>
                        <td style={styles.td}>{timeAgo(d.primera_actividad)}</td>
                        <td style={styles.td}>
                          <button
                            style={{...styles.blockBtn,...(blocking===d.device_hash?styles.blockBtnLoading:{})}}
                            onClick={() => blockDevice(d.device_hash)}
                            disabled={blocking===d.device_hash}>
                            {blocking===d.device_hash ? 'Eliminando...' : 'Bloquear'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  shell:           { height:'100dvh', display:'flex', flexDirection:'column', background:'#f8f8f8', fontFamily:'-apple-system,sans-serif' },
  loadingScreen:   { height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', color:'#aaa', gap:'10px', fontSize:'14px' },
  header:          { background:'#1a1a1a', padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' },
  headerLeft:      { display:'flex', alignItems:'center', gap:'10px' },
  headerLogo:      { color:'#fff', fontWeight:700, fontSize:'15px' },
  headerSub:       { color:'#666', fontSize:'11px' },
  headerRight:     { display:'flex', alignItems:'center', gap:'12px' },
  headerLink:      { color:'#888', fontSize:'12px', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' },
  logoutBtn:       { padding:'6px 14px', background:'#333', border:'none', borderRadius:'8px', color:'#fff', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' },
  statsGrid:       { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', padding:'20px 24px 0' },
  statCard:        { background:'#fff', borderRadius:'12px', padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' },
  statNum:         { fontSize:'28px', fontWeight:700 },
  statLabel:       { fontSize:'11px', color:'#aaa', textAlign:'center' },
  tabs:            { display:'flex', alignItems:'center', gap:'4px', padding:'16px 24px 0' },
  tab:             { padding:'8px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', color:'#888', fontWeight:500, display:'flex', alignItems:'center', gap:'6px' },
  tabActive:       { background:'#fff', color:'#1a1a1a', boxShadow:'0 1px 4px rgba(0,0,0,.08)' },
  refreshBtn:      { marginLeft:'auto', padding:'7px 14px', background:'#fff', border:'1px solid #eee', borderRadius:'8px', fontSize:'12px', cursor:'pointer', color:'#555', display:'flex', alignItems:'center', gap:'5px' },
  content:         { flex:1, padding:'16px 24px', overflowY:'auto' },
  tipoGrid:        { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'12px' },
  tipoCard:        { background:'#fff', borderRadius:'12px', padding:'16px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' },
  tipoTop:         { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' },
  tipoBadge:       { fontSize:'12px', padding:'3px 10px', borderRadius:'10px', fontWeight:600 },
  tipoCount:       { fontSize:'22px', fontWeight:700 },
  barBg:           { height:'6px', background:'#f0f0f0', borderRadius:'3px', marginBottom:'6px' },
  barFill:         { height:'6px', borderRadius:'3px' },
  tipoPct:         { fontSize:'11px', color:'#aaa' },
  searchRow:       { display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' },
  searchInput:     { flex:1, border:'1px solid #eee', borderRadius:'8px', padding:'8px 12px', fontSize:'13px', outline:'none' },
  searchCount:     { fontSize:'12px', color:'#aaa', whiteSpace:'nowrap' },
  tableWrapper:    { background:'#fff', borderRadius:'12px', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.06)' },
  table:           { width:'100%', borderCollapse:'collapse' },
  thead:           { background:'#f5f5f5' },
  th:              { padding:'10px 14px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'.04em' },
  tr:              { borderBottom:'1px solid #f5f5f5' },
  trSpam:          { background:'#fff8f8' },
  td:              { padding:'10px 14px', fontSize:'12px', color:'#333' },
  hashCell:        { display:'flex', alignItems:'center', gap:'6px' },
  spamBadge:       { fontSize:'10px', background:'#fff0f0', color:'#E24B4A', padding:'1px 6px', borderRadius:'6px', fontWeight:600, border:'1px solid #fdd' },
  hash:            { fontSize:'11px', color:'#888', fontFamily:'monospace' },
  tiposCell:       { display:'flex', gap:'4px', flexWrap:'wrap' },
  tipoTag:         { fontSize:'10px', background:'#f0f0f0', color:'#555', padding:'1px 6px', borderRadius:'6px' },
  blockBtn:        { padding:'4px 12px', background:'#fff0f0', border:'1px solid #fdd', borderRadius:'6px', color:'#E24B4A', fontSize:'11px', cursor:'pointer', fontWeight:500 },
  blockBtnLoading: { opacity:.5, cursor:'not-allowed' },
};
