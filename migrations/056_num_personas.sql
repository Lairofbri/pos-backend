-- =============================================
-- Migración 056: Número de personas por orden
-- =============================================

ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS num_personas INTEGER DEFAULT 1 CHECK (num_personas >= 1);
