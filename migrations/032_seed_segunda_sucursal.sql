-- =============================================
-- Migración 032: Seed segunda sucursal demo
-- Agrega una segunda sucursal al Restaurante Demo
-- =============================================

INSERT INTO sucursales (id, tenant_id, nombre, direccion, telefono, es_principal)
SELECT
    'b0000000-0000-4000-8000-000000000002',
    id,
    'Sucursal Centro',
    'Av. Roosevelt 123, San Salvador',
    '2200-0000',
    FALSE
FROM tenants
WHERE id = 'a0000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM sucursales
    WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
      AND nombre = 'Sucursal Centro'
  )
ON CONFLICT DO NOTHING;

-- =============================================
-- FIN DE MIGRACIÓN
-- =============================================
