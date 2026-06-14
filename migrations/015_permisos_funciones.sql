-- =============================================
-- Migraci\u00f3n 015: Permisos en PostgreSQL
-- Mueve cat\u00e1logo, defaults y l\u00f3gica de permisos
-- desde JavaScript a la base de datos
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Tabla de permisos default por rol
-- Fuente de verdad para defaults al crear tenant
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permisos_default (
    rol         VARCHAR(50) NOT NULL,
    permiso_id  UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    activo      BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (rol, permiso_id)
);

-- ─────────────────────────────────────────────
-- 2. Insertar defaults para los 5 roles
-- Mismos valores que el antiguo PERMISOS_DEFAULT
-- ─────────────────────────────────────────────
INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
  -- administrador: todos activos
  ('administrador', 'ordenes.ver', 'true'), ('administrador', 'ordenes.crear', 'true'),
  ('administrador', 'ordenes.actualizar', 'true'), ('administrador', 'ordenes.anular', 'true'),
  ('administrador', 'ordenes.descuento', 'true'), ('administrador', 'items.agregar', 'true'),
  ('administrador', 'items.eliminar', 'true'), ('administrador', 'items.estado', 'true'),
  ('administrador', 'mesas.administrar', 'true'), ('administrador', 'pago.registrar', 'true'),
  ('administrador', 'pago.anular', 'true'),
  ('administrador', 'caja.abrir', 'true'), ('administrador', 'caja.cerrar', 'true'),
  ('administrador', 'caja.movimientos', 'true'), ('administrador', 'caja.historial', 'true'),
  ('administrador', 'productos.ver', 'true'), ('administrador', 'productos.crear', 'true'),
  ('administrador', 'productos.editar', 'true'), ('administrador', 'productos.desactivar', 'true'),
  ('administrador', 'productos.stock', 'true'),
  ('administrador', 'categorias.ver', 'true'), ('administrador', 'categorias.crear', 'true'),
  ('administrador', 'categorias.editar', 'true'), ('administrador', 'categorias.desactivar', 'true'),
  ('administrador', 'combos.ver', 'true'), ('administrador', 'combos.crear', 'true'),
  ('administrador', 'combos.editar', 'true'), ('administrador', 'combos.desactivar', 'true'),
  ('administrador', 'menus.ver', 'true'), ('administrador', 'menus.crear', 'true'),
  ('administrador', 'menus.editar', 'true'), ('administrador', 'menus.desactivar', 'true'),
  ('administrador', 'clientes.ver', 'true'), ('administrador', 'clientes.crear', 'true'),
  ('administrador', 'clientes.editar', 'true'), ('administrador', 'clientes.desactivar', 'true'),
  ('administrador', 'usuarios.ver', 'true'), ('administrador', 'usuarios.crear', 'true'),
  ('administrador', 'usuarios.editar', 'true'), ('administrador', 'usuarios.reset-pin', 'true'),
  ('administrador', 'roles.configurar', 'true'),
  ('administrador', 'reportes.ver', 'true'), ('administrador', 'reportes.exportar', 'true'),

  -- gerente
  ('gerente', 'ordenes.ver', 'true'), ('gerente', 'ordenes.crear', 'true'),
  ('gerente', 'ordenes.actualizar', 'true'), ('gerente', 'ordenes.anular', 'true'),
  ('gerente', 'ordenes.descuento', 'true'), ('gerente', 'items.agregar', 'true'),
  ('gerente', 'items.eliminar', 'true'), ('gerente', 'items.estado', 'true'),
  ('gerente', 'mesas.administrar', 'true'), ('gerente', 'pago.registrar', 'true'),
  ('gerente', 'pago.anular', 'false'),
  ('gerente', 'caja.abrir', 'true'), ('gerente', 'caja.cerrar', 'true'),
  ('gerente', 'caja.movimientos', 'true'), ('gerente', 'caja.historial', 'true'),
  ('gerente', 'productos.ver', 'true'), ('gerente', 'productos.crear', 'true'),
  ('gerente', 'productos.editar', 'true'), ('gerente', 'productos.desactivar', 'true'),
  ('gerente', 'productos.stock', 'true'),
  ('gerente', 'categorias.ver', 'true'), ('gerente', 'categorias.crear', 'true'),
  ('gerente', 'categorias.editar', 'true'), ('gerente', 'categorias.desactivar', 'true'),
  ('gerente', 'combos.ver', 'true'), ('gerente', 'combos.crear', 'true'),
  ('gerente', 'combos.editar', 'true'), ('gerente', 'combos.desactivar', 'true'),
  ('gerente', 'menus.ver', 'true'), ('gerente', 'menus.crear', 'false'),
  ('gerente', 'menus.editar', 'false'), ('gerente', 'menus.desactivar', 'false'),
  ('gerente', 'clientes.ver', 'true'), ('gerente', 'clientes.crear', 'true'),
  ('gerente', 'clientes.editar', 'true'), ('gerente', 'clientes.desactivar', 'true'),
  ('gerente', 'usuarios.ver', 'true'), ('gerente', 'usuarios.crear', 'false'),
  ('gerente', 'usuarios.editar', 'true'), ('gerente', 'usuarios.reset-pin', 'true'),
  ('gerente', 'roles.configurar', 'false'),
  ('gerente', 'reportes.ver', 'true'), ('gerente', 'reportes.exportar', 'true'),

  -- cajero
  ('cajero', 'ordenes.ver', 'true'), ('cajero', 'ordenes.crear', 'true'),
  ('cajero', 'ordenes.actualizar', 'true'), ('cajero', 'ordenes.anular', 'false'),
  ('cajero', 'ordenes.descuento', 'false'), ('cajero', 'items.agregar', 'true'),
  ('cajero', 'items.eliminar', 'true'), ('cajero', 'items.estado', 'false'),
  ('cajero', 'mesas.administrar', 'false'), ('cajero', 'pago.registrar', 'true'),
  ('cajero', 'pago.anular', 'false'),
  ('cajero', 'caja.abrir', 'true'), ('cajero', 'caja.cerrar', 'true'),
  ('cajero', 'caja.movimientos', 'true'), ('cajero', 'caja.historial', 'true'),
  ('cajero', 'productos.ver', 'true'), ('cajero', 'productos.crear', 'false'),
  ('cajero', 'productos.editar', 'false'), ('cajero', 'productos.desactivar', 'false'),
  ('cajero', 'productos.stock', 'true'),
  ('cajero', 'categorias.ver', 'true'), ('cajero', 'categorias.crear', 'false'),
  ('cajero', 'categorias.editar', 'false'), ('cajero', 'categorias.desactivar', 'false'),
  ('cajero', 'combos.ver', 'true'), ('cajero', 'combos.crear', 'false'),
  ('cajero', 'combos.editar', 'false'), ('cajero', 'combos.desactivar', 'false'),
  ('cajero', 'menus.ver', 'true'), ('cajero', 'menus.crear', 'false'),
  ('cajero', 'menus.editar', 'false'), ('cajero', 'menus.desactivar', 'false'),
  ('cajero', 'clientes.ver', 'true'), ('cajero', 'clientes.crear', 'true'),
  ('cajero', 'clientes.editar', 'false'), ('cajero', 'clientes.desactivar', 'false'),
  ('cajero', 'usuarios.ver', 'false'), ('cajero', 'usuarios.crear', 'false'),
  ('cajero', 'usuarios.editar', 'false'), ('cajero', 'usuarios.reset-pin', 'false'),
  ('cajero', 'roles.configurar', 'false'),
  ('cajero', 'reportes.ver', 'false'), ('cajero', 'reportes.exportar', 'false'),

  -- mesero
  ('mesero', 'ordenes.ver', 'true'), ('mesero', 'ordenes.crear', 'false'),
  ('mesero', 'ordenes.actualizar', 'false'), ('mesero', 'ordenes.anular', 'false'),
  ('mesero', 'ordenes.descuento', 'false'), ('mesero', 'items.agregar', 'false'),
  ('mesero', 'items.eliminar', 'false'), ('mesero', 'items.estado', 'true'),
  ('mesero', 'mesas.administrar', 'false'), ('mesero', 'pago.registrar', 'false'),
  ('mesero', 'pago.anular', 'false'),
  ('mesero', 'caja.abrir', 'false'), ('mesero', 'caja.cerrar', 'false'),
  ('mesero', 'caja.movimientos', 'false'), ('mesero', 'caja.historial', 'false'),
  ('mesero', 'productos.ver', 'true'), ('mesero', 'productos.crear', 'false'),
  ('mesero', 'productos.editar', 'false'), ('mesero', 'productos.desactivar', 'false'),
  ('mesero', 'productos.stock', 'false'),
  ('mesero', 'categorias.ver', 'false'), ('mesero', 'categorias.crear', 'false'),
  ('mesero', 'categorias.editar', 'false'), ('mesero', 'categorias.desactivar', 'false'),
  ('mesero', 'combos.ver', 'false'), ('mesero', 'combos.crear', 'false'),
  ('mesero', 'combos.editar', 'false'), ('mesero', 'combos.desactivar', 'false'),
  ('mesero', 'menus.ver', 'false'), ('mesero', 'menus.crear', 'false'),
  ('mesero', 'menus.editar', 'false'), ('mesero', 'menus.desactivar', 'false'),
  ('mesero', 'clientes.ver', 'false'), ('mesero', 'clientes.crear', 'false'),
  ('mesero', 'clientes.editar', 'false'), ('mesero', 'clientes.desactivar', 'false'),
  ('mesero', 'usuarios.ver', 'false'), ('mesero', 'usuarios.crear', 'false'),
  ('mesero', 'usuarios.editar', 'false'), ('mesero', 'usuarios.reset-pin', 'false'),
  ('mesero', 'roles.configurar', 'false'),
  ('mesero', 'reportes.ver', 'false'), ('mesero', 'reportes.exportar', 'false'),

  -- cocinero
  ('cocinero', 'ordenes.ver', 'false'), ('cocinero', 'ordenes.crear', 'false'),
  ('cocinero', 'ordenes.actualizar', 'false'), ('cocinero', 'ordenes.anular', 'false'),
  ('cocinero', 'ordenes.descuento', 'false'), ('cocinero', 'items.agregar', 'false'),
  ('cocinero', 'items.eliminar', 'false'), ('cocinero', 'items.estado', 'true'),
  ('cocinero', 'mesas.administrar', 'false'), ('cocinero', 'pago.registrar', 'false'),
  ('cocinero', 'pago.anular', 'false'),
  ('cocinero', 'caja.abrir', 'false'), ('cocinero', 'caja.cerrar', 'false'),
  ('cocinero', 'caja.movimientos', 'false'), ('cocinero', 'caja.historial', 'false'),
  ('cocinero', 'productos.ver', 'true'), ('cocinero', 'productos.crear', 'false'),
  ('cocinero', 'productos.editar', 'false'), ('cocinero', 'productos.desactivar', 'false'),
  ('cocinero', 'productos.stock', 'false'),
  ('cocinero', 'categorias.ver', 'false'), ('cocinero', 'categorias.crear', 'false'),
  ('cocinero', 'categorias.editar', 'false'), ('cocinero', 'categorias.desactivar', 'false'),
  ('cocinero', 'combos.ver', 'false'), ('cocinero', 'combos.crear', 'false'),
  ('cocinero', 'combos.editar', 'false'), ('cocinero', 'combos.desactivar', 'false'),
  ('cocinero', 'menus.ver', 'false'), ('cocinero', 'menus.crear', 'false'),
  ('cocinero', 'menus.editar', 'false'), ('cocinero', 'menus.desactivar', 'false'),
  ('cocinero', 'clientes.ver', 'false'), ('cocinero', 'clientes.crear', 'false'),
  ('cocinero', 'clientes.editar', 'false'), ('cocinero', 'clientes.desactivar', 'false'),
  ('cocinero', 'usuarios.ver', 'false'), ('cocinero', 'usuarios.crear', 'false'),
  ('cocinero', 'usuarios.editar', 'false'), ('cocinero', 'usuarios.reset-pin', 'false'),
  ('cocinero', 'roles.configurar', 'false'),
  ('cocinero', 'reportes.ver', 'false'), ('cocinero', 'reportes.exportar', 'false')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. Funci\u00f3n: verificar si un rol tiene un permiso
-- Uso: SELECT fn_tiene_permiso('mesero', 'items.estado', tenant_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_tiene_permiso(
    p_rol VARCHAR,
    p_codigo VARCHAR,
    p_tenant_id UUID
) RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
    SELECT COALESCE((
        SELECT rp.activo
        FROM rol_permisos rp
        JOIN permisos p ON p.id = rp.permiso_id
        WHERE rp.rol = p_rol
          AND p.codigo = p_codigo
          AND rp.tenant_id = p_tenant_id
          AND rp.activo = TRUE
    ), false);
$$;

-- ─────────────────────────────────────────────
-- 4. Funci\u00f3n: permisos de un rol con estado activo
-- Uso: SELECT * FROM fn_permisos_rol('cajero', tenant_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_permisos_rol(
    p_rol VARCHAR,
    p_tenant_id UUID
) RETURNS TABLE(modulo VARCHAR, codigo VARCHAR, nombre VARCHAR, activo BOOLEAN)
LANGUAGE SQL STABLE
AS $$
    SELECT p.modulo, p.codigo, p.nombre,
           COALESCE(rp.activo, false) AS activo
    FROM permisos p
    LEFT JOIN rol_permisos rp ON rp.permiso_id = p.id
        AND rp.rol = p_rol
        AND rp.tenant_id = p_tenant_id
    ORDER BY p.modulo, p.codigo;
$$;

-- ─────────────────────────────────────────────
-- 5. Funci\u00f3n: lista de roles v\u00e1lidos
-- Uso: SELECT fn_roles_validos()
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_roles_validos()
RETURNS VARCHAR[]
LANGUAGE SQL STABLE
AS $$
    SELECT ARRAY_AGG(DISTINCT rol ORDER BY rol) FROM permisos_default;
$$;

-- ─────────────────────────────────────────────
-- 6. Funci\u00f3n: men\u00fas filtrados por permisos del rol
-- Retorna lista plana (el \u00e1rbol se construye en JS)
-- Uso: SELECT * FROM fn_obtener_menus('mesero', tenant_id, false)
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
    WHERE m.tenant_id = p_tenant_id
      AND m.activo = TRUE
      AND (
        p_es_admin
        OR m.permiso_codigo IS NULL
        OR fn_tiene_permiso(p_rol, m.permiso_codigo, p_tenant_id)
      )
    ORDER BY m.orden, m.titulo;
$$;

-- ─────────────────────────────────────────────
-- 7. Procedimiento: sembrar permisos default para un tenant
-- Uso: CALL sp_sembrar_permisos_tenant(tenant_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_sembrar_permisos_tenant(p_tenant_id UUID)
LANGUAGE SQL
AS $$
    INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
    SELECT d.rol, d.permiso_id, p_tenant_id, d.activo
    FROM permisos_default d
    ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;
$$;

-- ─────────────────────────────────────────────
-- 8. Procedimiento: resetear permisos de un rol a defaults
-- Uso: CALL sp_resetear_permisos_rol('cajero', tenant_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_resetear_permisos_rol(
    p_rol VARCHAR,
    p_tenant_id UUID
)
LANGUAGE SQL
AS $$
    DELETE FROM rol_permisos
    WHERE rol = p_rol AND tenant_id = p_tenant_id;

    INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
    SELECT d.rol, d.permiso_id, p_tenant_id, d.activo
    FROM permisos_default d
    WHERE d.rol = p_rol;
$$;

-- ─────────────────────────────────────────────
-- 9. \u00cdndice para b\u00fasquedas frecuentes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_permisos_default_rol
    ON permisos_default(rol);

-- ─────────────────────────────────────────────
-- FIN DE MIGRACI\u00d3N
-- ─────────────────────────────────────────────
