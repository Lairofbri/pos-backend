import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { actualizarRestauranteSchema } from './request.js';
import { actualizarRestaurante } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string; code?: string };
  if (e.code === '23505') return error(res, 'El NIT o NRC ya está registrado.', 409);
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado al actualizar restaurante', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = actualizarRestauranteSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const restaurante = await actualizarRestaurante({
      tenantId: req.usuario!.tenant_id,
      datos: value,
    });
    return exito(res, { restaurante }, 'Restaurante actualizado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
