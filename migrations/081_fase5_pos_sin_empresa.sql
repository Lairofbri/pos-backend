-- =============================================
-- Migración 081: F5 — POS sin datos de empresa ni tabla `sucursales`
-- Spec: «DTE única fuente de verdad de empresa y sucursal (POS)» §4 F5.
--
-- El DTE Service es la ÚNICA fuente de verdad de EMPRESA (identidad + config
-- fiscal) y de SUCURSAL/establecimiento. Esta migración cierra la copia local:
--
--   1. Remapea `sucursal_id` de las tablas operativas al `establecimiento_id`
--      canónico del DTE (`sucursales.dte_establecimiento_id`, o `branch_id`
--      como respaldo). SIN FK entre bases distintas (migración 079).
--   2. Elimina las FK que atan las tablas operativas a `sucursales` y luego
--      DROP TABLE `sucursales`.
--   3. Retira de `tenants` las columnas de EMPRESA (identidad, códigos MH,
--      logo, plan, semáforo fiscal y URL del DTE). La fila de `tenants` queda
--      como espejo MÍNIMO de identidad técnica: `id`, `activo`, `creado_en`,
--      `actualizado_en`, `pos_default_mode`, `dte_api_key_enc`.
--   4. Elimina `dte_api_key` (texto plano). Se conserva `dte_api_key_enc`
--      (AES-256-GCM, decisión §7.4). Si hubiera claves sin cifrar la migración
--      FALLA (fail-closed) para no perder credenciales: ejecutar antes
--      `pnpm cifrar:api-keys`.
--
-- NOTAS:
-- - `nombre` y `nombre_comercial` son identidad de EMPRESA (razón social y
--   nombre comercial): también se retiran. El criterio de salida de F5 es "la
--   base del POS no tiene datos de empresa"; el login y los tickets toman esos
--   valores del DTE.
-- - `dte_service_url` se retira: la URL del DTE es infraestructura, no dato de
--   empresa, y se resuelve con `DTE_SERVICE_URL` (env).
-- - Independiente de `058b_normalize_demo_tenant`: acá las FK se descubren por
--   `pg_constraint` (no por nombre) y no se asume la normalización de ids del
--   demo; el remapeo usa la tabla `sucursales` viva, tal como esté.
-- - Idempotente: `IF EXISTS` / descubrimiento dinámico. Re-ejecutar es no-op.
-- - Todo el archivo corre en una sola transacción implícita: si algo falla, no
--   se aplica nada.
--
-- Rollback (manual, §6 del spec): recrear las columnas de `tenants` y la tabla
--   `sucursales`, y repoblar desde el DTE:
--   ALTER TABLE tenants
--     ADD COLUMN IF NOT EXISTS nombre VARCHAR(100) NOT NULL DEFAULT 'Empresa',
--     ADD COLUMN IF NOT EXISTS nombre_comercial VARCHAR(150),
--     ADD COLUMN IF NOT EXISTS nit VARCHAR(20) UNIQUE,
--     ADD COLUMN IF NOT EXISTS nrc VARCHAR(20) UNIQUE,
--     ADD COLUMN IF NOT EXISTS direccion VARCHAR(255),
--     ADD COLUMN IF NOT EXISTS telefono VARCHAR(20),
--     ADD COLUMN IF NOT EXISTS email VARCHAR(100),
--     ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
--     ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'basico',
--     ADD COLUMN IF NOT EXISTS cod_estable_mh VARCHAR(10),
--     ADD COLUMN IF NOT EXISTS cod_punto_venta_mh VARCHAR(10),
--     ADD COLUMN IF NOT EXISTS dte_service_url VARCHAR(255),
--     ADD COLUMN IF NOT EXISTS dte_api_key VARCHAR(255),
--     ADD COLUMN IF NOT EXISTS fiscal_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending_fiscal_setup',
--     ADD COLUMN IF NOT EXISTS last_fiscal_sync_at TIMESTAMPTZ;
--   -- `sucursales`: recrear con la migración 001 + 070 y repoblar desde la API
--   -- del DTE (`GET /internal/provisioning/tenants/:id/empresa`).
--   -- `sucursal_id`: volver a mapear establecimiento_id → sucursal local.
-- =============================================

-- =============================================
-- 1. Pre-flight: no perder API Keys en claro
-- =============================================
DO $$
DECLARE
  claves_planas INTEGER := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'dte_api_key'
  ) THEN
    SELECT count(*) INTO claves_planas
    FROM tenants
    WHERE dte_api_key IS NOT NULL AND btrim(dte_api_key) <> '';

    IF claves_planas > 0 THEN
      RAISE EXCEPTION
        'F5: % tenant(s) tienen dte_api_key en texto plano. Ejecutá `pnpm cifrar:api-keys` antes de aplicar esta migración (decisión §7.4).',
        claves_planas;
    END IF;
  END IF;
END $$;

-- =============================================
-- 2. Remapeo sucursal_id → establecimiento_id del DTE
-- =============================================
DO $$
DECLARE
  tabla TEXT;
  huerfanos INTEGER;
BEGIN
  IF to_regclass('public.sucursales') IS NULL THEN
    RAISE NOTICE 'F5: `sucursales` no existe — remapeo omitido (idempotente).';
    RETURN;
  END IF;

  -- Mapa local → canónico: el id del establecimiento del DTE; si la sucursal
  -- nunca se vinculó, se usa el `branch_id` compartido como respaldo.
  CREATE TEMP TABLE _f5_mapa ON COMMIT DROP AS
    SELECT id AS sucursal_id,
           COALESCE(dte_establecimiento_id, branch_id) AS establecimiento_id
    FROM sucursales;

  FOREACH tabla IN ARRAY ARRAY[
    'ordenes', 'cajas', 'mesas', 'usuarios',
    'movimientos_inventario', 'inventario_sesiones'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tabla AND column_name = 'sucursal_id'
    ) THEN
      RAISE NOTICE 'F5: % no tiene sucursal_id — omitida.', tabla;
      CONTINUE;
    END IF;

    -- Remapeo a la identidad canónica del DTE.
    EXECUTE format(
      'UPDATE %1$I x
          SET sucursal_id = m.establecimiento_id
         FROM _f5_mapa m
        WHERE x.sucursal_id = m.sucursal_id
          AND m.establecimiento_id IS NOT NULL
          AND x.sucursal_id <> m.establecimiento_id',
      tabla
    );

    -- Sucursal sin vínculo fiscal: no hay establecimiento canónico al que
    -- apuntar; se deja NULL (las operaciones degradan de forma explícita).
    EXECUTE format(
      'UPDATE %1$I x
          SET sucursal_id = NULL
         FROM _f5_mapa m
        WHERE x.sucursal_id = m.sucursal_id
          AND m.establecimiento_id IS NULL',
      tabla
    );
  END LOOP;

  -- Reporte de ids que no son ni sucursal local ni establecimiento canónico
  -- (dato corrupto/legado). No se tocan: la emisión los rechaza con 409.
  SELECT count(*) INTO huerfanos
  FROM (
    SELECT sucursal_id FROM ordenes
    UNION ALL SELECT sucursal_id FROM cajas
    UNION ALL SELECT sucursal_id FROM mesas
    UNION ALL SELECT sucursal_id FROM usuarios
    UNION ALL SELECT sucursal_id FROM movimientos_inventario
    UNION ALL SELECT sucursal_id FROM inventario_sesiones
  ) v
  WHERE v.sucursal_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM _f5_mapa m
      WHERE m.sucursal_id = v.sucursal_id OR m.establecimiento_id = v.sucursal_id
    );

  IF huerfanos > 0 THEN
    RAISE WARNING 'F5: % fila(s) con sucursal_id que no es sucursal local ni establecimiento canónico; revisar manualmente.', huerfanos;
  ELSE
    RAISE NOTICE 'F5: remapeo de sucursal_id → establecimiento_id completado.';
  END IF;
END $$;

-- =============================================
-- 3. Fuera las FK a `sucursales` y la tabla local
-- =============================================
DO $$
DECLARE
  restriccion RECORD;
BEGIN
  IF to_regclass('public.sucursales') IS NULL THEN
    RETURN;
  END IF;

  FOR restriccion IN
    SELECT c.conrelid::regclass::text AS tabla, c.conname
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'sucursales'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', restriccion.tabla, restriccion.conname);
    RAISE NOTICE 'F5: quitada FK % de %', restriccion.conname, restriccion.tabla;
  END LOOP;
END $$;

DROP TABLE IF EXISTS sucursales;

-- =============================================
-- 4. `tenants` = espejo mínimo de identidad técnica
-- =============================================
ALTER TABLE tenants
  -- Identidad de empresa (fuente: DTE)
  DROP COLUMN IF EXISTS nombre,
  DROP COLUMN IF EXISTS nombre_comercial,
  DROP COLUMN IF EXISTS nit,
  DROP COLUMN IF EXISTS nrc,
  DROP COLUMN IF EXISTS direccion,
  DROP COLUMN IF EXISTS telefono,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS plan,
  -- Códigos MH del emisor (fuente: DTE)
  DROP COLUMN IF EXISTS cod_estable_mh,
  DROP COLUMN IF EXISTS cod_punto_venta_mh,
  -- Semáforo fiscal de proyección (fuente: DTE)
  DROP COLUMN IF EXISTS fiscal_sync_status,
  DROP COLUMN IF EXISTS last_fiscal_sync_at,
  -- Integración (infra: env `DTE_SERVICE_URL`)
  DROP COLUMN IF EXISTS dte_service_url,
  -- Secreto en claro (decisión §7.4: solo `dte_api_key_enc`)
  DROP COLUMN IF EXISTS dte_api_key;

COMMENT ON TABLE tenants IS
  'Espejo mínimo de identidad técnica del tenant (id compartido con el DTE). Sin datos de empresa: el DTE es la única fuente de verdad (F5, migración 081).';

-- =============================================
-- FIN DE MIGRACIÓN
-- =============================================
