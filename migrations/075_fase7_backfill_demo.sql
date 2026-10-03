-- Migración 075: Fase 7 — Backfill del demo + onboarding de tenants nuevos.
--
-- 1. Backfill del vínculo fiscal del tenant demo (spec §10 Fase 7):
--    - Sucursal Principal (activa) → branch_id b...0001 / establecimiento DTE
--      4862838d-2109-43cc-ba80-ab46165f87f1 → fiscal_status 'ready'.
--    - Sucursal Centro (activa) → branch_id b...0002 / establecimiento DTE
--      b...0002 → fiscal_status 'ready'.
--    - Duplicado histórico "Sucursal Principal" (inactiva, b0000000-0000-0000-0000-...)
--      → fiscal_status 'inactive' (no emite; sin vínculo).
--    Idempotente y scoped al tenant demo: re-ejecutar es no-op (guard branch_id IS NULL).
--    En entornos con otros tenants no toca nada (los WHERE incluyen IDs del demo).
--
-- 2. sp_sembrar_menus_tenant: menús default del sidebar para un tenant nuevo
--    (misma lista que src/migrations/seed.js sembrarMenusTenant, incluye "Empresas").
--    Idempotente por (tenant_id, titulo): no duplica si el menú ya existe.
--    Usado por el onboarding de provisión (src/features/provisioning/service.ts).
--
-- Rollback:
--   UPDATE sucursales SET branch_id = NULL, dte_establecimiento_id = NULL,
--     fiscal_status = 'pending_link', sync_error = NULL, last_fiscal_sync_at = NULL
--   WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001'
--     AND id IN ('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
--   UPDATE sucursales SET fiscal_status = 'pending_link', sync_error = NULL
--   WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001'
--     AND id = 'b0000000-0000-0000-0000-000000000001';
--   DROP PROCEDURE IF EXISTS sp_sembrar_menus_tenant(UUID);

-- ─────────────────────────────────────────────
-- 1. Backfill del vínculo fiscal del tenant demo
-- ─────────────────────────────────────────────

-- Sucursal Principal (activa) → Establecimiento Principal (4862838d-...), ready.
UPDATE sucursales
SET branch_id              = 'b0000000-0000-4000-8000-000000000001',
    dte_establecimiento_id = '4862838d-2109-43cc-ba80-ab46165f87f1',
    fiscal_status          = 'ready',
    sync_error             = NULL,
    last_fiscal_sync_at    = NOW()
WHERE id = 'b0000000-0000-4000-8000-000000000001'
  AND tenant_id = 'a0000000-0000-4000-8000-000000000001'
  AND branch_id IS NULL;

-- Sucursal Centro (activa) → Establecimiento Sucursal Centro (b...0002), ready.
UPDATE sucursales
SET branch_id              = 'b0000000-0000-4000-8000-000000000002',
    dte_establecimiento_id = 'b0000000-0000-4000-8000-000000000002',
    fiscal_status          = 'ready',
    sync_error             = NULL,
    last_fiscal_sync_at    = NOW()
WHERE id = 'b0000000-0000-4000-8000-000000000002'
  AND tenant_id = 'a0000000-0000-4000-8000-000000000001'
  AND branch_id IS NULL;

-- Duplicado histórico "Sucursal Principal" (inactiva): clasificado como
-- 'inactive' — no puede emitir ni vincularse (sin branch_id).
UPDATE sucursales
SET fiscal_status = 'inactive',
    sync_error    = NULL
WHERE id = 'b0000000-0000-0000-0000-000000000001'
  AND tenant_id = 'a0000000-0000-4000-8000-000000000001'
  AND branch_id IS NULL;

-- ─────────────────────────────────────────────
-- 2. Menús default del sidebar para un tenant nuevo
--    (espejo de seed.js sembrarMenusTenant; mantener en sincronía)
--    Idempotente: inserta solo si el título no existe aún en el tenant.
-- ─────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_sembrar_menus_tenant(p_tenant_id UUID)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Raíces
  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, NULL, 'POS', 'shopping-cart', '/pos', 1, 'ordenes.ver'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'POS');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, NULL, 'Cocina', 'chef-hat', '/cocina', 2, 'items.estado'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Cocina');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, NULL, 'Dashboard', 'layout-dashboard', '/dashboard', 3, NULL
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Dashboard');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, NULL, 'Administración', 'user-cog', NULL, 3, NULL
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, NULL, 'Principal', 'utensils', NULL, 1, NULL
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Principal');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, NULL, 'Configuraciones', 'settings', NULL, 4, NULL
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Configuraciones');

  -- Hijos de Administración
  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Mesas', 'table', '/admin/mesas', 1, 'mesas.administrar'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Mesas');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Combos', 'gift', '/admin/combos', 2, NULL
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Combos');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Productos', 'package', '/admin/productos', 3, 'productos.ver'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Productos');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Reportes', 'file-text', '/admin/reportes', 4, NULL
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Reportes');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Caja', 'dollar-sign', '/admin/caja', 5, 'caja.historial'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Caja');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Clientes', 'users', '/admin/clientes', 6, 'clientes.ver'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Clientes');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Impresoras', 'printer', '/admin/impresoras', 7, 'impresion.configurar'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Impresoras');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Inventario', 'clipboard-list', '/admin/inventario', 8, 'inventario.ver'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Inventario');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Recetas', 'book-open', '/admin/recetas', 9, 'recetas.ver'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Recetas');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Rentabilidad', 'trending-up', '/admin/rentabilidad', 10, 'rentabilidad.ver'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Rentabilidad');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Costos', 'dollar-sign', '/admin/reportes/costos', 11, 'costos.ver'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Costos');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Cuentas', 'receipt', '/admin/cuentas', 12, 'ordenes.ver'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Cuentas');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Restaurante', 'store', '/admin/restaurante', 15, NULL
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Restaurante');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Promociones', 'tag', '/admin/promociones', 16, NULL
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Promociones');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Administración' LIMIT 1),
         'Empresas', 'building', '/admin/empresas', 17, 'empresas.provisionar'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Empresas');

  -- Hijos de Configuraciones
  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Configuraciones' LIMIT 1),
         'Menú', 'menu', '/configuraciones/menus', 1, 'roles.configurar'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Menú');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Configuraciones' LIMIT 1),
         'Roles y Permisos', 'shield', '/configuraciones/roles', 2, 'roles.configurar'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Roles y Permisos');

  INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
  SELECT gen_random_uuid(), p_tenant_id, (SELECT id FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Configuraciones' LIMIT 1),
         'Usuarios', 'users', '/configuraciones/usuarios', 4, 'usuarios.ver'
  WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = p_tenant_id AND titulo = 'Usuarios');
END;
$$;