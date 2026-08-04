const pool = require('../db/pool');

async function detectarZona(lat, lng) {
  const { rows: cercanos } = await pool.query(`
    SELECT id, tipo,
           ST_Y(ubicacion::geometry) AS lat,
           ST_X(ubicacion::geometry) AS lng
    FROM reports
    WHERE estado != 'rechazado'
      AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, 500)
  `, [lat, lng]);

  if (cercanos.length < 5) return null;

  const centLat = cercanos.reduce((s, r) => s + r.lat, 0) / cercanos.length;
  const centLng = cercanos.reduce((s, r) => s + r.lng, 0) / cercanos.length;

  const conteo = {};
  cercanos.forEach(r => { conteo[r.tipo] = (conteo[r.tipo] || 0) + 1; });
  const tipoPredominante = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0];

  const { rows: existente } = await pool.query(`
    SELECT id FROM zonas_concentracion
    WHERE estado != 'descartada'
      AND ST_DWithin(centro, ST_MakePoint($2,$1)::geography, 250)
    LIMIT 1
  `, [centLat, centLng]);

  if (existente.length) {
    await pool.query(`
      UPDATE zonas_concentracion
      SET total_reportes = $1, tipo_predominante = $2,
          centro = ST_MakePoint($4,$3)::geography, ultima_actualizacion = NOW()
      WHERE id = $5
    `, [cercanos.length, tipoPredominante, centLat, centLng, existente[0].id]);
    return existente[0].id;
  } else {
    const { rows } = await pool.query(`
      INSERT INTO zonas_concentracion (centro, total_reportes, tipo_predominante)
      VALUES (ST_MakePoint($2,$1)::geography, $3, $4)
      RETURNING id
    `, [centLat, centLng, cercanos.length, tipoPredominante]);
    return rows[0].id;
  }
}

// Recorre TODAS las denuncias existentes y regenera las zonas desde cero
async function recalcularTodasLasZonas() {
  await pool.query(`DELETE FROM zonas_concentracion`); // empezar limpio

  const { rows: reportes } = await pool.query(`
    SELECT id, ST_Y(ubicacion::geometry) AS lat, ST_X(ubicacion::geometry) AS lng
    FROM reports
    WHERE estado != 'rechazado'
  `);

  for (const r of reportes) {
    await detectarZona(r.lat, r.lng);
  }

  const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM zonas_concentracion`);
  return Number(count);
}

module.exports = { detectarZona, recalcularTodasLasZonas };