import type { Request, Response } from 'express';
import { exito, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerReceta } from './service.js';

export const handler = async (req: Request, res: Response) => {
  try {
    const receta = await obtenerReceta({
      tenantId: req.usuario!.tenant_id,
      recetaId: req.params.id as string,
    });
    return exito(res, receta);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) {
      const { error } = await import('../../../shared/utils/response.js');
      return error(res, e.mensaje, e.status);
    }
    logger.error('Error al obtener receta', { error: (err as Error).message });
    return errorServidor(res);
  }
};
