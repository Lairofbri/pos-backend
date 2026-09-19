-- Estados fiscales y permisos requeridos por la integración POS <-> DTE Service.

ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_dte_estado_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_dte_estado_check
  CHECK (dte_estado IN ('pendiente', 'generado', 'firmado', 'transmitido', 'emitido', 'aceptado', 'rechazado', 'contingencia', 'anulado'));

ALTER TABLE dtes_orden DROP CONSTRAINT IF EXISTS dtes_orden_estado_check;
ALTER TABLE dtes_orden ADD CONSTRAINT dtes_orden_estado_check
  CHECK (estado IN ('pendiente', 'generado', 'firmado', 'transmitido', 'emitido', 'aceptado', 'rechazado', 'contingencia', 'anulado'));

INSERT INTO permisos (codigo, nombre, descripcion, modulo) VALUES
  ('dte.emitir', 'Emitir DTE', 'Emitir documentos tributarios electrónicos', 'dte'),
  ('restaurante.ver', 'Ver restaurante', 'Consultar la configuración del restaurante', 'restaurante'),
  ('restaurante.editar', 'Editar restaurante', 'Modificar la configuración del restaurante', 'restaurante'),
  ('promociones.ver', 'Ver promociones', 'Consultar promociones', 'promociones'),
  ('promociones.gestionar', 'Gestionar promociones', 'Crear, editar y desactivar promociones', 'promociones')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO permisos_default (rol, permiso_id, activo)
SELECT v.rol, p.id, TRUE
FROM (VALUES
  ('administrador', 'dte.emitir'),
  ('gerente', 'dte.emitir'),
  ('cajero', 'dte.emitir'),
  ('administrador', 'restaurante.ver'),
  ('administrador', 'restaurante.editar'),
  ('gerente', 'restaurante.ver'),
  ('administrador', 'promociones.ver'),
  ('administrador', 'promociones.gestionar'),
  ('gerente', 'promociones.ver'),
  ('gerente', 'promociones.gestionar')
) AS v(rol, codigo)
JOIN permisos p ON p.codigo = v.codigo
ON CONFLICT (rol, permiso_id) DO NOTHING;

INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
SELECT d.rol, d.permiso_id, t.id, d.activo
FROM permisos_default d
CROSS JOIN tenants t
JOIN permisos p ON p.id = d.permiso_id
WHERE p.codigo IN ('dte.emitir', 'restaurante.ver', 'restaurante.editar', 'promociones.ver', 'promociones.gestionar')
ON CONFLICT (rol, permiso_id, tenant_id) DO NOTHING;
