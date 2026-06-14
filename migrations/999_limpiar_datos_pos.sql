-- =============================================
-- Script: Limpiar datos transaccionales del POS
-- Deja intactas las tablas de configuración:
--   tenants, sucursales, usuarios, refresh_tokens,
--   permisos, rol_permisos, menus
-- =============================================
-- Ejecutar con:
--   psql $DATABASE_URL -f migrations/999_limpiar_datos_pos.sql
--   node src/migrations/run.js  (lo ejecuta en orden alfabético)
-- =============================================
-- Orden de borrado respetando FK:
--   movimientos_caja → pagos → orden_items → combo_productos
--   → ordenes → combos → productos → categorias
--   → cajas → clientes → mesas
-- =============================================

BEGIN;

-- 1. Movimientos de caja (FK a cajas, ordenes, usuarios)
DELETE FROM movimientos_caja;

-- 2. Pagos (FK a ordenes, usuarios)
DELETE FROM pagos;

-- 3. Items de orden (FK a ordenes, productos)
DELETE FROM orden_items;

-- 4. Productos de combo (FK a combos, productos)
DELETE FROM combo_productos;

-- 5. Órdenes (FK a mesas, clientes, usuarios)
DELETE FROM ordenes;

-- 6. Combos
DELETE FROM combos;

-- 7. Productos (FK a categorias)
DELETE FROM productos;

-- 8. Categorías
DELETE FROM categorias;

-- 9. Cajas (FK a usuarios)
DELETE FROM cajas;

-- 10. Clientes
DELETE FROM clientes;

-- 11. Mesas (FK a sucursales)
DELETE FROM mesas;

COMMIT;
