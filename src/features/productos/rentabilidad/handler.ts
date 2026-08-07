import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { rentabilidadSchema, evolucionSchema } from './request.js';
import { listarRentabilidad } from './service.js';
import { obtenerEvolucion } from './evolucion.service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en rentabilidad', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  return errorServidor(res);
};

export const rentabilidadHandler = async (req: Request, res: Response) => {
  const { error: validacionError, value: filtros } = rentabilidadSchema.validate(req.query);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await listarRentabilidad({
      tenantId: req.usuario!.tenant_id,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};

export const evolucionHandler = async (req: Request, res: Response) => {
  const { error: validacionError, value: filtros } = evolucionSchema.validate(req.query);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await obtenerEvolucion({
      tenantId: req.usuario!.tenant_id,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};
