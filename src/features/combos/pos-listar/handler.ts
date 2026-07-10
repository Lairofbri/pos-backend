import type { Request, Response } from 'express';
import { listarCombos } from '../listar/service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const tenantId = req.usuario?.tenant_id || req.headers['x-tenant-id'] as string | undefined;

  if (!tenantId) {
    return error(res, 'Header X-Tenant-Id requerido.', 400);
  }

  try {
    const combos = await listarCombos({ tenantId, soloActivos: true });
    return exito(res, { combos });
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error al listar combos para POS', {
      error: (err as Error).message,
      stack: (err as Error).stack,
      requestId: req.requestId,
    });
    return errorServidor(res);
  }
}
