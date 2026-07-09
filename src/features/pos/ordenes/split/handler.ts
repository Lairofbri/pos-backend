import type { Request, Response } from 'express';
import { creado, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';
import { splitOrdenSchema } from './request.js';
import { splitOrden } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en split orden', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = splitOrdenSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await splitOrden({
      tenantId: req.usuario!.tenant_id,
      usuarioId: req.usuario!.id,
      ordenId: req.params.id as string,
      datos: value,
    });
    return creado(res, resultado, 'Cuenta dividida exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
