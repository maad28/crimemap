//Users/mac/crimemap/backend-express/src/services/zonas.js

const pool = require('../db/pool');

// --- Definición de "riesgo" a nivel de zona: severidad acumulada de
// reportes 'aprobado' por semana, sumando TODAS las horas del día (a
// diferencia del modelo en predict.py, que predice para una hora puntual —
// esa es una unidad distinta a propósito, no se dividen entre 24 para
// hacerlas coincidir. Antes se dividía y el resultado nunca superaba el
// umbral de MEDIO con datos reales de la seed: ninguna zona, ni la de más
// peso de crimen, pasaba de ~3 cuando MEDIO empezaba en 4. Los umbrales de
// abajo están calibrados contra la distribución real de riesgo semanal
// (sin dividir por hora) de las 16 zonas urbanas de seed.py: las "alta"
// caen ~50-72, las "media" ~13-22, las "baja" ~1-4.
const DIAS_HISTORIAL_RIESGO = 180;
const SEMANAS_HISTORIAL_RIESGO = DIAS_HISTORIAL_RIESGO / 7;
const UMBRAL_RIESGO_ALTO = 40;   // puntos de severidad acumulada por semana
const UMBRAL_RIESGO_MEDIO = 10;

// Umbral SEPARADO, en otra unidad: severidad acumulada total (sin dividir
// entre semanas ni horas), usado solo para decidir si algo "merece" que se
// cree una zona para que la Autoridad lo revise. No es lo mismo que
// UMBRAL_RIESGO_ALTO — una zona puede activarse aquí (ej. 2 homicidios en
// algún momento de los últimos meses) y aun así mostrar nivel_riesgo BAJO
// al calcularse como tasa semanal, porque 2 eventos aislados en 6 meses son
// una tasa baja aunque cada uno haya sido grave. Son preguntas distintas:
// "¿esto merece revisión humana?" (aquí) vs. "¿es un patrón activo ahora
// mismo?" (nivel_riesgo). Coinciden en valor (10) por simplicidad, pero
// podrían separarse si hace falta ajustar una sin tocar la otra.
const UMBRAL_DETECCION_SEVERIDAD = 10;

function clasificarNivelRiesgo(riesgoSemanal) {
  if (riesgoSemanal >= UMBRAL_RIESGO_ALTO) return 'ALTO';
  if (riesgoSemanal >= UMBRAL_RIESGO_MEDIO) return 'MEDIO';
  return 'BAJO';
}

async function detectarZona(lat, lng) {
  const { rows: cercanos } = await pool.query(`
    SELECT id, tipo, severidad,
           ST_Y(ubicacion::geometry) AS lat,
           ST_X(ubicacion::geometry) AS lng
    FROM reports
    WHERE estado != 'rechazado'
      AND ST_DWithin(ubicacion, ST_MakePoint($2,$1)::geography, 500)
  `, [lat, lng]);

  // Dispara por CUALQUIERA de las dos señales: muchos reportes cercanos
  // (aunque sean leves), o pocos reportes pero con severidad acumulada ya
  // suficiente para ser "riesgo alto" (ej. 2 homicidios no llegan a 5
  // reportes, pero sí deberían marcarse como zona). Sin esto, un punto
  // realmente grave podía quedar invisible en "Zonas de concentración"
  // solo por no tener volumen.
  const severidadAcumulada = cercanos.reduce((s, r) => s + r.severidad, 0);
  const detectaPorConteo = cercanos.length >= 5;
  const detectaPorSeveridad = severidadAcumulada >= UMBRAL_DETECCION_SEVERIDAD;
  if (!detectaPorConteo && !detectaPorSeveridad) return null;

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

module.exports = {
  detectarZona,
  recalcularTodasLasZonas,
  clasificarNivelRiesgo,
  DIAS_HISTORIAL_RIESGO,
  SEMANAS_HISTORIAL_RIESGO,
  UMBRAL_RIESGO_ALTO,
  UMBRAL_RIESGO_MEDIO,
};