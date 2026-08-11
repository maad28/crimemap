// Mismos sectores urbanos usados en backend-fastapi/seed.py — permite ponerle
// nombre legible a una zona detectada (que solo tiene lat/lng) buscando el
// sector con nombre más cercano.
export const ZONAS_URBANAS = [
  { nombre: 'Socio Vivienda',            lat: -2.12214, lng: -79.95721 },
  { nombre: 'Monte Sinaí',               lat: -2.11542, lng: -79.97015 },
  { nombre: 'El Guasmo Sur',             lat: -2.26182, lng: -79.89845 },
  { nombre: 'Isla Trinitaria',           lat: -2.24251, lng: -79.91632 },
  { nombre: 'Bastión Popular',           lat: -2.09115, lng: -79.93124 },
  { nombre: 'Febres Cordero (Suburbio)', lat: -2.21453, lng: -79.93241 },
  { nombre: 'Pascuales Centro',          lat: -2.05941, lng: -79.90422 },
  { nombre: 'Cristo del Consuelo',       lat: -2.22635, lng: -79.91421 },
  { nombre: 'Sauces (Etapas 1-9)',       lat: -2.13142, lng: -79.89215 },
  { nombre: 'Alborada',                  lat: -2.14152, lng: -79.89942 },
  { nombre: 'Mucho Lote 1',              lat: -2.07841, lng: -79.91232 },
  { nombre: 'Puerto Santa Ana',          lat: -2.18025, lng: -79.87412 },
  { nombre: 'Urdesa Central',            lat: -2.16782, lng: -79.90924 },
  { nombre: 'Los Ceibos',                lat: -2.16853, lng: -79.93815 },
  { nombre: 'Kennedy Norte',             lat: -2.15842, lng: -79.89124 },
  { nombre: 'Barrio Centenario',         lat: -2.22741, lng: -79.89312 },
];

export function nombreZona(lat, lng) {
  let mejor = null;
  let mejorDist = Infinity;
  for (const z of ZONAS_URBANAS) {
    const dist = Math.hypot(lat - z.lat, lng - z.lng);
    if (dist < mejorDist) { mejorDist = dist; mejor = z; }
  }
  return mejor && mejorDist < 0.05 ? mejor.nombre : `Zona ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}
