-- =============================================
-- Migración 007: Permisos granulares por rol
-- POS Restaurante — El Salvador
-- =============================================
-- Reemplaza el sistema de roles fijos por un sistema
-- de permisos configurables por tenant. Cada restaurante
-- decide qué puede hacer cada rol sin afectar a otros.
-- =============================================

-- Catálogo fijo de permisos (compartido por todos los tenants)
CREATE TABLE IF NOT EXISTS permisos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      VARCHAR(100) UNIQUE NOT NULL,
    nombre      VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    modulo      VARCHAR(50) NOT NULL,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- Asignación de permisos por rol, por tenant
-- Cada tenant tiene su copia independiente
CREATE TABLE IF NOT EXISTS rol_permisos (
    rol         VARCHAR(50) NOT NULL,
    permiso_id  UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    activo      BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (rol, permiso_id, tenant_id)
);

-- Índice para lookup rápido de permisos por rol + tenant
CREATE INDEX IF NOT EXISTS idx_rol_permisos_lookup
    ON rol_permisos(tenant_id, rol, activo);

-- ═════════════════════════════════════════════
-- Catálogo de permisos
-- ═════════════════════════════════════════════

INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    -- Módulo: Pos
    ('ordenes.ver',         'Ver órdenes',              'Ver listado y detalle de órdenes',           'pos'),
    ('ordenes.crear',       'Crear orden',              'Crear una nueva orden (mesa, rápida)',        'pos'),
    ('ordenes.actualizar',  'Modificar orden',          'Cambiar notas y descuento de la orden',       'pos'),
    ('ordenes.anular',      'Anular orden',             'Cancelar una orden abierta',                  'pos'),
    ('ordenes.descuento',   'Aplicar descuento',        'Aplicar o modificar descuento porcentual',    'pos'),
    ('items.agregar',       'Agregar items',            'Agregar productos a una orden',               'pos'),
    ('items.eliminar',      'Eliminar items',           'Quitar items de una orden',                   'pos'),
    ('items.estado',        'Cambiar estado de item',   'Marcar items como listos o en proceso',       'pos'),
    ('mesas.administrar',   'Administrar mesas',        'Crear, editar y desactivar mesas',            'pos'),
    ('pago.registrar',      'Registrar pago',           'Cobrar una orden',                            'pos'),
    ('pago.anular',         'Anular pago',              'Anular un pago ya registrado',                'pos'),

    -- Módulo: Caja
    ('caja.abrir',          'Abrir caja',               'Abrir un nuevo turno de caja',                'caja'),
    ('caja.cerrar',         'Cerrar caja',              'Cerrar el turno de caja activo',              'caja'),
    ('caja.movimientos',    'Registrar movimientos',    'Registrar retiros o depósitos manuales',      'caja'),
    ('caja.historial',      'Ver historial de cajas',   'Consultar turnos anteriores y movimientos',   'caja'),

    -- Módulo: Productos
    ('productos.ver',       'Ver productos',            'Ver listado y detalle de productos',           'productos'),
    ('productos.crear',     'Crear productos',          'Crear un nuevo producto en el menú',           'productos'),
    ('productos.editar',    'Editar productos',         'Modificar nombre, precio, categoría, etc.',    'productos'),
    ('productos.desactivar','Desactivar productos',     'Marcar un producto como inactivo',             'productos'),
    ('productos.stock',     'Ajustar stock',            'Sumar, restar o fijar stock de un producto',  'productos'),
    ('categorias.crear',    'Crear categorías',         'Crear una nueva categoría del menú',           'productos'),
    ('categorias.editar',   'Editar categorías',        'Modificar nombre, orden o color de categoría', 'productos'),

    -- Módulo: Clientes
    ('clientes.ver',        'Ver clientes',             'Ver listado y detalle de clientes',            'clientes'),
    ('clientes.crear',      'Crear clientes',           'Registrar un nuevo cliente',                   'clientes'),
    ('clientes.editar',     'Editar clientes',          'Modificar datos de un cliente',                'clientes'),
    ('clientes.desactivar', 'Desactivar clientes',      'Marcar un cliente como inactivo',              'clientes'),

    -- Módulo: Usuarios
    ('usuarios.ver',        'Ver usuarios',             'Ver listado de usuarios del restaurante',      'usuarios'),
    ('usuarios.crear',      'Crear usuarios',           'Crear un nuevo usuario (cajero, mesero, etc.)','usuarios'),
    ('usuarios.editar',     'Editar usuarios',          'Modificar nombre, rol o sucursal de usuario',  'usuarios'),
    ('usuarios.reset-pin',  'Resetear PIN',             'Restablecer el PIN de un usuario',             'usuarios'),
    ('roles.configurar',    'Configurar roles',         'Activar o desactivar permisos por rol',        'usuarios'),

    -- Módulo: Reportes
    ('reportes.ver',        'Ver reportes',             'Acceder a los reportes del restaurante',       'reportes'),
    ('reportes.exportar',   'Exportar reportes',        'Descargar reportes en PDF o Excel',            'reportes'),

    -- Módulo: Categorías
    ('categorias.ver',          'Ver categorías',               'Ver listado de categorías',                    'categorias'),
    ('categorias.desactivar',   'Desactivar categorías',        'Marcar una categoría como inactiva',           'categorias'),

    -- Módulo: Combos
    ('combos.ver',          'Ver combos',               'Ver listado y detalle de combos',               'combos'),
    ('combos.crear',        'Crear combos',             'Crear un nuevo combo',                          'combos'),
    ('combos.editar',       'Editar combos',            'Modificar nombre, precio o productos del combo', 'combos'),
    ('combos.desactivar',   'Desactivar combos',        'Marcar un combo como inactivo',                 'combos'),

    -- Módulo: Menú del sidebar
    ('menus.ver',           'Ver menú del sidebar',     'Ver la estructura del menú lateral',            'menus'),
    ('menus.crear',         'Crear items del menú',     'Agregar nuevos items al menú lateral',           'menus'),
    ('menus.editar',        'Editar items del menú',    'Modificar items existentes del menú lateral',    'menus'),
    ('menus.desactivar',    'Desactivar items del menú','Ocultar items del menú lateral',                 'menus')

ON CONFLICT (codigo) DO NOTHING;

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
