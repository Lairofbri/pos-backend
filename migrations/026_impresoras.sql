-- 026: Crear tabla de impresoras térmicas por tenant
-- Almacena configuración de impresoras de red para impresión de tickets

CREATE TABLE IF NOT EXISTS impresoras (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre          VARCHAR(50) NOT NULL,
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('ticket-consumo', 'cocina', 'pre-cuenta')),
  conexion        VARCHAR(20) NOT NULL DEFAULT 'red' CHECK (conexion IN ('red')),
  ip              VARCHAR(45) NOT NULL,
  puerto          INTEGER NOT NULL DEFAULT 9100,
  papel_mm        INTEGER NOT NULL DEFAULT 80,
  caracteres_x_linea INTEGER NOT NULL DEFAULT 42,
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cada tenant puede tener varias impresoras pero solo una activa por tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_impresoras_tenant_tipo_activo
  ON impresoras (tenant_id, tipo) WHERE activo = true;
