import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';
import { cambiarEstadoSchema } from './request.js';
import { cambiarEstadoOrden } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en cambiar estado', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = cambiarEstadoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    await cambiarEstadoOrden({
      tenantId: req.usuario!.tenant_id,
      ordenId: req.params.id as string,
      estado: value.estado,
      motivo: value.motivo,
      usuarioId: req.usuario!.id,
    });
    return exito(res, null, `Orden marcada como "${value.estado}".`);
  } catch (err) {
    return manejarError(res, err);
  }
};
