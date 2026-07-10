import type { Request, Response } from 'express';
import { actualizarMenu } from './service.js';
import { actualizarMenuSchema } from './request.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = actualizarMenuSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const menu = await actualizarMenu({
      tenantId: req.usuario!.tenant_id,
      menuId: req.params.id as string,
      datos: value,
    });
    return exito(res, { menu }, 'Menú actualizado exitosamente.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error en menús', { error: (err as Error).message });
    return errorServidor(res);
  }
}
