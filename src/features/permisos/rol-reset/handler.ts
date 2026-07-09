import type { Request, Response } from 'express';
import { resetearPermisosRol } from './service.js';
import { rolParamSchema } from './request.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = rolParamSchema.validate({ rol: req.params.rol as string });
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const permisos = await resetearPermisosRol({
      tenantId: req.usuario!.tenant_id,
      rol: value.rol,
    });
    return exito(res, permisos, 'Permisos reseteados a valores default.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en permisos', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
