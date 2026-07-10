import type { Request, Response } from 'express';
import { listarCombos } from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  try {
    const soloActivos = req.usuario!.rol !== 'administrador' || req.query.todas !== 'true';
    const combos = await listarCombos({ tenantId: req.usuario!.tenant_id, soloActivos });
    return exito(res, { combos });
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en combos', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
