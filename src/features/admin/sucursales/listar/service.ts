import { servicioEmpresaDte } from '../../../../shared/dte-empresa.js';

/**
 * F3 (spec «DTE única fuente de verdad», 2026-10-16): las sucursales del POS
 * son los establecimientos del DTE. El POS ya no lee su tabla local
 * `sucursales`: proxy directo a la ficha de empresa del DTE Service.
 */
export const listarSucursales = async ({ tenantId }: { tenantId: string }) =>
  servicioEmpresaDte.listarEstablecimientos(tenantId);
