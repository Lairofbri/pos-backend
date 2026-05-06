-- =============================================
-- Migración 005: Caja y Movimientos
-- POS Restaurante — El Salvador
-- =============================================

-- ─────────────────────────────────────────────
-- TABLA: cajas
-- Representa un turno de caja
-- Una caja abierta = turno activo
-- Solo puede haber una caja abierta por sucursal
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cajas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sucursal_id     UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  -- Usuario que abrió la caja
  usuario_apertura_id UUID NOT NULL REFERENCES usuarios(id),
  -- Usuario que cerró la caja (puede ser diferente al que abrió)
  usuario_cierre_id   UUID REFERENCES usuarios(id),
  -- Estado del turno
  estado          VARCHAR(20) NOT NULL DEFAULT 'abierta'
                  CHECK (estado IN ('abierta', 'cerrada')),
  -- Montos
  monto_inicial   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monto_inicial >= 0),
  -- Total esperado al cierre = monto_inicial + ingresos - retiros
  total_esperado  NUMERIC(10,2) DEFAULT 0 CHECK (total_esperado >= 0),
  -- Monto contado físicamente al cerrar
  monto_final     NUMERIC(10,2) CHECK (monto_final >= 0),
  -- Diferencia entre contado y esperado (puede ser negativa)
  diferencia      NUMERIC(10,2) DEFAULT 0,
  -- Totales del turno para el reporte de cierre
  total_ventas    NUMERIC(10,2) DEFAULT 0 CHECK (total_ventas >= 0),
  total_efectivo  NUMERIC(10,2) DEFAULT 0 CHECK (total_efectivo >= 0),
  total_tarjeta   NUMERIC(10,2) DEFAULT 0 CHECK (total_tarjeta >= 0),
  total_retiros   NUMERIC(10,2) DEFAULT 0 CHECK (total_retiros >= 0),
  total_depositos NUMERIC(10,2) DEFAULT 0 CHECK (total_depositos >= 0),
  -- Notas del cierre
  notas_cierre    VARCHAR(500),
  -- Control de tiempo
  fecha_apertura  TIMESTAMPTZ DEFAULT NOW(),
  fecha_cierre    TIMESTAMPTZ,
  -- UNIQUE compuesto para FK tenant-safe en movimientos
  UNIQUE(id, tenant_id)
);

-- ─────────────────────────────────────────────
-- TABLA: movimientos_caja
-- Cada entrada o salida de dinero de la caja
-- Los pagos de órdenes también generan movimientos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_caja (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caja_id     UUID NOT NULL,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- FK compuesto tenant-safe
  FOREIGN KEY (caja_id, tenant_id)
    REFERENCES cajas(id, tenant_id)
    ON DELETE CASCADE,
  -- Tipo de movimiento
  tipo        VARCHAR(20) NOT NULL
              CHECK (tipo IN ('ingreso', 'retiro', 'deposito')),
  -- Monto siempre positivo — el tipo define la dirección
  monto       NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  -- Motivo del movimiento
  motivo      VARCHAR(255) NOT NULL,
  -- Usuario que registró el movimiento
  usuario_id  UUID NOT NULL REFERENCES usuarios(id),
  -- Orden asociada si el movimiento es un pago (opcional)
  orden_id    UUID REFERENCES ordenes(id) ON DELETE SET NULL,
  -- Método de pago si viene de una orden
  metodo_pago VARCHAR(20) CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'mixto')),
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cajas_tenant       ON cajas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cajas_estado       ON cajas(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_cajas_sucursal     ON cajas(sucursal_id, estado);
CREATE INDEX IF NOT EXISTS idx_cajas_fecha        ON cajas(tenant_id, fecha_apertura DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja   ON movimientos_caja(caja_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tenant ON movimientos_caja(tenant_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_orden  ON movimientos_caja(orden_id) WHERE orden_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha  ON movimientos_caja(caja_id, creado_en DESC);

-- Enforza a nivel de BD que solo puede haber una caja abierta por tenant/sucursal
-- Un índice único parcial solo aplica a las filas donde estado = 'abierta'
-- Cuando la caja se cierra (estado = 'cerrada') el índice ya no aplica
-- permitiendo abrir una nueva caja en la misma sucursal
CREATE UNIQUE INDEX IF NOT EXISTS idx_una_caja_abierta_por_sucursal
  ON cajas(tenant_id, sucursal_id)
  WHERE estado = 'abierta';

-- Para tenants sin sucursal definida (sucursal_id NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_una_caja_abierta_sin_sucursal
  ON cajas(tenant_id)
  WHERE estado = 'abierta' AND sucursal_id IS NULL;

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
