-- =============================================
-- Fix 002b: Correcciones tenant-safe en productos
-- Ejecutar ANTES de la migración 003
-- =============================================

-- Fix 1: UNIQUE compuesto en categorias (requerido para FK compuesto en productos)
ALTER TABLE categorias
  ADD CONSTRAINT uq_categorias_id_tenant UNIQUE (id, tenant_id);

-- Fix 2: Eliminar FK simple de categoria_id en productos
ALTER TABLE productos
  DROP CONSTRAINT IF EXISTS productos_categoria_id_fkey;

-- Fix 3: FK compuesto tenant-safe en productos → categorias
ALTER TABLE productos
  ADD CONSTRAINT fk_productos_categoria_tenant
  FOREIGN KEY (categoria_id, tenant_id)
  REFERENCES categorias(id, tenant_id)
  ON DELETE SET NULL;

-- Fix 4: UNIQUE compuesto en productos (requerido para FK compuesto en orden_items)
ALTER TABLE productos
  ADD CONSTRAINT uq_productos_id_tenant UNIQUE (id, tenant_id);

-- Fix 5: CHECK constraint faltante en stock_minimo
ALTER TABLE productos
  ADD CONSTRAINT chk_stock_minimo_positivo
  CHECK (stock_minimo >= 0);
