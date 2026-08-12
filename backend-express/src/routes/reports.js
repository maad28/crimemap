const express = require('express');
const crypto  = require('crypto');
const pool    = require('../db/pool');
const router  = express.Router();

const hashDevice = (id) => crypto.createHash('sha256').update(id).digest('hex');

// Piso mínimo de severidad para los tipos más graves — el reportante puede
// subirlo, pero no bajarlo por debajo de este valor (ver conversación sobre
// discrepancia testigo vs. víctima). La Autoridad puede reajustar al aprobar.
const SEVERIDAD_MINIMA_POR_TIPO = {
  'Homicidio': 5,
  'Extorsión': 4,
  'Asalto a mano armada': 3,
};
const {
  detectarZona,
  clasificarNivelRiesgo,
  SEMANAS_HISTORIAL_RIESGO,
  DIAS_HISTORIAL_RIESGO,
} = require('../services/zonas');
const {
  registrarNuevoReporte,
  estaBloqueado,
  detectarRafaga,
  excedeLimiteFrecuencia,
  detectarDispositivoNuevoSospechoso,
  detectarLimiteFrecuencia,
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
      `SELECT id, tipo, confirmaciones, severidad, descripcion, estado, created_at,
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
    const { tipo, descripcion, lat, lng, severidad, device_id, rol } = req.body;
    if (!tipo || !lat || !lng || !device_id)
      return res.status(400).json({ error: 'Faltan campos requeridos' });

    const device_hash = hashDevice(device_id);

    // Bloquear dispositivos con reputación por debajo del umbral
    if (await estaBloqueado(device_hash)) {
      return res.status(403).json({ error: 'Dispositivo bloqueado por actividad indebida' });
    }

    // ← AQUÍ VA EL NUEVO CHEQUEO DE FRECUENCIA
    if (await excedeLimiteFrecuencia(device_hash)) {
      // Que este bloqueo quede visible para Autoridad, no solo silencioso para el reportante.
      detectarLimiteFrecuencia(device_hash).catch(err => console.error('Error registrando alerta de frecuencia:', err));
      return res.status(429).json({ error: 'Demasiados reportes en poco tiempo. Espera unos minutos.' });
    }

    const minimo = SEVERIDAD_MINIMA_POR_TIPO[tipo] || 1;
    const severidadFinal = Math.max(severidad || 3, minimo);
    const rolReportante = ['testigo', 'victima'].includes(rol) ? rol : null;

    const point = `SRID=4326;POINT(${lng} ${lat})`;
    const { rows } = await pool.query(
      `INSERT INTO reports (tipo, descripcion, severidad, ubicacion, device_hash, rol_reportante)
       VALUES ($1,$2,$3,$4::geography,$5,$6) RETURNING id, tipo, created_at`,
      [tipo, descripcion || null, severidadFinal, point, device_hash, rolReportante]
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
      SELECT z.id, z.radio_metros, z.total_reportes, z.tipo_predominante,
             ST_Y(z.centro::geometry) AS lat,
             ST_X(z.centro::geometry) AS lng,
             z.ultima_actualizacion,
             COALESCE(riesgo.riesgo_total, 0) AS riesgo_total,
             COALESCE(sem_actual.total, 0)    AS reportes_7dias,
             COALESCE(sem_anterior.total, 0)  AS reportes_7dias_anterior,
             COALESCE(hoy.total, 0)           AS reportes_hoy,
             COALESCE(top_tipos.tipos, '[]')  AS principales_categorias
      FROM zonas_concentracion z
      LEFT JOIN LATERAL (
        SELECT SUM(severidad) AS riesgo_total
        FROM reports
        WHERE estado = 'aprobado'
          AND created_at > NOW() - INTERVAL '${DIAS_HISTORIAL_RIESGO} days'
          AND ST_DWithin(ubicacion, z.centro, z.radio_metros)
      ) riesgo ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total
        FROM reports
        WHERE estado != 'rechazado'
          AND created_at > NOW() - INTERVAL '7 days'
          AND ST_DWithin(ubicacion, z.centro, z.radio_metros)
      ) sem_actual ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total
        FROM reports
        WHERE estado != 'rechazado'
          AND created_at > NOW() - INTERVAL '14 days'
          AND created_at <= NOW() - INTERVAL '7 days'
          AND ST_DWithin(ubicacion, z.centro, z.radio_metros)
      ) sem_anterior ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total
        FROM reports
        WHERE estado != 'rechazado'
          AND created_at >= CURRENT_DATE
          AND ST_DWithin(ubicacion, z.centro, z.radio_metros)
      ) hoy ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(tipo) AS tipos FROM (
          SELECT tipo, COUNT(*) AS n
          FROM reports
          WHERE estado != 'rechazado'
            AND created_at > NOW() - INTERVAL '${DIAS_HISTORIAL_RIESGO} days'
            AND ST_DWithin(ubicacion, z.centro, z.radio_metros)
          GROUP BY tipo
          ORDER BY n DESC
          LIMIT 3
        ) t
      ) top_tipos ON true
      WHERE z.estado = 'verificada'
      ORDER BY z.total_reportes DESC
    `);

    const data = rows.map(z => {
      const riesgoSemanal = Number(z.riesgo_total) / SEMANAS_HISTORIAL_RIESGO;
      const actual   = Number(z.reportes_7dias);
      const anterior = Number(z.reportes_7dias_anterior);
      const tendencia = actual > anterior ? 'subida' : actual < anterior ? 'bajada' : 'estable';
      return {
        id: z.id, lat: z.lat, lng: z.lng, radio_metros: z.radio_metros,
        total_reportes: z.total_reportes, tipo_predominante: z.tipo_predominante,
        ultima_actualizacion: z.ultima_actualizacion,
        riesgo_semanal: Math.round(riesgoSemanal * 100) / 100,
        nivel_riesgo: clasificarNivelRiesgo(riesgoSemanal),
        reportes_7dias: actual,
        reportes_hoy: Number(z.reportes_hoy),
        tendencia,
        principales_categorias: z.principales_categorias,
      };
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener zonas verificadas' });
  }
});
// Mismos sectores urbanos y radios que backend-fastapi/seed.py — estadísticas
// en vivo por sector fijo, sin depender de que exista una zona_concentracion
// detectada/verificada ahí.
const ZONAS_FIJAS = [
  { nombre: 'Socio Vivienda',            lat: -2.12214, lng: -79.95721, radio_metros: 600 },
  { nombre: 'Monte Sinaí',               lat: -2.11542, lng: -79.97015, radio_metros: 600 },
  { nombre: 'El Guasmo Sur',             lat: -2.26182, lng: -79.89845, radio_metros: 700 },
  { nombre: 'Isla Trinitaria',           lat: -2.24251, lng: -79.91632, radio_metros: 600 },
  { nombre: 'Bastión Popular',           lat: -2.09115, lng: -79.93124, radio_metros: 600 },
  { nombre: 'Febres Cordero (Suburbio)', lat: -2.21453, lng: -79.93241, radio_metros: 600 },
  { nombre: 'Pascuales Centro',          lat: -2.05941, lng: -79.90422, radio_metros: 600 },
  { nombre: 'Cristo del Consuelo',       lat: -2.22635, lng: -79.91421, radio_metros: 500 },
  { nombre: 'Sauces (Etapas 1-9)',       lat: -2.13142, lng: -79.89215, radio_metros: 600 },
  { nombre: 'Alborada',                  lat: -2.14152, lng: -79.89942, radio_metros: 600 },
  { nombre: 'Mucho Lote 1',              lat: -2.07841, lng: -79.91232, radio_metros: 500 },
  { nombre: 'Puerto Santa Ana',          lat: -2.18025, lng: -79.87412, radio_metros: 400 },
  { nombre: 'Urdesa Central',            lat: -2.16782, lng: -79.90924, radio_metros: 500 },
  { nombre: 'Los Ceibos',                lat: -2.16853, lng: -79.93815, radio_metros: 500 },
  { nombre: 'Kennedy Norte',             lat: -2.15842, lng: -79.89124, radio_metros: 500 },
  { nombre: 'Barrio Centenario',         lat: -2.22741, lng: -79.89312, radio_metros: 400 },
];

// GET /api/reports/zonas-fijas — público, sin auth. Estadísticas en vivo
// para los 16 sectores urbanos conocidos, independiente de la detección
// automática de zonas_concentracion.
router.get('/zonas-fijas', async (req, res) => {
  try {
    const data = await Promise.all(ZONAS_FIJAS.map(async (z) => {
      const { rows: [r] } = await pool.query(`
        SELECT
          COALESCE((SELECT SUM(severidad) FROM reports
            WHERE estado = 'aprobado'
              AND created_at > NOW() - INTERVAL '${DIAS_HISTORIAL_RIESGO} days'
              AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, $3)
          ), 0) AS riesgo_total,
          COALESCE((SELECT COUNT(*) FROM reports
            WHERE estado != 'rechazado'
              AND created_at > NOW() - INTERVAL '7 days'
              AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, $3)
          ), 0) AS reportes_7dias,
          COALESCE((SELECT COUNT(*) FROM reports
            WHERE estado != 'rechazado'
              AND created_at > NOW() - INTERVAL '14 days'
              AND created_at <= NOW() - INTERVAL '7 days'
              AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, $3)
          ), 0) AS reportes_7dias_anterior,
          COALESCE((SELECT COUNT(*) FROM reports
            WHERE estado != 'rechazado'
              AND created_at >= CURRENT_DATE
              AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, $3)
          ), 0) AS reportes_hoy,
          COALESCE((SELECT json_agg(tipo) FROM (
            SELECT tipo, COUNT(*) AS n FROM reports
            WHERE estado != 'rechazado'
              AND created_at > NOW() - INTERVAL '${DIAS_HISTORIAL_RIESGO} days'
              AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, $3)
            GROUP BY tipo ORDER BY n DESC LIMIT 3
          ) t), '[]') AS principales_categorias,
          NOW() AS ahora
      `, [z.lat, z.lng, z.radio_metros]);

      const riesgoSemanal = Number(r.riesgo_total) / SEMANAS_HISTORIAL_RIESGO;
      const actual   = Number(r.reportes_7dias);
      const anterior = Number(r.reportes_7dias_anterior);
      const tendencia = actual > anterior ? 'subida' : actual < anterior ? 'bajada' : 'estable';

      return {
        nombre: z.nombre, lat: z.lat, lng: z.lng, radio_metros: z.radio_metros,
        riesgo_semanal: Math.round(riesgoSemanal * 100) / 100,
        nivel_riesgo: clasificarNivelRiesgo(riesgoSemanal),
        reportes_7dias: actual,
        reportes_hoy: Number(r.reportes_hoy),
        tendencia,
        principales_categorias: r.principales_categorias,
        ultima_actualizacion: r.ahora,
      };
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener zonas fijas' });
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

// GET /api/reports/tendencia-zona?lat=..&lng=..&radio=1000&meses=3
// Compara el número de denuncias en la zona en los últimos N meses contra los N meses anteriores.
router.get('/tendencia-zona', async (req, res) => {
  try {
    const { lat, lng, radio = 1000, meses = 3 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Faltan lat/lng' });

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE created_at > NOW() - INTERVAL '1 month' * $4
        ) AS actual,
        COUNT(*) FILTER (
          WHERE created_at <= NOW() - INTERVAL '1 month' * $4
            AND created_at >  NOW() - INTERVAL '1 month' * $4 * 2
        ) AS anterior
      FROM reports
      WHERE estado != 'rechazado'
        AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, $3)
    `, [lat, lng, radio, meses]);

    const actual   = Number(rows[0].actual);
    const anterior = Number(rows[0].anterior);
    const variacion_pct = anterior > 0
      ? Math.round(((actual - anterior) / anterior) * 1000) / 10
      : null;

    res.json({ actual, anterior, variacion_pct, meses: Number(meses) });
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular tendencia de zona' });
  }
});

// GET /api/reports/exportar?lat=&lng=&radio=&dias=&mes=&dia_semana=&hora_min=&hora_max=&tipo=&severidad_min=
// Exportación pública filtrable: por zona (lat/lng/radio), rango de días, mes, día de la
// semana, rango de hora y tipo/severidad. Nunca incluye denuncias rechazadas.
router.get('/exportar', async (req, res) => {
  try {
    const {
      lat, lng, radio = 1000, dias, mes, dia_semana,
      hora_min, hora_max, tipo, severidad_min, estado,
    } = req.query;

    const estadosPermitidos = ['pendiente', 'aprobado'];
    const estadosFiltro = estado
      ? estado.split(',').filter(e => estadosPermitidos.includes(e))
      : estadosPermitidos;
    const estadosFinal = estadosFiltro.length ? estadosFiltro : estadosPermitidos;

    const conditions = [`estado = ANY($1)`];
    const params = [estadosFinal];
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
    if (mes) {
      conditions.push(`EXTRACT(MONTH FROM created_at) = $${i}`);
      params.push(parseInt(mes));
      i++;
    }
    if (dia_semana !== undefined && dia_semana !== '') {
      conditions.push(`EXTRACT(DOW FROM created_at) = $${i}`);
      params.push(parseInt(dia_semana));
      i++;
    }
    if (hora_min !== undefined && hora_min !== '') {
      conditions.push(`EXTRACT(HOUR FROM created_at) >= $${i}`);
      params.push(parseInt(hora_min));
      i++;
    }
    if (hora_max !== undefined && hora_max !== '') {
      conditions.push(`EXTRACT(HOUR FROM created_at) <= $${i}`);
      params.push(parseInt(hora_max));
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

    const { rows } = await pool.query(`
      SELECT id, tipo, descripcion, severidad, confirmaciones, estado,
             ST_Y(ubicacion::geometry) AS lat,
             ST_X(ubicacion::geometry) AS lng,
             created_at
      FROM reports
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 3000
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar reportes' });
  }
});

module.exports = router;