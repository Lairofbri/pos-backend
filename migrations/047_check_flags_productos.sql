-- Migración 047: CHECK constraint para prevenir flags contradictorios en productos
-- Un producto no puede tener tiene_stock=true Y tiene_receta=true simultáneamente

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_flags_exclusivos' AND conrelid = 'productos'::regclass
  ) THEN
    ALTER TABLE productos ADD CONSTRAINT ck_flags_exclusivos
      CHECK (NOT (tiene_stock = TRUE AND tiene_receta = TRUE));
  END IF;
END $$;
