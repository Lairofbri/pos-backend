-- =============================================
-- Migraci\u00f3n 018: Corregir CHECK de usuarios.rol
-- Agrega gerente y cocinero a los roles permitidos
-- =============================================

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('administrador', 'cajero', 'mesero', 'gerente', 'cocinero'));

-- ─────────────────────────────────────────────
-- FIN DE MIGRACI\u00d3N
-- ─────────────────────────────────────────────
