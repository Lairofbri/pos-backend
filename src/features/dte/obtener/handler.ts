import type { Request, Response } from 'express';
import { obtener } from './service.js';
import { error, exito, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const codigoGeneracion = req.params.codigoGeneracion as string;
  if (!codigoGeneracion || codigoGeneracion.length < 10) {
    return error(res, 'El código de generación no es válido.', 400);
  }

  try {
    const dte = await obtener({
      tenantId: req.usuario!.tenant_id,
      codigoGeneracion,
    });
    return exito(res, dte);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en DTE obtener', { error: (err as Error).message, requestId: req.requestId });
    return errorServidor(res);
  }
}
