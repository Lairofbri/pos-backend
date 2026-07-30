import type { Request, Response } from 'express';
import { exito, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerResumen } from './service.js';

export const handler = async (req: Request, res: Response) => {
  try {
    const resumen = await obtenerResumen({ tenantId: req.usuario!.tenant_id });
    return exito(res, resumen);
  } catch (err) {
    logger.error('Error al obtener resumen de inventario', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
};
