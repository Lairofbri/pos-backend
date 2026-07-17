import type { Request, Response } from 'express';
import { obtenerPorOrden } from './service.js';
import { error, exito, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handler(req: Request, res: Response) {
  const ordenId = req.params.ordenId as string;
  if (!UUID_REGEX.test(ordenId)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

  try {
    const dte = await obtenerPorOrden({
      tenantId: req.usuario!.tenant_id,
      ordenId,
    });
    return exito(res, dte);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en DTE obtener por orden', { error: (err as Error).message, requestId: req.requestId });
    return errorServidor(res);
  }
}
