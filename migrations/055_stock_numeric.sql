-- =============================================
-- Migración 055: Cambiar stock_anterior/posterior a NUMERIC
-- =============================================

ALTER TABLE movimientos_inventario
    ALTER COLUMN stock_anterior TYPE NUMERIC(14,4),
    ALTER COLUMN stock_posterior TYPE NUMERIC(14,4);
