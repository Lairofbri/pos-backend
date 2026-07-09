import type { Request, Response } from 'express';
import { desactivarCombo } from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  try {
    await desactivarCombo({ tenantId: req.usuario!.tenant_id, comboId: req.params.id as string });
    return exito(res, null, 'Combo desactivado exitosamente.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en combos', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
