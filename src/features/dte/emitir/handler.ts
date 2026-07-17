import type { Request, Response } from 'express';
import { emitir } from './service.js';
import { emitirDTESchema } from './request.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = emitirDTESchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await emitir({
      tenantId: req.usuario!.tenant_id,
      usuarioId: req.usuario!.id,
      datos: value,
    });
    return exito(res, resultado, 'DTE emitido exitosamente.', 201);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en DTE emitir', { error: (err as Error).message, requestId: req.requestId });
    return errorServidor(res);
  }
}
