-- =============================================
-- Migración 061: Menú Dashboard (Principal)
-- =============================================

INSERT INTO menus (id, tenant_id, titulo, icono, ruta, orden, permiso_codigo, parent_id, activo)
SELECT
    '00000000-0000-4000-8000-000000000019', t.id,
    'Dashboard', 'layout-dashboard', '/dashboard',
    3, NULL, NULL, TRUE
FROM tenants t
ON CONFLICT (id) DO NOTHING;
