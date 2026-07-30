import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerReceta } from '../obtener/service.js';
import { obtenerRecetaPorProducto } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error al obtener receta por producto', { error: (err as Error).message });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  try {
    const recetaId = await obtenerRecetaPorProducto({
      tenantId: req.usuario!.tenant_id,
      productoId: req.params.productoId as string,
    });

    if (!recetaId) {
      return error(res, 'Este producto no tiene una receta asociada.', 404);
    }

    const receta = await obtenerReceta({
      tenantId: req.usuario!.tenant_id,
      recetaId,
    });

    return exito(res, receta);
  } catch (err) {
    return manejarError(res, err);
  }
};
