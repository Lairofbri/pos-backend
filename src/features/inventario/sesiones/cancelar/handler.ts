import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { cancelarSesion } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error al cancelar sesión', { error: (err as Error).message });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  try {
    await cancelarSesion({
      sesionId: req.params.id as string,
      tenantId: req.usuario!.tenant_id,
    });
    return exito(res, null, 'Sesión cancelada.');
  } catch (err) {
    return manejarError(res, err);
  }
};
