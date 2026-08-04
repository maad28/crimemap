//Users/mac/crimemap/frontend/src/api/client.js
import axios from 'axios';

export const apiExpress = axios.create({
  baseURL: import.meta.env.VITE_API_EXPRESS || 'http://localhost:3001',
});

export const apiFastapi = axios.create({
  baseURL: import.meta.env.VITE_API_FASTAPI || 'http://localhost:8000',
});
