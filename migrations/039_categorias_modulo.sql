-- 039: Agregar columna modulo a categorias
-- Permite etiquetar categorías por módulo (producto, receta, inventario)
-- para organización y reportes, manteniendo las categorías compartidas.

BEGIN;

ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS modulo VARCHAR(20) DEFAULT 'producto';

UPDATE categorias SET modulo = 'producto' WHERE modulo IS NULL;

ALTER TABLE categorias
  ALTER COLUMN modulo SET NOT NULL;

COMMIT;