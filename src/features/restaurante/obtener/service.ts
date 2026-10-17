import { query } from '../../../shared/config/database.js';
import { servicioEmpresaDte } from '../../../shared/dte-empresa.js';

/**
 * GET /api/v1/restaurante — F3 (spec «DTE única fuente de verdad», 2026-10-16).
 *
 * La identidad/config de la EMPRESA ya NO se lee de la tabla local `tenants`:
 * sale del DTE Service (fuente de verdad). Del POS solo se agrega la
 * preferencia OPERATIVA `pos_default_mode` (decisión §7.3), que es lo único
 * que el POS sigue guardando de esta entidad.
 *
 * `logo_url`/`plan` los decidió el propietario como datos del DTE (§7.1/§7.2),
 * pero el contrato de F1 aún no los expone: se devuelven `null` hasta F6.
 */
export const obtenerRestaurante = async ({ tenantId }: { tenantId: string }) => {
  const empresa = await servicioEmpresaDte.obtenerEmpresa(tenantId);
  const configuracion = empresa.configuracion ?? null;

  // Único dato de `tenants` que sigue siendo del POS: la preferencia operativa.
  const { rows } = await query('SELECT pos_default_mode FROM tenants WHERE id = $1', [tenantId]);

  return {
    id: empresa.tenant?.id ?? tenantId,
    nombre: empresa.tenant?.nombre ?? null,
    nombre_comercial: empresa.tenant?.nombre_comercial ?? null,
    nit: empresa.tenant?.nit ?? null,
    nrc: empresa.tenant?.nrc ?? null,
    direccion: configuracion?.direccion ?? null,
    telefono: configuracion?.telefono ?? null,
    email: configuracion?.email ?? null,
    logo_url: null,
    plan: null,
    pos_default_mode: (rows[0] as { pos_default_mode?: string } | undefined)?.pos_default_mode ?? null,
    // Señales fiscales (sin secretos) para la pantalla de solo lectura de F4.
    codigo_actividad: configuracion?.codigo_actividad ?? null,
    desc_actividad: configuracion?.desc_actividad ?? null,
    ambiente: configuracion?.ambiente ?? null,
    tiene_credenciales_hacienda: configuracion?.tiene_credenciales_hacienda ?? false,
    password_firma_configurada: configuracion?.password_firma_configurada ?? false,
    provisioning_status: empresa.tenant?.provisioning_status ?? null,
    activo: empresa.tenant?.activo ?? null,
  };
};
