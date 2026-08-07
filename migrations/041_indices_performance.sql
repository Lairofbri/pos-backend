-- Migración 041: Índices de performance para consultas frecuentes
-- Productos (POS y admin), recetas (expansión al pagar), movimientos (reportes), combos (agrupación)

-- 1. Productos: partial index para el filtro más común (POS y menú)
--    WHERE se_vende = TRUE AND activo = TRUE cubre >90% de queries de producto
CREATE INDEX IF NOT EXISTS idx_productos_se_vende
  ON productos (tenant_id, categoria_id, nombre)
  WHERE se_vende = TRUE AND activo = TRUE;

-- 2. Productos: índice compuesto para consultas de inventario
CREATE INDEX IF NOT EXISTS idx_productos_stock
  ON productos (tenant_id, tiene_stock, se_vende)
  WHERE tiene_stock = TRUE;

-- 3. Recetas: join frecuente con productos (obtener-por-producto, listar)
CREATE INDEX IF NOT EXISTS idx_recetas_producto
  ON recetas (producto_id);

-- 4. Receta ingredientes: expansión al pagar es la consulta más crítica
--    SELECT * FROM receta_ingredientes WHERE receta_id = $1
CREATE INDEX IF NOT EXISTS idx_receta_ingredientes_receta
  ON receta_ingredientes (receta_id);

-- 5. Receta ingredientes: búsqueda inversa (qué recetas usan este ingrediente)
CREATE INDEX IF NOT EXISTS idx_receta_ingredientes_ingrediente
  ON receta_ingredientes (ingrediente_id);

-- 6. Movimientos: consultas por fecha para reportes y resumen diario
CREATE INDEX IF NOT EXISTS idx_movimientos_creado_en
  ON movimientos_inventario (tenant_id, creado_en DESC);

-- 7. Orden items: agrupación por combo para reportes de combos vendidos
CREATE INDEX IF NOT EXISTS idx_orden_items_combo
  ON orden_items (combo_id)
  WHERE combo_id IS NOT NULL;

-- 8. Categorías: búsqueda por módulo con árbol
CREATE INDEX IF NOT EXISTS idx_categorias_modulo_activo
  ON categorias (tenant_id, modulo, activo, parent_id);
