import { useState } from 'react';
import AutoridadLogin from './AutoridadLogin';
import AutoridadDashboard from './AutoridadDashboard';

export default function Autoridad() {
  const [secret, setSecret] = useState(() => localStorage.getItem('autoridad_secret') || '');

  const handleLogout = () => {
    localStorage.removeItem('autoridad_secret');
    setSecret('');
  };

  if (!secret) return <AutoridadLogin onLogin={setSecret} />;
  return <AutoridadDashboard secret={secret} onLogout={handleLogout} />;
}