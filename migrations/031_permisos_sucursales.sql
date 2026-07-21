-- =============================================
-- Migración 028: Permisos de sucursales
-- =============================================

INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    ('sucursales.listar', 'Listar sucursales', 'Ver listado de sucursales', 'admin'),
    ('sucursales.crear',  'Crear sucursales',  'Crear una nueva sucursal',  'admin'),
    ('sucursales.editar', 'Editar sucursales', 'Modificar datos de sucursal', 'admin')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
    ('administrador', 'sucursales.listar', 'true'),
    ('administrador', 'sucursales.crear',  'true'),
    ('administrador', 'sucursales.editar', 'true'),
    ('gerente',       'sucursales.listar', 'true'),
    ('gerente',       'sucursales.crear',  'false'),
    ('gerente',       'sucursales.editar', 'false')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

-- =============================================
-- FIN DE MIGRACIÓN
-- =============================================
