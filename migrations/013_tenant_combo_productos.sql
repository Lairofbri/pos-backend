-- =============================================
-- Migración 013: tenant_id en combo_productos
-- POS Restaurante — El Salvador
-- =============================================
-- La tabla combo_productos no tenía tenant_id,
-- lo que impedía el filtrado multi-tenant a
-- nivel de base de datos.
-- =============================================

ALTER TABLE combo_productos
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Rellenar tenant_id de los registros existentes desde la tabla combos
UPDATE combo_productos cp
  SET tenant_id = c.tenant_id
  FROM combos c
  WHERE cp.combo_id = c.id AND cp.tenant_id IS NULL;

-- Ahora hacer NOT NULL
ALTER TABLE combo_productos
  ALTER COLUMN tenant_id SET NOT NULL;

-- Recrear unique incluyendo tenant_id (la UNIQUE de CREATE TABLE se auto-nombra)
ALTER TABLE combo_productos DROP CONSTRAINT IF EXISTS combo_productos_combo_id_producto_id_key;
ALTER TABLE combo_productos ADD UNIQUE (combo_id, producto_id, tenant_id);

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
