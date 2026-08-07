-- =============================================
-- Migración 053: Sesiones de inventario físico (H11)
-- =============================================

-- Tabla de sesiones de inventario físico
CREATE TABLE IF NOT EXISTS inventario_sesiones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    sucursal_id     UUID REFERENCES sucursales(id),
    estado          VARCHAR(20) NOT NULL DEFAULT 'abierta'
                        CHECK (estado IN ('abierta', 'cerrada', 'cancelada')),
    notas           VARCHAR(500),
    stock_snapshot  JSONB NOT NULL DEFAULT '{}',
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_por     UUID REFERENCES usuarios(id),
    cerrado_en      TIMESTAMPTZ
);

-- Una sola sesión abierta por sucursal
CREATE UNIQUE INDEX IF NOT EXISTS idx_sesion_abierta_por_sucursal
    ON inventario_sesiones (tenant_id, sucursal_id)
    WHERE estado = 'abierta';

-- Índice de búsqueda por tenant
CREATE INDEX IF NOT EXISTS idx_sesiones_tenant_estado
    ON inventario_sesiones (tenant_id, estado, creado_en DESC);

-- Tabla de conteos individuales
CREATE TABLE IF NOT EXISTS inventario_conteos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id         UUID NOT NULL REFERENCES inventario_sesiones(id) ON DELETE CASCADE,
    producto_id       UUID NOT NULL,
    stock_sistema     NUMERIC(14,4) NOT NULL,
    stock_fisico      NUMERIC(14,4) NOT NULL,
    unidad_medida_id  UUID REFERENCES unidades_medida(id),
    cantidad_input    NUMERIC(14,4),
    unidad_input_id   UUID REFERENCES unidades_medida(id),
    contado_por       UUID REFERENCES usuarios(id),
    contado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aplicado          BOOLEAN NOT NULL DEFAULT FALSE,
    ignorado          BOOLEAN NOT NULL DEFAULT FALSE
);

-- La validación de tenant se hace vía JOIN en queries
-- y la FK de sesion_id → inventario_sesiones.tenant_id.

-- Upsert: un solo conteo por producto dentro de una sesión
CREATE UNIQUE INDEX IF NOT EXISTS idx_conteo_sesion_producto
    ON inventario_conteos (sesion_id, producto_id);

CREATE INDEX IF NOT EXISTS idx_conteos_sesion
    ON inventario_conteos (sesion_id);

-- Columna para vincular movimientos de ajuste a la sesión
ALTER TABLE movimientos_inventario
    ADD COLUMN IF NOT EXISTS sesion_id UUID REFERENCES inventario_sesiones(id);

CREATE INDEX IF NOT EXISTS idx_movimientos_sesion
    ON movimientos_inventario (sesion_id) WHERE sesion_id IS NOT NULL;

-- Permisos para sesiones de inventario
-- NOTA: sesiones usa los permisos inventario.gestionar (crear, cerrar, conteo) e inventario.ver (listar, detalle) existentes.
-- No se crean nuevos permisos. Si inventario.gestionar no existe, se crea aquí:

INSERT INTO permisos (id, tenant_id, codigo, nombre, descripcion, modulo, activo)
SELECT
    gen_random_uuid(),
    t.id,
    'inventario.gestionar',
    'Gestionar inventario',
    'Registrar movimientos, conteos y sesiones de inventario',
    'inventario',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.tenant_id = t.id AND p.codigo = 'inventario.gestionar'
);

INSERT INTO permisos (id, tenant_id, codigo, nombre, descripcion, modulo, activo)
SELECT
    gen_random_uuid(),
    t.id,
    'inventario.ver',
    'Ver inventario',
    'Ver resumen, movimientos, sesiones y kardex de inventario',
    'inventario',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.tenant_id = t.id AND p.codigo = 'inventario.ver'
);
