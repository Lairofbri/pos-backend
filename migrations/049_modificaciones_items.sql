-- Migración 049: Modificaciones de items y categoría de extras
-- Permite personalizar items quitando ingredientes o agregando extras

-- 1. Campo JSONB para guardar modificaciones por item
ALTER TABLE orden_items ADD COLUMN IF NOT EXISTS modificaciones JSONB DEFAULT '{}';

-- 2. FK para categoría de extras (productos agrupados como extras disponibles)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria_extras_id UUID REFERENCES categorias(id);
