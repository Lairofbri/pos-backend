-- =============================================
-- Migración 002: Productos y Catálogo
-- POS Restaurante — El Salvador
-- =============================================

-- ─────────────────────────────────────────────
-- TABLA: categorias
-- Agrupa los productos del menú
-- Ej: Entradas, Platos fuertes, Bebidas, Postres
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre        VARCHAR(100) NOT NULL,
  descripcion   VARCHAR(255),
  -- Orden de aparición en el POS (1 aparece primero)
  orden         SMALLINT DEFAULT 0,
  -- Color opcional para identificar visualmente en el POS
  color         VARCHAR(7),                -- Hex: #FF5733
  activo        BOOLEAN DEFAULT TRUE,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  -- Un tenant no puede tener dos categorías con el mismo nombre
  UNIQUE(tenant_id, nombre)
);

-- ─────────────────────────────────────────────
-- TABLA: productos
-- Cada ítem del menú que se puede vender
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categoria_id    UUID REFERENCES categorias(id) ON DELETE SET NULL,
  -- Datos del producto
  nombre          VARCHAR(150) NOT NULL,
  descripcion     VARCHAR(500),
  precio          NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
  -- Imagen almacenada en S3/R2 (módulo futuro)
  imagen_url      VARCHAR(500),
  -- Control de inventario básico (opcional por producto)
  tiene_stock     BOOLEAN DEFAULT FALSE,   -- Si FALSE, siempre disponible
  stock_actual    INTEGER DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo    INTEGER DEFAULT 0,       -- Alerta cuando baje de este nivel
  -- Código interno opcional (para productos con código de barras)
  codigo          VARCHAR(50),
  -- Disponibilidad en el POS
  activo          BOOLEAN DEFAULT TRUE,
  -- Orden dentro de su categoría
  orden           SMALLINT DEFAULT 0,
  -- Auditoría
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW(),
  -- Un tenant no puede tener dos productos con el mismo nombre
  UNIQUE(tenant_id, nombre)
);

-- ─────────────────────────────────────────────
-- ÍNDICES para rendimiento
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_categorias_tenant   ON categorias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categorias_activo   ON categorias(tenant_id, activo);
CREATE INDEX IF NOT EXISTS idx_productos_tenant    ON productos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo    ON productos(tenant_id, activo);
CREATE INDEX IF NOT EXISTS idx_productos_stock     ON productos(tenant_id, tiene_stock, stock_actual);

-- ─────────────────────────────────────────────
-- TRIGGERS: auto-actualizar updated_at
-- ─────────────────────────────────────────────
CREATE TRIGGER trigger_categorias_updated
  BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_productos_updated
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ─────────────────────────────────────────────
-- DATOS INICIALES: Categorías y productos demo
-- ─────────────────────────────────────────────
INSERT INTO categorias (id, tenant_id, nombre, orden, color) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Entradas',       1, '#FF6B6B'),
  ('c1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Platos fuertes', 2, '#4ECDC4'),
  ('c1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Bebidas',        3, '#45B7D1'),
  ('c1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Postres',        4, '#96CEB4')
ON CONFLICT DO NOTHING;

INSERT INTO productos (tenant_id, categoria_id, nombre, precio, orden) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Sopa del día',       3.50, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Ensalada mixta',     4.00, 2),
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Pollo a la plancha', 8.50, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Carne asada',       12.00, 2),
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Pasta al pesto',     7.50, 3),
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Agua natural',       1.00, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Refresco',           1.50, 2),
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Jugo natural',       2.50, 3),
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'Flan',               2.50, 1),
  ('a0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'Pastel del día',     3.00, 2)
ON CONFLICT DO NOTHING;
