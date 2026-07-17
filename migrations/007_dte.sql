-- =============================================
-- Migración 007: Módulo 7 DTE (Facturación Electrónica)
-- POS Restaurante — El Salvador
-- Idempotente: puede ejecutarse múltiples veces
-- =============================================

-- TENANTS: códigos MH
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cod_estable_mh     VARCHAR(10),
  ADD COLUMN IF NOT EXISTS cod_punto_venta_mh VARCHAR(10),
  ADD COLUMN IF NOT EXISTS dte_service_url    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dte_api_key        VARCHAR(255);

-- ORDENES: propina + campos DTE
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS propina NUMERIC(10,2) DEFAULT 0 CHECK (propina >= 0);

ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS dte_codigo_generacion VARCHAR(36),
  ADD COLUMN IF NOT EXISTS dte_numero_control    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS dte_estado            VARCHAR(20)
    CHECK (dte_estado IN ('pendiente', 'emitido', 'rechazado', 'anulado')),
  ADD COLUMN IF NOT EXISTS dte_emitido_en        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ordenes_dte
  ON ordenes(tenant_id, dte_estado)
  WHERE dte_codigo_generacion IS NOT NULL;

-- dtes_orden
CREATE TABLE IF NOT EXISTS dtes_orden (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id            UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo_dte            VARCHAR(2) NOT NULL,
  codigo_generacion   VARCHAR(36),
  numero_control      VARCHAR(50),
  estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'emitido', 'rechazado', 'anulado')),
  json_envio          JSONB,
  json_respuesta      JSONB,
  errores             JSONB,
  creado_en           TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dtes_orden_tenant
  ON dtes_orden(tenant_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_dtes_orden_orden
  ON dtes_orden(orden_id);

DROP INDEX IF EXISTS idx_dtes_orden_codigo;
CREATE INDEX IF NOT EXISTS idx_dtes_orden_codigo
  ON dtes_orden(codigo_generacion)
  WHERE codigo_generacion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dtes_orden_estado
  ON dtes_orden(tenant_id, estado);

DROP TRIGGER IF EXISTS trigger_dtes_orden_updated ON dtes_orden;
CREATE TRIGGER trigger_dtes_orden_updated
  BEFORE UPDATE ON dtes_orden
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- dte_pendientes
CREATE TABLE IF NOT EXISTS dte_pendientes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id        UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo_dte        VARCHAR(2) NOT NULL,
  payload         JSONB NOT NULL,
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'procesando', 'completado', 'fallo')),
  intentos        INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  max_intentos    INTEGER NOT NULL DEFAULT 5 CHECK (max_intentos > 0),
  ultimo_error    TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- Handle UNIQUE for dte_pendientes (recreate if needed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dte_pendientes_orden
  ON dte_pendientes(orden_id);

CREATE INDEX IF NOT EXISTS idx_dte_pendientes_estado
  ON dte_pendientes(estado, intentos)
  WHERE estado IN ('pendiente', 'fallo');

DROP TRIGGER IF EXISTS trigger_dte_pendientes_updated ON dte_pendientes;
CREATE TRIGGER trigger_dte_pendientes_updated
  BEFORE UPDATE ON dte_pendientes
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
