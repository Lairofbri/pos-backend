-- =============================================
-- Migración 023: Jerarquía de Categorías
-- Agrega soporte para árbol de profundidad variable
-- (parent_id → subcategorías)
-- =============================================

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Agregar columna parent_id
-- ─────────────────────────────────────────────
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS parent_id UUID;

-- ─────────────────────────────────────────────
-- 2. FK compuesta con tenant_id (multitenant safe)
-- ON DELETE RESTRICT: no se puede eliminar una
-- categoría que tenga subcategorías
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_categorias_padre'
  ) THEN
    ALTER TABLE categorias
      ADD CONSTRAINT fk_categorias_padre
      FOREIGN KEY (parent_id, tenant_id)
      REFERENCES categorias(id, tenant_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 3. CHECK: una categoría no puede ser su propio padre
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_categoria_no_auto_padre'
  ) THEN
    ALTER TABLE categorias
      ADD CONSTRAINT chk_categoria_no_auto_padre
      CHECK (parent_id IS DISTINCT FROM id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 4. Índice para consultas de hijos eficientes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_categorias_parent
  ON categorias(tenant_id, parent_id);

-- ─────────────────────────────────────────────
-- 5. Limpiar datos demo existentes (desarrollo)
-- ─────────────────────────────────────────────
DELETE FROM combo_productos;
DELETE FROM orden_items;
DELETE FROM pagos;
DELETE FROM ordenes;
DELETE FROM combos;
DELETE FROM productos;
DELETE FROM categorias;

-- ─────────────────────────────────────────────
-- 6. Nuevos datos demo jerárquicos
-- ─────────────────────────────────────────────
INSERT INTO categorias (id, tenant_id, parent_id, nombre, orden, color) VALUES
  -- Raíces
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL, 'Bebidas', 1, '#45B7D1'),
  ('c1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', NULL, 'Comida',  2, '#4ECDC4'),
  ('c1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', NULL, 'Postres', 3, '#96CEB4'),

  -- Hijos de Bebidas
  ('c2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Alcohólicas',    1, '#FF6B6B'),
  ('c2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'No alcohólicas', 2, '#6BCB77'),
  ('c2000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Cócteles',       3, '#FFD93D'),

  -- Hijos de Comida
  ('c2000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Entradas',       1, '#FF6B6B'),
  ('c2000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Platos fuertes', 2, '#4ECDC4'),
  ('c2000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Acompañamientos', 3, '#96CEB4'),

  -- Subnieto: Cervezas dentro de Alcohólicas (prueba de profundidad 3)
  ('c3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Cervezas', 1, '#E8A838')
ON CONFLICT DO NOTHING;

-- Productos asignados a categorías hoja
INSERT INTO productos (tenant_id, categoria_id, nombre, precio, orden) VALUES
  -- Cervezas (c3000000...001)
  ('a0000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Cerveza Imperial',    2.50, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Cerveza Pilsener',   2.50, 2),
  ('a0000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Cerveza Suprema',    3.00, 3),

  -- No alcohólicas (c2000000...002)
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'Agua natural',       1.00, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'Refresco',           1.50, 2),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'Jugo natural',       2.50, 3),

  -- Cócteles (c2000000...003)
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 'Margarita',          5.00, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 'Mojito',             5.00, 2),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003', 'Piña Colada',        5.50, 3),

  -- Entradas (c2000000...004)
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 'Sopa del día',       3.50, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 'Ensalada mixta',     4.00, 2),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000004', 'Nachos',             4.50, 3),

  -- Platos fuertes (c2000000...005)
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 'Pollo a la plancha', 8.50, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 'Carne asada',       12.00, 2),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000005', 'Pasta al pesto',     7.50, 3),

  -- Acompañamientos (c2000000...006)
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 'Papas fritas',       2.50, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 'Arroz',              2.00, 2),
  ('a0000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000006', 'Frijoles',           2.00, 3)
ON CONFLICT DO NOTHING;

COMMIT;
