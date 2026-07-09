import type { Request, Response } from 'express';
import { listarUsuarios } from '../../shared.js';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  try {
    const usuarios = await listarUsuarios({ tenantId: req.usuario!.tenant_id });
    return exito(res, { usuarios });
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en auth', {
      error: (err as Error).message,
      stack: (err as Error).stack,
      requestId: req.requestId,
    });
    return errorServidor(res);
  }
}
