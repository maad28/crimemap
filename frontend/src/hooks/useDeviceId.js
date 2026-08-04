//Users/mac/crimemap/frontend/src/hooks/useDeviceId.js
import { useState, useEffect } from 'react';

function generateId() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    let id = localStorage.getItem('crimemap_device_id');
    if (!id) {
      id = generateId();
      localStorage.setItem('crimemap_device_id', id);
    }
    setDeviceId(id);
  }, []);

  return deviceId;
}
