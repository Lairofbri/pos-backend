-- =============================================
-- Limpieza de datos demo para Restaurante Demo
-- Conserva: menus, usuarios, permisos, catalogos, unidades, tenants, sucursales
-- Elimina: todo dato transaccional/operativo
-- =============================================

BEGIN;

-- 1. Recetas
DELETE FROM receta_ingredientes WHERE receta_id IN (SELECT id FROM recetas WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001');
DELETE FROM recetas WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';

-- 2. Combos
DELETE FROM combo_productos WHERE combo_id IN (SELECT id FROM combos WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001');
DELETE FROM combos WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';

-- 3. Órdenes
DELETE FROM orden_items WHERE orden_id IN (SELECT id FROM ordenes WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001');
DELETE FROM pagos WHERE orden_id IN (SELECT id FROM ordenes WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001');
DELETE FROM dtes_orden WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';
DELETE FROM dte_pendientes WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';
DELETE FROM ordenes WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';

-- 4. Caja
DELETE FROM bitacora_caja WHERE caja_id IN (SELECT id FROM cajas WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001');
DELETE FROM movimientos_caja WHERE caja_id IN (SELECT id FROM cajas WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001');
DELETE FROM cajas WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';

-- 5. Inventario
DELETE FROM movimientos_inventario WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';
DELETE FROM inventario_conteos WHERE sesion_id IN (SELECT id FROM inventario_sesiones WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001');
DELETE FROM inventario_sesiones WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';

-- 6. Mesas y clientes
DELETE FROM mesas WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';
DELETE FROM clientes WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';

-- 7. Productos
DELETE FROM productos WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';

-- 8. Categorías (self-referencing FK)
UPDATE categorias SET parent_id = NULL WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';
DELETE FROM categorias WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';

-- 9. Extras
DELETE FROM impresoras WHERE tenant_id = 'a0000000-0000-4000-8000-000000000001';
DELETE FROM idempotency_keys;

COMMIT;
