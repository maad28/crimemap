//Users/mac/crimemap/backend-express/src/routes/geocode.js
const express = require('express');
const router  = express.Router();

// Autocomplete — sugerencias mientras escribe
router.get('/autocomplete', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) return res.json({ predictions: [] });

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
      `input=${encodeURIComponent(q)}` +
      `&components=country:ec` +
      `&location=-2.1894,-79.8891&radius=20000` +
      `&language=es` +
      `&key=${process.env.GOOGLE_MAPS_KEY}`;

    const response = await fetch(url);
    const data     = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error autocomplete' });
  }
});

// Geocode — convierte place_id a coordenadas
router.get('/place', async (req, res) => {
  try {
    const { place_id } = req.query;
    if (!place_id) return res.status(400).json({ error: 'Falta place_id' });

    const url = `https://maps.googleapis.com/maps/api/place/details/json?` +
      `place_id=${place_id}` +
      `&fields=geometry,formatted_address,name` +
      `&language=es` +
      `&key=${process.env.GOOGLE_MAPS_KEY}`;

    const response = await fetch(url);
    const data     = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error place details' });
  }
});
// GET /api/geocode/staticmap?lat=..&lng=..
router.get('/staticmap', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Faltan lat/lng' });

    const url = `https://maps.googleapis.com/maps/api/staticmap?` +
      `center=${lat},${lng}` +
      `&zoom=15&size=280x130&scale=2` +
      `&markers=color:red%7C${lat},${lng}` +
      `&key=${process.env.GOOGLE_MAPS_KEY}`;

    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: 'Error del servicio de mapas' });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // cachea 1 día, son coordenadas fijas
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Error al generar mapa' });
  }
});

// GET /api/geocode/reverse?lat=..&lng=..
router.get('/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Faltan lat/lng' });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?` +
      `latlng=${lat},${lng}&language=es&key=${process.env.GOOGLE_MAPS_KEY}`;

    const response = await fetch(url);
    const data     = await response.json();
    const address  = data.results?.[0]?.formatted_address || 'Dirección no disponible';
    res.json({ address });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dirección' });
  }
});

module.exports = router;
