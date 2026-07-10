import type { Request, Response } from 'express';
import { crearUsuario } from '../../shared.js';
import { crearUsuarioSchema } from './request.js';
import { creado, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = crearUsuarioSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const usuario = await crearUsuario({
      tenantId: req.usuario!.tenant_id,
      datos: value,
    });
    return creado(res, { usuario }, 'Usuario creado exitosamente.');
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
