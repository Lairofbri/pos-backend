-- =============================================
-- Migración 062: Fase 3 — Idempotencia y consistencia fiscal DTE
-- Garantiza que una orden no genere más de un DTE por tipo,
-- registra estados fiscales explícitos y permite el reclamo
-- atómico de pendientes por múltiples instancias.
-- =============================================
-- NOTA: Ejecutar primero sobre una base de PRUEBAS.
-- Si existe más de un registro en dtes_orden para la misma
-- combinación (tenant_id, orden_id, tipo_dte), el índice único
-- fallará. Revisar y sanear duplicados antes de producción.

-- ─────────────────────────────────────────────
-- 1) dte_pendientes: clave idempotente tenant + orden + tipo
--    Reemplaza el UNIQUE(orden_id) por UNIQUE(tenant_id, orden_id, tipo_dte)
-- ─────────────────────────────────────────────
DROP INDEX IF EXISTS idx_dte_pendientes_orden;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dte_pendientes_idempotente
  ON dte_pendientes(tenant_id, orden_id, tipo_dte);

-- ─────────────────────────────────────────────
-- 2) dtes_orden: estados fiscales explícitos
--    pendiente | generando | firmado | enviado
--    aceptado  | rechazado | contingencia | anulado
-- ─────────────────────────────────────────────
ALTER TABLE dtes_orden
  DROP CONSTRAINT IF EXISTS dtes_orden_estado_check;

ALTER TABLE dtes_orden
  ADD CONSTRAINT dtes_orden_estado_check
  CHECK (estado IN (
    'pendiente', 'generando', 'firmado', 'enviado',
    'aceptado', 'rechazado', 'contingencia', 'anulado'
  ));

-- ─────────────────────────────────────────────
-- 3) ordenes.dte_estado: mismos estados fiscales explícitos
-- ─────────────────────────────────────────────
ALTER TABLE ordenes
  DROP CONSTRAINT IF EXISTS ordenes_dte_estado_check;

ALTER TABLE ordenes
  ADD CONSTRAINT ordenes_dte_estado_check
  CHECK (dte_estado IS NULL OR dte_estado IN (
    'pendiente', 'generando', 'firmado', 'enviado',
    'aceptado', 'rechazado', 'contingencia', 'anulado'
  ));

-- ─────────────────────────────────────────────
-- 4) Un único DTE emitido por (tenant, orden, tipo)
-- ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_dtes_orden_tenant_orden_tipo
  ON dtes_orden(tenant_id, orden_id, tipo_dte);