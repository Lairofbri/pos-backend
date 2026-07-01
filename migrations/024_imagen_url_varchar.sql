-- =============================================
-- Migración 024: Ampliar imagen_url a VARCHAR(1024)
-- Las URLs de Cloudflare R2 pueden ser largas con
-- paths multi-tenant: tenants/{uuid}/productos/{uuid}.webp
-- =============================================

ALTER TABLE productos
  ALTER COLUMN imagen_url TYPE VARCHAR(1024);
