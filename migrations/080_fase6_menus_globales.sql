-- =============================================
-- Migración 080: F6 — Menús globales (sin tenant_id)
-- =============================================
-- DECISIÓN DEL PROPIETARIO (2026-10-16):
--   Los menús del sidebar NO varían por empresa. Todas las empresas comparten
--   el mismo catálogo, así que `menus` deja de tener `tenant_id` y pasa a ser
--   un catálogo único (igual que `permisos`). Lo que SÍ varía por tenant son
--   los PERMISOS (`rol_permisos`, `permisos_default`), que siguen amarrados al
--   tenant: el sidebar se filtra con `fn_tiene_permiso(rol, codigo, tenant)`.
--
-- Consecuencias:
--   1. `fn_obtener_menus(p_rol, p_tenant_id, p_es_admin)` conserva la firma y
--      el contrato de respuesta, pero ya no filtra por `menus.tenant_id`;
--      p_tenant_id se usa solo para resolver permisos del tenant.
--   2. Desaparece `sp_sembrar_menus_tenant`: una empresa nueva NO necesita
--      sembrar menús (ya existen globalmente); sigue necesitando permisos
--      (`sp_sembrar_permisos_tenant`) y catálogos operativos.
--   3. El mantenimiento del catálogo (crear/editar/desactivar) queda reservado
--      al rol `plataforma`. El ítem "Menú" (/configuraciones/menus) se marca
--      con `solo_plataforma = TRUE` para que no aparezca a los demás roles.
--
-- Además corrige un bug de la migración 052 (rol 'admin' inexistente):
-- `costos.ver` y `rentabilidad.ver` no estaban en `permisos_default` para el
-- rol `administrador`, por lo que una empresa nueva quedaba con un
-- administrador SIN esos dos permisos ("no ve todo").
--
-- Idempotente: DROP ... IF EXISTS + CREATE + ON CONFLICT.
--
-- Rollback: ver bloque al final del archivo.
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Retirar las estructuras per-tenant de menús
-- ─────────────────────────────────────────────
DROP FUNCTION  IF EXISTS fn_obtener_menus(VARCHAR, UUID, BOOLEAN);
DROP PROCEDURE IF EXISTS sp_sembrar_menus_tenant(UUID);
DROP TABLE     IF EXISTS menus CASCADE;

-- ─────────────────────────────────────────────
-- 2. Catálogo global de menús (sin tenant_id)
-- ─────────────────────────────────────────────
CREATE TABLE menus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID REFERENCES menus(id) ON DELETE CASCADE,
  titulo          VARCHAR(100) NOT NULL,
  icono           VARCHAR(50),
  ruta            VARCHAR(200),
  orden           INT DEFAULT 0,
  activo          BOOLEAN DEFAULT TRUE,
  -- Ítems de mantenimiento de la plataforma (no operativos por empresa).
  solo_plataforma BOOLEAN NOT NULL DEFAULT FALSE,
  permiso_codigo  VARCHAR(100),
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menus_activo_orden ON menus(activo, orden);

-- ─────────────────────────────────────────────
-- 3. Catálogo canónico (ids fijos → idempotente)
--    Espejo del antiguo seed.js / sp_sembrar_menus_tenant +
--    "Sucursales" (migración 033, re-padreado en 076).
-- ─────────────────────────────────────────────

-- Raíces
INSERT INTO menus (id, parent_id, titulo, icono, ruta, orden, permiso_codigo) VALUES
  ('00000000-0000-4000-8000-000000000001', NULL, 'POS',           'shopping-cart',    '/pos',      1, 'ordenes.ver'),
  ('00000000-0000-4000-8000-000000000002', NULL, 'Cocina',        'chef-hat',         '/cocina',   2, 'items.estado'),
  ('00000000-0000-4000-8000-000000000019', NULL, 'Dashboard',     'layout-dashboard', '/dashboard',3, NULL),
  ('00000000-0000-4000-8000-000000000003', NULL, 'Administración','user-cog',         NULL,        3, NULL),
  ('cc306641-6ab2-4bfa-814f-528c4cbe2a65', NULL, 'Principal',     'utensils',         NULL,        1, NULL),
  ('00000000-0000-4000-8000-000000000010', NULL, 'Configuraciones','settings',        NULL,        4, NULL);

-- Hijos de Administración
INSERT INTO menus (id, parent_id, titulo, icono, ruta, orden, permiso_codigo) VALUES
  ('9f3f836b-82f0-452f-b524-5e3bc54e4318', '00000000-0000-4000-8000-000000000003', 'Mesas',        'table',          '/admin/mesas',           1,  'mesas.administrar'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 'Combos',       'gift',           '/admin/combos',          2,  NULL),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 'Productos',    'package',        '/admin/productos',       3,  'productos.ver'),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000003', 'Reportes',     'file-text',      '/admin/reportes',        4,  NULL),
  ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000003', 'Caja',         'dollar-sign',    '/admin/caja',            5,  'caja.historial'),
  ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000003', 'Clientes',     'users',          '/admin/clientes',        6,  'clientes.ver'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000003', 'Impresoras',   'printer',        '/admin/impresoras',      7,  'impresion.configurar'),
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000003', 'Inventario',   'clipboard-list', '/admin/inventario',      8,  'inventario.ver'),
  ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000003', 'Recetas',      'book-open',      '/admin/recetas',         9,  'recetas.ver'),
  ('00000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000003', 'Rentabilidad', 'trending-up',    '/admin/rentabilidad',    10, 'rentabilidad.ver'),
  ('00000000-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000003', 'Costos',       'dollar-sign',    '/admin/reportes/costos', 11, 'costos.ver'),
  ('00000000-0000-4000-8000-000000000018', '00000000-0000-4000-8000-000000000003', 'Cuentas',      'receipt',        '/admin/cuentas',         12, 'ordenes.ver'),
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000003', 'Restaurante',  'store',          '/admin/restaurante',     15, NULL),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000003', 'Promociones',  'tag',            '/admin/promociones',     16, NULL);

-- Hijos de Configuraciones
INSERT INTO menus (id, parent_id, titulo, icono, ruta, orden, permiso_codigo, solo_plataforma) VALUES
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000010', 'Menú',             'menu',   '/configuraciones/menus',    1,  NULL,               TRUE),
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000010', 'Roles y Permisos', 'shield', '/configuraciones/roles',    2,  'roles.configurar', FALSE),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000010', 'Usuarios',         'users',  '/configuraciones/usuarios', 4,  'usuarios.ver',     FALSE),
  ('00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000010', 'Sucursales',       'building-2', '/admin/sucursales',    25, 'sucursales.listar', FALSE);

-- ─────────────────────────────────────────────
-- 4. Función de sidebar: menús globales + permisos DEL TENANT
--    - p_tenant_id ya NO selecciona menús: resuelve los permisos del tenant.
--    - `solo_plataforma` excluye los ítems de mantenimiento para otros roles
--      (ni siquiera el bypass de administrador los ve).
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_obtener_menus(
    p_rol VARCHAR,
    p_tenant_id UUID,
    p_es_admin BOOLEAN
) RETURNS TABLE(
    id UUID,
    parent_id UUID,
    titulo VARCHAR(100),
    icono VARCHAR(50),
    ruta VARCHAR(200),
    orden INTEGER,
    permiso_codigo VARCHAR(100),
    activo BOOLEAN
)
LANGUAGE SQL STABLE
AS $$
    SELECT m.id, m.parent_id, m.titulo, m.icono, m.ruta, m.orden,
           m.permiso_codigo, m.activo
    FROM menus m
    WHERE m.activo = TRUE
      AND (NOT m.solo_plataforma OR p_rol = 'plataforma')
      AND (
        p_es_admin
        OR m.permiso_codigo IS NULL
        OR fn_tiene_permiso(p_rol, m.permiso_codigo, p_tenant_id)
      )
    ORDER BY m.orden, m.titulo;
$$;

-- ─────────────────────────────────────────────
-- 5. Corregir permisos_default/rol_permisos de la migración 052
--    (usaba el rol inexistente 'admin' en lugar de 'administrador')
-- ─────────────────────────────────────────────
INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT 'administrador', d.permiso_id, d.activo
FROM permisos_default d
WHERE d.rol = 'admin'
ON CONFLICT (rol, permiso_id) DO NOTHING;

INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
SELECT 'administrador', rp.permiso_id, rp.tenant_id, rp.activo
FROM rol_permisos rp
WHERE rp.rol = 'admin'
ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;

DELETE FROM rol_permisos    WHERE rol = 'admin';
DELETE FROM permisos_default WHERE rol = 'admin';

-- ─────────────────────────────────────────────
-- 6. Backfill de la matriz default para TODOS los tenants existentes
--    (equivalente a sp_sembrar_permisos_tenant; no pisa lo ya configurado)
-- ─────────────────────────────────────────────
INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
SELECT d.rol, d.permiso_id, t.id, d.activo
FROM permisos_default d
CROSS JOIN tenants t
ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- ROLLBACK (manual si fuera necesario):
--   DROP FUNCTION IF EXISTS fn_obtener_menus(VARCHAR, UUID, BOOLEAN);
--   DROP TABLE IF EXISTS menus CASCADE;
--   -- Recrear `menus` como en la migración 011 (con tenant_id), volver a
--   -- ejecutar 075/076/077 para sembrar el set por tenant y recrear
--   -- sp_sembrar_menus_tenant, y restaurar fn_obtener_menus de la 015.
--   -- (Los menús personalizados por empresa se pierden al consolidar; es la
--   --  consecuencia aceptada de la decisión: el catálogo es global.)
-- ─────────────────────────────────────────────
