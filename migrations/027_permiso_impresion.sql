-- 027: Agregar permiso impresion.configurar
-- Permite gestionar impresoras térmicas desde Admin > Impresoras

INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    ('impresion.configurar', 'Configurar impresoras', 'Gestionar impresoras térmicas: crear, editar, eliminar y probar conexión', 'impresion')
ON CONFLICT (codigo) DO NOTHING;

-- Asignar a permisos_default
INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
    ('administrador', 'impresion.configurar', 'true'),
    ('gerente',       'impresion.configurar', 'true')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;
