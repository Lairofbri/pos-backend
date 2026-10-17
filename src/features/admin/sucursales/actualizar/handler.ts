import type { Request, Response } from 'express';
import { error } from '../../../../shared/utils/response.js';
import { registrarIntentoEscrituraBloqueado, EVENTO_SUCURSAL_BLOQUEADA } from '../../../../shared/utils/auditoria.js';
import { MENSAJE_SUCURSAL_EDICION_SOLO_DTE } from '../../../../shared/empresa.js';

/**
 * PATCH /api/v1/sucursales/:id — BLOQUEADO (F2, 2026-10-16).
 *
 * La edición de sucursales (nombre, dirección, teléfono, principal, activo) se
 * administra en el DTE Service. El POS ya no modifica establecimientos.
 *
 * F5 (2026-10-16): la tabla local `sucursales` y su servicio de edición se
 * retiraron; esta ruta queda SOLO como error explícito y auditoría. Rollback:
 * recrear la tabla (ver bloque de rollback de la migración 081).
 */
export const handler = async (req: Request, res: Response) => {
  registrarIntentoEscrituraBloqueado({
    evento: EVENTO_SUCURSAL_BLOQUEADA,
    tenantId: req.usuario!.tenant_id,
    usuarioId: req.usuario!.id,
    metodo: req.method,
    ruta: req.originalUrl,
    campos: Object.keys((req.body ?? {}) as Record<string, unknown>),
    ip: req.ip,
  });

  return error(res, MENSAJE_SUCURSAL_EDICION_SOLO_DTE, 409);
};
