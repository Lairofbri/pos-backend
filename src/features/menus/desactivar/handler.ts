import type { Request, Response } from 'express';
import { desactivarMenu } from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  try {
    await desactivarMenu({
      tenantId: req.usuario!.tenant_id,
      menuId: req.params.id as string,
    });
    return exito(res, null, 'Menú desactivado exitosamente.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error en menús', { error: (err as Error).message });
    return errorServidor(res);
  }
}
