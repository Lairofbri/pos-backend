import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';
import { actualizarItemSchema } from './request.js';
import { actualizarItem } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en actualizar item', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }
  if (!esUuidValido(req.params.itemId)) {
    return error(res, 'El ID de item no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = actualizarItemSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const totales = await actualizarItem({
      tenantId: req.usuario!.tenant_id,
      ordenId: req.params.id as string,
      itemId: req.params.itemId as string,
      usuarioId: req.usuario!.id,
      datos: value,
    });
    return exito(res, totales, 'Item actualizado.');
  } catch (err) {
    return manejarError(res, err);
  }
};
