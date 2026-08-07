import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { esUuidValido } from '../../../shared/middlewares/uuid.middleware.js';
import { kardexSchema } from './request.js';
import { obtenerKardex } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en kardex', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const productoId = req.params.productoId as string;

  if (!productoId || !esUuidValido(productoId)) {
    return error(res, 'El parámetro productoId debe ser un UUID válido.', 400);
  }

  const { error: validacionError, value: filtros } = kardexSchema.validate(req.query);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await obtenerKardex({
      tenantId: req.usuario!.tenant_id,
      productoId,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};
