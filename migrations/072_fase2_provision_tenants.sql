-- =============================================
-- Migración 072: Fase 2 — Provisión de empresas POS ↔ DTE
-- Spec: Provisión y sincronización POS-DTE
--
-- 1. tenants: fiscal_sync_status, last_fiscal_sync_at (proyección operativa)
-- 2. usuarios.rol: agrega 'plataforma' (onboarding)
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Estado fiscal del tenant en POS (proyección)
-- POS es proyección operativa: el estado lo confirma el DTE Service.
-- ─────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS fiscal_sync_status VARCHAR(20)
    NOT NULL DEFAULT 'pending_fiscal_setup';

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_fiscal_sync_status_check;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_fiscal_sync_status_check
  CHECK (fiscal_sync_status IN (
    'provisioning', 'pending_fiscal_setup', 'active', 'blocked', 'failed'
  ));

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS last_fiscal_sync_at TIMESTAMPTZ;

-- Backfill: los tenants existentes ya operan → activos.
UPDATE tenants
SET fiscal_sync_status = 'active'
WHERE fiscal_sync_status = 'pending_fiscal_setup';

-- ─────────────────────────────────────────────
-- 2. Rol de plataforma (onboarding / alta de empresas)
-- ─────────────────────────────────────────────
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('administrador', 'cajero', 'mesero', 'gerente', 'cocinero', 'plataforma'));

-- ─────────────────────────────────────────────
-- ROLLBACK (manual si fuera necesario):
--   ALTER TABLE tenants DROP COLUMN IF EXISTS fiscal_sync_status;
--   ALTER TABLE tenants DROP COLUMN IF EXISTS last_fiscal_sync_at;
--   ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
--   ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
--     CHECK (rol IN ('administrador', 'cajero', 'mesero', 'gerente', 'cocinero'));
-- ─────────────────────────────────────────────