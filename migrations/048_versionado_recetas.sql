-- Migración 048: Versionado de recetas
-- Permite preservar el historial de cambios en recetas y la versión usada en cada orden

-- 1. Agregar columnas de versionado a recetas
ALTER TABLE recetas ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE recetas ADD COLUMN IF NOT EXISTS vigente_desde TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE recetas ADD COLUMN IF NOT EXISTS vigente_hasta TIMESTAMPTZ;

-- 2. Agregar receta_version a orden_items para trazabilidad histórica
ALTER TABLE orden_items ADD COLUMN IF NOT EXISTS receta_version INTEGER;
