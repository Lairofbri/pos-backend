-- =============================================
-- Migración 024: Corregir UUIDs a formato v4
-- Transforma los UUIDs de datos demo que no
-- cumplen con el formato UUID v4 estándar.
-- =============================================

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Crear tabla temporal de mapeo
-- ─────────────────────────────────────────────
CREATE TEMP TABLE _uuid_map (
  old_id UUID PRIMARY KEY,
  new_id UUID NOT NULL
);

-- ─────────────────────────────────────────────
-- 2. Poblar mapeo para categorías
--    old → new (v4 válido: 4xxx + [89ab]xxx)
-- ─────────────────────────────────────────────
INSERT INTO _uuid_map (old_id, new_id) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'c1000000-0000-4000-8000-000000000002'),
  ('c1000000-0000-0000-0000-000000000003', 'c1000000-0000-4000-8000-000000000003'),
  ('c2000000-0000-0000-0000-000000000001', 'c2000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-0000-0000-000000000002', 'c2000000-0000-4000-8000-000000000002'),
  ('c2000000-0000-0000-0000-000000000003', 'c2000000-0000-4000-8000-000000000003'),
  ('c2000000-0000-0000-0000-000000000004', 'c2000000-0000-4000-8000-000000000004'),
  ('c2000000-0000-0000-0000-000000000005', 'c2000000-0000-4000-8000-000000000005'),
  ('c2000000-0000-0000-0000-000000000006', 'c2000000-0000-4000-8000-000000000006'),
  ('c3000000-0000-0000-0000-000000000001', 'c3000000-0000-4000-8000-000000000001');

-- ─────────────────────────────────────────────
-- 3. Poblar mapeo para menús
-- ─────────────────────────────────────────────
INSERT INTO _uuid_map (old_id, new_id) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-4000-8000-000000000007'),
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-4000-8000-000000000008'),
  ('00000000-0000-0000-0000-000000000009', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-4000-8000-000000000011');

-- ─────────────────────────────────────────────
-- 4. Eliminar FK que apuntan a categorias.id
--    y menus.id para poder actualizar PKs
-- ─────────────────────────────────────────────
-- Buscar y dropear cualquier FK en productos que referencie categorias
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class tab ON con.conrelid = tab.oid
    WHERE tab.relname = 'productos'
      AND con.contype = 'f'
      AND con.confrelid = (SELECT oid FROM pg_class WHERE relname = 'categorias')
  LOOP
    EXECUTE 'ALTER TABLE productos DROP CONSTRAINT IF EXISTS ' || fk_name;
  END LOOP;
END $$;

-- Dropear FK de menus y FK auto-referenciada de categorias
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class tab ON con.conrelid = tab.oid
    WHERE tab.relname = 'menus'
      AND con.contype = 'f'
  LOOP
    EXECUTE 'ALTER TABLE menus DROP CONSTRAINT IF EXISTS ' || fk_name;
  END LOOP;

  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class tab ON con.conrelid = tab.oid
    WHERE tab.relname = 'categorias'
      AND con.contype = 'f'
      AND con.confrelid = tab.oid
  LOOP
    EXECUTE 'ALTER TABLE categorias DROP CONSTRAINT IF EXISTS ' || fk_name;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- 5. Actualizar categoria_id en productos
-- ─────────────────────────────────────────────
UPDATE productos p
  SET categoria_id = m.new_id
  FROM _uuid_map m
  WHERE p.categoria_id = m.old_id;

-- ─────────────────────────────────────────────
-- 6. Actualizar parent_id en categorías
-- ─────────────────────────────────────────────
UPDATE categorias c
  SET parent_id = m.new_id
  FROM _uuid_map m
  WHERE c.parent_id = m.old_id;

-- ─────────────────────────────────────────────
-- 7. Actualizar parent_id en menús
-- ─────────────────────────────────────────────
UPDATE menus m
  SET parent_id = m2.new_id
  FROM _uuid_map m2
  WHERE m.parent_id = m2.old_id;

-- ─────────────────────────────────────────────
-- 8. Actualizar id en categorías
-- ─────────────────────────────────────────────
UPDATE categorias c
  SET id = m.new_id
  FROM _uuid_map m
  WHERE c.id = m.old_id;

-- ─────────────────────────────────────────────
-- 9. Actualizar id en menús
-- ─────────────────────────────────────────────
UPDATE menus m
  SET id = m2.new_id
  FROM _uuid_map m2
  WHERE m.id = m2.old_id;

-- ─────────────────────────────────────────────
-- 10. Restaurar FK
-- ─────────────────────────────────────────────
ALTER TABLE productos
  ADD CONSTRAINT productos_categoria_id_fkey
  FOREIGN KEY (categoria_id, tenant_id)
  REFERENCES categorias(id, tenant_id)
  ON DELETE SET NULL;

ALTER TABLE menus
  ADD CONSTRAINT menus_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES tenants(id)
  ON DELETE CASCADE;

ALTER TABLE menus
  ADD CONSTRAINT menus_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES menus(id)
  ON DELETE CASCADE;

ALTER TABLE categorias
  ADD CONSTRAINT fk_categorias_padre
  FOREIGN KEY (parent_id, tenant_id)
  REFERENCES categorias(id, tenant_id)
  ON DELETE RESTRICT;

-- ─────────────────────────────────────────────
-- 11. Limpiar
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS _uuid_map;

COMMIT;
