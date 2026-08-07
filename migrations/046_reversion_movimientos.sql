-- Migración 046: Columnas para reversión de movimientos de inventario
-- Permite revertir compras, devoluciones y mermas con trazabilidad

ALTER TABLE movimientos_inventario 
  ADD COLUMN IF NOT EXISTS movimiento_revertido_id UUID REFERENCES movimientos_inventario(id);

ALTER TABLE movimientos_inventario 
  ADD COLUMN IF NOT EXISTS revertido_en TIMESTAMPTZ;
