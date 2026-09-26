-- Fase 0: campos de contención para evitar emisión sin vínculo fiscal.
-- La relación fiscal se completa en fases posteriores; mientras tanto toda
-- sucursal queda bloqueada por defecto con estado pending_link.

ALTER TABLE sucursales
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS dte_establecimiento_id UUID,
  ADD COLUMN IF NOT EXISTS fiscal_status VARCHAR(20) NOT NULL DEFAULT 'pending_link',
  ADD COLUMN IF NOT EXISTS last_fiscal_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

UPDATE sucursales
SET fiscal_status = 'pending_link'
WHERE fiscal_status IS NULL;

ALTER TABLE sucursales
  ALTER COLUMN fiscal_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sucursales_fiscal_status_check'
      AND conrelid = 'sucursales'::regclass
  ) THEN
    ALTER TABLE sucursales
      ADD CONSTRAINT sucursales_fiscal_status_check
      CHECK (fiscal_status IN ('pending_link', 'pending_mh_data', 'ready', 'inactive', 'blocked'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sucursales_tenant_branch_id
  ON sucursales (tenant_id, branch_id)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sucursales_tenant_fiscal_status
  ON sucursales (tenant_id, fiscal_status);
