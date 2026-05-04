-- =============================================
-- Migración 001: Autenticación y Multi-tenant
-- POS Restaurante — El Salvador
-- =============================================
-- Ejecutar con: psql $DATABASE_URL -f migrations/001_init_auth.sql
-- O usar: node src/migrations/run.js

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- TABLA: tenants
-- Un tenant = un restaurante (o futura cadena)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        VARCHAR(100) NOT NULL,
  -- Identificación fiscal El Salvador
  nit           VARCHAR(20) UNIQUE,          -- NIT del negocio
  nrc           VARCHAR(20) UNIQUE,          -- NRC (si aplica para CCF)
  direccion     VARCHAR(255),
  telefono      VARCHAR(20),
  email         VARCHAR(100),
  logo_url      VARCHAR(500),                -- URL a S3/R2 (módulo futuro)
  -- Plan / suscripción (para monetización futura)
  plan          VARCHAR(20) DEFAULT 'basico' CHECK (plan IN ('basico', 'pro', 'enterprise')),
  activo        BOOLEAN DEFAULT TRUE,
  -- Control de auditoría
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: sucursales
-- Una sucursal pertenece a un tenant
-- Dejamos la estructura lista para el futuro
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sucursales (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre        VARCHAR(100) NOT NULL,       -- Ej: "Sucursal Centro", "Sucursal Norte"
  direccion     VARCHAR(255),
  telefono      VARCHAR(20),
  es_principal  BOOLEAN DEFAULT FALSE,       -- Sucursal matriz del tenant
  activo        BOOLEAN DEFAULT TRUE,
  creado_en     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: usuarios
-- Roles: administrador, cajero, mesero
-- El PIN es para el login rápido en estaciones POS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sucursal_id     UUID REFERENCES sucursales(id) ON DELETE SET NULL,  -- Asignación a sucursal (opcional)
  -- Datos de identidad
  nombre          VARCHAR(100) NOT NULL,
  apellido        VARCHAR(100),
  email           VARCHAR(150) UNIQUE,       -- Para login web del admin (puede ser NULL para cajeros/meseros)
  -- Autenticación
  password_hash   VARCHAR(255),              -- Hash bcrypt — para login web
  pin_hash        VARCHAR(255) NOT NULL,     -- Hash bcrypt del PIN de 4-6 dígitos — login rápido estación
  -- Rol y permisos
  rol             VARCHAR(20) NOT NULL DEFAULT 'cajero'
                  CHECK (rol IN ('administrador', 'cajero', 'mesero')),
  -- Estado
  activo          BOOLEAN DEFAULT TRUE,
  -- Seguridad: registro de intentos fallidos de PIN
  intentos_pin    SMALLINT DEFAULT 0,
  bloqueado_hasta TIMESTAMPTZ,               -- NULL = no bloqueado
  -- Último acceso
  ultimo_acceso   TIMESTAMPTZ,
  -- Auditoría
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: refresh_tokens
-- Permite invalidar sesiones específicas
-- (útil cuando se pierde un dispositivo o cambia el PIN)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255) NOT NULL UNIQUE,  -- SHA-256 del refresh token
  dispositivo   VARCHAR(255),                  -- Ej: "Estación POS 1 - Windows 11"
  ip_origen     INET,
  activo        BOOLEAN DEFAULT TRUE,
  expira_en     TIMESTAMPTZ NOT NULL,
  creado_en     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ÍNDICES para rendimiento
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant     ON usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email      ON usuarios(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_rol        ON usuarios(tenant_id, rol);
CREATE INDEX IF NOT EXISTS idx_sucursales_tenant   ON sucursales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tenant      ON refresh_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refresh_usuario     ON refresh_tokens(usuario_id);

-- ─────────────────────────────────────────────
-- FUNCIÓN y TRIGGER: auto-actualizar updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenants_updated
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trigger_usuarios_updated
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ─────────────────────────────────────────────
-- DATOS INICIALES: Tenant y Admin de demostración
-- CAMBIAR antes de ir a producción
-- ─────────────────────────────────────────────
-- PIN de demo: 1234 (hash bcrypt del string '1234')
-- Password de demo: Admin123! (hash bcrypt)
-- En producción estos datos se crean vía panel de administración

INSERT INTO tenants (id, nombre, nit, plan)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Restaurante Demo',
  '0000-000000-000-0',
  'pro'
) ON CONFLICT DO NOTHING;

INSERT INTO sucursales (id, tenant_id, nombre, es_principal)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Sucursal Principal',
  TRUE
) ON CONFLICT DO NOTHING;

-- Nota: los hashes reales se generan al ejecutar el seeder de Node.js
-- Este INSERT es solo para referencia de estructura
-- Ver: src/migrations/seed.js

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
