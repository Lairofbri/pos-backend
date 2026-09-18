-- Migración 066: Permiso alertas.ver
-- Permite consultar las alertas inteligentes del dashboard (GET /alertas)

INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    ('alertas.ver', 'Ver alertas', 'Consultar las alertas inteligentes del dashboard', 'reportes')
ON CONFLICT (codigo) DO NOTHING;

-- Permisos default por rol (fuente de verdad para tenants nuevos)
INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
    ('administrador', 'alertas.ver', 'true'),
    ('gerente',       'alertas.ver', 'true')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

-- Activar permisos para todos los tenants existentes
INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
SELECT d.rol, d.permiso_id, t.id, d.activo
FROM permisos_default d
CROSS JOIN tenants t
WHERE EXISTS (SELECT 1 FROM permisos p WHERE p.id = d.permiso_id AND p.codigo = 'alertas.ver')
ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;