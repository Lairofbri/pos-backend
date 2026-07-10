import type { Request, Response } from 'express';
import { obtenerCatalogos } from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  try {
    const catalogos = await obtenerCatalogos({
      tenantId: req.usuario!.tenant_id,
    });
    return exito(res, catalogos);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error en catálogos', { error: (err as Error).message });
    return errorServidor(res);
  }
}
