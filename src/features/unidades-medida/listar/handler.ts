import type { Request, Response } from 'express';
import { exito, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { listarUnidades } from './service.js';

export const handler = async (req: Request, res: Response) => {
  try {
    const resultado = await listarUnidades({ tenantId: req.usuario!.tenant_id });
    return exito(res, resultado);
  } catch (err) {
    logger.error('Error al listar unidades de medida', { error: (err as Error).message });
    return errorServidor(res);
  }
};
