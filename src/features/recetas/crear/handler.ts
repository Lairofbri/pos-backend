import type { Request, Response } from 'express';
import { creado, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { crearRecetaSchema } from './request.js';
import { crearReceta } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en recetas', { error: (err as Error).message });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = crearRecetaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const receta = await crearReceta({
      tenantId: req.usuario!.tenant_id,
      datos: value,
    });
    return creado(res, { receta }, 'Receta creada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
