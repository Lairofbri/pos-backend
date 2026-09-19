-- =============================================
-- Migración 062: Configuración por tenant (CRUD Restaurantes)
-- Modo por defecto del POS por tenant
-- =============================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pos_default_mode VARCHAR(10) NOT NULL DEFAULT 'mesas'
  CHECK (pos_default_mode IN ('mesas', 'rapido'));
