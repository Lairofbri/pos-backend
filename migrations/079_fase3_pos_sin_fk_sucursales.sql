-- =============================================
-- Migración 079: F3 — POS sin FK a `sucursales`
-- Spec: «DTE única fuente de verdad de empresa y sucursal (POS)» §4 F3.
--
-- El DTE Service es la única fuente de verdad de sucursal/establecimiento y
-- las bases son DISTINTAS (POS ≠ DTE): no puede existir integridad referencial
-- POS → sucursales. Se eliminan las 6 FK que hoy atan las tablas operativas a
-- la tabla local `sucursales` (usuarios, mesas, ordenes, cajas,
-- movimientos_inventario, inventario_sesiones).
--
-- ALCANCE:
-- - Esta migración SOLO quita las restricciones (no toca datos ni columnas).
-- - El remapeo de `sucursal_id` al `establecimiento_id` del DTE y el
--   `DROP TABLE sucursales` se hacen en F5 (migración de datos con backup).
--
-- Es idempotente: si las FK ya no existen, no hace nada.
--
-- Rollback (manual, mientras exista la tabla `sucursales`):
--   ALTER TABLE usuarios              ADD CONSTRAINT usuarios_sucursal_id_fkey
--     FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE SET NULL;
--   ... (repetir para mesas, ordenes, cajas, movimientos_inventario,
--        inventario_sesiones; inventario usa RESTRICT por defecto).
-- =============================================

DO $$
DECLARE
  restriccion RECORD;
BEGIN
  -- F5 (migración 081) retira la tabla `sucursales`; re-ejecutar esta migración
  -- después de F5 no debe fallar (idempotencia entre entornos/estados).
  IF to_regclass('public.sucursales') IS NULL THEN
    RAISE NOTICE 'F3: `sucursales` no existe (retirada en F5) — nada que desligar.';
    RETURN;
  END IF;

  FOR restriccion IN
    SELECT c.conrelid::regclass::text AS tabla, c.conname
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'sucursales'::regclass
      AND c.conrelid::regclass::text IN (
        'usuarios', 'mesas', 'ordenes', 'cajas',
        'movimientos_inventario', 'inventario_sesiones'
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', restriccion.tabla, restriccion.conname);
    RAISE NOTICE 'F3: quitada FK % de %', restriccion.conname, restriccion.tabla;
  END LOOP;
END $$;

-- =============================================
-- FIN DE MIGRACIÓN
-- =============================================
