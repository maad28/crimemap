const express = require('express');
const crypto  = require('crypto');
const pool    = require('../db/pool');
const router  = express.Router();

const hashDevice = (id) => crypto.createHash('sha256').update(id).digest('hex');
const { detectarZona } = require('../services/zonas');
const {
  registrarNuevoReporte,
  estaBloqueado,
  detectarRafaga,
  excedeLimiteFrecuencia,
  detectarDispositivoNuevoSospechoso,
} = require('../services/reputacion');

router.get('/', async (req, res) => {
  try {
    const { bounds, dias, tipo, severidad_min, estado } = req.query;

    const estadosPermitidos = ['pendiente', 'aprobado'];
    const estadosFiltro = estado
      ? estado.split(',').filter(e => estadosPermitidos.includes(e))
      : estadosPermitidos;
    const estadosFinal = estadosFiltro.length ? estadosFiltro : estadosPermitidos;

    const conditions = [`r.estado = ANY($1)`];
    const params = [estadosFinal];
    let i = 2;

    if (bounds) {
      const [lat1, lng1, lat2, lng2] = bounds.split(',').map(Number);
      conditions.push(`r.ubicacion && ST_MakeEnvelope($${i},$${i+1},$${i+2},$${i+3}, 4326)::geography`);
      params.push(lng1, lat1, lng2, lat2);
      i += 4;
    }

    if (dias) {
      conditions.push(`r.created_at > NOW() - INTERVAL '1 day' * $${i}`);
      params.push(parseInt(dias));
      i += 1;
    }

    if (tipo) {
      conditions.push(`r.tipo = ANY($${i})`);
      params.push(tipo.split(','));
      i += 1;
    }

    if (severidad_min) {
      conditions.push(`r.severidad >= $${i}`);
      params.push(parseInt(severidad_min));
      i += 1;
    }

    const { rows } = await pool.query(`
      SELECT r.id, r.tipo, r.descripcion, r.severidad, r.confirmaciones, r.estado,
             ST_Y(r.ubicacion::geometry) AS lat,
             ST_X(r.ubicacion::geometry) AS lng,
             r.created_at,
             COALESCE(rd.puntos, 100) AS reputacion_puntos
      FROM reports r
      LEFT JOIN reputacion_dispositivo rd ON rd.device_hash = r.device_hash
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.created_at DESC
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
         AND estado = 'pendiente'
         AND confirmaciones < 10
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

    // Bloquear dispositivos con reputación por debajo del umbral
    if (await estaBloqueado(device_hash)) {
      return res.status(403).json({ error: 'Dispositivo bloqueado por actividad indebida' });
    }

    // ← AQUÍ VA EL NUEVO CHEQUEO DE FRECUENCIA
    if (await excedeLimiteFrecuencia(device_hash)) {
      return res.status(429).json({ error: 'Demasiados reportes en poco tiempo. Espera unos minutos.' });
    }

    const point = `SRID=4326;POINT(${lng} ${lat})`;
    const { rows } = await pool.query(
      `INSERT INTO reports (tipo, descripcion, severidad, ubicacion, device_hash)
       VALUES ($1,$2,$3,$4::geography,$5) RETURNING id, tipo, created_at`,
      [tipo, descripcion || null, severidad || 3, point, device_hash]
    );

    await registrarNuevoReporte(device_hash);

    // Detección de patrones sospechosos (no bloquea la respuesta al ciudadano)
    Promise.all([
      detectarRafaga(tipo, lat, lng),
      detectarDispositivoNuevoSospechoso(device_hash),
    ]).then(([rafaga, dispositivoNuevo]) => {
      if (rafaga.sospechoso) console.warn('⚠️ Ráfaga sospechosa detectada:', rafaga);
      if (dispositivoNuevo.sospechoso) console.warn('⚠️ Dispositivo nuevo sospechoso:', dispositivoNuevo);
    }).catch(err => console.error('Error en detección de patrones:', err));

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
// GET /api/reports/alerta-cercana?lat=..&lng=..
router.get('/alerta-cercana', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Faltan lat/lng' });

    const { rows } = await pool.query(`
      SELECT id, tipo, severidad, confirmaciones, estado,
             ST_Distance(ubicacion, ST_MakePoint($2,$1)::geography) AS distancia_metros,
             created_at
      FROM reports
      WHERE (estado = 'aprobado' OR confirmaciones >= 10)
        AND estado != 'rechazado'
        AND created_at > NOW() - INTERVAL '2 hours'
        AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, 1000)
      ORDER BY created_at DESC
      LIMIT 3
    `, [lat, lng]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar alertas cercanas' });
  }
});

// En reports.js, nuevo endpoint público que incluye pendientes y verificadas (nunca descartadas)
router.get('/zonas-para-ruta', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, radio_metros, total_reportes, tipo_predominante, estado,
             ST_Y(centro::geometry) AS lat,
             ST_X(centro::geometry) AS lng
      FROM zonas_concentracion
      WHERE estado != 'descartada'
      ORDER BY total_reportes DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener zonas para ruta' });
  }
});

// GET /api/reports/tipos-por-zona?lat=..&lng=..&radio=1000
router.get('/tipos-por-zona', async (req, res) => {
  try {
    const { lat, lng, radio = 1000 } = req.query;
    const { rows } = await pool.query(`
      SELECT tipo, COUNT(*) AS total
      FROM reports
      WHERE ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, $3)
      GROUP BY tipo
      ORDER BY total DESC
    `, [lat, lng, radio]);

    const totalGeneral = rows.reduce((sum, r) => sum + Number(r.total), 0);
    const conPorcentaje = rows.map(r => ({
      tipo: r.tipo,
      total: Number(r.total),
      porcentaje: totalGeneral > 0 ? Math.round((Number(r.total) / totalGeneral) * 100) : 0,
    }));

    res.json({ total_general: totalGeneral, tipos: conPorcentaje });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tipos por zona' });
  }
});

module.exports = router;