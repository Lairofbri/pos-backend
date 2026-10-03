-- =============================================
-- Migración 076: Sembrar menús base para tenants existentes
-- =============================================
-- Contexto: el set completo del sidebar (POS, Cocina, Dashboard,
-- Administración, Configuraciones + hijos) solo lo inserta
-- src/migrations/seed.js → sembrarMenusTenant(), que NUNCA corre en
-- producción (docker-entrypoint.sh lo omite con NODE_ENV=production).
-- Las migraciones SQL solo agregaban items puntuales y quedaban con
-- parent_id NULL cuando el root "Administración"/"Configuraciones"
-- no existía (ej: 033 con 'Configuración' que nunca existió).
--
-- sp_sembrar_menus_tenant (migración 075) es el espejo SQL del seed y
-- solo se usaba para tenants NUEVOS vía provisioning. Esta migración:
--   1. Lo aplica a todos los tenants existentes (idempotente por título).
--   2. Re-padrea los hijos huérfanos de migraciones anteriores.
--
-- Rollback:
--   DELETE FROM menus WHERE titulo IN ('POS','Cocina','Dashboard',
--     'Administración','Principal','Configuraciones','Mesas','Combos',
--     'Productos','Reportes','Caja','Clientes','Impresoras','Inventario',
--     'Recetas','Rentabilidad','Costos','Cuentas','Restaurante',
--     'Promociones','Empresas','Sucursales','Menú','Roles y Permisos',
--     'Usuarios') AND tenant_id IN (SELECT id FROM tenants)
--     AND parent_id IS NOT NULL;  -- conserva rows pre-existentes
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Menús base del sidebar para todos los tenants existentes
-- ─────────────────────────────────────────────
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    CALL sp_sembrar_menus_tenant(t.id);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- 2. Re-padrear hijos huérfanos (parent_id NULL)
--    de migraciones anteriores que corrieron sin root.
--    No-op si el root no existe.
-- ─────────────────────────────────────────────
UPDATE menus m
SET parent_id = (
  SELECT id FROM menus
  WHERE tenant_id = m.tenant_id AND titulo = 'Administración' LIMIT 1
)
WHERE m.parent_id IS NULL
  AND m.titulo IN ('Mesas','Combos','Productos','Reportes','Caja','Clientes',
                   'Impresoras','Inventario','Recetas','Rentabilidad','Costos',
                   'Cuentas','Restaurante','Promociones','Empresas');

UPDATE menus m
SET parent_id = (
  SELECT id FROM menus
  WHERE tenant_id = m.tenant_id AND titulo = 'Configuraciones' LIMIT 1
)
WHERE m.parent_id IS NULL
  AND m.titulo IN ('Menú','Roles y Permisos','Usuarios','Sucursales');