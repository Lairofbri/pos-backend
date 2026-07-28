-- =============================================
-- Migración 038: Recetas, unidades de medida e inventario extendido
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Tabla unidades_medida
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unidades_medida (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id),
    nombre        VARCHAR(50) NOT NULL,
    abreviatura   VARCHAR(10) NOT NULL,
    categoria     VARCHAR(20) NOT NULL CHECK (categoria IN ('masa', 'volumen', 'unidad')),
    factor        NUMERIC(12,4) NOT NULL CHECK (factor > 0),
    activo        BOOLEAN DEFAULT TRUE,
    UNIQUE(tenant_id, abreviatura)
);

INSERT INTO unidades_medida (id, tenant_id, nombre, abreviatura, categoria, factor)
SELECT
    gen_random_uuid(), t.id, v.nombre, v.abreviatura, v.categoria, v.factor
FROM tenants t
CROSS JOIN (VALUES
    ('Gramo',        'g',   'masa',     1),
    ('Kilogramo',    'kg',  'masa',     1000),
    ('Libra',        'lb',  'masa',     453.5924),
    ('Mililitro',    'ml',  'volumen',  1),
    ('Litro',        'L',   'volumen',  1000),
    ('Onza líquida', 'oz',  'volumen',  29.5735),
    ('Unidad',       'ud',  'unidad',   1),
    ('Docena',       'doc', 'unidad',   12)
) AS v(nombre, abreviatura, categoria, factor)
ON CONFLICT (tenant_id, abreviatura) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. Modificaciones a productos
-- ─────────────────────────────────────────────
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS se_vende         BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS tiene_receta     BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS unidad_medida_id UUID REFERENCES unidades_medida(id);

ALTER TABLE productos
    ALTER COLUMN stock_actual TYPE NUMERIC(14,4);

ALTER TABLE productos
    DROP CONSTRAINT IF EXISTS productos_stock_actual_check;

-- ─────────────────────────────────────────────
-- 3. Tabla recetas (1:1 con producto compuesto)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recetas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    producto_id     UUID NOT NULL UNIQUE REFERENCES productos(id),
    rendimiento     INTEGER NOT NULL DEFAULT 1 CHECK (rendimiento >= 1),
    instrucciones   TEXT,
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recetas_tenant ON recetas(tenant_id);

DROP TRIGGER IF EXISTS trigger_recetas_updated ON recetas;
CREATE TRIGGER trigger_recetas_updated
    BEFORE UPDATE ON recetas
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ─────────────────────────────────────────────
-- 4. Tabla receta_ingredientes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receta_ingredientes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receta_id         UUID NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
    ingrediente_id    UUID NOT NULL REFERENCES productos(id),
    cantidad          NUMERIC(12,4) NOT NULL CHECK (cantidad > 0),
    unidad_medida_id  UUID NOT NULL REFERENCES unidades_medida(id),
    preparacion       VARCHAR(100),
    creado_en         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(receta_id, ingrediente_id)
);

CREATE INDEX IF NOT EXISTS idx_receta_ingredientes_receta
    ON receta_ingredientes(receta_id);

-- ─────────────────────────────────────────────
-- 5. Modificaciones a movimientos_inventario
-- ─────────────────────────────────────────────
ALTER TABLE movimientos_inventario
    ALTER COLUMN cantidad TYPE NUMERIC(14,4);

ALTER TABLE movimientos_inventario
    ADD COLUMN IF NOT EXISTS unidad_medida_id  UUID REFERENCES unidades_medida(id),
    ADD COLUMN IF NOT EXISTS cantidad_input    NUMERIC(14,4),
    ADD COLUMN IF NOT EXISTS unidad_input_id   UUID REFERENCES unidades_medida(id);

-- ─────────────────────────────────────────────
-- 6. Permisos recetas
-- ─────────────────────────────────────────────
INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    ('recetas.ver',       'Ver recetas',       'Ver recetas e ingredientes de los platillos', 'recetas'),
    ('recetas.gestionar', 'Gestionar recetas', 'Crear, editar y eliminar recetas e ingredientes', 'recetas')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
    ('administrador', 'recetas.ver',       'true'),
    ('administrador', 'recetas.gestionar', 'true'),
    ('gerente',       'recetas.ver',       'true'),
    ('gerente',       'recetas.gestionar', 'true'),
    ('cajero',        'recetas.ver',       'false'),
    ('cajero',        'recetas.gestionar', 'false'),
    ('mesero',        'recetas.ver',       'false'),
    ('mesero',        'recetas.gestionar', 'false'),
    ('cocinero',      'recetas.ver',       'true'),
    ('cocinero',      'recetas.gestionar', 'false')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
SELECT d.rol, d.permiso_id, t.id, d.activo
FROM permisos_default d
CROSS JOIN tenants t
WHERE EXISTS (SELECT 1 FROM permisos p WHERE p.id = d.permiso_id AND p.codigo IN ('recetas.ver', 'recetas.gestionar'))
ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 7. Menú Recetas bajo Administración
-- ─────────────────────────────────────────────
INSERT INTO menus (id, tenant_id, titulo, icono, ruta, orden, permiso_codigo, parent_id, activo)
SELECT
    gen_random_uuid(),
    t.id,
    'Recetas',
    'book-open',
    '/admin/recetas',
    9,
    'recetas.ver',
    (SELECT m.id FROM menus m WHERE m.tenant_id = t.id AND m.titulo = 'Administración' LIMIT 1),
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM menus m WHERE m.tenant_id = t.id AND m.ruta = '/admin/recetas'
)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 8. Actualizar sp_sembrar_catalogos_tenant (agregar tipos_movimiento_inventario si falta)
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
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
