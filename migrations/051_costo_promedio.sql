-- Migración 051: costo_promedio en productos (promedio ponderado dinámico)
-- Parte del modelo de costos H9. Se actualiza atómicamente en cada compra con costo_unitario.
-- Ver Plan - Modelo de costos H9.md

-- 1. Columna costo_promedio (NOT NULL DEFAULT 0: sin compras aún = sin costo)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo_promedio NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 2. Backfill: calcular costo promedio ponderado desde compras históricas con costo_unitario
--    Fórmula: SUM(cantidad * costo_unitario) / SUM(cantidad) para cada producto
UPDATE productos p
SET costo_promedio = sub.costo_calc
FROM (
  SELECT
    producto_id,
    ROUND(SUM(cantidad * COALESCE(costo_unitario, 0)) / NULLIF(SUM(cantidad), 0), 2) AS costo_calc
  FROM movimientos_inventario
  WHERE tipo_movimiento = 'compra' AND costo_unitario IS NOT NULL
  GROUP BY producto_id
) sub
WHERE p.id = sub.producto_id;

-- 3. Índice parcial para consultas de auditoría de costos (solo compras con costo)
CREATE INDEX IF NOT EXISTS idx_movimientos_compra_costo
ON movimientos_inventario (producto_id, tipo_movimiento)
WHERE tipo_movimiento = 'compra' AND costo_unitario IS NOT NULL;
