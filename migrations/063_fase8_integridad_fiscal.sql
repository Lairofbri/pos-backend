-- Migración 063: Fase 8 - integridad fiscal e idempotencia tenant-scoped
-- NO ejecutar directamente en producción.
-- Ejecutar primero en una base de pruebas y revisar todos los prechecks.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dtes_orden
    GROUP BY tenant_id, orden_id, tipo_dte
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existen DTEs duplicados por tenant, orden y tipo.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM dte_pendientes
    WHERE payload ? 'password_pri' OR payload ? 'passwordPri'
  ) THEN
    RAISE EXCEPTION 'Existen secretos en dte_pendientes. Sanear antes de continuar.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM dte_pendientes p
    JOIN ordenes o ON o.id = p.orden_id
    WHERE p.tenant_id <> o.tenant_id
  ) THEN
    RAISE EXCEPTION 'Existen dte_pendientes con tenant distinto al de su orden.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pagos p
    JOIN ordenes o ON o.id = p.orden_id
    WHERE p.tenant_id <> o.tenant_id
  ) THEN
    RAISE EXCEPTION 'Existen pagos con tenant distinto al de su orden.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ordenes_id_tenant') THEN
    ALTER TABLE ordenes ADD CONSTRAINT uq_ordenes_id_tenant UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dtes_orden_orden_tenant') THEN
    ALTER TABLE dtes_orden ADD CONSTRAINT fk_dtes_orden_orden_tenant
      FOREIGN KEY (orden_id, tenant_id) REFERENCES ordenes(id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dte_pendientes_orden_tenant') THEN
    ALTER TABLE dte_pendientes ADD CONSTRAINT fk_dte_pendientes_orden_tenant
      FOREIGN KEY (orden_id, tenant_id) REFERENCES ordenes(id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pagos_orden_tenant') THEN
    ALTER TABLE pagos ADD CONSTRAINT fk_pagos_orden_tenant
      FOREIGN KEY (orden_id, tenant_id) REFERENCES ordenes(id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dte_pendientes_payload_sin_secretos') THEN
    ALTER TABLE dte_pendientes ADD CONSTRAINT dte_pendientes_payload_sin_secretos
      CHECK (NOT (payload ? 'password_pri') AND NOT (payload ? 'passwordPri'));
  END IF;
END $$;

ALTER TABLE idempotency_keys
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_idempotency_tenant_key
  ON idempotency_keys(tenant_id, key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_tenant_key
  ON idempotency_keys(tenant_id, key)
  WHERE tenant_id IS NOT NULL;

-- Rollback en pruebas, después de retirar el código que usa estas restricciones:
-- ALTER TABLE pagos DROP CONSTRAINT IF EXISTS fk_pagos_orden_tenant;
-- ALTER TABLE dte_pendientes DROP CONSTRAINT IF EXISTS fk_dte_pendientes_orden_tenant;
-- ALTER TABLE dtes_orden DROP CONSTRAINT IF EXISTS fk_dtes_orden_orden_tenant;
-- ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS uq_ordenes_id_tenant;
-- ALTER TABLE dte_pendientes DROP CONSTRAINT IF EXISTS dte_pendientes_payload_sin_secretos;
-- DROP INDEX IF EXISTS uq_idempotency_tenant_key;
-- DROP INDEX IF EXISTS idx_idempotency_tenant_key;
-- ALTER TABLE idempotency_keys DROP COLUMN IF EXISTS tenant_id;
