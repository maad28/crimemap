const express = require('express');
const pool = require('../db/pool');
const adminOrAuthorityAuth = require('../middleware/adminOrAuthorityAuth');
const router = express.Router();

router.use(adminOrAuthorityAuth);

router.get('/', async (req, res) => {
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
      generado_por: req.rol,
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

module.exports = router;