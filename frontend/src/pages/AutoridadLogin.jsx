import { useState } from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function AutoridadLogin({ onLogin }) {
  const [secret,  setSecret]  = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!secret) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('http://localhost:3001/api/authority/stats', {
        headers: { 'x-authority-secret': secret }
      });
      if (res.ok) { localStorage.setItem('autoridad_secret', secret); onLogin(secret); }
      else setError('Contraseña incorrecta');
    } catch { setError('No se pudo conectar al servidor'); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <ShieldCheck size={28} color="#1a1a1a" strokeWidth={1.5}/>
        </div>
        <div style={styles.title}>Panel Autoridad</div>
        <div style={styles.subtitle}>CrimeMap Guayaquil</div>
        <input
          type="password"
          placeholder="Contraseña de autoridad"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={styles.input}
          autoFocus
        />
        {error && <div style={styles.error}>{error}</div>}
        <button style={styles.btn} onClick={handleLogin} disabled={loading}>
          {loading ? 'Verificando...' : 'Ingresar'}
        </button>
        <a href="/" style={styles.back}>
          <ArrowLeft size={13} strokeWidth={2}/> Volver al mapa
        </a>
      </div>
    </div>
  );
}

const styles = {
  wrapper:  { height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5f5' },
  card:     { background:'#fff', borderRadius:'16px', padding:'40px 36px', width:'340px', boxShadow:'0 4px 24px rgba(0,0,0,.1)', display:'flex', flexDirection:'column', alignItems:'center' },
  iconWrap: { width:'60px', height:'60px', background:'#f5f5f5', borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'16px' },
  title:    { fontSize:'20px', fontWeight:700, color:'#1a1a1a', marginBottom:'4px' },
  subtitle: { fontSize:'13px', color:'#aaa', marginBottom:'24px' },
  input:    { width:'100%', border:'1px solid #eee', borderRadius:'10px', padding:'10px 14px', fontSize:'14px', marginBottom:'8px', boxSizing:'border-box', outline:'none' },
  error:    { fontSize:'12px', color:'#E24B4A', background:'#fff0f0', padding:'6px 10px', borderRadius:'6px', marginBottom:'8px', width:'100%', textAlign:'center' },
  btn:      { width:'100%', padding:'10px', background:'#1a1a1a', border:'none', borderRadius:'10px', color:'#fff', fontWeight:600, fontSize:'14px', cursor:'pointer', marginBottom:'16px' },
  back:     { fontSize:'12px', color:'#aaa', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' },
};