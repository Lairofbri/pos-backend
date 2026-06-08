-- =============================================
-- Migración 010: Comandas de cocina
-- POS Restaurante — El Salvador
-- =============================================
-- Agrega campos para rastrear cuándo y quién
-- envió cada item a la cocina, y permite que
-- items de una misma orden se envíen en tandas.
-- =============================================

ALTER TABLE orden_items
  ADD COLUMN IF NOT EXISTS enviado_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enviado_por UUID REFERENCES usuarios(id);

-- Índice para la consulta de cocina: items activos (en cocina o listos)
CREATE INDEX IF NOT EXISTS idx_orden_items_cocina
  ON orden_items(tenant_id, estado)
  WHERE estado IN ('en_proceso', 'listo');

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
