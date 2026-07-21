import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { listarMesas } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en listar mesas', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  try {
    const soloActivas = req.usuario!.rol !== 'administrador' || req.query.todas !== 'true';
    const mesas = await listarMesas({
      tenantId: req.usuario!.tenant_id,
      soloActivas,
      sucursalId: req.sucursalId,
    });
    return exito(res, { mesas });
  } catch (err) {
    return manejarError(res, err);
  }
};
