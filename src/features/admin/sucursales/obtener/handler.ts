import type { Request, Response } from 'express';
import { obtenerSucursal } from './service.js';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';

export const handler = async (req: Request, res: Response) => {
  try {
    const sucursal = await obtenerSucursal({
      tenantId: req.usuario!.tenant_id,
      sucursalId: req.params.id as string,
    });
    return exito(res, { sucursal });
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error al obtener sucursal', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
};
