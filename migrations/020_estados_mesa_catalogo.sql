-- =============================================
-- Migracion 020: Estados de mesa a catalogos
-- Mueve los valores del CHECK CONSTRAINT de mesas
-- a la tabla catalogos como fuente de verdad
-- =============================================

-- Demo tenant
INSERT INTO catalogos (tenant_id, grupo, valor, label, orden) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'estados_mesa', 'disponible', 'Disponible', 1),
    ('a0000000-0000-0000-0000-000000000001', 'estados_mesa', 'ocupada', 'Ocupada', 2),
    ('a0000000-0000-0000-0000-000000000001', 'estados_mesa', 'reservada', 'Reservada', 3),
    ('a0000000-0000-0000-0000-000000000001', 'estados_mesa', 'inactiva', 'Inactiva', 4)
ON CONFLICT (tenant_id, grupo, valor) DO NOTHING;

-- Actualizar procedimiento para nuevos tenants
CREATE OR REPLACE PROCEDURE sp_sembrar_catalogos_tenant(p_tenant_id UUID)
LANGUAGE SQL
AS $$
    INSERT INTO catalogos (tenant_id, grupo, valor, label, orden)
    SELECT p_tenant_id, v.grupo, v.valor, v.label, v.orden
    FROM (VALUES
        ('zonas', 'salon', 'Salon', 1),
        ('zonas', 'bar', 'Bar', 2),
        ('zonas', 'evento', 'Evento', 3),
        ('tipos_documento', 'dui', 'DUI', 1),
        ('tipos_documento', 'nit', 'NIT', 2),
        ('tipos_documento', 'pasaporte', 'Pasaporte', 3),
        ('tipos_documento', 'carnet_residente', 'Carnet Residente', 4),
        ('metodos_pago', 'efectivo', 'Efectivo', 1),
        ('metodos_pago', 'tarjeta', 'Tarjeta', 2),
        ('metodos_pago', 'mixto', 'Mixto', 3),
        ('movimientos_tipo', 'ingreso', 'Ingreso', 1),
        ('movimientos_tipo', 'retiro', 'Retiro', 2),
        ('movimientos_tipo', 'deposito', 'Deposito', 3),
        ('origenes_orden', 'pos', 'POS', 1),
        ('origenes_orden', 'hugo', 'Hugo', 2),
        ('origenes_orden', 'pedidosya', 'PedidosYa', 3),
        ('origenes_orden', 'ubereats', 'Uber Eats', 4),
        ('origenes_orden', 'whatsapp', 'WhatsApp', 5),
        ('origenes_orden', 'telefono', 'Telefono', 6),
        ('origenes_orden', 'otro', 'Otro', 7),
        ('tipos_orden', 'rapido', 'Rapido', 1),
        ('tipos_orden', 'mesa', 'Mesa', 2),
        ('tipos_orden', 'delivery', 'Delivery', 3),
        ('estados_orden', 'abierta', 'Abierta', 1),
        ('estados_orden', 'en_proceso', 'En Proceso', 2),
        ('estados_orden', 'lista', 'Lista', 3),
        ('estados_orden', 'entregada', 'Entregada', 4),
        ('estados_orden', 'pagada', 'Pagada', 5),
        ('estados_orden', 'cancelada', 'Cancelada', 6),
        ('estados_item', 'pendiente', 'Pendiente', 1),
        ('estados_item', 'en_proceso', 'En Proceso', 2),
        ('estados_item', 'listo', 'Listo', 3),
        ('estados_item', 'cancelado', 'Cancelado', 4),
        ('estados_caja', 'abierta', 'Abierta', 1),
        ('estados_caja', 'cerrada', 'Cerrada', 2),
        ('tipos_ajuste_stock', 'suma', 'Sumar', 1),
        ('tipos_ajuste_stock', 'resta', 'Restar', 2),
        ('tipos_ajuste_stock', 'absoluto', 'Fijar', 3),
        ('estados_mesa', 'disponible', 'Disponible', 1),
        ('estados_mesa', 'ocupada', 'Ocupada', 2),
        ('estados_mesa', 'reservada', 'Reservada', 3),
        ('estados_mesa', 'inactiva', 'Inactiva', 4)
    ) AS v(grupo, valor, label, orden)
    ON CONFLICT (tenant_id, grupo, valor) DO NOTHING;
$$;

-- =============================================
-- FIN DE MIGRACION
-- =============================================
