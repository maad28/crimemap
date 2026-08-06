//Users/mac/crimemap/backend-express/src/routes/admin.js
const express   = require('express');
const pool      = require('../db/pool');
const adminAuth = require('../middleware/adminAuth');
const router    = express.Router();

router.use(adminAuth);

router.get('/devices', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT device_hash,
             COUNT(*)                 AS total_denuncias,
             MAX(created_at)          AS ultima_actividad,
             MIN(created_at)          AS primera_actividad,
             array_agg(DISTINCT tipo) AS tipos
      FROM reports
      GROUP BY device_hash
      ORDER BY total_denuncias DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener devices' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { rows: [stats] } = await pool.query(`
      SELECT COUNT(*)                                                      AS total_reportes,
             COUNT(DISTINCT device_hash)                                   AS dispositivos_unicos,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h')  AS ultimas_24h,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1h')   AS ultima_hora
      FROM reports`);
    const { rows: porTipo } = await pool.query(
      `SELECT tipo, COUNT(*) AS total FROM reports GROUP BY tipo ORDER BY total DESC`);
    res.json({ ...stats, por_tipo: porTipo });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener stats' });
  }
});

router.delete('/devices/:hash', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM reports WHERE device_hash = $1', [req.params.hash]);
    res.json({ ok: true, eliminadas: rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar device' });
  }
});

module.exports = router;

// GET /api/admin/tendencia?dias=30
router.get('/tendencia', async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 30;
    const { rows } = await pool.query(`
      SELECT DATE(created_at) AS fecha,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE tipo = 'Robo a persona')       AS robos,
             COUNT(*) FILTER (WHERE tipo = 'Asalto a mano armada') AS asaltos,
             COUNT(*) FILTER (WHERE tipo = 'Homicidio')            AS homicidios,
             COUNT(*) FILTER (WHERE tipo = 'Punto GDO')            AS gdo
      FROM reports
      WHERE created_at > NOW() - INTERVAL '${dias} days'
      GROUP BY DATE(created_at)
      ORDER BY fecha ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error tendencia' });
  }
});

// GET /api/admin/zonas-riesgo
router.get('/zonas-riesgo', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ROUND(ST_Y(ubicacion::geometry)::numeric, 2) AS lat_zona,
        ROUND(ST_X(ubicacion::geometry)::numeric, 2) AS lng_zona,
        COUNT(*)                                      AS total,
        AVG(severidad)                                AS severidad_promedio,
        SUM(confirmaciones)                           AS confirmaciones_total,
        array_agg(DISTINCT tipo)                      AS tipos
      FROM reports
      GROUP BY lat_zona, lng_zona
      ORDER BY total DESC
      LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error zonas' });
  }
});

// GET /api/admin/confirmaciones-tipo
router.get('/confirmaciones-tipo', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT tipo,
             COUNT(*)                          AS total_denuncias,
             SUM(confirmaciones)               AS total_confirmaciones,
             ROUND(AVG(confirmaciones)::numeric, 2) AS promedio_confirmaciones,
             ROUND(
               100.0 * SUM(CASE WHEN confirmaciones > 0 THEN 1 ELSE 0 END) / COUNT(*),
               1
             )                                 AS tasa_confirmacion_pct
      FROM reports
      GROUP BY tipo
      ORDER BY tasa_confirmacion_pct DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error confirmaciones' });
  }
});

// GET /api/admin/reporte-general
router.get('/reporte-general', async (req, res) => {
  try {
    const { rows: [totales] } = await pool.query(`
      SELECT COUNT(*)                                                     AS total_reportes,
             COUNT(*) FILTER (WHERE estado = 'pendiente')                AS pendientes,
             COUNT(*) FILTER (WHERE estado = 'aprobado')                 AS aprobados,
             COUNT(*) FILTER (WHERE estado = 'rechazado')                AS rechazados,
             COUNT(DISTINCT device_hash)                                  AS dispositivos_unicos,
             SUM(confirmaciones)                                          AS confirmaciones_totales,
             ROUND(AVG(severidad)::numeric, 2)                            AS severidad_promedio
      FROM reports`);

    const { rows: porTipo } = await pool.query(`
      SELECT tipo, COUNT(*) AS total,
             ROUND(AVG(severidad)::numeric, 2) AS severidad_promedio,
             SUM(confirmaciones) AS confirmaciones
      FROM reports GROUP BY tipo ORDER BY total DESC`);

    const { rows: zonas } = await pool.query(`
      SELECT id, tipo_predominante, total_reportes, radio_metros, estado,
             ST_Y(centro::geometry) AS lat, ST_X(centro::geometry) AS lng
      FROM zonas_concentracion ORDER BY total_reportes DESC`);

    const { rows: reputacion } = await pool.query(`
      SELECT COUNT(*) AS total_dispositivos,
             COUNT(*) FILTER (WHERE bloqueado) AS bloqueados,
             COUNT(*) FILTER (WHERE puntos >= 130) AS confiables,
             ROUND(AVG(puntos)::numeric, 1) AS puntos_promedio
      FROM reputacion_dispositivo`);

    const { rows: alertas } = await pool.query(`
      SELECT tipo_alerta, COUNT(*) AS total,
             COUNT(*) FILTER (WHERE revisada) AS revisadas
      FROM alertas_sospecha GROUP BY tipo_alerta`);

    res.json({
      generado_en: new Date().toISOString(),
      totales,
      por_tipo: porTipo,
      zonas,
      reputacion: reputacion[0],
      alertas,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte general' });
  }
});