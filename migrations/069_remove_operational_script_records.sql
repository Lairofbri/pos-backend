-- Los scripts de limpieza son operaciones manuales, no migraciones.
-- El runner actual ya los excluye; se eliminan únicamente sus registros
-- históricos del control de migraciones para que el estado sea auditable.
DELETE FROM _migraciones
WHERE archivo IN ('clean-demo.sql', '999_limpiar_datos_pos.sql');
