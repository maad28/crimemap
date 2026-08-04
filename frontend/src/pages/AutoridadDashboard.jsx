import { useState } from 'react';
import { ShieldCheck, FileText, BarChart2, MapPinned, LogOut } from 'lucide-react';
import AutoridadReportes from './AutoridadReportes';
import AutoridadAnalitica from './AutoridadAnalitica';
import AutoridadZonas from './AutoridadZonas';

export default function AutoridadDashboard({ secret, onLogout }) {
  const [activeTab, setActiveTab] = useState('reportes');

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system,sans-serif', background: '#fafafa' }}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <ShieldCheck size={18} color="#1a1a1a" strokeWidth={2.5} />
          <span>Autoridad</span>
        </div>

        <nav style={styles.nav}>
          <div style={{ ...styles.navItem, ...(activeTab === 'reportes' ? styles.navItemActive : {}) }}
            onClick={() => setActiveTab('reportes')}>
            <FileText size={16} strokeWidth={1.8} />
            <span>Reportes</span>
          </div>
          <div style={{ ...styles.navItem, ...(activeTab === 'zonas' ? styles.navItemActive : {}) }}
            onClick={() => setActiveTab('zonas')}>
            <MapPinned size={16} strokeWidth={1.8} />
            <span>Zonas</span>
          </div>
          <div style={{ ...styles.navItem, ...(activeTab === 'analitica' ? styles.navItemActive : {}) }}
            onClick={() => setActiveTab('analitica')}>
            <BarChart2 size={16} strokeWidth={1.8} />
            <span>Analítica</span>
          </div>
        </nav>

        <button onClick={onLogout} style={styles.logoutBtn}>
          <LogOut size={15} /> Salir
        </button>
      </aside>

      <main style={styles.content}>
        {activeTab === 'reportes'  && <AutoridadReportes secret={secret} />}
        {activeTab === 'zonas'     && <AutoridadZonas secret={secret} />}
        {activeTab === 'analitica' && <AutoridadAnalitica secret={secret} />}
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