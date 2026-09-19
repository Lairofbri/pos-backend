-- Migración 067: Infraestructura de alertas (#25, Fase 4)
-- Config por tenant, estado/historial por alerta y snapshot multi-instancia

-- 1. Config por tenant (umbrales + horario silencioso)
CREATE TABLE IF NOT EXISTS alertas_config (
    tenant_id          UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    tendencia_caida_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
    silencio_desde     TIME,
    silencio_hasta     TIME,
    cooldown_minutos   INTEGER NOT NULL DEFAULT 120,
    actualizado_en     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Estado/historial por alerta (dedupe + cooldown + leída/resuelta)
CREATE TABLE IF NOT EXISTS alertas_estado (
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    alerta_id          VARCHAR(50) NOT NULL,
    estado             VARCHAR(20) NOT NULL DEFAULT 'activa',
    silenciada_hasta   TIMESTAMPTZ,
    primera_deteccion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_deteccion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    veces_detectada    INTEGER NOT NULL DEFAULT 1,
    ultimo_titulo      VARCHAR(200),
    ultima_descripcion VARCHAR(500),
    ultima_severidad   VARCHAR(20),
    ultima_accion      JSONB,
    PRIMARY KEY (tenant_id, alerta_id)
);

-- 3. Snapshot de firma por tenant (dedupe multi-instancia)
CREATE TABLE IF NOT EXISTS alertas_snapshot (
    tenant_id    UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    firma        TEXT NOT NULL,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Seed de config para tenants existentes
INSERT INTO alertas_config (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 5. Permiso alertas.configurar (solo administrador)
INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
    ('alertas.configurar', 'Configurar alertas', 'Ajustar umbrales y horario silencioso de las alertas', 'reportes')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, v.activo::boolean
FROM (VALUES
    ('administrador', 'alertas.configurar', 'true')
) AS v(rol, codigo, activo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
SELECT d.rol, d.permiso_id, t.id, d.activo
FROM permisos_default d
CROSS JOIN tenants t
WHERE EXISTS (SELECT 1 FROM permisos p WHERE p.id = d.permiso_id AND p.codigo = 'alertas.configurar')
ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;