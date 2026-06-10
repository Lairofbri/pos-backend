-- =============================================
-- Migración 012: Multi-tenant en usuarios
-- POS Restaurante — El Salvador
-- =============================================
-- Asegura que el email sea único dentro de cada
-- tenant (no global). Misma empresa no puede
-- tener dos usuarios con el mismo email, pero
-- empresas distintas sí pueden.
-- =============================================

-- Eliminar índice viejo (global, no único)
DROP INDEX IF EXISTS idx_usuarios_email;

-- Nuevo índice único por tenant — email único DENTRO del mismo tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_tenant
  ON usuarios(tenant_id, email)
  WHERE email IS NOT NULL;

-- Índice compuesto para login por tenant_id + email (rápido)
CREATE INDEX IF NOT EXISTS idx_usuarios_login
  ON usuarios(tenant_id, email)
  WHERE activo = TRUE;

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
