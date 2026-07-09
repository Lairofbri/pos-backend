import type { Request, Response } from 'express';
import { actualizarPermisosRol } from './service.js';
import { rolParamSchema, actualizarPermisosSchema } from './request.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: rolError, value: rolValue } = rolParamSchema.validate({ rol: req.params.rol as string });
  if (rolError) return error(res, rolError.details[0].message, 400);

  const { error: bodyError, value: bodyValue } = actualizarPermisosSchema.validate(req.body);
  if (bodyError) return error(res, bodyError.details[0].message, 400);

  try {
    const permisos = await actualizarPermisosRol({
      tenantId: req.usuario!.tenant_id,
      rol: rolValue.rol,
      permisos: bodyValue.permisos,
    });
    return exito(res, permisos, 'Permisos actualizados exitosamente.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en permisos', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
