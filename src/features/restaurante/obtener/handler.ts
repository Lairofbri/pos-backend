import type { Request, Response } from 'express';
import { exito, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerRestaurante } from './service.js';

export const handler = async (req: Request, res: Response) => {
  try {
    const restaurante = await obtenerRestaurante({ tenantId: req.usuario!.tenant_id });
    return exito(res, { restaurante });
  } catch (err) {
    logger.error('Error no controlado al obtener restaurante', {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    return errorServidor(res);
  }
};
