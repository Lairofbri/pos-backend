-- Fase 5: contexto fiscal persistido por DTE emitido.
-- Permite a la anulación (y cualquier operación posterior) conservar el
-- establecimiento original del DTE aunque la sucursal cambie de vínculo.

ALTER TABLE dtes_orden
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS dte_establecimiento_id UUID;

CREATE INDEX IF NOT EXISTS idx_dtes_orden_tenant_establecimiento
  ON dtes_orden (tenant_id, dte_establecimiento_id);