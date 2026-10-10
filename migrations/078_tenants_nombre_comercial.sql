-- =============================================
-- Migración 078: tenants.nombre_comercial (nombre de login/display)
--
-- Espejo de la migración DTE 032: la proyección POS del tenant distingue la
-- razón social fiscal (tenants.nombre) del nombre comercial con el que
-- aparece en el login (tenants.nombre_comercial) — ver spec §6.2 y avance
-- 2026-10-07.
-- =============================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS nombre_comercial VARCHAR(150);

UPDATE tenants
SET nombre_comercial = nombre
WHERE nombre_comercial IS NULL;

COMMENT ON COLUMN tenants.nombre_comercial IS
  'Nombre comercial (muestra en el selector de login). Si es NULL se usa tenants.nombre (razón social fiscal).';

-- =============================================
-- FIN DE MIGRACIÓN
-- =============================================