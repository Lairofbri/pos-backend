import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { eliminarConteo } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error al eliminar conteo', { error: (err as Error).message });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  try {
    await eliminarConteo({
      sesionId: req.params.id as string,
      productoId: req.params.productoId as string,
      tenantId: req.usuario!.tenant_id,
    });
    return exito(res, null, 'Conteo eliminado.');
  } catch (err) {
    return manejarError(res, err);
  }
};
