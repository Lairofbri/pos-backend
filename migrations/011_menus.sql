-- =============================================
-- Migración 011: Menú dinámico (sidebar)
-- POS Restaurante — El Salvador
-- =============================================
-- Estructura jerárquica de menús y submenús,
-- configurable por tenant y filtrable por
-- permisos del usuario.
-- =============================================

CREATE TABLE IF NOT EXISTS menus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES menus(id) ON DELETE CASCADE,
  titulo          VARCHAR(100) NOT NULL,
  icono           VARCHAR(50),
  ruta            VARCHAR(200),
  orden           INT DEFAULT 0,
  activo          BOOLEAN DEFAULT TRUE,
  permiso_codigo  VARCHAR(100),
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menus_tenant
  ON menus(tenant_id, activo, orden);

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
