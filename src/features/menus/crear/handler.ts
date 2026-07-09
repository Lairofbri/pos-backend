import type { Request, Response } from 'express';
import { crearMenu } from './service.js';
import { crearMenuSchema } from './request.js';
import { creado, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = crearMenuSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const menu = await crearMenu({
      tenantId: req.usuario!.tenant_id,
      datos: value,
    });
    return creado(res, { menu }, 'Menú creado exitosamente.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error en menús', { error: (err as Error).message });
    return errorServidor(res);
  }
}
