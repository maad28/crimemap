import { useState } from 'react';
import { Filter, X } from 'lucide-react';

const TIPOS = [
  'Robo a persona', 'Robo a domicilio', 'Robo a vehículo',
  'Asalto a mano armada', 'Homicidio', 'Extorsión',
  'Vandalismo', 'Punto GDO', 'Otro',
];const PERIODOS = [
  { label: 'Últimas 24h', valor: 1 },
  { label: 'Últimos 7 días', valor: 7 },
  { label: 'Últimos 30 días', valor: 30 },
  { label: 'Todo', valor: null },
];

export default function FilterPanel({ filtros, onChange, mobile }) {
  const [abierto, setAbierto] = useState(false);
  const posDerecha = mobile ? 16 : 264;

  const toggleTipo = (tipo) => {
    const nuevos = filtros.tipos.includes(tipo)
      ? filtros.tipos.filter(t => t !== tipo)
      : [...filtros.tipos, tipo];
    onChange({ ...filtros, tipos: nuevos });
  };

  const toggleEstado = (estado) => {
    const nuevos = filtros.estados.includes(estado)
      ? filtros.estados.filter(e => e !== estado)
      : [...filtros.estados, estado];
    onChange({ ...filtros, estados: nuevos });
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} style={{ ...styles.fab, right: posDerecha }}>
        <Filter size={20} color="#fff" />
      </button>
    );
  }

  return (
    <div style={{ ...styles.panel, right: posDerecha }}>
      <div style={styles.header}>
        <strong>Filtros</strong>
        <button onClick={() => setAbierto(false)} style={styles.closeBtn}><X size={18} /></button>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Periodo</div>
        <select
          value={filtros.dias ?? ''}
          onChange={e => onChange({ ...filtros, dias: e.target.value ? Number(e.target.value) : null })}
          style={styles.select}
        >
          {PERIODOS.map(p => (
            <option key={p.label} value={p.valor ?? ''}>{p.label}</option>
          ))}
        </select>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Tipo de incidente</div>
        {TIPOS.map(tipo => (
          <label key={tipo} style={styles.checkLabel}>
            <input type="checkbox" checked={filtros.tipos.includes(tipo)} onChange={() => toggleTipo(tipo)} />
            {tipo}
          </label>
        ))}
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Severidad mínima: {filtros.severidadMin}</div>
        <input
          type="range" min="1" max="5" value={filtros.severidadMin}
          onChange={e => onChange({ ...filtros, severidadMin: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={styles.section}>
      <div style={styles.label}>Estado de verificación</div>
      <label style={styles.checkLabel}>
        <input type="checkbox" checked={filtros.estados.includes('aprobado')} onChange={() => toggleEstado('aprobado')} />
        Verificado por autoridad
      </label>
      <label style={styles.checkLabel}>
        <input type="checkbox" checked={filtros.estados.includes('pendiente')} onChange={() => toggleEstado('pendiente')} />
        Pendiente de revisión
      </label>
      <label style={styles.checkLabel}>
        <input type="checkbox" checked={filtros.soloConfiables || false}
          onChange={() => onChange({ ...filtros, soloConfiables: !filtros.soloConfiables })} />
        ⭐ Solo reportantes confiables
      </label>
    </div>
    </div>
  );
}

const styles = {
  // position: 'fixed' (no 'absolute') a propósito, igual que PanicButton —
  // así los dos usan el mismo sistema de coordenadas (relativo al viewport,
  // no al contenedor del mapa) y quedan alineados en la misma columna sin
  // importar en qué layout (móvil/escritorio) se rendericen.
  // bottom:206 dejar un hueco de 8px sobre LocateButton (bottom:156, alto 42 → borde superior en 198)
  fab:    { position: 'fixed', bottom: 206, zIndex: 1000, background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,.2)' },
  panel:  { position: 'fixed', bottom: 206, zIndex: 1000, background: '#fff', borderRadius: 14, padding: 16, width: 240, maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,.15)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer' },
  section: { marginBottom: 14 },
  label:  { fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 },
  select: { width: '100%', padding: 6, borderRadius: 8, border: '1px solid #eee' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 4, cursor: 'pointer' },
};