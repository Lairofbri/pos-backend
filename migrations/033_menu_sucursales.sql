-- =============================================
-- Migración 033: Agregar ítem de menú para sucursales
-- =============================================

INSERT INTO menus (id, tenant_id, titulo, icono, ruta, orden, permiso_codigo, parent_id, activo)
SELECT
    gen_random_uuid(),
    id,
    'Sucursales',
    'building-2',
    '/admin/sucursales',
    25,
    'sucursales.listar',
    (SELECT m.id FROM menus m WHERE m.tenant_id = t.id AND m.titulo = 'Configuración' LIMIT 1),
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM menus m
    WHERE m.tenant_id = t.id AND m.ruta = '/admin/sucursales'
)
ON CONFLICT DO NOTHING;

-- =============================================
-- FIN DE MIGRACIÓN
-- =============================================
