import type { Request, Response } from 'express';
import { getCajaActiva } from './service.js';
import { esUuidValido } from '../../../shared/middlewares/uuid.middleware.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  let { sucursal_id } = req.query as { sucursal_id?: string };

  if (!sucursal_id && req.sucursalId) {
    sucursal_id = req.sucursalId;
  }

  if (sucursal_id && !esUuidValido(sucursal_id)) {
    return error(res, 'El parámetro sucursal_id no tiene un formato UUID válido.', 400);
  }

  try {
    const caja = await getCajaActiva({
      tenantId: req.usuario!.tenant_id,
      sucursalId: sucursal_id || null,
    });
    return exito(res, { caja });
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en caja', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
