-- =============================================
-- Migración 003: POS — Mesas, Órdenes, Items y Pagos
-- POS Restaurante — El Salvador
-- =============================================

-- ─────────────────────────────────────────────
-- TABLA: mesas
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sucursal_id   UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  numero        VARCHAR(10) NOT NULL,
  nombre        VARCHAR(50),
  capacidad     SMALLINT DEFAULT 4 CHECK (capacidad > 0),
  estado        VARCHAR(20) DEFAULT 'disponible'
                CHECK (estado IN ('disponible', 'ocupada', 'reservada', 'inactiva')),
  activo        BOOLEAN DEFAULT TRUE,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, numero),
  -- Requerido para FK compuesto tenant-safe en ordenes
  UNIQUE(id, tenant_id)
);

-- ─────────────────────────────────────────────
-- TABLA: ordenes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordenes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sucursal_id     UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  tipo            VARCHAR(20) NOT NULL DEFAULT 'rapido'
                  CHECK (tipo IN ('rapido', 'mesa', 'delivery')),
  estado          VARCHAR(20) NOT NULL DEFAULT 'abierta'
                  CHECK (estado IN ('abierta', 'en_proceso', 'lista', 'entregada', 'pagada', 'cancelada')),
  mesa_id         UUID,
  -- FK compuesto tenant-safe: garantiza que la mesa pertenece al mismo tenant
  FOREIGN KEY (mesa_id, tenant_id)
    REFERENCES mesas(id, tenant_id)
    ON DELETE SET NULL,
  cliente_id      UUID,
  usuario_id      UUID NOT NULL REFERENCES usuarios(id),
  -- Correlativo por tenant (no SERIAL global — ese mezclaría tenants)
  numero_orden    INTEGER NOT NULL DEFAULT 0,
  subtotal        NUMERIC(10,2) DEFAULT 0 CHECK (subtotal >= 0),
  porcentaje_descuento NUMERIC(5,2) DEFAULT 0
                  CHECK (porcentaje_descuento >= 0 AND porcentaje_descuento <= 100),
  descuento       NUMERIC(10,2) DEFAULT 0 CHECK (descuento >= 0),
  total           NUMERIC(10,2) DEFAULT 0 CHECK (total >= 0),
  -- Desglose IVA 13% El Salvador (precios incluyen IVA)
  gravado         NUMERIC(10,2) DEFAULT 0 CHECK (gravado >= 0),
  iva             NUMERIC(10,2) DEFAULT 0 CHECK (iva >= 0),
  notas           VARCHAR(500),
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW(),
  cerrado_en      TIMESTAMPTZ
);

-- Función para correlativo de orden por tenant
-- Cada tenant tiene su propia secuencia: 1, 2, 3...
CREATE OR REPLACE FUNCTION generar_numero_orden()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(numero_orden), 0) + 1
  INTO NEW.numero_orden
  FROM ordenes
  WHERE tenant_id = NEW.tenant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_numero_orden
  BEFORE INSERT ON ordenes
  FOR EACH ROW EXECUTE FUNCTION generar_numero_orden();

-- ─────────────────────────────────────────────
-- TABLA: orden_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orden_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id          UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producto_id       UUID,
  -- FK compuesto tenant-safe: garantiza que el producto pertenece al mismo tenant
  -- Requiere UNIQUE(id, tenant_id) en productos — aplicado en 002b
  FOREIGN KEY (producto_id, tenant_id)
    REFERENCES productos(id, tenant_id)
    ON DELETE SET NULL,
  -- Snapshot del nombre y precio al momento de la venta
  -- El historial no cambia aunque el producto cambie de precio después
  nombre_producto   VARCHAR(150) NOT NULL,
  precio_unitario   NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  cantidad          SMALLINT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  estado            VARCHAR(20) DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'en_proceso', 'listo', 'cancelado')),
  notas             VARCHAR(255),
  creado_en         TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: pagos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id        UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metodo          VARCHAR(20) NOT NULL
                  CHECK (metodo IN ('efectivo', 'tarjeta', 'mixto')),
  monto_efectivo  NUMERIC(10,2) DEFAULT 0 CHECK (monto_efectivo >= 0),
  monto_tarjeta   NUMERIC(10,2) DEFAULT 0 CHECK (monto_tarjeta >= 0),
  total_pagado    NUMERIC(10,2) NOT NULL CHECK (total_pagado >= 0),
  vuelto          NUMERIC(10,2) DEFAULT 0 CHECK (vuelto >= 0),
  referencia_tarjeta VARCHAR(50),
  usuario_id      UUID NOT NULL REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mesas_tenant        ON mesas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mesas_estado        ON mesas(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_tenant      ON ordenes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado      ON ordenes(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_mesa        ON ordenes(mesa_id) WHERE mesa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ordenes_usuario     ON ordenes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_fecha       ON ordenes(tenant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_orden_items_orden   ON orden_items(orden_id);
CREATE INDEX IF NOT EXISTS idx_orden_items_tenant  ON orden_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pagos_orden         ON pagos(orden_id);
CREATE INDEX IF NOT EXISTS idx_pagos_tenant        ON pagos(tenant_id);

-- ─────────────────────────────────────────────
-- TRIGGERS updated_at
-- ─────────────────────────────────────────────
CREATE TRIGGER trigger_mesas_updated
  BEFORE UPDATE ON mesas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_ordenes_updated
  BEFORE UPDATE ON ordenes
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_orden_items_updated
  BEFORE UPDATE ON orden_items
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ─────────────────────────────────────────────
-- DATOS INICIALES: Mesas demo
-- ─────────────────────────────────────────────
INSERT INTO mesas (tenant_id, sucursal_id, numero, nombre, capacidad) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '1',  'Mesa 1',  4),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2',  'Mesa 2',  4),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '3',  'Mesa 3',  6),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '4',  'Mesa 4',  2),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '5',  'Mesa 5',  8),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'B1', 'Barra 1', 2),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'B2', 'Barra 2', 2)
ON CONFLICT DO NOTHING;
