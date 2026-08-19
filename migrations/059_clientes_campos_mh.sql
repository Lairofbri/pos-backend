-- =============================================
-- Migración 059: Ampliar clientes para MH
-- Agrega campos requeridos por Hacienda: tipo_cliente, actividad económica
-- =============================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_cliente VARCHAR(20) DEFAULT 'natural'
    CHECK (tipo_cliente IN ('natural', 'juridico')),
  ADD COLUMN IF NOT EXISTS cod_actividad VARCHAR(6),
  ADD COLUMN IF NOT EXISTS desc_actividad VARCHAR(300);

-- FK opcionales a catálogos MH (sin constraint para evitar errores si catálogo no existe aún)
CREATE INDEX IF NOT EXISTS idx_clientes_depto ON clientes(tenant_id, departamento);
CREATE INDEX IF NOT EXISTS idx_clientes_muni ON clientes(tenant_id, municipio);

-- ─────────────────────────────────────────────
-- Seed: Cliente por defecto "Consumidor Final"
-- Datos mínimos requeridos por Hacienda para FCF
-- Son datos genéricos, no representan a una persona real
-- ─────────────────────────────────────────────
INSERT INTO clientes (id, tenant_id, nombre, tipo_documento, numero_documento, tipo_cliente, direccion, departamento, municipio, telefono)
VALUES (
  'cf000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'Consumidor Final',
  'otro',
  '00000000-0',
  'natural',
  'San Salvador',
  'San Salvador',
  'San Salvador',
  '0000-0000'
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  tipo_documento = EXCLUDED.tipo_documento,
  numero_documento = EXCLUDED.numero_documento,
  direccion = EXCLUDED.direccion,
  departamento = EXCLUDED.departamento,
  municipio = EXCLUDED.municipio,
  telefono = EXCLUDED.telefono;

-- =============================================
-- FIN DE MIGRACIÓN
-- =============================================
