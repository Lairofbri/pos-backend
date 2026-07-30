-- =============================================
-- Migración 037: Sistema de inventario
-- Movimientos de inventario, catálogo, permisos y menú
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Tabla movimientos_inventario (append-only)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    sucursal_id     UUID REFERENCES sucursales(id),
    producto_id     UUID NOT NULL,
    tipo_movimiento VARCHAR(20) NOT NULL,
    cantidad        INTEGER NOT NULL CHECK (cantidad >= 0),
    stock_anterior  INTEGER NOT NULL,
    stock_posterior INTEGER NOT NULL,
    motivo          VARCHAR(255),
    referencia_tipo VARCHAR(30),
    referencia_id   UUID,
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (producto_id, tenant_id) REFERENCES productos(id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_tenant_producto
    ON movimientos_inventario (tenant_id, producto_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_tenant_tipo
    ON movimientos_inventario (tenant_id, tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_referencia
    ON movimientos_inventario (referencia_tipo, referencia_id)
    WHERE referencia_tipo IS NOT NULL;

-- ─────────────────────────────────────────────
-- 2. Permitir stock negativo
-- ─────────────────────────────────────────────
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_stock_actual_check;

-- ─────────────────────────────────────────────
-- 3. Catálogo tipos_movimiento_inventario (todos los tenants)
-- ─────────────────────────────────────────────
INSERT INTO catalogos (tenant_id, grupo, valor, label, orden)
SELECT t.id, 'tipos_movimiento_inventario', v.valor, v.label, v.orden
FROM tenants t
CROSS JOIN (VALUES
    ('compra',     'Compra',     1),
    ('ajuste',     'Ajuste',     2),
    ('merma',      'Merma',      3),
    ('devolucion', 'Devolución', 4),
    ('consumo',    'Consumo',    5)
) AS v(valor, label, orden)
ON CONFLICT (tenant_id, grupo, valor) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. Actualizar sp_sembrar_catalogos_tenant
-- ─────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_sembrar_catalogos_tenant(p_tenant_id UUID)
LANGUAGE SQL
AS $$
    INSERT INTO catalogos (tenant_id, grupo, valor, label, orden)
    SELECT p_tenant_id, v.grupo, v.valor, v.label, v.orden
    FROM (VALUES
        ('tipos_documento', 'dui', 'DUI', 1),
        ('tipos_documento', 'nit', 'NIT', 2),
        ('tipos_documento', 'pasaporte', 'Pasaporte', 3),
        ('tipos_documento', 'carnet_residente', 'Carnet Residente', 4),
        ('metodos_pago', 'efectivo', 'Efectivo', 1),
        ('metodos_pago', 'tarjeta', 'Tarjeta', 2),
        ('metodos_pago', 'mixto', 'Mixto', 3),
        ('metodos_pago', 'tarjeta_debito', 'Tarjeta Débito', 4),
        ('metodos_pago', 'tarjeta_credito', 'Tarjeta Crédito', 5),
        ('metodos_pago', 'transferencia', 'Transferencia', 6),
        ('metodos_pago', 'bitcoin', 'Bitcoin', 7),
        ('metodos_pago', 'monedero_electronico', 'Monedero Electrónico', 8),
        ('metodos_pago', 'cheque', 'Cheque', 9),
        ('metodos_pago', 'tarjeta_empresarial', 'Tarjeta Empresarial', 10),
        ('metodos_pago', 'bonos', 'Bonos', 11),
        ('metodos_pago', 'vales', 'Vales', 12),
        ('metodos_pago', 'otro', 'Otro', 13),
        ('movimientos_tipo', 'ingreso', 'Ingreso', 1),
        ('movimientos_tipo', 'retiro', 'Retiro', 2),
        ('movimientos_tipo', 'deposito', 'Depósito', 3),
        ('origenes_orden', 'pos', 'POS', 1),
        ('origenes_orden', 'hugo', 'Hugo', 2),
        ('origenes_orden', 'pedidosya', 'PedidosYa', 3),
        ('origenes_orden', 'ubereats', 'Uber Eats', 4),
        ('origenes_orden', 'whatsapp', 'WhatsApp', 5),
        ('origenes_orden', 'telefono', 'Teléfono', 6),
        ('origenes_orden', 'otro', 'Otro', 7),
        ('tipos_orden', 'rapido', 'Rápido', 1),
        ('tipos_orden', 'mesa', 'Mesa', 2),
        ('tipos_orden', 'delivery', 'Delivery', 3),
        ('estados_orden', 'abierta', 'Abierta', 1),
        ('estados_orden', 'en_proceso', 'En Proceso', 2),
        ('estados_orden', 'lista', 'Lista', 3),
        ('estados_orden', 'entregada', 'Entregada', 4),
        ('estados_orden', 'pagada', 'Pagada', 5),
        ('estados_orden', 'cancelada', 'Cancelada', 6),
        ('estados_item', 'pendiente', 'Pendiente', 1),
        ('estados_item', 'en_proceso', 'En Proceso', 2),
        ('estados_item', 'listo', 'Listo', 3),
        ('estados_item', 'cancelado', 'Cancelado', 4),
        ('estados_caja', 'abierta', 'Abierta', 1),
        ('estados_caja', 'cerrada', 'Cerrada', 2),
        ('tipos_ajuste_stock', 'suma', 'Sumar', 1),
        ('tipos_ajuste_stock', 'resta', 'Restar', 2),
        ('tipos_ajuste_stock', 'absoluto', 'Fijar', 3),
        ('tipos_movimiento_inventario', 'compra', 'Compra', 1),
        ('tipos_movimiento_inventario', 'ajuste', 'Ajuste', 2),
        ('tipos_movimiento_inventario', 'merma', 'Merma', 3),
        ('tipos_movimiento_inventario', 'devolucion', 'Devolución', 4),
        ('tipos_movimiento_inventario', 'consumo', 'Consumo', 5)
    ) AS v(grupo, valor, label, orden)
    ON CONFLICT (tenant_id, grupo, valor) DO NOTHING;
$$;

-- ─────────────────────────────────────────────
-- 5. Permisos de inventario
-- ─────────────────────────────────────────────
INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    ('inventario.ver',       'Ver inventario',       'Ver movimientos, resumen y alertas de inventario', 'inventario'),
    ('inventario.gestionar', 'Gestionar inventario', 'Crear movimientos de inventario (entradas/salidas/ajustes)', 'inventario')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
    ('administrador', 'inventario.ver',       'true'),
    ('administrador', 'inventario.gestionar', 'true'),
    ('gerente',       'inventario.ver',       'true'),
    ('gerente',       'inventario.gestionar', 'true'),
    ('cajero',        'inventario.ver',       'false'),
    ('cajero',        'inventario.gestionar', 'false'),
    ('mesero',        'inventario.ver',       'false'),
    ('mesero',        'inventario.gestionar', 'false'),
    ('cocinero',      'inventario.ver',       'false'),
    ('cocinero',      'inventario.gestionar', 'false')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
SELECT d.rol, d.permiso_id, t.id, d.activo
FROM permisos_default d
CROSS JOIN tenants t
WHERE EXISTS (SELECT 1 FROM permisos p WHERE p.id = d.permiso_id AND p.codigo IN ('inventario.ver', 'inventario.gestionar'))
ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 6. Menú "Inventario" bajo Administración
-- ─────────────────────────────────────────────
INSERT INTO menus (id, tenant_id, titulo, icono, ruta, orden, permiso_codigo, parent_id, activo)
SELECT
    gen_random_uuid(),
    t.id,
    'Inventario',
    'clipboard-list',
    '/admin/inventario',
    8,
    'inventario.ver',
    (SELECT m.id FROM menus m WHERE m.tenant_id = t.id AND m.titulo = 'Administración' LIMIT 1),
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM menus m WHERE m.tenant_id = t.id AND m.ruta = '/admin/inventario'
)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
