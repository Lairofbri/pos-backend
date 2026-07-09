import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';
import { obtenerMesa } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en obtener mesa', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de mesa no tiene un formato UUID válido.', 400);
  }

  try {
    const mesa = await obtenerMesa({
      tenantId: req.usuario!.tenant_id,
      mesaId: req.params.id as string,
    });
    return exito(res, { mesa });
  } catch (err) {
    return manejarError(res, err);
  }
};
