import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error atrapado por ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={styles.wrapper}>
          <div style={styles.card}>
            <div style={styles.title}>Algo salió mal</div>
            <p style={styles.desc}>
              Ocurrió un error inesperado cargando la página. Intenta recargar.
            </p>
            <button style={styles.btn} onClick={() => window.location.reload()}>
              Recargar
            </button>
            <pre style={styles.error}>{String(this.state.error.message || this.state.error)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  wrapper: { height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', fontFamily: '-apple-system,sans-serif', padding: 20 },
  card: { background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 380, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,.1)', textAlign: 'center' },
  title: { fontWeight: 700, fontSize: 17, color: '#1a1a1a', marginBottom: 8 },
  desc: { fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 16 },
  btn: { background: '#E24B4A', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  error: { marginTop: 16, fontSize: 10, color: '#aaa', whiteSpace: 'pre-wrap', textAlign: 'left', maxHeight: 100, overflowY: 'auto' },
};
