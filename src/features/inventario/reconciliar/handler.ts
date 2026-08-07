import type { Request, Response } from 'express';
import { exito, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { reconciliarStock } from './service.js';

export const handler = async (req: Request, res: Response) => {
  try {
    const resultado = await reconciliarStock({
      tenantId: req.usuario!.tenant_id,
    });
    return exito(res, resultado, resultado.conciliado ? 'Stock conciliado — sin divergencias.' : `Se encontraron ${resultado.total_divergencias} divergencias.`);
  } catch (err) {
    logger.error('Error al reconciliar stock', { error: (err as Error).message });
    return errorServidor(res);
  }
};
