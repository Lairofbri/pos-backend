-- Migración 045: Tabla de idempotencia para proteger contra doble cobro en pagos
-- POST /ordenes/:id/pagar usa header Idempotency-Key para evitar pagos duplicados

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key         UUID PRIMARY KEY,
    endpoint    VARCHAR(150) NOT NULL,
    response    JSONB NOT NULL,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_creado_en ON idempotency_keys(creado_en);
