//frontend/src/pages/AutoridadDashboard.jsx
import { useState, useEffect } from 'react';
import { ShieldCheck, FileText, BarChart2, MapPinned, LogOut, ShieldAlert, AlertTriangle } from 'lucide-react';
import AutoridadReportes from './AutoridadReportes';
import AutoridadAnalitica from './AutoridadAnalitica';
import AutoridadZonas from './AutoridadZonas';
import AutoridadReputacion from './AutoridadReputacion';
import AutoridadAlertas from './AutoridadAlertas';

const isMobile = () => window.innerWidth < 768;

const NAV_ITEMS = [
  { id: 'reportes',   label: 'Incidentes', Icon: FileText },
  { id: 'zonas',      label: 'Zonas',       Icon: MapPinned },
  { id: 'analitica',  label: 'Analítica',   Icon: BarChart2 },
  { id: 'alertas',    label: 'Alertas',     Icon: AlertTriangle },
  { id: 'reputacion', label: 'Reputación',  Icon: ShieldAlert },
];

export default function AutoridadDashboard({ secret, onLogout }) {
  const [activeTab, setActiveTab] = useState('reportes');
  const [mobile, setMobile] = useState(isMobile());

  useEffect(() => {
    const handleResize = () => setMobile(isMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderPanel = () => (
    <>
      {activeTab === 'reportes'  && <AutoridadReportes secret={secret} />}
      {activeTab === 'zonas'     && <AutoridadZonas secret={secret} />}
      {activeTab === 'analitica' && <AutoridadAnalitica secret={secret} />}
      {activeTab === 'reputacion' && <AutoridadReputacion secret={secret} />}
      {activeTab === 'alertas' && <AutoridadAlertas secret={secret} />}
    </>
  );

  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', fontFamily: '-apple-system,sans-serif', background: '#fafafa' }}>
        <header style={mStyles.header}>
          <div style={styles.logo}>
            <ShieldCheck size={18} color="#1a1a1a" strokeWidth={2.5} />
            <span>Autoridad</span>
          </div>
          <button onClick={onLogout} style={mStyles.logoutBtn} aria-label="Salir">
            <LogOut size={17} />
          </button>
        </header>

        <nav style={mStyles.tabStrip}>
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button key={id}
              style={{ ...mStyles.tabPill, ...(activeTab === id ? mStyles.tabPillActive : {}) }}
              onClick={() => setActiveTab(id)}>
              <Icon size={14} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <main style={mStyles.content}>
          {renderPanel()}
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', fontFamily: '-apple-system,sans-serif', background: '#fafafa' }}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <ShieldCheck size={18} color="#1a1a1a" strokeWidth={2.5} />
          <span>Autoridad</span>
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <div key={id}
              style={{ ...styles.navItem, ...(activeTab === id ? styles.navItemActive : {}) }}
              onClick={() => setActiveTab(id)}>
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
            </div>
          ))}
        </nav>

        <button onClick={onLogout} style={styles.logoutBtn}>
          <LogOut size={15} /> Salir
        </button>
      </aside>

      <main style={styles.content}>
        {renderPanel()}
      </main>
    </div>
  );
}

const styles = {
  sidebar:      { width: 200, background: '#fff', borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column', padding: '16px 12px', flexShrink: 0 },
  logo:         { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, padding: '4px 8px 20px', color: '#1a1a1a' },
  nav:          { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  navItem:      { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' },
  navItemActive:{ background: '#f5f5f5', color: '#1a1a1a', fontWeight: 600 },
  logoutBtn:    { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 13, padding: '8px 10px' },
  content:      { flex: 1, overflowY: 'auto', padding: 24 },
};

const mStyles = {
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0 },
  logoutBtn:   { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 6 },
  tabStrip:    { display: 'flex', gap: 6, padding: '8px 10px', overflowX: 'auto', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0, WebkitOverflowScrolling: 'touch' },
  tabPill:     { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '7px 12px', borderRadius: 20, border: '1px solid #eee', background: '#fafafa', color: '#666', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  tabPillActive: { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' },
  content:     { flex: 1, overflowY: 'auto', padding: 14 },
};
