-- =============================================
-- Migración 009: Combos / Paquetes
-- POS Restaurante — El Salvador
-- =============================================
-- Permite agrupar productos en combos que se
-- expanden en items individuales al agregarlos
-- a una orden.
-- =============================================

CREATE TABLE IF NOT EXISTS combos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre     VARCHAR(100) NOT NULL,
  precio     DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
  activo     BOOLEAN DEFAULT TRUE,
  creado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combo_productos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id    UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad    INT DEFAULT 1,
  UNIQUE (combo_id, producto_id)
);

-- Índice para lookup rápido al agregar orden
CREATE INDEX IF NOT EXISTS idx_combo_productos_combo
  ON combo_productos(combo_id);

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
