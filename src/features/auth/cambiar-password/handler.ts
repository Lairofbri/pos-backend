import type { Request, Response } from 'express';
import { cambiarPassword } from '../shared.js';
import { cambiarPasswordSchema } from './request.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = cambiarPasswordSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    await cambiarPassword({
      usuarioId: req.usuario!.id,
      tenantId: req.usuario!.tenant_id,
      passwordActual: value.password_actual,
      passwordNuevo: value.password_nuevo,
    });
    return exito(res, null, 'Contraseña actualizada exitosamente.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en auth', {
      error: (err as Error).message,
      stack: (err as Error).stack,
      requestId: req.requestId,
    });
    return errorServidor(res);
  }
}
