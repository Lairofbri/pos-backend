-- =============================================
-- Migración 074: Fase 6 — Onboarding POS (menú Empresas) + permiso plataforma
-- Spec: Provisión y sincronización POS-DTE (§10 Fase 6 — Interfaces y operación)
--
-- 1. Permiso global empresas.provisionar (alta de empresas desde POS)
-- 2. permisos_default: rol plataforma → empresas.provisionar
--    (primer permiso default del rol; los tenants nuevos lo heredan vía
--    sp_sembrar_permisos_tenant)
-- 3. Backfill rol_permisos para tenants existentes (idempotente)
-- 4. Menú "Empresas" (/admin/empresas) bajo Administración para TODOS los
--    tenants (mismo ID fijo que el seed → idempotente entre migración y seed)
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Permiso global (sin tenant_id)
-- ─────────────────────────────────────────────
INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
  ('empresas.provisionar', 'Provisionar empresas', 'Crear empresas (onboarding) mediante la provisión POS ↔ DTE', 'admin')
ON CONFLICT (codigo) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. Permiso default para el rol plataforma
-- ─────────────────────────────────────────────
INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
  ('plataforma', 'empresas.provisionar', 'true')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. Activar para todos los tenants existentes
-- ─────────────────────────────────────────────
INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
SELECT d.rol, d.permiso_id, t.id, d.activo
FROM permisos_default d
CROSS JOIN tenants t
JOIN permisos p ON p.id = d.permiso_id
WHERE p.codigo = 'empresas.provisionar'
ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. Menú: Empresas (bajo Administración)
--    ID fijo (mismo que el seed) para que migración + seed no dupliquen.
-- ─────────────────────────────────────────────
INSERT INTO menus (id, tenant_id, titulo, icono, ruta, orden, permiso_codigo, parent_id, activo)
SELECT
    '00000000-0000-4000-8000-000000000022',
    t.id,
    'Empresas',
    'building',
    '/admin/empresas',
    17,
    'empresas.provisionar',
    (SELECT m.id FROM menus m WHERE m.tenant_id = t.id AND m.titulo = 'Administración' LIMIT 1),
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM menus m WHERE m.tenant_id = t.id AND m.ruta = '/admin/empresas'
);

-- ─────────────────────────────────────────────
-- ROLLBACK (manual si fuera necesario):
--   DELETE FROM menus WHERE ruta = '/admin/empresas';
--   DELETE FROM rol_permisos
--     WHERE rol = 'plataforma' AND permiso_id IN
--       (SELECT id FROM permisos WHERE codigo = 'empresas.provisionar');
--   DELETE FROM permisos_default
--     WHERE rol = 'plataforma' AND permiso_id IN
--       (SELECT id FROM permisos WHERE codigo = 'empresas.provisionar');
--   DELETE FROM permisos WHERE codigo = 'empresas.provisionar';
-- ─────────────────────────────────────────────