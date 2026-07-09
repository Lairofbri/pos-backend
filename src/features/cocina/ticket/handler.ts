import type { Request, Response } from 'express';
import { getTicketTexto } from './service.js';
import { error, errorServidor } from '../../../shared/utils/response.js';
import { esUuidValido } from '../../../shared/middlewares/uuid.middleware.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  if (!esUuidValido(req.params.ordenId as string)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

  try {
    const texto = await getTicketTexto({
      tenantId: req.usuario!.tenant_id,
      ordenId: req.params.ordenId as string,
    });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(texto);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en cocina', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
