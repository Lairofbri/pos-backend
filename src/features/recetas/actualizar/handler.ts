import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { actualizarRecetaSchema } from './request.js';
import { actualizarReceta } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en recetas', { error: (err as Error).message });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = actualizarRecetaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const receta = await actualizarReceta({
      tenantId: req.usuario!.tenant_id,
      recetaId: req.params.id as string,
      datos: value,
    });
    return exito(res, { receta }, 'Receta actualizada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
