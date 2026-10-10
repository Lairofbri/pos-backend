-- Migración 077: Quitar el alta de empresas del POS (decisión propietario 2026-10-07).
--
-- Contexto: el mantenimiento "Crear empresa" queda SOLO en el DTE Frontend
-- (rol plataforma). El POS Frontend ya no expone /admin/empresas ni el POS
-- Backend expone POST /api/v1/provisioning/tenants. El POS conserva la
-- proyección y el consumo de eventos de provisión (internal).
--
-- 1. Elimina el menú "Empresas" (/admin/empresas) de TODOS los tenants.
-- 2. Actualiza sp_sembrar_menus_tenant (migración 075) SIN el menú "Empresas"
--    para que los tenants nuevos tampoco lo reciban.
-- 3. Elimina el permiso 'empresas.provisionar' (permiso + permisos_default +
--    rol_permisos) — sin código activo que lo use.
--
-- Rollback:
--   Re-ejecutar migración 074 (menú + permisos) o 075 (procedimiento anterior).
--   INSERT INTO menus (id, tenant_id, titulo, icono, ruta, orden, permiso_codigo,
--                      parent_id, activo)
--   SELECT '00000000-0000-4000-8000-000000000022', t.id, 'Empresas', 'building',
--          '/admin/empresas', 17, 'empresas.provisionar',
--          (SELECT m.id FROM menus m WHERE m.tenant_id = t.id AND m.titulo = 'Administración' LIMIT 1),
--          TRUE
--   FROM tenants t
--   WHERE NOT EXISTS (SELECT 1 FROM menus WHERE tenant_id = t.id AND ruta = '/admin/empresas');

-- ─────────────────────────────────────────────
-- 1. Menú "Empresas" fuera de todos los tenants
-- ─────────────────────────────────────────────
DELETE FROM menus
WHERE ruta = '/admin/empresas';

-- ─────────────────────────────────────────────
-- 2. sp_sembrar_menus_tenant sin el menú "Empresas"
--    (espejo de seed.js sembrarMenusTenant; mantener en sincronía)
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

  -- NOTA (077): el menú "Empresas" se eliminó — el alta de empresas vive solo en DTE Frontend.

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

-- ─────────────────────────────────────────────
-- 3. Permiso 'empresas.provisionar' sin uso activo
-- ─────────────────────────────────────────────
DELETE FROM rol_permisos
WHERE permiso_id IN (SELECT id FROM permisos WHERE codigo = 'empresas.provisionar');

DELETE FROM permisos_default
WHERE permiso_id IN (SELECT id FROM permisos WHERE codigo = 'empresas.provisionar');

DELETE FROM permisos WHERE codigo = 'empresas.provisionar';

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────