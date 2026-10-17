import { servicioEmpresaDte } from '../../../../shared/dte-empresa.js';

/**
 * F3 (spec «DTE única fuente de verdad», 2026-10-16): la sucursal pedida por
 * el POS es un establecimiento del DTE. Se consulta la ficha de empresa al
 * DTE Service; si el establecimiento no pertenece al tenant → 404 (aislamiento).
 */
export const obtenerSucursal = async ({
  tenantId,
  sucursalId,
}: {
  tenantId: string;
  sucursalId: string;
}) => servicioEmpresaDte.obtenerEstablecimiento(tenantId, sucursalId);
