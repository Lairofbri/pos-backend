-- src/migrations/021_propina_ordenes.sql
-- Agrega columnas de propina a ordenes (independientes del total fiscal)
-- La propina NO se incluye en total/gravado/iva para cumplir con DTE Hacienda

ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS propina_porcentaje NUMERIC(5,2) DEFAULT 0
    CHECK (propina_porcentaje >= 0 AND propina_porcentaje <= 100),
  ADD COLUMN IF NOT EXISTS propina_monto NUMERIC(10,2) DEFAULT 0
    CHECK (propina_monto >= 0);
