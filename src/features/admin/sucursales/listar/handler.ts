import type { Request, Response } from 'express';
import { exito, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { listarSucursales } from './service.js';

export const handler = async (req: Request, res: Response) => {
  try {
    const sucursales = await listarSucursales({ tenantId: req.usuario!.tenant_id });
    return exito(res, { sucursales });
  } catch (err) {
    logger.error('Error al listar sucursales', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
};
