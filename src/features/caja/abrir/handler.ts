import type { Request, Response } from 'express';
import { abrirCaja } from './service.js';
import { abrirCajaSchema } from './request.js';
import { creado, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = abrirCajaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const caja = await abrirCaja({
      tenantId: req.usuario!.tenant_id,
      usuarioId: req.usuario!.id,
      datos: { ...value, sucursal_id: value.sucursal_id || req.sucursalId },
    });
    return creado(res, { caja }, 'Caja abierta exitosamente. Buen turno.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en caja', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
