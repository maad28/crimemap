CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS reports (
    id             SERIAL PRIMARY KEY,
    tipo           VARCHAR(50)  NOT NULL,
    descripcion    TEXT,
    severidad      INT          DEFAULT 3 CHECK (severidad BETWEEN 1 AND 5),
    ubicacion      GEOGRAPHY(POINT, 4326) NOT NULL,
    device_hash    VARCHAR(64),
    confirmaciones INT          DEFAULT 0,
    created_at     TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_ubicacion ON reports USING GIST(ubicacion);
CREATE INDEX IF NOT EXISTS idx_reports_created   ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_tipo      ON reports(tipo);

CREATE OR REPLACE VIEW admin_device_stats AS
SELECT
    device_hash,
    COUNT(*)                                          AS total_denuncias,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h') AS denuncias_hoy,
    MAX(created_at)                                   AS ultima_actividad,
    MIN(created_at)                                   AS primera_actividad,
    array_agg(DISTINCT tipo)                          AS tipos_usados
FROM reports
GROUP BY device_hash
ORDER BY total_denuncias DESC;
