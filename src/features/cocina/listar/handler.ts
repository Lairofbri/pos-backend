import type { Request, Response } from 'express';
import { listarItemsActivos } from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  try {
    const soloPendientes = req.query.pendientes === 'true';
    const items = await listarItemsActivos({
      tenantId: req.usuario!.tenant_id,
      soloPendientes,
    });
    return exito(res, items);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en cocina', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
