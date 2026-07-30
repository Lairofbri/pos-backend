-- Migración 040: Permisos y menú para unidades de medida
-- Permite crear, editar y listar unidades de medida personalizadas (ej: quintal, caja)

-- 1. Permisos
INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    ('unidades.ver',       'Ver unidades de medida',       'Listar unidades de medida disponibles', 'configuracion'),
    ('unidades.gestionar', 'Gestionar unidades de medida', 'Crear, editar y desactivar unidades de medida', 'configuracion')
ON CONFLICT (codigo) DO NOTHING;

-- 2. Permisos default por rol
INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
    ('administrador', 'unidades.ver',       'true'),
    ('administrador', 'unidades.gestionar', 'true'),
    ('gerente',       'unidades.ver',       'true'),
    ('gerente',       'unidades.gestionar', 'true'),
    ('cajero',        'unidades.ver',       'false'),
    ('cajero',        'unidades.gestionar', 'false'),
    ('mesero',        'unidades.ver',       'false'),
    ('mesero',        'unidades.gestionar', 'false'),
    ('cocinero',      'unidades.ver',       'false'),
    ('cocinero',      'unidades.gestionar', 'false')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

-- 3. Activar permisos para todos los tenants existentes
INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
SELECT d.rol, d.permiso_id, t.id, d.activo
FROM permisos_default d
CROSS JOIN tenants t
WHERE EXISTS (SELECT 1 FROM permisos p WHERE p.id = d.permiso_id AND p.codigo IN ('unidades.ver', 'unidades.gestionar'))
ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;
