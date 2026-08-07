-- Migración 043: precio_costo en productos y movimientos de inventario
-- Prepara el terreno para el modelo de costos (FIFO, food cost, márgenes)

-- 1. Agregar precio_costo a productos (costo unitario, opcional, para insumos y vendibles)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_costo NUMERIC(10,2) DEFAULT 0;

-- 2. Agregar costo_unitario a movimientos_inventario (solo para compras, informacional)
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(10,2) DEFAULT NULL;
