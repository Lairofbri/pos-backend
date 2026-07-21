-- =============================================
-- Migración 036: Métodos de pago extendidos
-- Agrega soporte para transferencia, bitcoin,
-- monedero electrónico, cheque, tarjeta empresarial,
-- bonos, vales y otros métodos de pago
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Ampliar CHECK de pagos.metodo
-- ─────────────────────────────────────────────
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_check
  CHECK (metodo IN (
    'efectivo',
    'tarjeta',
    'tarjeta_debito',
    'tarjeta_credito',
    'mixto',
    'transferencia',
    'bitcoin',
    'monedero_electronico',
    'cheque',
    'tarjeta_empresarial',
    'bonos',
    'vales',
    'otro'
  ));

-- ─────────────────────────────────────────────
-- 2. Agregar columnas opcionales a pagos
-- ─────────────────────────────────────────────
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS referencia_transferencia VARCHAR(100),
  ADD COLUMN IF NOT EXISTS hash_bitcoin           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS wallet_id              VARCHAR(50),
  ADD COLUMN IF NOT EXISTS referencia_cheque      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS banco_emisor           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS descripcion_otro       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS monto_transferencia    NUMERIC(10,2) DEFAULT 0 CHECK (monto_transferencia >= 0),
  ADD COLUMN IF NOT EXISTS monto_bitcoin          NUMERIC(10,2) DEFAULT 0 CHECK (monto_bitcoin >= 0),
  ADD COLUMN IF NOT EXISTS monto_monedero         NUMERIC(10,2) DEFAULT 0 CHECK (monto_monedero >= 0),
  ADD COLUMN IF NOT EXISTS monto_cheque           NUMERIC(10,2) DEFAULT 0 CHECK (monto_cheque >= 0),
  ADD COLUMN IF NOT EXISTS monto_tarjeta_empresarial NUMERIC(10,2) DEFAULT 0 CHECK (monto_tarjeta_empresarial >= 0),
  ADD COLUMN IF NOT EXISTS monto_bonos            NUMERIC(10,2) DEFAULT 0 CHECK (monto_bonos >= 0),
  ADD COLUMN IF NOT EXISTS monto_vales            NUMERIC(10,2) DEFAULT 0 CHECK (monto_vales >= 0),
  ADD COLUMN IF NOT EXISTS monto_otro             NUMERIC(10,2) DEFAULT 0 CHECK (monto_otro >= 0);

-- ─────────────────────────────────────────────
-- 3. Ampliar CHECK de movimientos_caja.metodo_pago
-- ─────────────────────────────────────────────
ALTER TABLE movimientos_caja DROP CONSTRAINT IF EXISTS movimientos_caja_metodo_pago_check;
ALTER TABLE movimientos_caja ADD CONSTRAINT movimientos_caja_metodo_pago_check
  CHECK (metodo_pago IN (
    'efectivo',
    'tarjeta',
    'tarjeta_debito',
    'tarjeta_credito',
    'mixto',
    'transferencia',
    'bitcoin',
    'monedero_electronico',
    'cheque',
    'tarjeta_empresarial',
    'bonos',
    'vales',
    'otro'
  ));

-- ─────────────────────────────────────────────
-- 4. Agregar columnas de totales a cajas
-- ─────────────────────────────────────────────
ALTER TABLE cajas
  ADD COLUMN IF NOT EXISTS total_transferencia    NUMERIC(10,2) DEFAULT 0 CHECK (total_transferencia >= 0),
  ADD COLUMN IF NOT EXISTS total_bitcoin          NUMERIC(10,2) DEFAULT 0 CHECK (total_bitcoin >= 0),
  ADD COLUMN IF NOT EXISTS total_monedero         NUMERIC(10,2) DEFAULT 0 CHECK (total_monedero >= 0),
  ADD COLUMN IF NOT EXISTS total_cheque           NUMERIC(10,2) DEFAULT 0 CHECK (total_cheque >= 0),
  ADD COLUMN IF NOT EXISTS total_tarjeta_empresarial NUMERIC(10,2) DEFAULT 0 CHECK (total_tarjeta_empresarial >= 0),
  ADD COLUMN IF NOT EXISTS total_bonos            NUMERIC(10,2) DEFAULT 0 CHECK (total_bonos >= 0),
  ADD COLUMN IF NOT EXISTS total_vales            NUMERIC(10,2) DEFAULT 0 CHECK (total_vales >= 0),
  ADD COLUMN IF NOT EXISTS total_otros            NUMERIC(10,2) DEFAULT 0 CHECK (total_otros >= 0);

-- ─────────────────────────────────────────────
-- 5. Sembrar nuevos métodos en catálogo (tenant demo)
-- ─────────────────────────────────────────────
INSERT INTO catalogos (tenant_id, grupo, valor, label, orden) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'tarjeta_debito',       'Tarjeta Débito',       4),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'tarjeta_credito',      'Tarjeta Crédito',      5),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'transferencia',        'Transferencia',        6),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'bitcoin',              'Bitcoin',              7),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'monedero_electronico', 'Monedero Electrónico', 8),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'cheque',               'Cheque',               9),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'tarjeta_empresarial',  'Tarjeta Empresarial',  10),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'bonos',                'Bonos',                11),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'vales',                'Vales',                12),
    ('a0000000-0000-0000-0000-000000000001', 'metodos_pago', 'otro',                 'Otro',                 13)
ON CONFLICT (tenant_id, grupo, valor) DO NOTHING;

-- ─────────────────────────────────────────────
-- 6. Actualizar procedimiento sp_sembrar_catalogos_tenant
-- ─────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_sembrar_catalogos_tenant(p_tenant_id UUID)
LANGUAGE SQL
AS $$
    INSERT INTO catalogos (tenant_id, grupo, valor, label, orden)
    SELECT p_tenant_id, v.grupo, v.valor, v.label, v.orden
    FROM (VALUES
        ('zonas', 'salon', 'Salón', 1),
        ('zonas', 'bar', 'Bar', 2),
        ('zonas', 'evento', 'Evento', 3),
        ('tipos_documento', 'dui', 'DUI', 1),
        ('tipos_documento', 'nit', 'NIT', 2),
        ('tipos_documento', 'pasaporte', 'Pasaporte', 3),
        ('tipos_documento', 'carnet_residente', 'Carnet Residente', 4),
        ('metodos_pago', 'efectivo', 'Efectivo', 1),
        ('metodos_pago', 'tarjeta', 'Tarjeta', 2),
        ('metodos_pago', 'mixto', 'Mixto', 3),
        ('metodos_pago', 'tarjeta_debito', 'Tarjeta Débito', 4),
        ('metodos_pago', 'tarjeta_credito', 'Tarjeta Crédito', 5),
        ('metodos_pago', 'transferencia', 'Transferencia', 6),
        ('metodos_pago', 'bitcoin', 'Bitcoin', 7),
        ('metodos_pago', 'monedero_electronico', 'Monedero Electrónico', 8),
        ('metodos_pago', 'cheque', 'Cheque', 9),
        ('metodos_pago', 'tarjeta_empresarial', 'Tarjeta Empresarial', 10),
        ('metodos_pago', 'bonos', 'Bonos', 11),
        ('metodos_pago', 'vales', 'Vales', 12),
        ('metodos_pago', 'otro', 'Otro', 13),
        ('movimientos_tipo', 'ingreso', 'Ingreso', 1),
        ('movimientos_tipo', 'retiro', 'Retiro', 2),
        ('movimientos_tipo', 'deposito', 'Depósito', 3),
        ('origenes_orden', 'pos', 'POS', 1),
        ('origenes_orden', 'hugo', 'Hugo', 2),
        ('origenes_orden', 'pedidosya', 'PedidosYa', 3),
        ('origenes_orden', 'ubereats', 'Uber Eats', 4),
        ('origenes_orden', 'whatsapp', 'WhatsApp', 5),
        ('origenes_orden', 'telefono', 'Teléfono', 6),
        ('origenes_orden', 'otro', 'Otro', 7)
    ) AS v(grupo, valor, label, orden)
    ON CONFLICT (tenant_id, grupo, valor) DO NOTHING;
$$;

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
