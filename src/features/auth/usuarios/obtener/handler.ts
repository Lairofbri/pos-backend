import type { Request, Response } from 'express';
import { obtenerUsuario } from '../../shared.js';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';

export async function handler(req: Request, res: Response) {
  const id = req.params.id as string;

  if (!esUuidValido(id)) {
    return error(res, 'El ID de usuario no tiene un formato UUID válido.', 400);
  }

  try {
    const usuario = await obtenerUsuario({
      tenantId: req.usuario!.tenant_id,
      usuarioId: id,
    });
    return exito(res, { usuario });
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
