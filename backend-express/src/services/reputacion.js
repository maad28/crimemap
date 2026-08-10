const pool = require('../db/pool');

const PUNTOS_APROBADO   = 5;
const PUNTOS_RECHAZADO  = -15;
const UMBRAL_BLOQUEO    = 30;

// Ventanas de detección de patrones sospechosos
const VENTANA_RAFAGA_MIN     = 10;   // minutos
const UMBRAL_RAFAGA_REPORTES = 5;    // reportes mínimos para considerar ráfaga
const RADIO_RAFAGA_METROS    = 500;

const VENTANA_DISPOSITIVO_NUEVO_MIN     = 30; // minutos desde su primer reporte
const UMBRAL_CONFIRMACIONES_SOSPECHOSAS = 5;

async function asegurarRegistro(device_hash) {
  await pool.query(`
    INSERT INTO reputacion_dispositivo (device_hash)
    VALUES ($1)
    ON CONFLICT (device_hash) DO NOTHING
  `, [device_hash]);
}

async function registrarNuevoReporte(device_hash) {
  await asegurarRegistro(device_hash);
  await pool.query(`
    UPDATE reputacion_dispositivo
    SET reportes_totales = reportes_totales + 1, updated_at = NOW()
    WHERE device_hash = $1
  `, [device_hash]);
}

async function ajustarPorAprobacion(device_hash) {
  await asegurarRegistro(device_hash);
  const { rows } = await pool.query(`
    UPDATE reputacion_dispositivo
    SET puntos = puntos + $2,
        reportes_aprobados = reportes_aprobados + 1,
        updated_at = NOW()
    WHERE device_hash = $1
    RETURNING puntos
  `, [device_hash, PUNTOS_APROBADO]);
  return rows[0]?.puntos;
}

async function ajustarPorRechazo(device_hash) {
  await asegurarRegistro(device_hash);
  const { rows } = await pool.query(`
    UPDATE reputacion_dispositivo
    SET puntos = puntos + $2,
        reportes_rechazados = reportes_rechazados + 1,
        bloqueado = (puntos + $2) < $3,
        updated_at = NOW()
    WHERE device_hash = $1
    RETURNING puntos, bloqueado
  `, [device_hash, PUNTOS_RECHAZADO, UMBRAL_BLOQUEO]);
  return rows[0];
}

async function estaBloqueado(device_hash) {
  const { rows } = await pool.query(
    `SELECT bloqueado FROM reputacion_dispositivo WHERE device_hash = $1`,
    [device_hash]
  );
  return rows[0]?.bloqueado || false;
}

async function excedeLimiteFrecuencia(device_hash) {
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS total
    FROM reports
    WHERE device_hash = $1
      AND created_at > NOW() - INTERVAL '15 minutes'
  `, [device_hash]);
  return Number(rows[0].total) >= 3;
}

async function registrarAlerta(tipo_alerta, detalle) {
  await pool.query(`
    INSERT INTO alertas_sospecha (tipo_alerta, detalle)
    VALUES ($1, $2)
  `, [tipo_alerta, JSON.stringify(detalle)]);
}

// --- Detección 2a: ráfaga temporal de reportes similares ---
// Múltiples reportes del mismo tipo, cerca entre sí, en una ventana corta de tiempo.
async function detectarRafaga(tipo, lat, lng) {
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS total, array_agg(DISTINCT device_hash) AS dispositivos
    FROM reports
    WHERE tipo = $1
      AND created_at > NOW() - INTERVAL '${VENTANA_RAFAGA_MIN} minutes'
      AND ST_DWithin(ubicacion, ST_MakePoint($3,$2)::geography, $4)
  `, [tipo, lat, lng, RADIO_RAFAGA_METROS]);

  const total = Number(rows[0].total);
  if (total >= UMBRAL_RAFAGA_REPORTES) {
    const alerta = {
      sospechoso: true,
      motivo: 'rafaga_temporal',
      total_reportes: total,
      dispositivos_involucrados: rows[0].dispositivos,
      tipo, lat, lng,
    };
    await registrarAlerta('rafaga_temporal', alerta);
    return alerta;
  }
  return { sospechoso: false };
}

// --- Detección 2c: dispositivo nuevo con actividad inmediata alta ---
// Un device_hash que apareció por primera vez hace muy poco y ya generó
// o recibió muchas confirmaciones, un patrón típico de identidades desechables
// creadas para manipular el sistema.
async function detectarDispositivoNuevoSospechoso(device_hash) {
  const { rows } = await pool.query(`
    SELECT r.primera_actividad,
           COALESCE(SUM(rep.confirmaciones), 0) AS confirmaciones_recibidas
    FROM reputacion_dispositivo r
    LEFT JOIN reports rep ON rep.device_hash = r.device_hash
    WHERE r.device_hash = $1
    GROUP BY r.primera_actividad
  `, [device_hash]);

  if (!rows.length) return { sospechoso: false };

  const { primera_actividad, confirmaciones_recibidas } = rows[0];
  const minutosDesdeCreacion = (Date.now() - new Date(primera_actividad).getTime()) / 60000;

  if (
    minutosDesdeCreacion <= VENTANA_DISPOSITIVO_NUEVO_MIN &&
    Number(confirmaciones_recibidas) >= UMBRAL_CONFIRMACIONES_SOSPECHOSAS
  ) {
    const alerta = {
      sospechoso: true,
      motivo: 'dispositivo_nuevo_actividad_alta',
      minutos_desde_creacion: Math.round(minutosDesdeCreacion),
      confirmaciones_recibidas: Number(confirmaciones_recibidas),
      // Hash completo para permitir bloquear el dispositivo desde la alerta;
      // la UI solo muestra un prefijo truncado (igual que en el panel de Reputación).
      device_hash,
    };
    await registrarAlerta('dispositivo_nuevo_actividad_alta', alerta);
    return alerta;
  }
  return { sospechoso: false };
}

async function bloquearManualmente(device_hash) {
  await asegurarRegistro(device_hash);
  await pool.query(`
    UPDATE reputacion_dispositivo SET bloqueado = true, updated_at = NOW()
    WHERE device_hash = $1
  `, [device_hash]);
}

async function desbloquearManualmente(device_hash) {
  await pool.query(`
    UPDATE reputacion_dispositivo SET bloqueado = false, updated_at = NOW()
    WHERE device_hash = $1
  `, [device_hash]);
}

module.exports = {
  registrarNuevoReporte,
  ajustarPorAprobacion,
  ajustarPorRechazo,
  estaBloqueado,
  excedeLimiteFrecuencia,
  detectarRafaga,
  detectarDispositivoNuevoSospechoso,
  bloquearManualmente,
  desbloquearManualmente,
};