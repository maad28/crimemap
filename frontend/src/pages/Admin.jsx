//Users/mac/crimemap/frontend/src/pages/Admin.jsx
import { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

export default function Admin() {
  const [secret, setSecret] = useState(() => localStorage.getItem('admin_secret') || '');

  const handleLogout = () => {
    localStorage.removeItem('admin_secret');
    setSecret('');
  };

  if (!secret) return <AdminLogin onLogin={setSecret} />;
  return <AdminDashboard secret={secret} onLogout={handleLogout} />;
}
