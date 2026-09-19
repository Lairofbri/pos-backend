-- Normaliza los seeds históricos que usaban un UUID de tenant distinto.
-- Se ejecuta después de las migraciones que todavía contienen esos valores.

DO $$
DECLARE
  tabla RECORD;
  restriccion RECORD;
BEGIN
  CREATE TEMP TABLE _tenant_fk_defs (
    tabla REGCLASS NOT NULL,
    nombre TEXT NOT NULL,
    definicion TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _tenant_fk_defs (tabla, nombre, definicion)
  SELECT c.conrelid::regclass, c.conname, pg_get_constraintdef(c.oid)
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%tenant_id%';

  FOR restriccion IN SELECT * FROM _tenant_fk_defs LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      restriccion.tabla,
      restriccion.nombre
    );
  END LOOP;

  FOR tabla IN
    SELECT DISTINCT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET tenant_id = $1 WHERE tenant_id = $2',
      tabla.table_schema,
      tabla.table_name
    ) USING
      'a0000000-0000-4000-8000-000000000001'::uuid,
      'a0000000-0000-0000-0000-000000000001'::uuid;
  END LOOP;

  FOR restriccion IN SELECT * FROM _tenant_fk_defs LOOP
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I %s',
      restriccion.tabla,
      restriccion.nombre,
      restriccion.definicion
    );
  END LOOP;
END $$;

DELETE FROM tenants
WHERE id = 'a0000000-0000-0000-0000-000000000001';
