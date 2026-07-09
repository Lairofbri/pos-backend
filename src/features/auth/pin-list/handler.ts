import type { Request, Response } from 'express';
import { listarUsuariosParaPin } from '../shared.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { esUuidValido } from '../../../shared/middlewares/uuid.middleware.js';

export async function handler(req: Request, res: Response) {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;

  if (!tenantId) {
    return error(res, 'Header X-Tenant-Id requerido.', 400);
  }

  if (!esUuidValido(tenantId)) {
    return error(res, 'El header X-Tenant-Id no tiene un formato UUID válido.', 400);
  }

  try {
    const usuarios = await listarUsuariosParaPin({ tenantId });
    return exito(res, { usuarios });
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
