const express      = require('express');
const pool         = require('../db/pool');
const authorityAuth = require('../middleware/authorityAuth');
const router       = express.Router();
const { recalcularTodasLasZonas, clasificarNivelRiesgo, DIAS_HISTORIAL_RIESGO, SEMANAS_HISTORIAL_RIESGO } = require('../services/zonas');
const { ajustarPorAprobacion, ajustarPorRechazo, bloquearManualmente, desbloquearManualmente } = require('../services/reputacion');

router.use(authorityAuth);

const ORDEN_REPORTES = {
  recientes:           'created_at DESC, id DESC',
  antiguos:             'created_at ASC, id ASC',
  severidad_desc:       'severidad DESC, created_at DESC, id DESC',
  confirmaciones_desc:  'confirmaciones DESC, created_at DESC, id DESC',
};
const ordenReportesSql = (orden) => ORDEN_REPORTES[orden] || ORDEN_REPORTES.recientes;

const ORDEN_ZONAS = {
  total_desc: 'total_reportes DESC',
  total_asc:  'total_reportes ASC',
  recientes:  'primera_deteccion DESC',
  antiguas:   'primera_deteccion ASC',
};
const ordenZonasSql = (orden) => ORDEN_ZONAS[orden] || ORDEN_ZONAS.total_desc;

const ORDEN_REPUTACION = {
  puntos_asc:      'puntos ASC',
  puntos_desc:      'puntos DESC',
  rechazos_desc:    'reportes_rechazados DESC, puntos ASC',
  aprobados_desc:   'reportes_aprobados DESC',
  reportes_desc:    'reportes_totales DESC',
  recientes:        'primera_actividad DESC',
  antiguos:         'primera_actividad ASC',
};
const ordenReputacionSql = (orden) => ORDEN_REPUTACION[orden] || ORDEN_REPUTACION.puntos_asc;

router.get('/pendientes', async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;
    const { dias, tipo, severidad_min, orden, lat, lng, radio = 1000 } = req.query;

    const conditions = [`estado = 'pendiente'`];
    const params = [];
    let i = 1;

    if (lat && lng) {
      conditions.push(`ST_DWithin(ubicacion, ST_MakePoint($${i + 1},$${i})::geography, $${i + 2})`);
      params.push(lat, lng, radio);
      i += 3;
    }
    if (dias) {
      conditions.push(`created_at > NOW() - INTERVAL '1 day' * $${i}`);
      params.push(parseInt(dias));
      i++;
    }
    if (tipo) {
      conditions.push(`tipo = ANY($${i})`);
      params.push(tipo.split(','));
      i++;
    }
    if (severidad_min) {
      conditions.push(`severidad >= $${i}`);
      params.push(parseInt(severidad_min));
      i++;
    }

    const where = conditions.join(' AND ');

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM reports WHERE ${where}`, params
    );

    const { rows } = await pool.query(`
      SELECT id, tipo, descripcion, severidad, confirmaciones, estado, rol_reportante,
             ST_Y(ubicacion::geometry) AS lat,
             ST_X(ubicacion::geometry) AS lng,
             created_at
      FROM reports
      WHERE ${where}
      ORDER BY ${ordenReportesSql(orden)}
      LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({ data: rows, total: Number(count), page, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pendientes' });
  }
});

router.get('/revisados', async (req, res) => {
  try {
    const estados = (req.query.estado || 'aprobado,rechazado').split(',');
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;
    const { dias, tipo, severidad_min, orden, lat, lng, radio = 1000 } = req.query;

    const conditions = [`estado = ANY($1)`];
    const params = [estados];
    let i = 2;

    if (lat && lng) {
      conditions.push(`ST_DWithin(ubicacion, ST_MakePoint($${i + 1},$${i})::geography, $${i + 2})`);
      params.push(lat, lng, radio);
      i += 3;
    }
    if (dias) {
      conditions.push(`created_at > NOW() - INTERVAL '1 day' * $${i}`);
      params.push(parseInt(dias));
      i++;
    }
    if (tipo) {
      conditions.push(`tipo = ANY($${i})`);
      params.push(tipo.split(','));
      i++;
    }
    if (severidad_min) {
      conditions.push(`severidad >= $${i}`);
      params.push(parseInt(severidad_min));
      i++;
    }

    const where = conditions.join(' AND ');

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM reports WHERE ${where}`, params
    );

    const { rows } = await pool.query(`
      SELECT id, tipo, descripcion, severidad, confirmaciones, estado, rol_reportante,
             ST_Y(ubicacion::geometry) AS lat,
             ST_X(ubicacion::geometry) AS lng,
             created_at
      FROM reports
      WHERE ${where}
      ORDER BY ${ordenReportesSql(orden)}
      LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({ data: rows, total: Number(count), page, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener revisados' });
  }
});

// POST /api/authority/:id/aprobar  (body opcional: { severidad } para ajustarla al aprobar)
router.post('/:id/aprobar', async (req, res) => {
  try {
    const severidad = parseInt(req.body?.severidad);
    const severidadValida = severidad >= 1 && severidad <= 5 ? severidad : null;

    const { rows } = await pool.query(
      severidadValida
        ? `UPDATE reports SET estado = 'aprobado', severidad = $2
           WHERE id = $1 RETURNING id, estado, severidad, device_hash`
        : `UPDATE reports SET estado = 'aprobado'
           WHERE id = $1 RETURNING id, estado, severidad, device_hash`,
      severidadValida ? [req.params.id, severidadValida] : [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    await ajustarPorAprobacion(rows[0].device_hash);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar' });
  }
});

// POST /api/authority/:id/rechazar
router.post('/:id/rechazar', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE reports SET estado = 'rechazado'
       WHERE id = $1 RETURNING id, estado, device_hash`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    const resultado = await ajustarPorRechazo(rows[0].device_hash);
    res.json({ ...rows[0], reputacion_actualizada: resultado });
  } catch (err) {
    res.status(500).json({ error: 'Error al rechazar' });
  }
});

// GET /api/authority/stats
router.get('/stats', async (req, res) => {
  try {
    const { rows: [stats] } = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
             COUNT(*) FILTER (WHERE estado = 'aprobado')  AS aprobados,
             COUNT(*) FILTER (WHERE estado = 'rechazado') AS rechazados
      FROM reports`);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener stats' });
  }
});

// POST /api/authority/:id/revertir — regresa a pendiente
router.post('/:id/revertir', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE reports SET estado = 'pendiente'
       WHERE id = $1 RETURNING id, estado`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al revertir' });
  }
});

// GET /api/authority/analitica
router.get('/analitica', async (req, res) => {
  try {
    const { rows: porTipo } = await pool.query(`
      SELECT tipo,
             COUNT(*)                                     AS total,
             COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
             COUNT(*) FILTER (WHERE estado = 'aprobado')  AS aprobados,
             COUNT(*) FILTER (WHERE estado = 'rechazado') AS rechazados
      FROM reports
      GROUP BY tipo
      ORDER BY total DESC
    `);

    const { rows: tendencia } = await pool.query(`
      SELECT DATE(created_at) AS fecha,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE tipo = 'Robo a persona')       AS robos,
             COUNT(*) FILTER (WHERE tipo = 'Asalto a mano armada') AS asaltos,
             COUNT(*) FILTER (WHERE tipo = 'Homicidio')            AS homicidios,
             COUNT(*) FILTER (WHERE tipo = 'Punto GDO')            AS gdo
      FROM reports
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY fecha ASC
    `);

    // Misma ventana, mismo criterio ('aprobado') y mismo tipo de riesgo
    // (severidad acumulada, no conteo) que zonas_concentracion y el modelo
    // de predicción — ver services/zonas.js.
    const { rows: zonasRaw } = await pool.query(`
      SELECT
        ROUND(ST_Y(ubicacion::geometry)::numeric, 2) AS lat_zona,
        ROUND(ST_X(ubicacion::geometry)::numeric, 2) AS lng_zona,
        COUNT(*) AS total,
        AVG(severidad) AS severidad_promedio,
        SUM(severidad) AS riesgo_total
      FROM reports
      WHERE estado = 'aprobado'
        AND created_at > NOW() - INTERVAL '${DIAS_HISTORIAL_RIESGO} days'
      GROUP BY lat_zona, lng_zona
      ORDER BY riesgo_total DESC
      LIMIT 8
    `);
    const zonas = zonasRaw.map(z => {
      const riesgoSemanal = Number(z.riesgo_total) / SEMANAS_HISTORIAL_RIESGO;
      return {
        ...z,
        riesgo_semanal: Math.round(riesgoSemanal * 100) / 100,
        nivel_riesgo: clasificarNivelRiesgo(riesgoSemanal),
      };
    });

    const { rows: [totales] } = await pool.query(`
      SELECT COUNT(*) AS total_denuncias,
             COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
             COUNT(*) FILTER (WHERE estado = 'aprobado')  AS aprobados,
             COUNT(*) FILTER (WHERE estado = 'rechazado') AS rechazados,
             ROUND(100.0 * COUNT(*) FILTER (WHERE estado = 'aprobado') /
               NULLIF(COUNT(*) FILTER (WHERE estado != 'pendiente'), 0), 1) AS tasa_aprobacion_pct
      FROM reports
    `);

    res.json({ por_tipo: porTipo, tendencia, zonas, totales });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener analítica' });
  }
});

// POST /api/authority/dispositivos/:hash/bloquear
router.post('/dispositivos/:hash/bloquear', async (req, res) => {
  try {
    await bloquearManualmente(req.params.hash);
    res.json({ ok: true, device_hash: req.params.hash, bloqueado: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al bloquear dispositivo' });
  }
});

// POST /api/authority/dispositivos/:hash/desbloquear
router.post('/dispositivos/:hash/desbloquear', async (req, res) => {
  try {
    await desbloquearManualmente(req.params.hash);
    res.json({ ok: true, device_hash: req.params.hash, bloqueado: false });
  } catch (err) {
    res.status(500).json({ error: 'Error al desbloquear dispositivo' });
  }
});

// GET /api/authority/reputacion?bloqueados=true
router.get('/reputacion', async (req, res) => {
  try {
    const soloBloqueados = req.query.bloqueados === 'true';
    const where = soloBloqueados ? 'WHERE bloqueado = true' : '';
    const orderBy = ordenReputacionSql(req.query.orden);
    const { rows } = await pool.query(`
      SELECT device_hash, puntos, reportes_totales, reportes_aprobados,
             reportes_rechazados, bloqueado, primera_actividad
      FROM reputacion_dispositivo
      ${where}
      ORDER BY ${orderBy}
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reputación' });
  }
});

// GET /api/authority/zonas?estado=pendiente&page=1&limit=12
router.get('/zonas', async (req, res) => {
  try {
    const estado = req.query.estado || 'pendiente';
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM zonas_concentracion WHERE estado = $1`, [estado]
    );

    const { rows } = await pool.query(`
      SELECT z.id, z.radio_metros, z.total_reportes, z.tipo_predominante, z.estado,
             ST_Y(z.centro::geometry) AS lat,
             ST_X(z.centro::geometry) AS lng,
             z.primera_deteccion, z.ultima_actualizacion,
             COALESCE(r.riesgo_total, 0) AS riesgo_total
      FROM zonas_concentracion z
      LEFT JOIN LATERAL (
        SELECT SUM(severidad) AS riesgo_total
        FROM reports
        WHERE estado = 'aprobado'
          AND created_at > NOW() - INTERVAL '${DIAS_HISTORIAL_RIESGO} days'
          AND ST_DWithin(ubicacion, z.centro, z.radio_metros)
      ) r ON true
      WHERE z.estado = $1
      ORDER BY ${ordenZonasSql(req.query.orden)}
      LIMIT $2 OFFSET $3`, [estado, limit, offset]
    );

    // Misma fórmula y umbrales que el modelo de predicción (ver services/zonas.js):
    // riesgo = severidad acumulada / semanas / 24 horas, porque aquí se suman
    // las 24 horas del día juntas y el modelo predice para una hora puntual.
    const data = rows.map(z => {
      const riesgoSemanal = Number(z.riesgo_total) / SEMANAS_HISTORIAL_RIESGO;
      return {
        ...z,
        riesgo_semanal: Math.round(riesgoSemanal * 100) / 100,
        nivel_riesgo: clasificarNivelRiesgo(riesgoSemanal),
      };
    });

    res.json({ data, total: Number(count), page, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
});

// GET /api/authority/zonas/:id/reportes — denuncias que componen esa zona
router.get('/zonas/:id/reportes', async (req, res) => {
  try {
    const { rows: [zona] } = await pool.query(
      `SELECT ST_Y(centro::geometry) AS lat, ST_X(centro::geometry) AS lng, radio_metros
       FROM zonas_concentracion WHERE id = $1`, [req.params.id]
    );
    if (!zona) return res.status(404).json({ error: 'Zona no encontrada' });

    const { rows } = await pool.query(`
      SELECT id, tipo, descripcion, severidad, estado,
             ST_Y(ubicacion::geometry) AS lat,
             ST_X(ubicacion::geometry) AS lng,
             created_at
      FROM reports
      WHERE estado != 'rechazado'
        AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, $3)
      ORDER BY created_at DESC
    `, [zona.lat, zona.lng, zona.radio_metros]);

    res.json({ zona, reportes: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reportes de la zona' });
  }
});

// POST /api/authority/zonas/:id/verificar
router.post('/zonas/:id/verificar', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE zonas_concentracion SET estado = 'verificada', ultima_actualizacion = NOW()
       WHERE id = $1 RETURNING id, estado`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar zona' });
  }
});

// POST /api/authority/zonas/:id/descartar
router.post('/zonas/:id/descartar', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE zonas_concentracion SET estado = 'descartada', ultima_actualizacion = NOW()
       WHERE id = $1 RETURNING id, estado`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al descartar zona' });
  }
});

// POST /api/authority/zonas/:id/revertir
router.post('/zonas/:id/revertir', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE zonas_concentracion SET estado = 'pendiente', ultima_actualizacion = NOW()
       WHERE id = $1 RETURNING id, estado`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al revertir zona' });
  }
});

router.post('/zonas/recalcular', async (req, res) => {
  try {
    const totalZonas = await recalcularTodasLasZonas();
    res.json({ ok: true, zonas_generadas: totalZonas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al recalcular zonas' });
  }
});

// GET /api/authority/alertas?revisada=false
router.get('/alertas', async (req, res) => {
  try {
    const soloNoRevisadas = req.query.revisada !== 'true';
    const where = soloNoRevisadas ? 'WHERE revisada = false' : '';
    const { rows } = await pool.query(`
      SELECT id, tipo_alerta, detalle, revisada, created_at
      FROM alertas_sospecha
      ${where}
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

// POST /api/authority/alertas/:id/marcar-revisada
router.post('/alertas/:id/marcar-revisada', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE alertas_sospecha SET revisada = true
       WHERE id = $1 RETURNING id, revisada`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar alerta' });
  }
});

// GET /api/authority/exportar?tab=pendientes&dias=30&tipo=..&severidad_min=..&orden=..
router.get('/exportar', async (req, res) => {
  try {
    const { tab, dias, tipo, severidad_min, orden, lat, lng, radio = 1000 } = req.query;

    const estadoMap = { pendientes: 'pendiente', aprobados: 'aprobado', rechazados: 'rechazado' };
    const estado = estadoMap[tab] || 'pendiente';

    const conditions = [`estado = $1`];
    const params = [estado];
    let i = 2;

    if (lat && lng) {
      conditions.push(`ST_DWithin(ubicacion, ST_MakePoint($${i + 1},$${i})::geography, $${i + 2})`);
      params.push(lat, lng, radio);
      i += 3;
    }
    if (dias) {
      conditions.push(`created_at > NOW() - INTERVAL '1 day' * $${i}`);
      params.push(parseInt(dias));
      i++;
    }
    if (tipo) {
      conditions.push(`tipo = ANY($${i})`);
      params.push(tipo.split(','));
      i++;
    }
    if (severidad_min) {
      conditions.push(`severidad >= $${i}`);
      params.push(parseInt(severidad_min));
      i++;
    }

    const where = conditions.join(' AND ');

    const { rows } = await pool.query(`
      SELECT id, tipo, descripcion, severidad, confirmaciones, estado, rol_reportante,
             ST_Y(ubicacion::geometry) AS lat,
             ST_X(ubicacion::geometry) AS lng,
             created_at
      FROM reports
      WHERE ${where}
      ORDER BY ${ordenReportesSql(orden)}
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar reportes' });
  }
});

module.exports = router;