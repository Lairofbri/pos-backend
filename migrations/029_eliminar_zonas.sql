-- =============================================
-- Migración 029: Eliminar sistema de zonas
-- Remueve la columna zona de mesas y los catálogos de zonas
-- Idempotente: puede ejecutarse múltiples veces
-- =============================================

-- 1. Eliminar columna zona de mesas (si existe)
ALTER TABLE mesas DROP COLUMN IF EXISTS zona;

-- 2. Eliminar catálogos de zonas
DELETE FROM catalogos WHERE grupo = 'zonas';

-- 3. Recrear la función fn_catalogos sin zonas (si aún referencia zonas)
-- Nota: PostgreSQL almacena funciones como objetos separados.
-- La función fn_catalogos probablemente devuelve todos los grupos de catalogos
-- dinámicamente, así que eliminar las filas de catalogos es suficiente.

-- 4. FIN
-- =============================================
