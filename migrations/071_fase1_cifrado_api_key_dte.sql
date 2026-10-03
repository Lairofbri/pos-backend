-- Fase 1: almacenamiento seguro de la API Key técnica DTE en POS.
-- La API Key ya no vive en texto plano en tenants.dte_api_key de forma
-- permanente; el backfill la mueve a dte_api_key_enc cifrada (AES-256-GCM,
-- ver src/shared/utils/crypto.ts) y limpia el valor en claro.
-- El script idempotente scripts/cifrar-api-keys.ts realiza la migración.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS dte_api_key_enc TEXT;