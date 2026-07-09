import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';
import { actualizarMesaSchema } from './request.js';
import { actualizarMesa } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un registro con ese valor.', 409);
  logger.error('Error no controlado en actualizar mesa', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de mesa no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = actualizarMesaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const mesa = await actualizarMesa({
      tenantId: req.usuario!.tenant_id,
      mesaId: req.params.id as string,
      datos: value,
    });
    return exito(res, { mesa }, 'Mesa actualizada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
