-- =============================================
-- Migración 006: Delivery — Canal de origen en órdenes
-- POS Restaurante — El Salvador
-- =============================================
-- En El Salvador la mayoría de restaurantes pequeños usan apps externas
-- (Hugo, PedidosYa, UberEats) en vez de delivery propio.
-- Esta migración agrega campos para registrar el canal de origen
-- y el número de pedido externo sin complicar el flujo del POS.
-- =============================================

-- Agregar campo de origen del pedido
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'pos'
  CHECK (origen IN ('pos', 'hugo', 'pedidosya', 'ubereats', 'whatsapp', 'telefono', 'otro'));

-- Agregar número de pedido externo (ej: Hugo #4521)
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS numero_externo VARCHAR(50);

-- Índice para filtrar ventas por canal en reportes
CREATE INDEX IF NOT EXISTS idx_ordenes_origen
  ON ordenes(tenant_id, origen);

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
