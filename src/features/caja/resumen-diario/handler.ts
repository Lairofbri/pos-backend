import type { Request, Response } from 'express';
import { resumenDiario } from './service.js';
import { resumenDiarioSchema } from './request.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = resumenDiarioSchema.validate(req.query);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resumen = await resumenDiario({
      tenantId: req.usuario!.tenant_id,
      fecha: value.fecha || null,
      sucursalId: req.sucursalId,
    });
    return exito(res, { resumen });
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en caja', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
