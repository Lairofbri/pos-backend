-- =============================================
-- Migración 022: Bitácora de caja + permiso cuadre
-- POS Restaurante — El Salvador
-- =============================================
-- 1. Tabla bitacora_caja: registro de discrepancias
-- 2. Nuevo permiso caja.cuadre (solo admins/gerentes)

-- ─────────────────────────────────────────────
-- 1. Bitácora de discrepancias de caja
-- Guarda eventos de sobrante/faltante al cerrar caja
-- para auditoría y recálculo posterior
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bitacora_caja (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    caja_id         UUID NOT NULL,
    tipo_evento     VARCHAR(20) NOT NULL CHECK (tipo_evento IN ('sobrante', 'faltante')),
    total_esperado  NUMERIC(10,2) NOT NULL,
    monto_final     NUMERIC(10,2) NOT NULL,
    diferencia      NUMERIC(10,2) NOT NULL,
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (caja_id, tenant_id) REFERENCES cajas(id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_caja_tenant
    ON bitacora_caja(tenant_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_bitacora_caja_caja
    ON bitacora_caja(caja_id);

-- ─────────────────────────────────────────────
-- 2. Nuevo permiso: caja.cuadre
-- Permite ver el detalle completo de cuadre
-- (total esperado, diferencia, desglose)
-- Solo administradores y gerentes
-- ─────────────────────────────────────────────
INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    ('caja.cuadre', 'Ver cuadre de caja', 'Ver el detalle completo del cuadre de caja (totales esperados, diferencia, desglose por método de pago)', 'caja')
ON CONFLICT (codigo) DO NOTHING;

-- Asignar a permisos_default
INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
    ('administrador', 'caja.cuadre', 'true'),
    ('gerente',       'caja.cuadre', 'true')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- FIN DE MIGRACIÓN
-- ─────────────────────────────────────────────
