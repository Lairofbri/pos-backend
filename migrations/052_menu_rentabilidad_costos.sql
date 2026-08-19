-- =============================================
-- Migración 052: Menú Rentabilidad + Menú Costos + Permisos
-- =============================================

-- Permisos (globales, sin tenant_id)
INSERT INTO permisos (id, codigo, nombre, descripcion, modulo)
SELECT gen_random_uuid(), 'rentabilidad.ver', 'Ver rentabilidad', 'Ver dashboard de rentabilidad con gráficos de margen y evolución', 'rentabilidad'
WHERE NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = 'rentabilidad.ver');

INSERT INTO permisos (id, codigo, nombre, descripcion, modulo)
SELECT gen_random_uuid(), 'costos.ver', 'Ver costos', 'Ver reportes de costos (por producto, categoría, evolución, inventario)', 'costos'
WHERE NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = 'costos.ver');

-- Asignar permisos al rol admin
INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT 'admin', p.id, TRUE
FROM permisos p
WHERE p.codigo IN ('rentabilidad.ver', 'costos.ver')
  AND NOT EXISTS (
      SELECT 1 FROM permisos_default pd
      WHERE pd.rol = 'admin' AND pd.permiso_id = p.id
  );

-- Menú: Rentabilidad (bajo Administración)
INSERT INTO menus (id, tenant_id, titulo, icono, ruta, orden, permiso_codigo, parent_id, activo)
SELECT
    gen_random_uuid(),
    t.id,
    'Rentabilidad',
    'trending-up',
    '/admin/rentabilidad',
    10,
    'rentabilidad.ver',
    (SELECT m.id FROM menus m WHERE m.tenant_id = t.id AND m.titulo = 'Administración' LIMIT 1),
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM menus m WHERE m.tenant_id = t.id AND m.ruta = '/admin/rentabilidad'
);

-- Menú: Costos (bajo Administración)
INSERT INTO menus (id, tenant_id, titulo, icono, ruta, orden, permiso_codigo, parent_id, activo)
SELECT
    gen_random_uuid(),
    t.id,
    'Costos',
    'dollar-sign',
    '/admin/reportes/costos',
    11,
    'costos.ver',
    (SELECT m.id FROM menus m WHERE m.tenant_id = t.id AND m.titulo = 'Administración' LIMIT 1),
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM menus m WHERE m.tenant_id = t.id AND m.ruta = '/admin/reportes/costos'
);
