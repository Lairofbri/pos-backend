-- Migración 028: combo_id en orden_items
-- Permite trazabilidad de combos en órdenes

ALTER TABLE orden_items
ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES combos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orden_items_combo_id ON orden_items(combo_id);

-- Nota: Los combos existentes en órdenes previas quedarán con combo_id = NULL
-- Solo las órdenes nuevas tendrán el combo_id poblado
