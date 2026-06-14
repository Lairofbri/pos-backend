-- =============================================
-- Migración 014: Zona en mesas + Notas apertura caja
-- POS Restaurante — El Salvador
-- =============================================
-- Agrega campo zona a mesas para filtrar por área
-- (salón, terraza, barra, etc.) en pantalla POS.
-- Agrega campo notas_apertura a cajas para persistir
-- la nota que el frontend envía al abrir caja.
-- =============================================

ALTER TABLE mesas
  ADD COLUMN IF NOT EXISTS zona VARCHAR(50) NOT NULL DEFAULT 'salon';

ALTER TABLE cajas
  ADD COLUMN IF NOT EXISTS notas_apertura VARCHAR(500);
