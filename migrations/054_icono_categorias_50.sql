-- =============================================
-- Migración 054: Ampliar icono VARCHAR(10) → VARCHAR(50) en categorías
-- =============================================

ALTER TABLE categorias ALTER COLUMN icono TYPE VARCHAR(50);
