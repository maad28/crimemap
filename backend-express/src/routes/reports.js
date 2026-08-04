
//Users/mac/crimemap/backend-express/src/routes/reports.js
const express = require('express');
const crypto  = require('crypto');
const pool    = require('../db/pool');
const router  = express.Router();

const hashDevice = (id) => crypto.createHash('sha256').update(id).digest('hex');
const { detectarZona } = require('../services/zonas');
router.get('/', async (req, res) => {
  try {
    const { bounds, dias, tipo, severidad_min, estado } = req.query;

    // Estados permitidos al público: nunca 'rechazado'
    const estadosPermitidos = ['pendiente', 'aprobado'];
    const estadosFiltro = estado
      ? estado.split(',').filter(e => estadosPermitidos.includes(e))
      : estadosPermitidos;
    const estadosFinal = estadosFiltro.length ? estadosFiltro : estadosPermitidos;

    const conditions = [`estado = ANY($1)`];
    const params = [estadosFinal];
    let i = 2;

    if (bounds) {
      const [lat1, lng1, lat2, lng2] = bounds.split(',').map(Number);
      conditions.push(`ubicacion && ST_MakeEnvelope($${i},$${i+1},$${i+2},$${i+3}, 4326)::geography`);
      params.push(lng1, lat1, lng2, lat2);
      i += 4;
    }

    if (dias) {
      conditions.push(`created_at > NOW() - INTERVAL '1 day' * $${i}`);
      params.push(parseInt(dias));
      i += 1;
    }

    if (tipo) {
      conditions.push(`tipo = ANY($${i})`);
      params.push(tipo.split(','));
      i += 1;
    }

    if (severidad_min) {
      conditions.push(`severidad >= $${i}`);
      params.push(parseInt(severidad_min));
      i += 1;
    }

    const { rows } = await pool.query(`
      SELECT id, tipo, descripcion, severidad, confirmaciones, estado,
             ST_Y(ubicacion::geometry) AS lat,
             ST_X(ubicacion::geometry) AS lng,
             created_at
      FROM reports
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ${bounds ? 500 : 200}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 500 } = req.query;
    const { rows } = await pool.query(
      `SELECT id, tipo, confirmaciones, severidad, descripcion, estado,
              ST_Y(ubicacion::geometry) AS lat,
              ST_X(ubicacion::geometry) AS lng,
              ST_Distance(ubicacion, ST_MakePoint($2,$1)::geography) AS distancia_metros
       FROM reports
       WHERE ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, $3)
         AND created_at > NOW() - INTERVAL '6 hours'
         AND estado != 'rechazado'
       ORDER BY distancia_metros ASC LIMIT 10`,
      [lat, lng, radius]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error buscando cercanos' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { tipo, descripcion, lat, lng, severidad, device_id } = req.body;
    if (!tipo || !lat || !lng || !device_id)
      return res.status(400).json({ error: 'Faltan campos requeridos' });

    const device_hash = hashDevice(device_id);
    const point = `SRID=4326;POINT(${lng} ${lat})`;
    const { rows } = await pool.query(
      `INSERT INTO reports (tipo, descripcion, severidad, ubicacion, device_hash)
       VALUES ($1,$2,$3,$4::geography,$5) RETURNING id, tipo, created_at`,
      [tipo, descripcion || null, severidad || 3, point, device_hash]
    );

    detectarZona(lat, lng).catch(err => console.error('Error detectando zona:', err));

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar reporte' });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE reports SET confirmaciones = confirmaciones + 1
       WHERE id = $1 RETURNING id, confirmaciones`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al confirmar' });
  }
});

// GET /api/reports/zonas-verificadas — público, sin auth
router.get('/zonas-verificadas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, radio_metros, total_reportes, tipo_predominante,
             ST_Y(centro::geometry) AS lat,
             ST_X(centro::geometry) AS lng,
             ultima_actualizacion
      FROM zonas_concentracion
      WHERE estado = 'verificada'
      ORDER BY total_reportes DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener zonas verificadas' });
  }
});


module.exports = router;
