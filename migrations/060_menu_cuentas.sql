-- =============================================
-- Migración 060: Menú Cuentas (bajo Administración)
-- =============================================

INSERT INTO menus (id, tenant_id, titulo, icono, ruta, orden, permiso_codigo, parent_id, activo)
SELECT
    '00000000-0000-4000-8000-000000000018', t.id,
    'Cuentas', 'receipt', '/admin/cuentas',
    12, 'ordenes.ver',
    (SELECT m.id FROM menus m WHERE m.tenant_id = t.id AND m.titulo = 'Administración' LIMIT 1),
    TRUE
FROM tenants t
ON CONFLICT (id) DO NOTHING;
