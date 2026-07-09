import type { Request, Response } from 'express';
import { listarCatalogo } from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(_req: Request, res: Response) {
  try {
    const catalogo = await listarCatalogo();
    return exito(res, catalogo);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en permisos', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
