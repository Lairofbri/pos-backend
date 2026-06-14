-- =============================================
-- Migraci\u00f3n 016: Cat\u00e1logos del sistema
-- Tabla \u00fanica como fuente de verdad para valores
-- de selects, combos y etiquetas del frontend
-- Reemplaza los .valid() hardcodeados en Joi
-- =============================================

CREATE TABLE IF NOT EXISTS catalogos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    grupo      VARCHAR(50) NOT NULL,
    valor      VARCHAR(50) NOT NULL,
    label      VARCHAR(100) NOT NULL,
    orden      INTEGER DEFAULT 0,
    activo     BOOLEAN DEFAULT TRUE,
    UNIQUE(tenant_id, grupo, valor)
);

CREATE INDEX IF NOT EXISTS idx_catalogos_tenant_grupo
    ON catalogos(tenant_id, grupo, orden);

-- ─────────────────────────────────────────────
-- Sembrar catalogs para el tenant demo
-- ─────────────────────────────────────────────
INSERT INTO catalogos (tenant_id, grupo, valor, label, orden) VALUES
    -- Zonas de mesas
    ('a0000000-0000-0000-0000-000000000001', 'zonas', 'salon', 'Sal\u00f3n', 1),
    ('a0000000-0000-0000-0000-000000000001', 'zonas', 'bar', 'Bar', 2),
    ('a0000000-0000-0000-0000-000000000001', 'zonas', 'evento', 'Evento', 3),

    -- Tipos de documento de identidad
    ('a0000000-0000-0000-0000-000000000001', 'tipos_documento', 'dui', 'DUI', 1),
    ('a0000000-0000-0000-0000-000000000001', 'tipos_documento', 'nit', 'NIT', 2),
    ('a0000000-0000-0000-0000-000000000001', 'tipos_documento', 'pasaporte', 'Pasaporte', 3),
    ('a0000000-0000-0000-0000-000000000001', 'tipos_documento', 'carnet_residente', 'Carnet Residente', 4),

    -- M\u00e9todos de pago
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'efectivo', 'Efectivo', 1),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'tarjeta', 'Tarjeta', 2),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'mixto', 'Mixto', 3),

    -- Tipos de movimiento de caja
    ('a0000000-0000-0000-0000-000000000001', 'movimientos_tipo', 'ingreso', 'Ingreso', 1),
    ('a0000000-0000-0000-0000-000000000001', 'movimientos_tipo', 'retiro', 'Retiro', 2),
    ('a0000000-0000-0000-0000-000000000001', 'movimientos_tipo', 'deposito', 'Dep\u00f3sito', 3),

    -- Or\u00edgenes de pedido (delivery)
    ('a0000000-0000-0000-0000-000000000001', 'origenes_orden', 'pos', 'POS', 1),
    ('a0000000-0000-0000-0000-000000000001', 'origenes_orden', 'hugo', 'Hugo', 2),
    ('a0000000-0000-0000-0000-000000000001', 'origenes_orden', 'pedidosya', 'PedidosYa', 3),
    ('a0000000-0000-0000-0000-000000000001', 'origenes_orden', 'ubereats', 'Uber Eats', 4),
    ('a0000000-0000-0000-0000-000000000001', 'origenes_orden', 'whatsapp', 'WhatsApp', 5),
    ('a0000000-0000-0000-0000-000000000001', 'origenes_orden', 'telefono', 'Tel\u00e9fono', 6),
    ('a0000000-0000-0000-0000-000000000001', 'origenes_orden', 'otro', 'Otro', 7)
ON CONFLICT (tenant_id, grupo, valor) DO NOTHING;

-- ─────────────────────────────────────────────
-- Funci\u00f3n: obtener cat\u00e1logos agrupados
-- Uso: SELECT * FROM fn_catalogos(tenant_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_catalogos(p_tenant_id UUID)
RETURNS JSON
LANGUAGE SQL STABLE
AS $$
    SELECT COALESCE(
        jsonb_object_agg(grupo, items ORDER BY grupo),
        '{}'::jsonb
    )
    FROM (
        SELECT c.grupo, jsonb_agg(
            jsonb_build_object('valor', c.valor, 'label', c.label)
            ORDER BY c.orden, c.valor
        ) AS items
        FROM catalogos c
        WHERE c.tenant_id = p_tenant_id AND c.activo = TRUE
        GROUP BY c.grupo
    ) sub;
$$;

-- ─────────────────────────────────────────────
-- Procedimiento: sembrar cat\u00e1logos default para un tenant nuevo
-- Uso: CALL sp_sembrar_catalogos_tenant(tenant_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_sembrar_catalogos_tenant(p_tenant_id UUID)
LANGUAGE SQL
AS $$
    INSERT INTO catalogos (tenant_id, grupo, valor, label, orden)
    SELECT p_tenant_id, v.grupo, v.valor, v.label, v.orden
    FROM (VALUES
        ('zonas', 'salon', 'Sal\u00f3n', 1),
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
        ('movimientos_tipo', 'deposito', 'Dep\u00f3sito', 3),
        ('origenes_orden', 'pos', 'POS', 1),
        ('origenes_orden', 'hugo', 'Hugo', 2),
        ('origenes_orden', 'pedidosya', 'PedidosYa', 3),
        ('origenes_orden', 'ubereats', 'Uber Eats', 4),
        ('origenes_orden', 'whatsapp', 'WhatsApp', 5),
        ('origenes_orden', 'telefono', 'Tel\u00e9fono', 6),
        ('origenes_orden', 'otro', 'Otro', 7)
    ) AS v(grupo, valor, label, orden)
    ON CONFLICT (tenant_id, grupo, valor) DO NOTHING;
$$;

-- ─────────────────────────────────────────────
-- FIN DE MIGRACI\u00d3N
-- ─────────────────────────────────────────────
