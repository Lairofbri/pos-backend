-- =============================================
-- Migración 064: Promociones / Combos dinámicos (#32)
-- Reglas de descuento automático (%, 2x1, happy hour, volumen)
-- =============================================

CREATE TABLE IF NOT EXISTS promociones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  tipo VARCHAR(20) NOT NULL
    CHECK (tipo IN ('porcentaje', 'dosxuno', 'volumen', 'happy_hour')),
  -- % de descuento (porcentaje / volumen / happy_hour)
  descuento_porcentaje NUMERIC(5,2),
  -- cantidad mínima para calificar (volumen; opcional en porcentaje)
  volumen_minimo INTEGER,
  -- ventana horaria (happy_hour; opcional en otros tipos) en formato HH:MM:SS
  hora_inicio TIME,
  hora_fin TIME,
  -- días de la semana (0=Domingo .. 6=Sábado). NULL = todos los días.
  dias SMALLINT[],
  vigente_desde TIMESTAMPTZ,
  vigente_hasta TIMESTAMPTZ,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  CHECK (descuento_porcentaje IS NULL OR (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100))
);

CREATE INDEX IF NOT EXISTS idx_promociones_tenant ON promociones (tenant_id, activo);

CREATE TABLE IF NOT EXISTS promocion_productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (promo_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_promocion_productos_promo ON promocion_productos (promo_id);
CREATE INDEX IF NOT EXISTS idx_promocion_productos_producto ON promocion_productos (producto_id);

-- Monto descontado por promoción a nivel de línea de orden
ALTER TABLE orden_items ADD COLUMN IF NOT EXISTS descuento_promo NUMERIC(14,4) NOT NULL DEFAULT 0
  CHECK (descuento_promo >= 0);

-- Detalle de promociones aplicadas en la orden (para ticket y reporte)
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS promociones_aplicadas JSONB NOT NULL DEFAULT '[]'::jsonb;
