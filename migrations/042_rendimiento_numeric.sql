-- Migración 042: rendimiento recetas INTEGER → NUMERIC(10,2)
-- Permite rendimientos fraccionarios (ej: 2.5 porciones, 0.5 bandejas)

ALTER TABLE recetas ALTER COLUMN rendimiento TYPE NUMERIC(10,2);
