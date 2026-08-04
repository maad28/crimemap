import { apiExpress, apiFastapi } from './client';

export const getReports = (bounds, filtros = {}) => {
  const { dias, tipos, severidadMin, estados } = filtros;
  const params = { bounds };

  if (dias) params.dias = dias;
  if (tipos && tipos.length) params.tipo = tipos.join(',');
  if (severidadMin && severidadMin > 1) params.severidad_min = severidadMin;
  if (estados && estados.length) params.estado = estados.join(',');

  return apiExpress.get('/api/reports', { params }).then(r => r.data);
};

export const createReport = (data) =>
  apiExpress.post('/api/reports', data).then(r => r.data);

export const confirmReport = (id) =>
  apiExpress.post(`/api/reports/${id}/confirm`).then(r => r.data);

export const getNearby = (lat, lng, radius = 500) =>
  apiExpress.get('/api/reports/nearby', { params: { lat, lng, radius } }).then(r => r.data);

export const getHeatmap = (days = 30) =>
  apiFastapi.get('/heatmap', { params: { days } }).then(r => r.data);

export const getClusters = () =>
  apiFastapi.get('/clustering').then(r => r.data);

export const getZonasVerificadas = () =>
  apiExpress.get('/api/reports/zonas-verificadas').then(r => r.data);