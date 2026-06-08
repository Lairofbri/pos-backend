-- =============================================
-- Migración 008: Descuento por item en órdenes
-- POS Restaurante — El Salvador
-- =============================================
-- Permite aplicar descuento porcentual a cada item
-- de la orden individualmente.
-- =============================================

ALTER TABLE orden_items
  ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) DEFAULT 0
  CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100);

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
