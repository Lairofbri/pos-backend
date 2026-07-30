import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { desactivarReceta } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error al eliminar receta', { error: (err as Error).message });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  try {
    const resultado = await desactivarReceta({
      tenantId: req.usuario!.tenant_id,
      recetaId: req.params.id as string,
    });
    return exito(res, null, `Receta "${resultado.producto_nombre}" eliminada.`);
  } catch (err) {
    return manejarError(res, err);
  }
};
