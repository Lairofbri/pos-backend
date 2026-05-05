-- =============================================
-- Migración 004: Clientes
-- POS Restaurante — El Salvador
-- =============================================

-- ─────────────────────────────────────────────
-- TABLA: clientes
-- Registro de clientes para CCF y delivery
-- El uso es opcional — la mayoría de ventas
-- son consumidor final sin cliente registrado
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Datos personales
  nombre          VARCHAR(100) NOT NULL,
  apellido        VARCHAR(100),
  telefono        VARCHAR(20),
  email           VARCHAR(150),

  -- Tipo y número de documento de identidad
  tipo_documento  VARCHAR(20) DEFAULT 'dui'
                  CHECK (tipo_documento IN ('dui', 'nit', 'pasaporte', 'carnet_residente')),
  numero_documento VARCHAR(20),              -- Número del documento seleccionado

  -- Datos fiscales El Salvador
  -- Requeridos para emitir Crédito Fiscal (CCF)
  nit             VARCHAR(20),              -- NIT del contribuyente (persona natural o jurídica)
  nrc             VARCHAR(20),              -- NRC (solo contribuyentes registrados)
  razon_social    VARCHAR(200),             -- Nombre de la empresa (persona jurídica)

  -- Dirección — requerida para delivery y documentos fiscales
  direccion       VARCHAR(255),
  municipio       VARCHAR(100),
  departamento    VARCHAR(100),

  -- Control
  activo          BOOLEAN DEFAULT TRUE,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  -- NIT único por tenant (no puede haber dos clientes con el mismo NIT)
  UNIQUE(tenant_id, nit),
  -- NRC único por tenant
  UNIQUE(tenant_id, nrc),
  -- UNIQUE compuesto requerido para FK tenant-safe en otras tablas
  UNIQUE(id, tenant_id)
);

-- ─────────────────────────────────────────────
-- ÍNDICES para búsqueda rápida desde el POS
-- El cajero busca por nombre, NIT o DUI
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_tenant   ON clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nit      ON clientes(tenant_id, nit) WHERE nit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_nrc      ON clientes(tenant_id, nrc) WHERE nrc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_nombre   ON clientes(tenant_id, nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(tenant_id, numero_documento) WHERE numero_documento IS NOT NULL;

-- ─────────────────────────────────────────────
-- TRIGGER: auto-actualizar updated_at
-- ─────────────────────────────────────────────
CREATE TRIGGER trigger_clientes_updated
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ─────────────────────────────────────────────
-- FK en ordenes → clientes (tenant-safe)
-- Se agrega aquí porque clientes se crea después de ordenes
-- ─────────────────────────────────────────────
ALTER TABLE ordenes
  ADD CONSTRAINT fk_ordenes_cliente_tenant
  FOREIGN KEY (cliente_id, tenant_id)
  REFERENCES clientes(id, tenant_id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
