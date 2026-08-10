-- CrimeMap GYE — esquema completo de base de datos (PostgreSQL + PostGIS)
-- Correr esto entero en una base nueva y vacía (ej. un proyecto nuevo de Supabase)
-- deja la base lista para que ambos backends (Express y FastAPI) funcionen.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── reports ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id              SERIAL PRIMARY KEY,
    tipo            VARCHAR(50)  NOT NULL,
    descripcion     TEXT,
    severidad       INT          DEFAULT 3 CHECK (severidad BETWEEN 1 AND 5),
    ubicacion       GEOGRAPHY(POINT, 4326) NOT NULL,
    device_hash     VARCHAR(64),
    confirmaciones  INT          DEFAULT 0,
    created_at      TIMESTAMP    DEFAULT NOW(),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    rol_reportante  VARCHAR(10)
                     CHECK (rol_reportante IS NULL OR rol_reportante IN ('testigo', 'victima'))
);

CREATE INDEX IF NOT EXISTS idx_reports_ubicacion ON reports USING GIST(ubicacion);
CREATE INDEX IF NOT EXISTS idx_reports_created   ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_tipo      ON reports(tipo);
CREATE INDEX IF NOT EXISTS idx_reports_estado    ON reports(estado);

CREATE OR REPLACE VIEW admin_device_stats AS
SELECT
    device_hash,
    COUNT(*)                                                     AS total_denuncias,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h')  AS denuncias_hoy,
    MAX(created_at)                                              AS ultima_actividad,
    MIN(created_at)                                              AS primera_actividad,
    array_agg(DISTINCT tipo)                                     AS tipos_usados
FROM reports
GROUP BY device_hash
ORDER BY total_denuncias DESC;

-- ── zonas_concentracion ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zonas_concentracion (
    id                     SERIAL PRIMARY KEY,
    centro                 GEOGRAPHY(POINT, 4326) NOT NULL,
    radio_metros           INT         NOT NULL DEFAULT 500,
    total_reportes         INT         NOT NULL DEFAULT 0,
    tipo_predominante      VARCHAR(50),
    estado                 VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente', 'verificada', 'descartada')),
    primera_deteccion      TIMESTAMP   NOT NULL DEFAULT NOW(),
    ultima_actualizacion   TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zonas_centro ON zonas_concentracion USING GIST(centro);
CREATE INDEX IF NOT EXISTS idx_zonas_estado ON zonas_concentracion(estado);

-- ── reputacion_dispositivo ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reputacion_dispositivo (
    device_hash          VARCHAR(64) PRIMARY KEY,
    puntos                INT       DEFAULT 100,
    reportes_totales      INT       DEFAULT 0,
    reportes_aprobados    INT       DEFAULT 0,
    reportes_rechazados   INT       DEFAULT 0,
    bloqueado             BOOLEAN   DEFAULT FALSE,
    primera_actividad     TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputacion_bloqueado ON reputacion_dispositivo(bloqueado);

-- ── alertas_sospecha ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertas_sospecha (
    id           SERIAL PRIMARY KEY,
    tipo_alerta  VARCHAR(50) NOT NULL,
    detalle      JSONB       NOT NULL,
    revisada     BOOLEAN     DEFAULT FALSE,
    created_at   TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_revisada ON alertas_sospecha(revisada);
